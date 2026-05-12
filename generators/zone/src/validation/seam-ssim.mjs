import sharp from "sharp";

/**
 * Compute SSIM-like similarity between two equal-sized RGB strips.
 *
 * We use a fast luminance-domain SSIM approximation: split each strip into
 * 8x8 windows, compute per-window means and variances, return mean SSIM.
 */
async function rgbStrip(buf, x, y, w, h) {
  const raw = await sharp(buf)
    .extract({ left: x, top: y, width: w, height: h })
    .removeAlpha()
    .raw()
    .toBuffer();
  return { raw, w, h };
}

function lumaFromRgb(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function ssim8(stripA, stripB) {
  const { raw: rawA, w, h } = stripA;
  const { raw: rawB } = stripB;
  const C1 = 6.5025;
  const C2 = 58.5225;
  let sum = 0;
  let n = 0;
  const winSize = 8;
  for (let y = 0; y + winSize <= h; y += winSize) {
    for (let x = 0; x + winSize <= w; x += winSize) {
      let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0;
      const N = winSize * winSize;
      for (let dy = 0; dy < winSize; dy++) {
        for (let dx = 0; dx < winSize; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 3;
          const la = lumaFromRgb(rawA[i], rawA[i + 1], rawA[i + 2]);
          const lb = lumaFromRgb(rawB[i], rawB[i + 1], rawB[i + 2]);
          sumA += la;
          sumB += lb;
          sumAA += la * la;
          sumBB += lb * lb;
          sumAB += la * lb;
        }
      }
      const meanA = sumA / N;
      const meanB = sumB / N;
      const varA = sumAA / N - meanA * meanA;
      const varB = sumBB / N - meanB * meanB;
      const covAB = sumAB / N - meanA * meanB;
      const num = (2 * meanA * meanB + C1) * (2 * covAB + C2);
      const den = (meanA * meanA + meanB * meanB + C1) * (varA + varB + C2);
      sum += num / den;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * Compute the SSIM along a horizontal seam between two stacked chunks.
 * The "seam" is a thin band that straddles the boundary: the bottom of the
 * top chunk vs the top of the bottom chunk.
 */
export async function ssimHorizontalSeam(topBuf, bottomBuf, bandPx = 32) {
  const top = await sharp(topBuf).metadata();
  const bot = await sharp(bottomBuf).metadata();
  const w = Math.min(top.width, bot.width);
  const h = bandPx;
  const a = await rgbStrip(topBuf, 0, top.height - h, w, h);
  const b = await rgbStrip(bottomBuf, 0, 0, w, h);
  return ssim8(a, b);
}

export async function ssimVerticalSeam(leftBuf, rightBuf, bandPx = 32) {
  const left = await sharp(leftBuf).metadata();
  const right = await sharp(rightBuf).metadata();
  const h = Math.min(left.height, right.height);
  const w = bandPx;
  const a = await rgbStrip(leftBuf, left.width - w, 0, w, h);
  const b = await rgbStrip(rightBuf, 0, 0, w, h);
  return ssim8(a, b);
}

/**
 * For a 3x3 chunk grid, compute SSIM over all 12 internal seams (6 horizontal
 * + 6 vertical) and return summary stats.
 */
export async function evaluateAllSeams(chunkBufs, gridChunks) {
  const byPos = new Map();
  for (const c of gridChunks) byPos.set(`${c.row},${c.col}`, c);

  const results = [];
  for (const c of gridChunks) {
    const buf = chunkBufs.get(c.id);
    if (!buf) continue;
    // Right neighbor → vertical seam
    const right = byPos.get(`${c.row},${c.col + 1}`);
    if (right && chunkBufs.has(right.id)) {
      const ssim = await ssimVerticalSeam(buf, chunkBufs.get(right.id));
      results.push({ from: c.id, to: right.id, type: "vertical", ssim });
    }
    // Bottom neighbor → horizontal seam
    const bottom = byPos.get(`${c.row + 1},${c.col}`);
    if (bottom && chunkBufs.has(bottom.id)) {
      const ssim = await ssimHorizontalSeam(buf, chunkBufs.get(bottom.id));
      results.push({ from: c.id, to: bottom.id, type: "horizontal", ssim });
    }
  }
  const values = results.map((r) => r.ssim);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const passing = values.filter((v) => v >= 0.85).length;
  return { results, mean, min, max, passingCount: passing, total: values.length };
}
