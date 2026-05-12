import dotenv from "dotenv";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { generateStyleAnchor } from "./steps/step-z1-style-anchor.mjs";
import { generateOverworld } from "./steps/step-z2-overworld.mjs";
import { generateChunkGrid } from "./steps/step-z3-chunk-grid.mjs";
import { buildComposite, buildPreview } from "./steps/step-z5-composite.mjs";
import { repairSeams } from "./steps/step-z6-seam-repair.mjs";
import { generateWalkability } from "./steps/step-z7-walkability.mjs";
import { evaluateAllSeams } from "./validation/seam-ssim.mjs";
import { evaluateConnectivity } from "./validation/connectivity.mjs";
import { evaluateStyleVariance } from "./validation/style-variance.mjs";
import { evaluateLLMSemantic } from "./validation/llm-semantic.mjs";
import { evaluateFeatureContinuity } from "./validation/feature-continuity.mjs";
import { initLogger, log } from "./utils/logger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
dotenv.config({ path: join(ROOT, ".env") });

const OUTPUT_BASE = process.env.ZONE_OUTPUT_DIR || join(ROOT, "output/zones");

async function main() {
  const configArg = process.argv[2];
  if (!configArg) {
    console.error("Usage: node generators/zone/src/index.mjs <config.json>");
    process.exit(1);
  }
  const configPath = configArg.startsWith("/") || /^[A-Z]:/.test(configArg)
    ? configArg
    : join(__dirname, "../configs", configArg);
  if (!existsSync(configPath)) {
    console.error(`config not found: ${configPath}`);
    process.exit(1);
  }
  const zoneCfg = JSON.parse(readFileSync(configPath, "utf-8"));

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const inplaceDir = process.env.ZONE_INPLACE || "";
  const runDir = inplaceDir
    ? (inplaceDir.startsWith("/") || /^[A-Z]:/.test(inplaceDir) ? inplaceDir : join(OUTPUT_BASE, inplaceDir))
    : join(OUTPUT_BASE, `${zoneCfg.zoneId}_${runId}`);
  const chunksDir = join(runDir, "chunks");
  mkdirSync(chunksDir, { recursive: true });
  initLogger(join(runDir, inplaceDir ? `pipeline-inplace-${runId}.log` : "pipeline.log"));

  const save = (name, buf) => {
    const p = join(runDir, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buf);
    return p;
  };
  const saveJson = (name, obj) => {
    const p = join(runDir, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(obj, null, 2));
    return p;
  };

  log("Pipeline", "start", `zone=${zoneCfg.zoneId} run=${runId} dir=${runDir}`);
  saveJson("config.json", zoneCfg);

  const skipSteps = (process.env.ZONE_SKIP || "").split(",").filter(Boolean);
  const limitChunks = parseInt(process.env.ZONE_CHUNK_LIMIT || "0", 10);

  // ZONE_REUSE_FROM=<previous-run-dir> reuses Z1+Z2 outputs by default. To
  // also skip Z3 (no chunk regen at all), set ZONE_SKIP=z3 explicitly.
  // To regenerate ONLY missing chunks while keeping existing ones, leave Z3
  // enabled and set ZONE_SKIP_EXISTING=1 + ZONE_SKIP_EXISTING_DIR=<dir>.
  const reuseFrom = process.env.ZONE_REUSE_FROM || "";
  if (reuseFrom) {
    log("Pipeline", `reusing Z1+Z2 outputs from ${reuseFrom} (Z3 still active unless explicitly skipped)`);
    if (!skipSteps.includes("z1")) skipSteps.push("z1");
    if (!skipSteps.includes("z2")) skipSteps.push("z2");
  }
  const reuseDir = reuseFrom ? (reuseFrom.startsWith("/") || /^[A-Z]:/.test(reuseFrom) ? reuseFrom : join(OUTPUT_BASE, reuseFrom)) : null;

  // ── Step Z1: Style anchor ──
  let styleAnchorBuf;
  if (!skipSteps.includes("z1")) {
    console.log("\n═══ Z1: Style Anchor ═══");
    styleAnchorBuf = await generateStyleAnchor(zoneCfg);
    save("style-anchor.png", styleAnchorBuf);
  } else {
    const sourceDir = reuseDir || runDir;
    styleAnchorBuf = readFileSync(join(sourceDir, "style-anchor.png"));
    save("style-anchor.png", styleAnchorBuf);
    log("Z1", `skipped (loaded from ${sourceDir})`);
  }

  // ── Step Z2: Overworld semantic skeleton ──
  let overworldBuf;
  if (!skipSteps.includes("z2")) {
    console.log("\n═══ Z2: Overworld Semantic Skeleton ═══");
    overworldBuf = await generateOverworld(zoneCfg);
    save("overworld.png", overworldBuf);
  } else {
    const sourceDir = reuseDir || runDir;
    overworldBuf = readFileSync(join(sourceDir, "overworld.png"));
    save("overworld.png", overworldBuf);
    log("Z2", `skipped (loaded from ${sourceDir})`);
  }

  // ── Step Z3: chunk grid ──
  let cfgForGrid = zoneCfg;
  if (limitChunks > 0) {
    cfgForGrid = {
      ...zoneCfg,
      grid: { ...zoneCfg.grid, chunks: zoneCfg.grid.chunks.slice(0, limitChunks) },
    };
  }
  let chunkBufs;
  if (!skipSteps.includes("z3")) {
    console.log("\n═══ Z3: Chunk Grid ═══");
    const out = await generateChunkGrid(cfgForGrid, overworldBuf, styleAnchorBuf, save);
    chunkBufs = out.chunkBufs;
    saveJson("chunk-review-meta.json", out.reviewMeta);
  } else {
    const sourceDir = reuseDir || runDir;
    console.log(`\n═══ Z3: Chunk Grid (reused from ${sourceDir}) ═══`);
    chunkBufs = new Map();
    for (const c of cfgForGrid.grid.chunks) {
      const p = join(sourceDir, "chunks", `${c.id}.png`);
      if (!existsSync(p)) {
        log("Z3", `WARN: missing chunk file ${p}, skipping`);
        continue;
      }
      const buf = readFileSync(p);
      chunkBufs.set(c.id, buf);
      save(`chunks/${c.id}.png`, buf);
    }
  }
  log("Z3", "complete", `${chunkBufs.size}/${cfgForGrid.grid.chunks.length} chunks`);

  // ── Step Z4-pre: validation BEFORE seam repair ──
  console.log("\n═══ Z4-pre: Validation (before seam repair) ═══");
  const validationPre = {};
  validationPre.seamSsim = await evaluateAllSeams(chunkBufs, cfgForGrid.grid.chunks);
  log("Z4-pre", "SSIM", `mean=${validationPre.seamSsim.mean.toFixed(3)} pass=${validationPre.seamSsim.passingCount}/${validationPre.seamSsim.total}`);
  validationPre.featureContinuity = await evaluateFeatureContinuity(chunkBufs, cfgForGrid.grid.chunks);
  log("Z4-pre", "feature-continuity", `mean=${validationPre.featureContinuity.mean.toFixed(3)} pass=${validationPre.featureContinuity.passingCount}/${validationPre.featureContinuity.total}`);
  validationPre.connectivity = await evaluateConnectivity(chunkBufs, cfgForGrid.grid.chunks, cfgForGrid.grid.rows, cfgForGrid.grid.cols);
  log("Z4-pre", "connectivity", `${validationPre.connectivity.reachable}/${validationPre.connectivity.total} chunks reachable`);
  validationPre.styleVariance = await evaluateStyleVariance(chunkBufs);
  log("Z4-pre", "style variance", `mean pairwise dist=${validationPre.styleVariance.meanPairwise.toFixed(3)}, max=${validationPre.styleVariance.maxPairwise.toFixed(3)}`);
  saveJson("validation-pre-repair.json", validationPre);

  // composite snapshot before repair
  const compositePre = await buildComposite(chunkBufs, cfgForGrid);
  save("composite-full-pre-repair.png", compositePre);
  const previewPre = await buildPreview(chunkBufs, cfgForGrid);
  save("composite-preview-pre-repair.png", previewPre);

  // ── Step Z6: seam repair ──
  let seamLog = [];
  if (!skipSteps.includes("z6")) {
    console.log("\n═══ Z6: Seam Repair (Tier 1.1 inpainting) ═══");
    seamLog = await repairSeams(chunkBufs, cfgForGrid, styleAnchorBuf, save);
    saveJson("seam-repair-log.json", seamLog);
  } else {
    log("Z6", "skipped");
  }

  // ── Step Z4-post: validation AFTER seam repair ──
  console.log("\n═══ Z4-post: Validation (after seam repair) ═══");
  const validation = {};
  validation.seamSsim = await evaluateAllSeams(chunkBufs, cfgForGrid.grid.chunks);
  log("Z4-post", "SSIM", `mean=${validation.seamSsim.mean.toFixed(3)} pass=${validation.seamSsim.passingCount}/${validation.seamSsim.total}`);
  validation.featureContinuity = await evaluateFeatureContinuity(chunkBufs, cfgForGrid.grid.chunks);
  log("Z4-post", "feature-continuity", `mean=${validation.featureContinuity.mean.toFixed(3)} pass=${validation.featureContinuity.passingCount}/${validation.featureContinuity.total}`);
  validation.connectivity = await evaluateConnectivity(chunkBufs, cfgForGrid.grid.chunks, cfgForGrid.grid.rows, cfgForGrid.grid.cols);
  log("Z4-post", "connectivity", `${validation.connectivity.reachable}/${validation.connectivity.total} chunks reachable`);
  validation.styleVariance = await evaluateStyleVariance(chunkBufs);
  log("Z4-post", "style variance", `mean pairwise dist=${validation.styleVariance.meanPairwise.toFixed(3)}, max=${validation.styleVariance.maxPairwise.toFixed(3)}`);
  validation.llmSemantic = await evaluateLLMSemantic(chunkBufs, cfgForGrid.grid.chunks);
  if (validation.llmSemantic.skipped) {
    log("Z4-post", "LLM judge skipped");
  } else {
    log("Z4-post", "LLM judge", `${validation.llmSemantic.passing}/${validation.llmSemantic.total} consistent`);
  }
  saveJson("validation.json", validation);

  // ── Step Z5: composite (post-repair) ──
  console.log("\n═══ Z5: Composite ═══");
  const fullComposite = await buildComposite(chunkBufs, cfgForGrid);
  save("composite-full.png", fullComposite);
  const preview = await buildPreview(chunkBufs, cfgForGrid);
  save("composite-preview.png", preview);

  // ── Step Z7: walkability (per-chunk walkable mask + grid + TMJ) ──
  let z7Log = [];
  if (!skipSteps.includes("z7")) {
    console.log("\n═══ Z7: Walkability (per-chunk walkable + TMJ) ═══");
    z7Log = await generateWalkability(chunkBufs, cfgForGrid, runDir, save);
    saveJson("walkability-log.json", z7Log);
    const okCount = z7Log.filter((x) => x.ok).length;
    log("Z7", `complete`, `${okCount}/${z7Log.length} chunks have TMJ`);
  } else {
    log("Z7", "skipped");
  }

  // ── Final report ──
  const summarizeValidation = (v) => ({
    seamSsim: {
      mean: v.seamSsim.mean,
      min: v.seamSsim.min,
      max: v.seamSsim.max,
      passingCount: v.seamSsim.passingCount,
      total: v.seamSsim.total,
    },
    featureContinuity: v.featureContinuity ? {
      mean: v.featureContinuity.mean,
      min: v.featureContinuity.min,
      max: v.featureContinuity.max,
      passingCount: v.featureContinuity.passingCount,
      total: v.featureContinuity.total,
    } : null,
    connectivity: {
      reachable: v.connectivity.reachable,
      total: v.connectivity.total,
    },
    styleVariance: {
      meanPairwise: v.styleVariance.meanPairwise,
      maxPairwise: v.styleVariance.maxPairwise,
      mostDriftedChunk: v.styleVariance.mostDriftedChunk?.id,
    },
    llmSemantic: v.llmSemantic?.skipped
      ? { skipped: true }
      : v.llmSemantic
        ? { passing: v.llmSemantic.passing, total: v.llmSemantic.total }
        : { skipped: true },
  });

  const report = {
    runId,
    zoneId: zoneCfg.zoneId,
    chunksGenerated: chunkBufs.size,
    chunksTotal: cfgForGrid.grid.chunks.length,
    validationPreRepair: summarizeValidation(validationPre),
    validationPostRepair: summarizeValidation(validation),
    seamsRepaired: seamLog.filter((s) => s.ok).length,
    seamsAttempted: seamLog.length,
  };
  saveJson("report.json", report);

  console.log("\n═══════════════════════════════════════════");
  console.log(`✓ Zone pipeline complete!`);
  console.log(`  Run dir:    ${runDir}`);
  console.log(`  Chunks:     ${chunkBufs.size}/${cfgForGrid.grid.chunks.length}`);
  console.log(`  Pre-repair  SSIM: mean=${validationPre.seamSsim.mean.toFixed(3)} pass=${validationPre.seamSsim.passingCount}/${validationPre.seamSsim.total}`);
  console.log(`  Post-repair SSIM: mean=${validation.seamSsim.mean.toFixed(3)} pass=${validation.seamSsim.passingCount}/${validation.seamSsim.total}`);
  console.log(`  Pre-repair  reach: ${validationPre.connectivity.reachable}/${validationPre.connectivity.total}`);
  console.log(`  Post-repair reach: ${validation.connectivity.reachable}/${validation.connectivity.total}`);
  console.log(`  Style var (post): mean=${validation.styleVariance.meanPairwise.toFixed(3)} max=${validation.styleVariance.maxPairwise.toFixed(3)}`);
  if (!validation.llmSemantic.skipped) {
    console.log(`  LLM judge:  ${validation.llmSemantic.passing}/${validation.llmSemantic.total} consistent`);
  }
  console.log(`  Seams repaired: ${seamLog.filter((s) => s.ok).length}/${seamLog.length}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("Pipeline failed:", e);
  process.exit(1);
});
