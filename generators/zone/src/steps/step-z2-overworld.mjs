import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { generateImage } from "../models/image-client.mjs";
import { log, logError } from "../utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "../../prompts/overworld.md");

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function formatLandmarkPositions(zoneCfg) {
  // Zone config has a 3x3 grid for the prototype. We turn each named landmark
  // into a "place a yellow dot at approx (px, py)" instruction so the
  // overworld generator knows where to anchor the dots.
  const { rows, cols, chunks } = zoneCfg.grid;
  const tileW = 1024 / cols;
  const tileH = 1024 / rows;
  const lines = [];
  for (const c of chunks) {
    if (c.kind !== "landmark") continue;
    const cx = Math.round(c.col * tileW + tileW / 2);
    const cy = Math.round(c.row * tileH + tileH / 2);
    lines.push(`- ${c.id} (${c.shortName}): place yellow dot near (${cx}, ${cy}) in the 1024×1024 image`);
  }
  return lines.join("\n");
}

/**
 * Step Z2: Generate the zone overworld semantic skeleton.
 *
 * @param {object} zoneCfg
 * @returns {Promise<Buffer>} 1024x1024 PNG
 */
export async function generateOverworld(zoneCfg) {
  log("Z2", "start");
  const tmpl = readFileSync(PROMPT_PATH, "utf-8");
  const prompt = fillTemplate(tmpl, {
    zoneIdentity: zoneCfg.zoneIdentity,
    geographyLayout: zoneCfg.geographyLayout,
    landmarkPositions: formatLandmarkPositions(zoneCfg),
  });

  try {
    const buf = await generateImage(prompt, { size: "1024x1024" });
    log("Z2", "done", `bytes=${buf.length}`);
    return buf;
  } catch (e) {
    logError("Z2", e);
    throw e;
  }
}
