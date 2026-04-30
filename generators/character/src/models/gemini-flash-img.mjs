/**
 * Image generation client — OpenAI-compatible chat completions with image output.
 * Reads IMAGE_GEN_* env vars. Simplified client for character sprite generation.
 *
 * Set IMAGE_GEN_PROTOCOL=openai-images to switch to OpenAI native /v1/images/edits
 * (e.g. for gpt-image-2 via OpenAI / cliproxy).
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";
const MODEL = process.env.IMAGE_GEN_MODEL || DEFAULT_MODEL;
const BASE_URL = process.env.IMAGE_GEN_BASE_URL || DEFAULT_BASE_URL;
const REQUEST_TIMEOUT_MS = parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "180000", 10);
const PROTOCOL = (process.env.IMAGE_GEN_PROTOCOL || "chat-completions").toLowerCase();
const QUALITY = process.env.IMAGE_GEN_QUALITY || "high";

/**
 * Image editing: send reference image + text instruction -> new image.
 * @param {string} text  - generation instruction
 * @param {Buffer} imageBuffer - reference sprite sheet
 * @returns {Buffer} PNG image buffer
 */
export async function editImage(text, imageBuffer, opts = { imageSize: "1K" }) {
  const MAX_ATTEMPTS = 2;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await editImageOnce(text, imageBuffer, opts);
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[char-edit] Attempt ${attempt} failed (${e.message}), retrying...`);
      }
    }
  }
  throw lastErr;
}

async function editImageOnce(text, imageBuffer, { imageSize = "1K" } = {}) {
  const API_KEY = process.env.IMAGE_GEN_API_KEY || "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    if (PROTOCOL === "openai-images") {
      const form = new FormData();
      form.append("model", MODEL);
      form.append("prompt", text);
      form.append("size", "1024x1024");
      form.append("quality", QUALITY);
      form.append("n", "1");
      form.append("image", new Blob([imageBuffer], { type: "image/png" }), "input.png");
      const res = await fetch(`${BASE_URL}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Image Gen Edit API error ${res.status}: ${err}`);
      }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No b64_json in OpenAI image edit response");
      return Buffer.from(b64, "base64");
    }

    const base64 = imageBuffer.toString("base64");
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64}` },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
        image_config: { image_size: imageSize },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Image Gen Edit API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return extractImageBuffer(data);
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`Image Gen Edit request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function extractImageBuffer(data) {
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("No message in Image Gen response");

  if (message.images && message.images.length > 0) {
    const url = message.images[0].image_url.url;
    const b64 = url.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(b64, "base64");
  }

  if (message.content && typeof message.content === "string") {
    const match = message.content.match(/data:image\/\w+;base64,([A-Za-z0-9+/=]+)/);
    if (match) return Buffer.from(match[1], "base64");
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "image_url") {
        const url = part.image_url?.url || "";
        const b64 = url.replace(/^data:image\/\w+;base64,/, "");
        if (b64) return Buffer.from(b64, "base64");
      }
    }
  }

  throw new Error("No image found in Image Gen response");
}
