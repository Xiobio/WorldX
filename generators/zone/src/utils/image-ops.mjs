import sharp from "sharp";

export async function getSize(buf) {
  const m = await sharp(buf).metadata();
  return { width: m.width, height: m.height };
}

/** Resize buffer to exact target size. */
export async function resize(buf, w, h) {
  return sharp(buf).resize(w, h, { fit: "fill" }).png().toBuffer();
}

/** Extract a rectangular crop. */
export async function crop(buf, { left, top, width, height }) {
  return sharp(buf).extract({ left, top, width, height }).png().toBuffer();
}

/**
 * Composite a set of (image, x, y) tiles onto a blank canvas of given size.
 * Tiles outside the canvas bounds are clipped.
 */
export async function composite(canvasW, canvasH, tiles) {
  const layers = tiles.map((t) => ({ input: t.buffer, top: t.y, left: t.x }));
  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 30, g: 30, b: 35, alpha: 1 } },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

/**
 * Build a mask PNG: opaque (white, alpha=255) everywhere EXCEPT a rectangular
 * editable region which is transparent (alpha=0). Used by OpenAI Images.edits
 * to constrain inpainting to a sub-region of a base image.
 *
 * @param {number} w canvas width
 * @param {number} h canvas height
 * @param {{x:number, y:number, width:number, height:number}} editRegion - transparent rectangle
 */
export async function buildEditMask(w, h, editRegion) {
  // Start fully opaque
  const opaque = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
  // Build a fully-transparent rectangle of the same size as editRegion
  const hole = await sharp({
    create: {
      width: editRegion.width,
      height: editRegion.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  // Composite the transparent rect onto the opaque base; we need `blend: 'dest-out'`
  // to actually punch a hole rather than overlay. sharp's `dest-out` makes the
  // destination transparent where the source is opaque — but our source is
  // transparent. So instead build an inverted approach:
  // 1) start with a fully transparent canvas
  const transparent = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  // 2) build an opaque rectangle whose dimensions are the COMPLEMENT of the hole
  // — but that's awkward for arbitrary positions. The cleanest way is to build
  // the mask pixel-by-pixel.
  const raw = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inHole =
        x >= editRegion.x && x < editRegion.x + editRegion.width &&
        y >= editRegion.y && y < editRegion.y + editRegion.height;
      const idx = (y * w + x) * 4;
      // For OpenAI: transparent (alpha=0) = editable; opaque (alpha=255) = preserved.
      raw[idx + 0] = inHole ? 0 : 255;
      raw[idx + 1] = inHole ? 0 : 255;
      raw[idx + 2] = inHole ? 0 : 255;
      raw[idx + 3] = inHole ? 0 : 255;
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/**
 * Alpha-blend two images along a vertical line at x = seamX over a band of
 * width `bandWidth` (centered on the seam). Returns the blended image (same
 * size as image inputs).
 *
 * Used as a no-API fallback to soften visible seam color jumps even when the
 * underlying geometry doesn't perfectly align.
 */
export async function alphaBlendVerticalSeam(leftImg, rightImg, seamX, bandWidth = 64) {
  const meta = await sharp(leftImg).metadata();
  const w = meta.width;
  const h = meta.height;
  // Strategy: build a gradient alpha mask for the right image where alpha=0
  // at left edge of the band and alpha=255 at right edge of band.
  // Outside the band: rightImg fully opaque or transparent based on which side.
  const leftRaw = await sharp(leftImg).removeAlpha().raw().toBuffer();
  const rightRaw = await sharp(rightImg).removeAlpha().raw().toBuffer();
  const out = Buffer.alloc(w * h * 3);
  const bandStart = seamX - bandWidth / 2;
  const bandEnd = seamX + bandWidth / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      let t;
      if (x < bandStart) t = 0;       // pure left
      else if (x >= bandEnd) t = 1;   // pure right
      else t = (x - bandStart) / bandWidth;
      const lr = leftRaw[idx], lg = leftRaw[idx + 1], lb = leftRaw[idx + 2];
      const rr = rightRaw[idx], rg = rightRaw[idx + 1], rb = rightRaw[idx + 2];
      out[idx] = Math.round(lr * (1 - t) + rr * t);
      out[idx + 1] = Math.round(lg * (1 - t) + rg * t);
      out[idx + 2] = Math.round(lb * (1 - t) + rb * t);
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/** Write a tiny visual annotation (text label) onto an image. */
export async function annotate(buf, label) {
  const { width, height } = await getSize(buf);
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="${Math.min(width - 12, label.length * 12 + 16)}" height="26" fill="rgba(0,0,0,0.62)" rx="4"/>
    <text x="14" y="24" font-size="16" fill="#fff" font-family="monospace">${label}</text>
  </svg>`;
  return sharp(buf).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a styled top-left corner label onto a chunk image.
 * Includes a Chinese-friendly font stack and a soft drop-shadow on the badge.
 *
 * @param {Buffer} buf  source PNG
 * @param {string} text label text (Chinese, English, or both)
 */
export async function addCornerLabel(buf, text) {
  const { width, height } = await getSize(buf);
  const safeText = escapeXml(text || "");
  const fontSize = 36;
  // Heuristic width: CJK chars are wide. Estimate per-char width.
  const chars = [...safeText];
  const cjkCount = chars.filter((c) => /[一-鿿぀-ヿ]/.test(c)).length;
  const asciiCount = chars.length - cjkCount;
  const estTextW = cjkCount * fontSize + asciiCount * Math.round(fontSize * 0.55);
  const padX = 22;
  const padY = 14;
  const boxW = Math.min(width - 32, estTextW + padX * 2);
  const boxH = Math.round(fontSize * 1.5) + padY * 2 - 8;
  const boxX = 24;
  const boxY = 24;
  const fontStack = "Noto Sans CJK SC, Microsoft YaHei, PingFang SC, Hiragino Sans GB, sans-serif";

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="2"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}"
          rx="10" ry="10" fill="rgba(20,18,16,0.72)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
    <text x="${boxX + padX}" y="${boxY + padY + fontSize - 4}"
          font-size="${fontSize}" font-family="${fontStack}" fill="#f7eed9"
          font-weight="500" letter-spacing="2">${safeText}</text>
  </g>
</svg>`;
  return sharp(buf).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
