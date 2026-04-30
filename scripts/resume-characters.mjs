/**
 * Resume character generation for a world that lost some characters mid-run.
 * Reads world-design.json + characters.json, generates missing chars, then
 * rebuilds runtime configs via generateConfigs.
 *
 * Usage: node scripts/resume-characters.mjs <world_id>
 */

import "dotenv/config";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateConfigs } from "../orchestrator/src/config-generator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const worldId = process.argv[2];
if (!worldId) {
  console.error("Usage: node scripts/resume-characters.mjs <world_id>");
  process.exit(1);
}

const worldDir = join(ROOT, "output/worlds", worldId);
const charsDir = join(worldDir, "characters");
const designPath = join(worldDir, "world-design.json");
const charsJsonPath = join(charsDir, "characters.json");

if (!existsSync(designPath)) {
  console.error(`world-design.json not found: ${designPath}`);
  process.exit(1);
}

const worldDesign = JSON.parse(readFileSync(designPath, "utf-8"));
const existingChars = existsSync(charsJsonPath)
  ? JSON.parse(readFileSync(charsJsonPath, "utf-8"))
  : [];
const existingNames = new Set(existingChars.map((c) => c.name));

const missing = (worldDesign.characters || []).filter((c) => !existingNames.has(c.name));

console.log(`World:           ${worldDesign.worldName}`);
console.log(`Total designed:  ${worldDesign.characters.length}`);
console.log(`Already exist:   ${existingChars.length}`);
console.log(`Missing:         ${missing.length}`);
console.log(`Will regenerate: ${missing.map((c) => c.name).join(", ")}`);

if (missing.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

const worldVisualContext = [
  worldDesign.mapDescription,
  worldDesign.worldDescription,
  worldDesign.worldName,
]
  .filter(Boolean)
  .map((s) => s.trim())
  .join("；");

function pickIpSource() {
  for (const c of worldDesign.characters || []) {
    if (c.canonicalRefs?.source) return c.canonicalRefs.source;
  }
  const text = `${worldDesign.worldName || ""} ${worldDesign.worldDescription || ""}`;
  if (/英雄联盟|League of Legends/i.test(text)) return "英雄联盟";
  return "";
}
const defaultIpSource = pickIpSource();

const charScript = join(ROOT, "generators/character/src/index.mjs");

function runChar(char) {
  return new Promise((res, rej) => {
    const ipSource = char.canonicalRefs?.source || defaultIpSource;
    const args = [
      charScript,
      char.appearance,
      "--name",
      char.name,
      "--role",
      typeof char.role === "string" ? char.role : "",
      "--world-visual-context",
      worldVisualContext,
      ...(ipSource ? ["--ip-source", ipSource] : []),
    ];
    console.log(`\n━━━ Resuming character: ${char.name} (${char.role}) ━━━`);
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, CHAR_OUTPUT_DIR: charsDir },
      stdio: "inherit",
    });
    child.on("error", rej);
    child.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`Character "${char.name}" exit ${code}`));
    });
  });
}

let succeeded = 0;
let failed = 0;
for (const c of missing) {
  try {
    await runChar(c);
    succeeded++;
  } catch (e) {
    console.error(`✗ ${c.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\n━━━ Resume summary: ${succeeded} succeeded, ${failed} still failed ━━━`);

console.log("\n━━━ Rebuilding runtime configs ━━━");
const charsBefore = JSON.parse(readFileSync(charsJsonPath, "utf-8")).length;
console.log(`characters.json now has ${charsBefore} entries`);

await generateConfigs(worldDesign, worldDir);
console.log("✓ Runtime configs rebuilt");
console.log("\nRestart WorldX server to pick up new characters.");
