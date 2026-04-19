---
name: worldspark-generation-pipeline
description: Changes or debugs the WorldX world generation pipeline: create-job flow, orchestrator prompts, world design normalization, style-aware map generation, region/element localization, character generation, and config bridging. Use when working on `npm run create`, front-end world creation, generated world contents, time config, or asset/config contracts.
---
# WorldX Generation Pipeline

## Use this skill when

Apply this skill for tasks involving:
- `npm run create`
- the create-world page or create-job API
- orchestrator prompt/schema changes
- map or character generation behavior
- generated world output layout
- config generation from assets

## Entry points

World creation can start from:
- CLI: `npm run create -- "<prompt>"`
- UI: `client/src/ui/pages/CreateWorldPage.tsx`
- server job orchestration: `server/src/core/create-job-manager.ts`
- create routes: `server/src/api/routes/worlds-create.ts`

The actual pipeline order is:

1. `orchestrator/src/world-designer.mjs` — LLM designs the world (max_tokens: 32768)
2. `generators/map/src/index.mjs` and `generators/character/src/index.mjs` — run in parallel
3. `orchestrator/src/index.mjs: purgeFailedCharacters()` — removes characters without valid sprites
4. `orchestrator/src/config-generator.mjs` — bridges assets into runtime configs
5. `orchestrator/src/index.mjs: cleanupIntermediateImages()` — removes intermediate PNGs (unless `KEEP_GENERATION_ARTIFACTS=1`)

Current orchestration rules:
- map and character generation run in parallel
- failed characters are automatically purged before config generation (empty dirs removed, `characters.json` and `worldDesign.characters` synced by name)
- config generation waits for both map + character
- intermediate images cleaned up after config generation in non-dev mode
- `dev=1` in the create page URL sets `KEEP_GENERATION_ARTIFACTS=1` to retain all artifacts

## Edit world design and time defaults

Touch these areas for schema/prompt/default changes:
- `orchestrator/prompts/design-world.md`
- `orchestrator/src/world-design-utils.mjs`
- `orchestrator/src/world-designer.mjs`

Current world design rules:
- `mapDescription` must follow "core identity first" format: `[时代/文化背景][场景类型]，[风格]，[1句构图要点]`; less is more — avoid verbose rendering instructions
- LLM call uses `max_tokens: 32768` (API default is 4096, far too small for full world JSON)
- orchestrator validates hard limits: max 8 characters, max 8 regions + elements combined; returns `feasible: false` if exceeded
- generated worlds normalize to fixed 15-minute ticks
- open scenes are authored with `startTime` + `endTime`; orchestrator derives runtime `maxTicks`
- `endOfDayText` and `newDayText` are generated for open-scene transitions
- `worldSocialContext` describes the social backdrop (weak injection into runtime prompts)
- `appearanceHint` per character describes what bystanders see (no identity spoilers)

## Edit map generation

Touch these areas for map work:
- `generators/map/prompts/`
- `generators/map/src/`
- `generators/map/src/utils/overlay-extraction.mjs`
- `generators/map/src/utils/image-utils.mjs`

Map pipeline steps:
1. Step 1: map image generation (with review + retry loop)
2. Step 2: upscale
3. Step 3: region localization (with review + retry up to 2 times, dynamic constraints)
4. Step 3.2: interactive element localization (same retry logic as Step 3)
5. Step 4: walkable area generation
6. Step 5: walkable grid computation and TMJ assembly
7. Step 6: final packaging

Important current behavior:
- map style follows the user prompt; do not assume pixel art
- Step 3 and 3.2 have retry logic: on review failure, retries up to 2 times with dynamically added constraints; if still failing, ignores problematic regions/elements
- walkable grid uses conservative "less is better" thresholds with thin-corridor rescue
- `cleanupGrid` only removes isolated walkable cells (no gap-filling expansion)
- prompts include concise summaries for both regions and interactive elements
- Step 3 and 3.2 may use `buildOverlayWorkingImage()` to downscale large images for token savings
- extracted boxes must be remapped back to original image pixels before writing runtime artifacts

Runtime-facing map contract:
- `map/06-final.tmj`
- `map/06-background.png`
- `map/06-regions-scaled.json`
- `map/06-elements-scaled.json`
- layer names: `regions`, `interactive_objects`

Note: the `timelines/` subdirectory is created at runtime by `TimelineManager`, not by the generation pipeline.

If you rename map outputs, update both:
- `client/src/scenes/BootScene.ts`
- `server/src/index.ts`

## Edit character generation

Touch these areas for character asset work:
- `generators/character/prompts/`
- `generators/character/src/index.mjs`
- `generators/character/src/utils/chromakey.mjs`

Character generation now receives:
- `--name`: character name
- `--role`: character role/identity
- `--world-visual-context`: synthesized from `mapDescription` + `worldDescription` + `worldName`

The sprite generation prompt uses `characterRole`, `characterAppearance`, and `worldVisualContext` as separate placeholders. World visual context is reference-only; the character's own design takes precedence if there's a deliberate contrast (e.g., time traveler in ancient setting).

Chromakey notes:
- background classification uses flood-fill from corners
- soft edges apply alpha blending plus color decontamination
- preserve internal green sprite details when changing thresholds

Runtime-facing character contract:
- `characters/characters.json`
- `characters/<char-id>/spritesheet.png`
- `config/characters/<char-id>.json`

If character output layout changes, also update:
- `orchestrator/src/config-generator.mjs`
- `server/src/utils/config-loader.ts`
- `client/src/scenes/BootScene.ts`

## Edit config bridging

Use `orchestrator/src/config-generator.mjs` when the problem is:
- generated regions/elements do not appear correctly in runtime
- interactive elements are missing from `main_area`
- anchors or start positions drift
- `mainAreaPoints`, `worldSize`, or scene metadata disagree with generated assets

Use `orchestrator/src/main-area-points.mjs` when the problem is:
- main-area point generation
- density / clearance rules
- element approach points (`element_<id>`)
- walkable snapping outside element boxes
- spawn point edge avoidance

Use `server/src/utils/config-loader.ts` when the problem is:
- runtime reads the wrong generated files
- generated config shape does not match runtime expectations
- scene config merging is wrong

## Verification

After generation-pipeline changes:

1. Run one create flow:

```bash
cd WorldX
npm run create -- "<prompt>"
```

or exercise the UI create flow through `/create`.

2. Inspect the new `output/worlds/<world-id>/`.
3. Confirm expected files exist, especially `06-elements-scaled.json` when elements were designed.
4. Load the generated world with:

```bash
WORLD_DIR=output/worlds/<world-id> npm run dev
```

## Common pitfalls

- Runtime consumes `config/world.json` and `config/characters/*.json`, not raw `world-design.json`.
- A world can generate successfully while still being unrunnable if asset naming or config bridging drift.
- Element approach points must stay outside the element box on walkable tiles.
- 2K/4K localization bugs usually come from forgetting the working-image-to-original-image coordinate remap.
- Generation does not create `timelines/` or `state.db`; those are created by the server's `TimelineManager` on first run.
- If world design JSON is truncated, check `max_tokens` in `world-designer.mjs` (currently 32768).
- Failed characters are purged by name matching between `characters.json` and `worldDesign.characters`; index-based mapping in `config-generator.mjs` depends on this alignment.
