import sharp from "sharp";

/** Convert a Buffer of RGB pixels into a coarse LAB histogram. */
async function labHistogram(buf, bins = 8) {
  const { data, info } = await sharp(buf)
    .resize(256, 256, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hist = new Array(bins * bins * bins).fill(0);
  const N = info.width * info.height;
  for (let i = 0; i < N; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    // Approximate L*a*b* via simple linear transform — enough for relative
    // variance comparison.
    const L = 0.5 * (Math.max(r, g, b) + Math.min(r, g, b));
    const a = (r - g) * 0.5 + 0.5;
    const bChan = (g - b) * 0.5 + 0.5;
    const li = Math.min(bins - 1, Math.max(0, Math.floor(L * bins)));
    const ai = Math.min(bins - 1, Math.max(0, Math.floor(a * bins)));
    const bi = Math.min(bins - 1, Math.max(0, Math.floor(bChan * bins)));
    hist[li * bins * bins + ai * bins + bi]++;
  }
  // Normalize
  for (let i = 0; i < hist.length; i++) hist[i] /= N;
  return hist;
}

function chiSquare(h1, h2) {
  let s = 0;
  for (let i = 0; i < h1.length; i++) {
    const a = h1[i];
    const b = h2[i];
    const denom = a + b;
    if (denom > 1e-9) s += ((a - b) * (a - b)) / denom;
  }
  return 0.5 * s;
}

/**
 * Measure cross-chunk style drift.
 *
 * For each pair of chunks compute chi-square distance between their LAB
 * histograms. Report mean, max, and the chunk that's furthest from the
 * collection's average histogram (= most "off-style").
 */
export async function evaluateStyleVariance(chunkBufs) {
  const ids = [];
  const hists = [];
  for (const [id, buf] of chunkBufs) {
    ids.push(id);
    hists.push(await labHistogram(buf));
  }
  if (hists.length === 0) {
    return { meanPairwise: 0, maxPairwise: 0, mostDriftedChunk: null, distances: [] };
  }

  const avg = new Array(hists[0].length).fill(0);
  for (const h of hists) for (let i = 0; i < h.length; i++) avg[i] += h[i] / hists.length;

  const distancesToAvg = ids.map((id, i) => ({
    id,
    distanceToCenter: chiSquare(hists[i], avg),
  }));

  const pairs = [];
  for (let i = 0; i < hists.length; i++) {
    for (let j = i + 1; j < hists.length; j++) {
      pairs.push({ a: ids[i], b: ids[j], dist: chiSquare(hists[i], hists[j]) });
    }
  }
  const pairwiseValues = pairs.map((p) => p.dist);
  const meanPairwise = pairwiseValues.length
    ? pairwiseValues.reduce((a, b) => a + b, 0) / pairwiseValues.length
    : 0;
  const maxPairwise = pairwiseValues.length ? Math.max(...pairwiseValues) : 0;
  distancesToAvg.sort((a, b) => b.distanceToCenter - a.distanceToCenter);

  return {
    meanPairwise,
    maxPairwise,
    mostDriftedChunk: distancesToAvg[0],
    distances: distancesToAvg,
    pairs: pairs.sort((a, b) => b.dist - a.dist).slice(0, 5),
  };
}
