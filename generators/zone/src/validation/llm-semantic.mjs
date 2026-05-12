import sharp from "sharp";
import { log, logError } from "../utils/logger.mjs";

/**
 * Use the project's LLM-vision client to ask a multimodal model whether two
 * adjacent edge crops "describe the same continuous landscape".
 *
 * Returns { consistent: boolean, reason: string } per seam.
 */

function visionCfg() {
  return {
    BASE_URL: process.env.VISION_BASE_URL || process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    MODEL: process.env.VISION_MODEL || process.env.LLM_MODEL || "google/gemini-2.5-pro",
    API_KEY: process.env.VISION_API_KEY || process.env.LLM_API_KEY || "",
  };
}

async function judgePair(imgA, imgB, axis) {
  const { BASE_URL, MODEL, API_KEY } = visionCfg();
  const a = imgA.toString("base64");
  const b = imgB.toString("base64");
  const prompt = `You are evaluating whether two adjacent map tiles form a continuous landscape.

Image 1 is the ${axis === "vertical" ? "right edge of the left tile" : "bottom edge of the top tile"}.
Image 2 is the ${axis === "vertical" ? "left edge of the right tile" : "top edge of the bottom tile"}.

If a road, river, coastline, or terrain feature exits one image, the same feature must enter the other at the same height/x-position. Style (palette, brushwork, lighting) must also match.

Reply with strict JSON:
{"consistent": true|false, "reason": "<short reason>"}`;
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${a}` } },
          { type: "image_url", image_url: { url: `data:image/png;base64,${b}` } },
        ],
      }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(txt);
  } catch {
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { consistent: false, reason: "parse failed" };
  }
}

async function edgeStrip(buf, side, px = 64) {
  const meta = await sharp(buf).metadata();
  if (side === "right") {
    return sharp(buf).extract({ left: meta.width - px, top: 0, width: px, height: meta.height }).png().toBuffer();
  }
  if (side === "left") {
    return sharp(buf).extract({ left: 0, top: 0, width: px, height: meta.height }).png().toBuffer();
  }
  if (side === "top") {
    return sharp(buf).extract({ left: 0, top: 0, width: meta.width, height: px }).png().toBuffer();
  }
  if (side === "bottom") {
    return sharp(buf).extract({ left: 0, top: meta.height - px, width: meta.width, height: px }).png().toBuffer();
  }
  throw new Error("bad side");
}

export async function evaluateLLMSemantic(chunkBufs, gridChunks, { skipIfNoKey = true } = {}) {
  const { API_KEY, MODEL } = visionCfg();
  if (process.env.ZONE_SKIP_LLM_JUDGE === "1") {
    log("LLM-judge", "skipped (ZONE_SKIP_LLM_JUDGE=1)");
    return { skipped: true, results: [] };
  }
  if (skipIfNoKey && !API_KEY) {
    log("LLM-judge", "skipped (no VISION_API_KEY/LLM_API_KEY)");
    return { skipped: true, results: [] };
  }
  log("LLM-judge", `start with model ${MODEL}`);
  const MAX_CONSECUTIVE_ERRORS = 3;
  let consecutiveErrors = 0;
  const byPos = new Map();
  for (const c of gridChunks) byPos.set(`${c.row},${c.col}`, c);

  const results = [];
  let aborted = false;
  for (const c of gridChunks) {
    if (aborted) break;
    const buf = chunkBufs.get(c.id);
    if (!buf) continue;
    const right = byPos.get(`${c.row},${c.col + 1}`);
    if (right && chunkBufs.has(right.id)) {
      try {
        const a = await edgeStrip(buf, "right");
        const b = await edgeStrip(chunkBufs.get(right.id), "left");
        const judgment = await judgePair(a, b, "vertical");
        results.push({ from: c.id, to: right.id, type: "vertical", ...judgment });
        consecutiveErrors = 0;
      } catch (e) {
        logError("LLM-judge", e);
        results.push({ from: c.id, to: right.id, type: "vertical", consistent: false, reason: `judge failed: ${e.message}` });
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          log("LLM-judge", `aborting after ${consecutiveErrors} consecutive errors`);
          aborted = true;
          break;
        }
      }
    }
    if (aborted) break;
    const bottom = byPos.get(`${c.row + 1},${c.col}`);
    if (bottom && chunkBufs.has(bottom.id)) {
      try {
        const a = await edgeStrip(buf, "bottom");
        const b = await edgeStrip(chunkBufs.get(bottom.id), "top");
        const judgment = await judgePair(a, b, "horizontal");
        results.push({ from: c.id, to: bottom.id, type: "horizontal", ...judgment });
        consecutiveErrors = 0;
      } catch (e) {
        logError("LLM-judge", e);
        results.push({ from: c.id, to: bottom.id, type: "horizontal", consistent: false, reason: `judge failed: ${e.message}` });
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          log("LLM-judge", `aborting after ${consecutiveErrors} consecutive errors`);
          aborted = true;
          break;
        }
      }
    }
  }
  const passing = results.filter((r) => r.consistent).length;
  return { skipped: false, results, passing, total: results.length };
}
