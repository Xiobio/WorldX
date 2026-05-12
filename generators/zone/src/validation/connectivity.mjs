import sharp from "sharp";

/**
 * Cheap walkability heuristic: a pixel is walkable if it's in the road / path
 * color band (warm light tones, low saturation) OR it's a generic ground tone.
 *
 * For a true pipeline we'd reuse Step 4 (Gemini-painted walkable mask). Here
 * we only need a coarse signal good enough to tell whether 9 chunks form one
 * connected region or several islands.
 */
async function walkableMask(buf) {
  const { data, info } = await sharp(buf)
    .resize(192, 128, { fit: "fill" }) // small grid is fine for connectivity
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    // Heuristic: warm light tones (paths) OR grayish ground
    const lum = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const warmPath = lum > 130 && r >= g && g >= b - 10 && sat > 20 && sat < 120;
    const groundLike = lum > 90 && lum < 180 && sat < 40;
    mask[i] = (warmPath || groundLike) ? 1 : 0;
  }
  return { mask, w, h };
}

/** Tile the chunk masks together into a single big mask of size (cols*w, rows*h). */
async function tileMasks(chunkBufs, gridChunks, rows, cols) {
  if (chunkBufs.size === 0) return null;
  const samples = await Promise.all([...chunkBufs.entries()].map(async ([id, buf]) => ({
    id,
    ...(await walkableMask(buf)),
  })));
  const w = samples[0].w;
  const h = samples[0].h;
  const W = cols * w;
  const H = rows * h;
  const big = new Uint8Array(W * H);
  for (const c of gridChunks) {
    const s = samples.find((x) => x.id === c.id);
    if (!s) continue;
    const offX = c.col * w;
    const offY = c.row * h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        big[(offY + y) * W + (offX + x)] = s.mask[y * w + x];
      }
    }
  }
  return { big, W, H, w, h };
}

/** Flood fill from each chunk's center; return how many chunks are mutually reachable. */
export async function evaluateConnectivity(chunkBufs, gridChunks, rows, cols) {
  const tiled = await tileMasks(chunkBufs, gridChunks, rows, cols);
  if (!tiled) return { reachable: 0, total: 0, components: [] };
  const { big, W, H, w, h } = tiled;

  // Pick the seed: the first chunk in scan order that has at least 1 walkable px
  // around its center.
  const ordered = [...gridChunks].sort((a, b) => a.row - b.row || a.col - b.col);
  let seed = null;
  for (const c of ordered) {
    if (!chunkBufs.has(c.id)) continue;
    const cx = c.col * w + Math.floor(w / 2);
    const cy = c.row * h + Math.floor(h / 2);
    // Search a small neighborhood for a walkable pixel
    for (let dy = -8; dy <= 8 && !seed; dy++) {
      for (let dx = -8; dx <= 8 && !seed; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (big[y * W + x]) seed = { x, y };
      }
    }
    if (seed) break;
  }
  if (!seed) return { reachable: 0, total: chunkBufs.size, components: [] };

  // BFS flood fill
  const visited = new Uint8Array(W * H);
  const stack = [seed];
  visited[seed.y * W + seed.x] = 1;
  while (stack.length) {
    const { x, y } = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const idx = ny * W + nx;
      if (visited[idx] || !big[idx]) continue;
      visited[idx] = 1;
      stack.push({ x: nx, y: ny });
    }
  }

  // Count chunks that have at least one visited pixel
  const reachableIds = new Set();
  for (const c of gridChunks) {
    if (!chunkBufs.has(c.id)) continue;
    const x0 = c.col * w, y0 = c.row * h;
    let any = false;
    for (let y = y0; y < y0 + h && !any; y++) {
      for (let x = x0; x < x0 + w && !any; x++) {
        if (visited[y * W + x]) any = true;
      }
    }
    if (any) reachableIds.add(c.id);
  }

  return {
    reachable: reachableIds.size,
    total: chunkBufs.size,
    reachableIds: [...reachableIds],
    unreachableIds: [...chunkBufs.keys()].filter((id) => !reachableIds.has(id)),
  };
}
