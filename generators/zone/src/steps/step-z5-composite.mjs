import { composite, annotate, getSize, resize } from "../utils/image-ops.mjs";
import { log } from "../utils/logger.mjs";

const CHUNK_W = 1536;
const CHUNK_H = 1024;

/**
 * Tile chunks into a single composite image at full chunk resolution.
 * For a 3x3 zone that's 4608x3072, written as a PNG.
 */
export async function buildComposite(chunkBufs, zoneCfg, { annotated = false } = {}) {
  const { rows, cols, chunks } = zoneCfg.grid;
  const tiles = [];
  for (const c of chunks) {
    let buf = chunkBufs.get(c.id);
    if (!buf) continue;
    // Some models return slightly different sizes; force to canonical chunk size.
    const sz = await getSize(buf);
    if (sz.width !== CHUNK_W || sz.height !== CHUNK_H) {
      buf = await resize(buf, CHUNK_W, CHUNK_H);
    }
    if (annotated) {
      buf = await annotate(buf, `${c.id} (r${c.row},c${c.col})`);
    }
    tiles.push({ buffer: buf, x: c.col * CHUNK_W, y: c.row * CHUNK_H });
  }
  log("Z5", `composite ${tiles.length} chunks → ${cols * CHUNK_W}x${rows * CHUNK_H}`);
  return composite(cols * CHUNK_W, rows * CHUNK_H, tiles);
}

/** Smaller preview composite for fast inspection (one-third resolution). */
export async function buildPreview(chunkBufs, zoneCfg) {
  const { rows, cols, chunks } = zoneCfg.grid;
  const PREVIEW_W = 512;
  const PREVIEW_H = Math.round(PREVIEW_W * (CHUNK_H / CHUNK_W));
  const tiles = [];
  for (const c of chunks) {
    const buf = chunkBufs.get(c.id);
    if (!buf) continue;
    const small = await resize(buf, PREVIEW_W, PREVIEW_H);
    const labeled = await annotate(small, `${c.id} (r${c.row},c${c.col})`);
    tiles.push({ buffer: labeled, x: c.col * PREVIEW_W, y: c.row * PREVIEW_H });
  }
  return composite(cols * PREVIEW_W, rows * PREVIEW_H, tiles);
}
