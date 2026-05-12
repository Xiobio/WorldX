/**
 * Step Z6 — seam inpainting repair (V2: mask-based).
 *
 * For each adjacent chunk pair, we build a 1536x1024 context window that
 * straddles the boundary, then ask gpt-image-2's /v1/images/edits to
 * repaint ONLY a central band (using a transparency mask). The opaque
 * regions of the mask MUST be preserved by the model, which means we no
 * longer get random outer-region content like in V1 of Z6.
 *
 * Modes (controlled by ZONE_SEAM_REPAIR_MODE):
 *   - `mask`        (default): masked inpainting via OpenAI
 *   - `alpha-blend`: pure local alpha-gradient blend, no API calls
 *   - `both`        : run mask first, then alpha-blend the seam to clean up
 *                     any micro residual color jump
 */

import sharp from "sharp";

import { editWithMask } from "../models/image-client.mjs";
import { buildEditMask, getSize, composite, resize, alphaBlendVerticalSeam } from "../utils/image-ops.mjs";
import { log, logError } from "../utils/logger.mjs";

const CHUNK_W = 1536;
const CHUNK_H = 1024;
const CONTEXT_HALF = 768;        // pixels taken from each side into the context window
const REPAINT_BAND = 256;         // central band that is allowed to be edited
const PER_SIDE_OVERWRITE = 128;   // how many px of each chunk's edge get replaced

const MODE = (process.env.ZONE_SEAM_REPAIR_MODE || "mask").toLowerCase();

function makePrompt(axis, zoneIdentity) {
  const seamDesc = axis === "vertical"
    ? "The seam runs vertically down the exact center (x=768) of the image."
    : "The seam runs horizontally across the exact center (y=512) of the image.";

  return `You are repairing a seam between two adjacent map tiles in a fantasy game zone.

INPUT: a 1536x1024 image with a TRANSPARENT mask region in the middle.
${seamDesc}

YOUR JOB: paint the transparent region so that whatever crosses INTO it from the surrounding opaque areas continues continuously through it. If a road exits the opaque region on one side, draw the same road continuing across the transparent strip and exiting on the other side. Same for rivers, paths, and terrain types.

DO NOT modify or affect the opaque regions in any way.

Style identity (must match exactly the surrounding opaque regions):
${zoneIdentity}

The result must be a 1536x1024 image where the transparent region has been filled in with content that bridges the surrounding context naturally. Outside the transparent region, the image should be IDENTICAL to the input.`;
}

async function buildVerticalContextWindow(chunkA, chunkB) {
  const leftHalf = await sharp(chunkA)
    .extract({ left: CHUNK_W - CONTEXT_HALF, top: 0, width: CONTEXT_HALF, height: CHUNK_H })
    .png()
    .toBuffer();
  const rightHalf = await sharp(chunkB)
    .extract({ left: 0, top: 0, width: CONTEXT_HALF, height: CHUNK_H })
    .png()
    .toBuffer();
  return composite(CHUNK_W, CHUNK_H, [
    { buffer: leftHalf, x: 0, y: 0 },
    { buffer: rightHalf, x: CONTEXT_HALF, y: 0 },
  ]);
}

async function buildHorizontalContextWindow(chunkA, chunkB) {
  // For horizontal seams we stack chunks vertically. Each contributes 512 px
  // of height (its half nearest the seam) in the 1024-tall frame.
  const HALF_H = 512;
  const topHalf = await sharp(chunkA)
    .extract({ left: 0, top: CHUNK_H - HALF_H, width: CHUNK_W, height: HALF_H })
    .png()
    .toBuffer();
  const bottomHalf = await sharp(chunkB)
    .extract({ left: 0, top: 0, width: CHUNK_W, height: HALF_H })
    .png()
    .toBuffer();
  return composite(CHUNK_W, CHUNK_H, [
    { buffer: topHalf, x: 0, y: 0 },
    { buffer: bottomHalf, x: 0, y: HALF_H },
  ]);
}

async function applyVerticalRepaint(chunkA, chunkB, repainted) {
  const meta = await sharp(repainted).metadata();
  const window = (meta.width !== CHUNK_W || meta.height !== CHUNK_H)
    ? await resize(repainted, CHUNK_W, CHUNK_H)
    : repainted;

  const bandLeft = CONTEXT_HALF - REPAINT_BAND / 2; // 640
  const band = await sharp(window).extract({ left: bandLeft, top: 0, width: REPAINT_BAND, height: CHUNK_H }).png().toBuffer();
  const leftBand = await sharp(band).extract({ left: 0, top: 0, width: PER_SIDE_OVERWRITE, height: CHUNK_H }).png().toBuffer();
  const rightBand = await sharp(band).extract({ left: PER_SIDE_OVERWRITE, top: 0, width: PER_SIDE_OVERWRITE, height: CHUNK_H }).png().toBuffer();

  const newA = await sharp(chunkA)
    .composite([{ input: leftBand, left: CHUNK_W - PER_SIDE_OVERWRITE, top: 0 }])
    .png()
    .toBuffer();
  const newB = await sharp(chunkB)
    .composite([{ input: rightBand, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { newA, newB };
}

async function applyHorizontalRepaint(chunkA, chunkB, repainted) {
  const meta = await sharp(repainted).metadata();
  const window = (meta.width !== CHUNK_W || meta.height !== CHUNK_H)
    ? await resize(repainted, CHUNK_W, CHUNK_H)
    : repainted;

  const HALF_H = 512;
  const bandTop = HALF_H - REPAINT_BAND / 2; // 384
  const band = await sharp(window).extract({ left: 0, top: bandTop, width: CHUNK_W, height: REPAINT_BAND }).png().toBuffer();

  // Source-space: each PER_SIDE_OVERWRITE px in the compressed window
  // corresponds to PER_SIDE_OVERWRITE * (CHUNK_H/HALF_H) px in source chunks.
  const SRC_OVERWRITE = PER_SIDE_OVERWRITE * (CHUNK_H / HALF_H); // 256
  const topBandSrc = await sharp(band).extract({ left: 0, top: 0, width: CHUNK_W, height: PER_SIDE_OVERWRITE }).png().toBuffer();
  const bottomBandSrc = await sharp(band).extract({ left: 0, top: PER_SIDE_OVERWRITE, width: CHUNK_W, height: PER_SIDE_OVERWRITE }).png().toBuffer();
  const topBand = await resize(topBandSrc, CHUNK_W, SRC_OVERWRITE);
  const bottomBand = await resize(bottomBandSrc, CHUNK_W, SRC_OVERWRITE);

  const newA = await sharp(chunkA)
    .composite([{ input: topBand, left: 0, top: CHUNK_H - SRC_OVERWRITE }])
    .png()
    .toBuffer();
  const newB = await sharp(chunkB)
    .composite([{ input: bottomBand, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { newA, newB };
}

// ── Pure-local alpha-blend fallback ─────────────────────────────────────────

async function alphaBlendVerticalChunks(chunkA, chunkB, bandWidth = 96) {
  // Stitch chunks side-by-side, blend at the seam (x = CHUNK_W on the stitched
  // image), then split back. Avoids any API calls.
  const stitchedW = CHUNK_W * 2;
  const stitched = await composite(stitchedW, CHUNK_H, [
    { buffer: chunkA, x: 0, y: 0 },
    { buffer: chunkB, x: CHUNK_W, y: 0 },
  ]);
  const blended = await alphaBlendVerticalSeam(
    await sharp(stitched).extract({ left: 0, top: 0, width: stitchedW, height: CHUNK_H }).png().toBuffer(),
    await sharp(stitched).extract({ left: 0, top: 0, width: stitchedW, height: CHUNK_H }).png().toBuffer(),
    CHUNK_W,
    bandWidth,
  );
  // For our purposes we want a different operation: blend chunk A's right edge
  // with chunk B's left edge so the COLOR on each side smoothly transitions
  // across the seam. The function above blends two whole images symmetrically
  // — we can instead blend just the band band by band.
  // Simpler: blend a strip of size [seam-band/2 .. seam+band/2] from both
  // images and write it back.
  const half = bandWidth / 2;
  const stripA = await sharp(chunkA).extract({ left: CHUNK_W - half, top: 0, width: half, height: CHUNK_H }).removeAlpha().raw().toBuffer();
  const stripB = await sharp(chunkB).extract({ left: 0, top: 0, width: half, height: CHUNK_H }).removeAlpha().raw().toBuffer();

  // Build the blended bands. Going from left to right across the band of width=bandWidth:
  //   t=0   → 100% A; t=1 → 100% B.
  // For chunk A's right strip (covers t in [0..0.5]): t = 0..0.5
  // For chunk B's left strip (covers t in [0.5..1.0]): t = 0.5..1.0
  const blendedA = Buffer.alloc(half * CHUNK_H * 3);
  const blendedB = Buffer.alloc(half * CHUNK_H * 3);
  for (let y = 0; y < CHUNK_H; y++) {
    for (let x = 0; x < half; x++) {
      const idx = (y * half + x) * 3;
      const tA = (x) / bandWidth;            // 0..0.5
      const tB = (half + x) / bandWidth;     // 0.5..1.0
      // For chunk A's strip we need the value at position bandWidth-half + x = half + x in B's terms
      // ...this gets confusing. Cleaner: just sample the corresponding pixel from the OTHER image.
      // For chunkA strip at x: the OTHER image's pixel is at (CHUNK_W - half + x)... but in chunkB that's negative.
      // Take chunkB's pixel at x (mirroring to the left edge of B):
      const aR = stripA[idx], aG = stripA[idx + 1], aB = stripA[idx + 2];
      const bR = stripB[idx], bG = stripB[idx + 1], bB = stripB[idx + 2];
      // Blend in A's strip: t goes 0..0.5 → mostly A
      blendedA[idx] = Math.round(aR * (1 - tA) + bR * tA);
      blendedA[idx + 1] = Math.round(aG * (1 - tA) + bG * tA);
      blendedA[idx + 2] = Math.round(aB * (1 - tA) + bB * tA);
      // Blend in B's strip: t goes 0.5..1 → mostly B
      blendedB[idx] = Math.round(aR * (1 - tB) + bR * tB);
      blendedB[idx + 1] = Math.round(aG * (1 - tB) + bG * tB);
      blendedB[idx + 2] = Math.round(aB * (1 - tB) + bB * tB);
    }
  }
  const aPatch = await sharp(blendedA, { raw: { width: half, height: CHUNK_H, channels: 3 } }).png().toBuffer();
  const bPatch = await sharp(blendedB, { raw: { width: half, height: CHUNK_H, channels: 3 } }).png().toBuffer();
  const newA = await sharp(chunkA)
    .composite([{ input: aPatch, left: CHUNK_W - half, top: 0 }])
    .png()
    .toBuffer();
  const newB = await sharp(chunkB)
    .composite([{ input: bPatch, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { newA, newB };
}

async function alphaBlendHorizontalChunks(chunkA, chunkB, bandHeight = 96) {
  const half = bandHeight / 2;
  const stripA = await sharp(chunkA).extract({ left: 0, top: CHUNK_H - half, width: CHUNK_W, height: half }).removeAlpha().raw().toBuffer();
  const stripB = await sharp(chunkB).extract({ left: 0, top: 0, width: CHUNK_W, height: half }).removeAlpha().raw().toBuffer();
  const blendedA = Buffer.alloc(CHUNK_W * half * 3);
  const blendedB = Buffer.alloc(CHUNK_W * half * 3);
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < CHUNK_W; x++) {
      const idx = (y * CHUNK_W + x) * 3;
      const tA = (y) / bandHeight;
      const tB = (half + y) / bandHeight;
      const aR = stripA[idx], aG = stripA[idx + 1], aB = stripA[idx + 2];
      const bR = stripB[idx], bG = stripB[idx + 1], bB = stripB[idx + 2];
      blendedA[idx] = Math.round(aR * (1 - tA) + bR * tA);
      blendedA[idx + 1] = Math.round(aG * (1 - tA) + bG * tA);
      blendedA[idx + 2] = Math.round(aB * (1 - tA) + bB * tA);
      blendedB[idx] = Math.round(aR * (1 - tB) + bR * tB);
      blendedB[idx + 1] = Math.round(aG * (1 - tB) + bG * tB);
      blendedB[idx + 2] = Math.round(aB * (1 - tB) + bB * tB);
    }
  }
  const aPatch = await sharp(blendedA, { raw: { width: CHUNK_W, height: half, channels: 3 } }).png().toBuffer();
  const bPatch = await sharp(blendedB, { raw: { width: CHUNK_W, height: half, channels: 3 } }).png().toBuffer();
  const newA = await sharp(chunkA)
    .composite([{ input: aPatch, left: 0, top: CHUNK_H - half }])
    .png()
    .toBuffer();
  const newB = await sharp(chunkB)
    .composite([{ input: bPatch, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { newA, newB };
}

// ── Main per-seam routine ───────────────────────────────────────────────────

async function repairOneSeamMask(seam, chunkBufs, zoneCfg, styleAnchorBuf, save) {
  const aBuf = chunkBufs.get(seam.a);
  const bBuf = chunkBufs.get(seam.b);
  const ctx = seam.axis === "vertical"
    ? await buildVerticalContextWindow(aBuf, bBuf)
    : await buildHorizontalContextWindow(aBuf, bBuf);
  const editRegion = seam.axis === "vertical"
    ? { x: CONTEXT_HALF - REPAINT_BAND / 2, y: 0, width: REPAINT_BAND, height: CHUNK_H }
    : { x: 0, y: CHUNK_H / 2 - REPAINT_BAND / 2, width: CHUNK_W, height: REPAINT_BAND };
  const mask = await buildEditMask(CHUNK_W, CHUNK_H, editRegion);

  save(`seams/${seam.a}__${seam.b}-context.png`, ctx);
  save(`seams/${seam.a}__${seam.b}-mask.png`, mask);

  const prompt = makePrompt(seam.axis, zoneCfg.zoneIdentity);
  const repainted = await editWithMask(prompt, ctx, mask, [styleAnchorBuf], {
    size: `${CHUNK_W}x${CHUNK_H}`,
  });
  save(`seams/${seam.a}__${seam.b}-repainted.png`, repainted);

  const apply = seam.axis === "vertical" ? applyVerticalRepaint : applyHorizontalRepaint;
  return apply(aBuf, bBuf, repainted);
}

async function repairOneSeamAlphaBlend(seam, chunkBufs) {
  const aBuf = chunkBufs.get(seam.a);
  const bBuf = chunkBufs.get(seam.b);
  if (seam.axis === "vertical") return alphaBlendVerticalChunks(aBuf, bBuf, 128);
  return alphaBlendHorizontalChunks(aBuf, bBuf, 128);
}

export async function repairSeams(chunkBufs, zoneCfg, styleAnchorBuf, save) {
  const byPos = new Map();
  for (const c of zoneCfg.grid.chunks) byPos.set(`${c.row},${c.col}`, c);

  const seams = [];
  for (const c of zoneCfg.grid.chunks) {
    if (!chunkBufs.has(c.id)) continue;
    const right = byPos.get(`${c.row},${c.col + 1}`);
    if (right && chunkBufs.has(right.id)) seams.push({ a: c.id, b: right.id, axis: "vertical" });
    const bottom = byPos.get(`${c.row + 1},${c.col}`);
    if (bottom && chunkBufs.has(bottom.id)) seams.push({ a: c.id, b: bottom.id, axis: "horizontal" });
  }

  log("Z6", `repair mode=${MODE}, ${seams.length} seams`);
  const seamLog = [];

  for (const seam of seams) {
    const start = Date.now();
    try {
      let newA, newB;
      if (MODE === "alpha-blend") {
        ({ newA, newB } = await repairOneSeamAlphaBlend(seam, chunkBufs));
      } else if (MODE === "both") {
        // Mask first
        ({ newA, newB } = await repairOneSeamMask(seam, chunkBufs, zoneCfg, styleAnchorBuf, save));
        chunkBufs.set(seam.a, newA);
        chunkBufs.set(seam.b, newB);
        // Then alpha-blend the seam
        ({ newA, newB } = await repairOneSeamAlphaBlend(seam, chunkBufs));
      } else {
        // mask (default)
        ({ newA, newB } = await repairOneSeamMask(seam, chunkBufs, zoneCfg, styleAnchorBuf, save));
      }
      chunkBufs.set(seam.a, newA);
      chunkBufs.set(seam.b, newB);
      seamLog.push({ ...seam, ok: true, mode: MODE, t_seconds: (Date.now() - start) / 1000 });
      log("Z6", `seam ${seam.a}↔${seam.b} (${seam.axis}) ok`, `t=${((Date.now() - start) / 1000).toFixed(1)}s mode=${MODE}`);
    } catch (e) {
      logError("Z6", e);
      seamLog.push({ ...seam, ok: false, mode: MODE, error: e.message });
    }
  }

  for (const [id, buf] of chunkBufs) {
    save(`chunks-repaired/${id}.png`, buf);
  }
  return seamLog;
}
