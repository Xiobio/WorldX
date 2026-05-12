import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { editWithReferences } from "../models/image-client.mjs";
import { crop, getSize, resize, addCornerLabel } from "../utils/image-ops.mjs";
import { log, logError } from "../utils/logger.mjs";
import { reviewChunkEdges, MAX_REVIEW_RETRIES } from "./chunk-review.mjs";

const INDEPENDENT_CHUNKS = process.env.ZONE_INDEPENDENT_CHUNKS === "1";
const ADD_LABELS = process.env.ZONE_ADD_LABELS !== "0"; // default ON
const SKIP_EXISTING = process.env.ZONE_SKIP_EXISTING === "1";
const SKIP_EXISTING_DIR = process.env.ZONE_SKIP_EXISTING_DIR || "";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "../../prompts/chunk.md");

const CHUNK_W = 1536;
const CHUNK_H = 1024;

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Crop the overworld image to the grid cell occupied by this chunk.
 *
 * Overworld is 1024x1024, divided into rows×cols cells. We extract the
 * cell at (row, col) and resize to the chunk's 1536x1024 framing.
 */
async function cropOverworldCell(overworldBuf, row, col, rows, cols) {
  const owSize = await getSize(overworldBuf);
  const cellW = Math.floor(owSize.width / cols);
  const cellH = Math.floor(owSize.height / rows);
  const left = col * cellW;
  const top = row * cellH;
  // Clamp to image bounds
  const w = Math.min(cellW, owSize.width - left);
  const h = Math.min(cellH, owSize.height - top);
  const cellBuf = await crop(overworldBuf, { left, top, width: w, height: h });
  // Resize to a smaller reference (256x171 keeps aspect roughly 16:9 enough
  // for the model to read geometry without burning tokens)
  return resize(cellBuf, 384, 256);
}

function buildReferenceList(refs) {
  return refs.map((r, i) => `${i + 1}. ${r.label}`).join("\n");
}

function buildNeighborInstructions(neighbors) {
  if (neighbors.length === 0) {
    return "There are no already-generated neighbors yet. Just paint a chunk that could plausibly be tiled with similar chunks on every side.";
  }
  const parts = ["The following neighbor chunks have already been generated. Your edges must continue them seamlessly:"];
  for (const n of neighbors) {
    parts.push(`- Reference image ${n.refIndex + 1} is the ${n.direction} neighbor. Your ${n.myEdge} edge must continue out of its ${n.theirEdge} edge: terrain, color, and any roads/rivers must align pixel-by-pixel where they cross the seam.`);
  }
  return parts.join("\n");
}

/**
 * Generate one chunk.
 *
 * @returns {Promise<Buffer>} the chunk PNG
 */
async function generateOneChunk({
  chunk,
  zoneCfg,
  overworldBuf,
  styleAnchorBuf,
  generatedChunks, // map: chunkId → Buffer
}) {
  const { rows, cols, chunks } = zoneCfg.grid;

  // Build reference image list:
  //   1: overworld crop (geometry)
  //   2: style anchor
  //   3+: any already-generated neighbors (left, top, top-left in scan order)
  const overworldCrop = await cropOverworldCell(overworldBuf, chunk.row, chunk.col, rows, cols);
  const refs = [
    { buffer: overworldCrop, label: "OVERWORLD CROP — the geometric/semantic skeleton for THIS chunk. Roads, water, mountains, building zones must follow this layout (it is a colored blueprint, not the final art)." },
    { buffer: styleAnchorBuf, label: "STYLE ANCHOR — the exact look-and-feel (palette, brushwork, lighting) that this chunk MUST match. Treat it as a sample of the same painter's work." },
  ];

  const neighborMeta = [];
  if (!INDEPENDENT_CHUNKS) {
    // Scan-order generation: only previously-generated neighbors are available.
    // For a row-major scan, that's left and top neighbors.
    const directions = [
      { dx: -1, dy: 0, dir: "left", myEdge: "left", theirEdge: "right" },
      { dx: 0, dy: -1, dir: "top", myEdge: "top", theirEdge: "bottom" },
    ];
    for (const d of directions) {
      const nrow = chunk.row + d.dy;
      const ncol = chunk.col + d.dx;
      const neighbor = chunks.find((c) => c.row === nrow && c.col === ncol);
      if (!neighbor) continue;
      const nbuf = generatedChunks.get(neighbor.id);
      if (!nbuf) continue;
      const nDown = await resize(nbuf, 768, 512);
      refs.push({ buffer: nDown, label: `${d.dir.toUpperCase()} NEIGHBOR — already-generated chunk ${neighbor.id}. The ${d.theirEdge} edge of this image is what your ${d.myEdge} edge must continue from.` });
      neighborMeta.push({ refIndex: refs.length - 1, direction: d.dir, myEdge: d.myEdge, theirEdge: d.theirEdge });
    }
  }

  const tmpl = readFileSync(PROMPT_PATH, "utf-8");
  const prompt = fillTemplate(tmpl, {
    zoneStyleIdentity: zoneCfg.zoneIdentity,
    numReferences: String(refs.length),
    referenceList: buildReferenceList(refs),
    chunkId: chunk.id,
    row: String(chunk.row),
    col: String(chunk.col),
    rows: String(rows),
    cols: String(cols),
    chunkContent: chunk.content || "(no specific content; paint a generic transition area consistent with the zone)",
    allowedFlora: chunk.allowedFlora || "any local zone flora",
    forbiddenElements: chunk.forbiddenElements || "(none specified beyond zone constraints)",
    interactiveElements: (chunk.interactiveElements || []).map((e) => `${e.name}（${e.description}）`).join("；") || "none",
    neighborInstructions: buildNeighborInstructions(neighborMeta),
  });

  log("Z3", `gen chunk ${chunk.id} (${chunk.row},${chunk.col}) refs=${refs.length}`);
  const buf = await editWithReferences(prompt, refs.map((r) => r.buffer), {
    size: `${CHUNK_W}x${CHUNK_H}`,
  });
  return { buf, prompt, refs };
}

/**
 * Generate a chunk with review-retry: after the first attempt, ask vision LLM
 * whether the chunk's edges align with already-generated neighbors. If not,
 * inject the issues as additional constraints and regenerate (up to MAX_REVIEW_RETRIES).
 */
async function generateChunkWithReview({ chunk, zoneCfg, overworldBuf, styleAnchorBuf, generatedChunks }) {
  let lastBuf = null;
  let extraConstraints = "";
  let reviewLog = [];

  for (let attempt = 0; attempt <= MAX_REVIEW_RETRIES; attempt++) {
    const { buf } = await generateOneChunk({
      chunk: extraConstraints
        ? { ...chunk, content: `${chunk.content}\n\nADDITIONAL SEAM CONSTRAINTS (from previous attempt review):\n${extraConstraints}` }
        : chunk,
      zoneCfg,
      overworldBuf,
      styleAnchorBuf,
      generatedChunks,
    });
    lastBuf = buf;

    // Build neighbor pairs for review
    const directions = [
      { dir: "left", dx: -1, dy: 0 },
      { dir: "top", dx: 0, dy: -1 },
    ];
    const neighborPairs = [];
    for (const d of directions) {
      const nrow = chunk.row + d.dy;
      const ncol = chunk.col + d.dx;
      const neighbor = zoneCfg.grid.chunks.find((c) => c.row === nrow && c.col === ncol);
      if (!neighbor) continue;
      const nbuf = generatedChunks.get(neighbor.id);
      if (!nbuf) continue;
      neighborPairs.push({ direction: d.dir, neighborBuf: nbuf });
    }

    if (neighborPairs.length === 0) {
      log("Z3-review", `${chunk.id}: no generated neighbors yet, accepting attempt ${attempt + 1}`);
      return { buf, attempts: attempt + 1, reviewLog };
    }

    const review = await reviewChunkEdges(buf, neighborPairs);
    reviewLog.push({ attempt: attempt + 1, ...review });
    log("Z3-review", `${chunk.id} attempt ${attempt + 1}: ok=${review.ok} issues=${(review.issues || []).length}${review.skipped ? " (skipped)" : ""}`);

    if (review.ok || review.skipped || attempt === MAX_REVIEW_RETRIES) {
      return { buf, attempts: attempt + 1, reviewLog };
    }

    extraConstraints = review.issues.map((s) => `- ${s}`).join("\n");
  }

  return { buf: lastBuf, attempts: MAX_REVIEW_RETRIES + 1, reviewLog };
}

/**
 * Step Z3: Generate all chunks in row-major scan order.
 *
 * @param {object} zoneCfg
 * @param {Buffer} overworldBuf
 * @param {Buffer} styleAnchorBuf
 * @param {(name: string, buf: Buffer) => void} save - persist intermediate chunks
 * @returns {Promise<Map<string, Buffer>>}
 */
export async function generateChunkGrid(zoneCfg, overworldBuf, styleAnchorBuf, save) {
  log("Z3", "start", `chunks=${zoneCfg.grid.chunks.length}`);
  const ordered = [...zoneCfg.grid.chunks].sort(
    (a, b) => a.row - b.row || a.col - b.col,
  );
  const generated = new Map();
  const reviewMeta = {};
  for (const chunk of ordered) {
    const start = Date.now();
    // Skip if already generated (when SKIP_EXISTING is on)
    if (SKIP_EXISTING && SKIP_EXISTING_DIR) {
      const existingPath = join(SKIP_EXISTING_DIR, "chunks", `${chunk.id}.png`);
      if (existsSync(existingPath)) {
        const buf = readFileSync(existingPath);
        generated.set(chunk.id, buf);
        save(`chunks/${chunk.id}.png`, buf);
        log("Z3", `chunk ${chunk.id} REUSED from existing dir`);
        continue;
      }
    }
    try {
      let buf, attempts, reviewLog;
      if (INDEPENDENT_CHUNKS) {
        // Pure zone-graph mode: just generate, no review-retry.
        const result = await generateOneChunk({
          chunk, zoneCfg, overworldBuf, styleAnchorBuf, generatedChunks: generated,
        });
        buf = result.buf; attempts = 1; reviewLog = [];
      } else {
        const result = await generateChunkWithReview({
          chunk, zoneCfg, overworldBuf, styleAnchorBuf, generatedChunks: generated,
        });
        buf = result.buf; attempts = result.attempts; reviewLog = result.reviewLog;
      }
      // Save raw chunk first
      save(`chunks-raw/${chunk.id}.png`, buf);
      // Optionally apply top-left landmark label.
      const labelText = chunk.shortName || chunk.id;
      const finalBuf = ADD_LABELS ? await addCornerLabel(buf, labelText) : buf;
      generated.set(chunk.id, finalBuf);
      reviewMeta[chunk.id] = { attempts, reviewLog };
      save(`chunks/${chunk.id}.png`, finalBuf);
      log("Z3", `chunk ${chunk.id} done`, `bytes=${finalBuf.length}, t=${(Date.now() - start) / 1000}s, attempts=${attempts}`);
    } catch (e) {
      logError("Z3", e);
      log("Z3", `chunk ${chunk.id} FAILED — continuing`);
    }
  }
  return { chunkBufs: generated, reviewMeta };
}
