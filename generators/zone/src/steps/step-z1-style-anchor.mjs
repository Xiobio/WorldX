import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { generateImage } from "../models/image-client.mjs";
import { log, logError } from "../utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "../../prompts/style-anchor.md");

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Step Z1: Generate the zone-wide style anchor.
 *
 * @param {{ zoneIdentity: string }} zoneCfg
 * @returns {Promise<Buffer>} 1024x1024 PNG
 */
export async function generateStyleAnchor(zoneCfg) {
  log("Z1", "start");
  const tmpl = readFileSync(PROMPT_PATH, "utf-8");
  const prompt = fillTemplate(tmpl, { zoneIdentity: zoneCfg.zoneIdentity });

  try {
    const buf = await generateImage(prompt, { size: "1024x1024" });
    log("Z1", "done", `bytes=${buf.length}`);
    return buf;
  } catch (e) {
    logError("Z1", e);
    throw e;
  }
}
