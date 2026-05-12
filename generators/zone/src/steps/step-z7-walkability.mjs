/**
 * Step Z7 — per-chunk walkability.
 *
 * For each chunk: ask gpt-image-2 to paint cyan over walkable surfaces, compute
 * a tile-resolution walkable grid from the diff, and build a Tiled-format TMJ
 * file so the chunk can be loaded by the WorldX game runtime.
 *
 * Reuses generators/map's:
 *   - prompts/step4-walkable-generation.md
 *   - utils/image-utils.computeWalkableGrid + cleanupGrid
 *   - utils/tmj-builder.buildTMJ
 */

import sharp from "sharp";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { editWithReferences } from "../models/image-client.mjs";
import { log, logError } from "../utils/logger.mjs";
import { resize, getSize } from "../utils/image-ops.mjs";
import { computeWalkableGrid, cleanupGrid } from "../../../map/src/utils/image-utils.mjs";
import { buildTMJ } from "../../../map/src/utils/tmj-builder.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Allow overriding both the prompt and the output subdirectory via env vars,
// so we can run multiple walkability generations side-by-side for comparison
// without polluting each other.
const WALKABLE_PROMPT_NAME = process.env.ZONE_WALKABLE_PROMPT || "step4-walkable-generation.md";
const WALKABLE_PROMPT_PATH = join(__dirname, "../../../map/prompts", WALKABLE_PROMPT_NAME);
const WALKABLE_OUT_DIR = process.env.ZONE_WALKABLE_DIR || "walkable";

const CHUNK_W = 1536;
const CHUNK_H = 1024;
const TILE_SIZE = 16;

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function buildWalkablePrompt(chunk) {
  const tmpl = readFileSync(WALKABLE_PROMPT_PATH, "utf-8");
  const elementSummary = (chunk.interactiveElements || [])
    .map((e) => `- ${e.name}：${e.description || ""}`)
    .join("\n") || "（无）";
  return fillTemplate(tmpl, {
    userPrompt: chunk.content || "",
    mapPlanSummary: `场景：${chunk.shortName || chunk.id}`,
    regionSummary: elementSummary,
    additionalInstructions: "",
  });
}

/**
 * Generate walkable mask for one chunk.
 *
 * @param {Buffer} chunkBuf - the raw chunk image (without label, ideally)
 * @param {object} chunk    - chunk config entry
 * @returns {Promise<Buffer>} the cyan-marked PNG (same dimensions as input, downsized to 1024w then back is fine)
 */
async function generateWalkableMask(chunkBuf, chunk) {
  const prompt = buildWalkablePrompt(chunk);
  // Step 4 in the original pipeline downscales to 1024 width before editing,
  // for token economy. We do the same.
  const { width: srcW } = await getSize(chunkBuf);
  const inputBuf = srcW > 1024 ? await resize(chunkBuf, 1024, Math.round(1024 * CHUNK_H / CHUNK_W)) : chunkBuf;
  return editWithReferences(prompt, [inputBuf], { size: "1536x1024" });
}

/**
 * Z7 main: per-chunk walkability generation.
 *
 * @param {Map<string, Buffer>} chunkBufsLabeled - labeled chunks (have corner badges)
 * @param {object} zoneCfg
 * @param {string} runDir - root run directory; raw chunks live in runDir/chunks-raw
 * @param {(name: string, data: any) => void} save
 */
export async function generateWalkability(chunkBufsLabeled, zoneCfg, runDir, save) {
  log("Z7", `walkability for ${zoneCfg.grid.chunks.length} chunks`);
  const z7Log = [];

  for (const chunk of zoneCfg.grid.chunks) {
    const start = Date.now();
    // Skip already-processed chunks for resumability
    const tmjPath = join(runDir, WALKABLE_OUT_DIR, `${chunk.id}.tmj`);
    if (existsSync(tmjPath)) {
      log("Z7", `${chunk.id} REUSED (TMJ already exists)`);
      z7Log.push({ id: chunk.id, ok: true, reused: true });
      continue;
    }

    // Use the RAW chunk (no label) for walkable detection so the dark badge
    // doesn't get marked as "wall".
    const rawPath = join(runDir, "chunks-raw", `${chunk.id}.png`);
    if (!existsSync(rawPath)) {
      log("Z7", `${chunk.id} SKIP: no raw chunk at ${rawPath}`);
      z7Log.push({ id: chunk.id, ok: false, error: "no raw chunk" });
      continue;
    }
    const rawBuf = readFileSync(rawPath);

    try {
      // 1) Generate walkable mask
      const markedBuf = await generateWalkableMask(rawBuf, chunk);
      save(`${WALKABLE_OUT_DIR}/${chunk.id}-marked.png`, markedBuf);

      // 2) Compute walkable grid
      const { width: srcW, height: srcH } = await getSize(rawBuf);
      const { grid: rawGrid, gridWidth, gridHeight } = await computeWalkableGrid(
        rawBuf,
        markedBuf,
        TILE_SIZE,
        srcW,
      );
      const grid = cleanupGrid(rawGrid);
      const walkableCount = grid.flat().filter((v) => v === 0).length;
      const totalCells = gridWidth * gridHeight;

      save(`${WALKABLE_OUT_DIR}/${chunk.id}-grid.json`, JSON.stringify({ gridWidth, gridHeight, grid }, null, 2));

      // 3) Build TMJ
      const interactiveObjects = (chunk.interactiveElements || []).map((e, i) => ({
        id: `${chunk.id}_e${i}`,
        name: e.name,
        topLeft: { x: 100 + i * 100, y: 100 + i * 100 }, // placeholder positions
        bottomRight: { x: 200 + i * 100, y: 200 + i * 100 },
        suggestedInteractions: [],
      }));

      const regions = [{
        id: chunk.id,
        name: chunk.shortName || chunk.id,
        description: chunk.content || "",
        type: chunk.kind === "landmark" ? "landmark" : "transition",
        topLeft: { x: 0, y: 0 },
        bottomRight: { x: gridWidth * TILE_SIZE, y: gridHeight * TILE_SIZE },
        actions: [],
        adjacentRegions: [],
      }];

      const tmj = buildTMJ({
        gridWidth,
        gridHeight,
        tileSize: TILE_SIZE,
        collisionGrid: grid,
        regions,
        interactiveObjects,
        backgroundImage: `../chunks/${chunk.id}.png`,
      });
      save(`${WALKABLE_OUT_DIR}/${chunk.id}.tmj`, JSON.stringify(tmj, null, 2));

      const t = (Date.now() - start) / 1000;
      log("Z7", `${chunk.id} ok`, `walkable=${walkableCount}/${totalCells} (${(walkableCount * 100 / totalCells).toFixed(1)}%) t=${t.toFixed(1)}s`);
      z7Log.push({ id: chunk.id, ok: true, walkable: walkableCount, total: totalCells, t });
    } catch (e) {
      logError("Z7", e);
      z7Log.push({ id: chunk.id, ok: false, error: e.message });
    }
  }

  return z7Log;
}
