/**
 * Rebuild runtime configs (world.json / scene.json / characters/*.json)
 * for an existing world dir, using the fixed config-generator.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateConfigs } from "../orchestrator/src/config-generator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const worldId = process.argv[2];
if (!worldId) {
  console.error("Usage: node scripts/rebuild-configs.mjs <world_id>");
  process.exit(1);
}

const worldDir = join(ROOT, "output/worlds", worldId);
const designPath = join(worldDir, "world-design.json");
if (!existsSync(designPath)) {
  console.error(`world-design.json not found: ${designPath}`);
  process.exit(1);
}

const design = JSON.parse(readFileSync(designPath, "utf-8"));
console.log(`Rebuilding configs for: ${design.worldName}`);
await generateConfigs(design, worldDir);
console.log("✓ Done. Restart server with WORLD_ID=" + worldId);
