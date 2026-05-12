/**
 * Multi-image image-generation client for the zone pipeline.
 *
 * Wraps the OpenAI Images API (gpt-image-1 / gpt-image-2 via cliproxy) to
 * support edits with MULTIPLE reference images: an overworld crop, a style
 * anchor, and any already-generated neighbor chunks. The text prompt tells
 * the model how to use each reference (geometry vs style vs continuity).
 *
 * Reads IMAGE_GEN_* env vars; defaults to OpenRouter + gemini for plain
 * text-to-image generation, and OpenAI native edits when PROTOCOL=openai-images.
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";

// Read env at call time, not at module-load time, so dotenv.config() can run
// in the entry script's body before these are needed.
function cfg() {
  return {
    MODEL: process.env.IMAGE_GEN_MODEL || DEFAULT_MODEL,
    BASE_URL: process.env.IMAGE_GEN_BASE_URL || DEFAULT_BASE_URL,
    PROTOCOL: (process.env.IMAGE_GEN_PROTOCOL || "chat-completions").toLowerCase(),
    QUALITY: process.env.IMAGE_GEN_QUALITY || "high",
    DEFAULT_TIMEOUT_MS: parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "360000", 10),
  };
}

function pickOpenAISize(aspect, width = 1024, height = 1024) {
  if (aspect === "square" || width === height) return "1024x1024";
  if (aspect === "landscape" || width > height) return "1536x1024";
  return "1024x1536";
}

async function callOpenAIImagesGenerate({ prompt, size, quality, timeoutMs }) {
  const { MODEL, BASE_URL } = cfg();
  const apiKey = process.env.IMAGE_GEN_API_KEY || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, n: 1, size, quality }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Images.generate ${res.status}: ${err.slice(0, 400)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Images.generate: no b64_json in response");
    return Buffer.from(b64, "base64");
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAIImagesEdit({ prompt, imageBuffers, maskBuffer, size, quality, timeoutMs }) {
  const { MODEL, BASE_URL } = cfg();
  const apiKey = process.env.IMAGE_GEN_API_KEY || "";
  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", quality);
  form.append("n", "1");
  // gpt-image-1/2 accept multiple `image[]` entries; the model uses each as a reference.
  for (let i = 0; i < imageBuffers.length; i++) {
    form.append(
      "image[]",
      new Blob([imageBuffers[i]], { type: "image/png" }),
      `ref-${i}.png`,
    );
  }
  if (maskBuffer) {
    // OpenAI Images.edits semantics: transparent areas in the mask are the regions
    // that may be modified; opaque areas must be preserved as-is.
    form.append("mask", new Blob([maskBuffer], { type: "image/png" }), "mask.png");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Images.edit ${res.status}: ${err.slice(0, 400)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Images.edit: no b64_json in response");
    return Buffer.from(b64, "base64");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plain text-to-image. Used for the style anchor (no inputs) and the
 * overworld semantic skeleton.
 */
async function withRetry(label, fn, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts) {
        console.warn(`[${label}] attempt ${i}/${attempts} failed: ${e.message?.slice(0, 200)} — retrying`);
        await new Promise((r) => setTimeout(r, 2000 * i));
      }
    }
  }
  throw lastErr;
}

export async function generateImage(prompt, { size = "1024x1024", timeoutMs } = {}) {
  const { PROTOCOL, QUALITY, DEFAULT_TIMEOUT_MS } = cfg();
  if (PROTOCOL !== "openai-images") {
    throw new Error("zone pipeline currently requires IMAGE_GEN_PROTOCOL=openai-images");
  }
  const [w, h] = size.split("x").map(Number);
  return withRetry("generateImage", () =>
    callOpenAIImagesGenerate({
      prompt,
      size: pickOpenAISize(undefined, w, h),
      quality: QUALITY,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }),
  );
}

/**
 * Multi-image edit: text prompt + N reference images → new image.
 *
 * Use this for chunks (overworld crop + style anchor + neighbors) and for
 * any later step that needs the model to integrate multiple visual cues.
 *
 * @param {string} prompt
 * @param {Buffer[]} imageBuffers - ordered list of PNG buffers; the prompt
 *   should reference them by position ("reference image 1 is the geometry
 *   skeleton", "reference image 2 is the style anchor", etc.)
 * @param {{ size?: string, timeoutMs?: number }} [opts]
 */
export async function editWithReferences(prompt, imageBuffers, { size = "1536x1024", timeoutMs } = {}) {
  const { PROTOCOL, QUALITY, DEFAULT_TIMEOUT_MS } = cfg();
  if (PROTOCOL !== "openai-images") {
    throw new Error("zone pipeline currently requires IMAGE_GEN_PROTOCOL=openai-images");
  }
  if (!imageBuffers || imageBuffers.length === 0) {
    throw new Error("editWithReferences requires at least one reference image");
  }
  const [w, h] = size.split("x").map(Number);
  return withRetry("editWithReferences", () =>
    callOpenAIImagesEdit({
      prompt,
      imageBuffers,
      size: pickOpenAISize(undefined, w, h),
      quality: QUALITY,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }),
  );
}

/**
 * Masked inpainting: edit only transparent regions of the mask while preserving
 * opaque regions of the base image. Required for true seam repair.
 *
 * @param {string} prompt
 * @param {Buffer} baseImage      - the canvas to edit
 * @param {Buffer} maskImage      - PNG with alpha channel; transparent = editable
 * @param {Buffer[]} [referenceImages] - optional extra style/context references
 */
export async function editWithMask(prompt, baseImage, maskImage, referenceImages = [], { size = "1536x1024", timeoutMs } = {}) {
  const { PROTOCOL, QUALITY, DEFAULT_TIMEOUT_MS } = cfg();
  if (PROTOCOL !== "openai-images") {
    throw new Error("zone pipeline currently requires IMAGE_GEN_PROTOCOL=openai-images");
  }
  if (!baseImage) throw new Error("editWithMask requires baseImage");
  if (!maskImage) throw new Error("editWithMask requires maskImage");
  const [w, h] = size.split("x").map(Number);
  // The base image must be passed FIRST in image[]; references follow.
  return withRetry("editWithMask", () =>
    callOpenAIImagesEdit({
      prompt,
      imageBuffers: [baseImage, ...referenceImages],
      maskBuffer: maskImage,
      size: pickOpenAISize(undefined, w, h),
      quality: QUALITY,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }),
  );
}

export function getModelName() {
  return cfg().MODEL;
}
