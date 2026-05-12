/**
 * Feature-continuity validation.
 *
 * Replaces the noisy SSIM seam metric with a category-aware alignment score:
 * for each seam, classify a thin band on each side into 4 categories
 * (road, water, vegetation, other), then check whether each row (vertical
 * seam) or column (horizontal seam) has matching categories on both sides.
 *
 * Output: per-seam continuity score in [0..1] where 1 = every row/column
 * across the seam matches.
 */

import sharp from "sharp";

const STRIP_PX = 16;            // sample this many pixels from each side
const SAMPLE_HEIGHT_PX = 16;    // average across this many rows for vertical seams (or cols)

/**
 * Classify a single RGB triple into a feature category.
 *   0 = other
 *   1 = road / path / built (warm tan/brown, light)
 *   2 = water (blueish)
 *   3 = vegetation (greenish)
 */
function classifyPixel(r, g, b) {
  // Water: blue dominant
  if (b > r + 20 && b > 90) return 2;
  // Vegetation: green dominant, low blue
  if (g > r + 5 && g > b + 10 && g > 80) return 3;
  // Road/path: warm tan with red-leaning, moderate brightness
  const lum = (r + g + b) / 3;
  if (r >= g && g >= b - 5 && lum > 110 && lum < 220 && r - b > 15) return 1;
  return 0;
}

function dominantClass(rawData, width, channels, sx, sy, sw, sh) {
  const counts = [0, 0, 0, 0];
  for (let y = sy; y < sy + sh; y++) {
    for (let x = sx; x < sx + sw; x++) {
      const idx = (y * width + x) * channels;
      counts[classifyPixel(rawData[idx], rawData[idx + 1], rawData[idx + 2])]++;
    }
  }
  let max = 0, klass = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > max) { max = counts[i]; klass = i; }
  }
  return klass;
}

async function rgbRaw(buf) {
  const m = await sharp(buf).metadata();
  const data = await sharp(buf).removeAlpha().raw().toBuffer();
  return { data, w: m.width, h: m.height, channels: 3 };
}

/**
 * Score a vertical seam: chunkA is on the LEFT, chunkB is on the RIGHT.
 * Walk down both edges in chunks of SAMPLE_HEIGHT_PX rows; for each row-band,
 * find dominant class on each side; mark "aligned" if classes match.
 */
async function scoreVerticalSeam(aBuf, bBuf) {
  const a = await rgbRaw(aBuf);
  const b = await rgbRaw(bBuf);
  const sampleH = SAMPLE_HEIGHT_PX;
  const total = Math.floor(a.h / sampleH);
  let aligned = 0;
  const breakdown = [];
  for (let i = 0; i < total; i++) {
    const y = i * sampleH;
    const cA = dominantClass(a.data, a.w, a.channels, a.w - STRIP_PX, y, STRIP_PX, sampleH);
    const cB = dominantClass(b.data, b.w, b.channels, 0, y, STRIP_PX, sampleH);
    if (cA === cB) aligned++;
    breakdown.push({ y, cA, cB });
  }
  return { score: aligned / total, aligned, total, breakdown };
}

async function scoreHorizontalSeam(aBuf, bBuf) {
  const a = await rgbRaw(aBuf);
  const b = await rgbRaw(bBuf);
  const sampleW = SAMPLE_HEIGHT_PX;
  const total = Math.floor(a.w / sampleW);
  let aligned = 0;
  const breakdown = [];
  for (let i = 0; i < total; i++) {
    const x = i * sampleW;
    const cA = dominantClass(a.data, a.w, a.channels, x, a.h - STRIP_PX, sampleW, STRIP_PX);
    const cB = dominantClass(b.data, b.w, b.channels, x, 0, sampleW, STRIP_PX);
    if (cA === cB) aligned++;
    breakdown.push({ x, cA, cB });
  }
  return { score: aligned / total, aligned, total, breakdown };
}

/**
 * Evaluate feature-continuity across all internal seams of a chunk grid.
 * Returns per-seam scores plus aggregate stats.
 */
export async function evaluateFeatureContinuity(chunkBufs, gridChunks) {
  const byPos = new Map();
  for (const c of gridChunks) byPos.set(`${c.row},${c.col}`, c);
  const results = [];
  for (const c of gridChunks) {
    const buf = chunkBufs.get(c.id);
    if (!buf) continue;
    const right = byPos.get(`${c.row},${c.col + 1}`);
    if (right && chunkBufs.has(right.id)) {
      const r = await scoreVerticalSeam(buf, chunkBufs.get(right.id));
      results.push({ from: c.id, to: right.id, type: "vertical", score: r.score, aligned: r.aligned, total: r.total });
    }
    const bottom = byPos.get(`${c.row + 1},${c.col}`);
    if (bottom && chunkBufs.has(bottom.id)) {
      const r = await scoreHorizontalSeam(buf, chunkBufs.get(bottom.id));
      results.push({ from: c.id, to: bottom.id, type: "horizontal", score: r.score, aligned: r.aligned, total: r.total });
    }
  }
  const scores = results.map((r) => r.score);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 0;
  const passing = results.filter((r) => r.score >= 0.6).length; // 60% category match is "decent"
  return { results, mean, min, max, passingCount: passing, total: results.length };
}
