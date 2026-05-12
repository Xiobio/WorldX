/**
 * Per-chunk visual review using a vision LLM.
 *
 * After a chunk is freshly generated, this asks gpt-5.5 (via cliproxy) to
 * compare its edges against the already-generated neighbors. If the verdict
 * is "discontinuous", we extract the specific issues and feed them back as
 * additional prompt constraints for a regeneration.
 *
 * Cap at MAX_RETRIES to avoid burning the day on a stubborn chunk.
 */

import sharp from "sharp";
import { log, logError } from "../utils/logger.mjs";

const MAX_REVIEW_RETRIES = parseInt(process.env.ZONE_CHUNK_REVIEW_RETRIES || "1", 10);

function visionCfg() {
  return {
    BASE_URL: process.env.VISION_BASE_URL || process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    MODEL: process.env.VISION_MODEL || process.env.LLM_MODEL || "google/gemini-2.5-pro",
    API_KEY: process.env.VISION_API_KEY || process.env.LLM_API_KEY || "",
  };
}

async function edge(buf, side, px = 96) {
  const meta = await sharp(buf).metadata();
  if (side === "right") return sharp(buf).extract({ left: meta.width - px, top: 0, width: px, height: meta.height }).png().toBuffer();
  if (side === "left")  return sharp(buf).extract({ left: 0, top: 0, width: px, height: meta.height }).png().toBuffer();
  if (side === "top")   return sharp(buf).extract({ left: 0, top: 0, width: meta.width, height: px }).png().toBuffer();
  if (side === "bottom")return sharp(buf).extract({ left: 0, top: meta.height - px, width: meta.width, height: px }).png().toBuffer();
  throw new Error("bad side: " + side);
}

/**
 * Ask the vision LLM whether `chunkBuf`'s edges align with already-generated
 * neighbors. Returns { ok: boolean, issues: string[] }.
 *
 * @param {Buffer} chunkBuf
 * @param {{direction: 'left'|'top', neighborBuf: Buffer}[]} neighborPairs
 */
export async function reviewChunkEdges(chunkBuf, neighborPairs) {
  if (neighborPairs.length === 0) return { ok: true, issues: [] };
  const { BASE_URL, MODEL, API_KEY } = visionCfg();
  if (!API_KEY) return { ok: true, issues: [], skipped: true };

  // Build the comparison images: for each neighbor pair, two facing edge strips.
  const blobs = [];
  const captions = [];
  for (let i = 0; i < neighborPairs.length; i++) {
    const { direction, neighborBuf } = neighborPairs[i];
    let myEdge, theirEdge, axis;
    if (direction === "left") {
      myEdge = await edge(chunkBuf, "left", 96);
      theirEdge = await edge(neighborBuf, "right", 96);
      axis = "vertical";
    } else if (direction === "top") {
      myEdge = await edge(chunkBuf, "top", 96);
      theirEdge = await edge(neighborBuf, "bottom", 96);
      axis = "horizontal";
    } else {
      continue;
    }
    blobs.push({ kind: "neighbor", buf: theirEdge });
    blobs.push({ kind: "self", buf: myEdge });
    captions.push({ idx: blobs.length - 2, role: `neighbor (${direction}) outer edge`, axis });
    captions.push({ idx: blobs.length - 1, role: `THIS chunk inner edge facing the neighbor`, axis });
  }

  const userText = `You are auditing whether a freshly-generated map tile aligns with its already-generated neighbors.

You will receive ${blobs.length} small edge strips, in pairs:
${captions.map((c) => `- Image ${c.idx + 1}: ${c.role}`).join("\n")}

For each pair (neighbor edge, self edge), check:
1. **Geometry**: if a road, river, coastline, or path exits one edge, the same feature must enter the other at roughly the same y-position (vertical seams) or x-position (horizontal seams). Tolerance: ~80 pixels.
2. **Style**: palette and brushwork should be visually similar.
3. **Terrain class**: forest meets forest, road meets road, water meets water.

Return strict JSON of the form:
{
  "ok": true | false,
  "issues": [<short specific issue strings, one per problem>]
}

Mark "ok": true ONLY if every pair is broadly consistent. If any pair has a clearly broken feature, mark false and list the issue.`;

  const content = [{ type: "text", text: userText }];
  for (const b of blobs) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${b.buf.toString("base64")}` },
    });
  }

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      logError("chunk-review", new Error(`vision ${res.status}: ${err.slice(0, 200)}`));
      return { ok: true, issues: [], skipped: true, error: `${res.status}` };
    }
    const data = await res.json();
    const txt = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { ok: true, issues: [] };
    }
    return { ok: !!parsed.ok, issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
  } catch (e) {
    logError("chunk-review", e);
    return { ok: true, issues: [], skipped: true };
  }
}

export { MAX_REVIEW_RETRIES };
