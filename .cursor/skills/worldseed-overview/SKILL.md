---
name: worldseed-overview
description: Maps WorldSeed architecture, ownership boundaries, commands, and output contracts. Use when starting any WorldSeed task, deciding which subsystem owns a feature or bug, or orienting an agent to the repo before making changes.
---
# WorldSeed Overview

## Quick start

Use this skill first when the task touches multiple subsystems or the correct edit location is unclear.

Local setup:

```bash
cd world-seed
npm install
cd client && npm install
cd ../server && npm install
```

Run the stack:

```bash
npm run dev
```

Select a specific generated world only when needed:

```bash
WORLD_DIR=output/worlds/<world-id> npm run dev
```

Expected local endpoints:
- Client: `http://localhost:3200`
- Server: `http://localhost:3100`

## Repo map

- `orchestrator/`: sentence -> `world-design.json` -> parallel map/character generation -> config generation
- `generators/map/`: builds map artifacts including `06-final.tmj` and `06-background.png`
- `generators/character/`: builds character spritesheets under `characters/<charId>/spritesheet.png`; includes chromakey green-screen removal with color decontamination
- `server/`: simulation runtime, config loading, LLM decisions, dialogue, memory, relationships
- `client/`: Phaser + React runtime viewer and controls
- `output/worlds/<world-id>/`: generated world artifacts consumed by runtime

Runtime world selection:
- server defaults to the lexicographically latest directory in `output/worlds/`
- `WORLD_DIR` overrides the selected world
- client top bar can switch generated worlds through the `Scene` selector

## Key domain concepts

- **Functional regions**: spaces characters can enter and walk inside (rooms, plazas, gardens). Defined in `worldDesign.regions`.
- **Interactive elements**: map objects in `main_area` that characters approach to interact with but do not enter (stalls, wells, shrines). Defined in `worldDesign.interactiveElements`.
- **Combined limit**: `regions + interactiveElements <= 8`.
- **Character anchoring**: a profile-level constraint (`anchor: { type: "region"|"element", targetId }`) that restricts a character to stay in a region or near an element. Anchored characters cannot use `move_to` or `move_within_main_area`.
- **Main area points**: server-side navigation graph for large `main_area` spaces, including auto-generated element approach points (`element_<id>`).

## Task routing

Use these ownership rules:

- World prompt/schema/worldActions/regions/interactiveElements/character anchoring/scene-time changes:
  - `orchestrator/prompts/design-world.md`
  - `orchestrator/src/world-design-utils.mjs`
  - `orchestrator/src/world-designer.mjs`
  - `orchestrator/src/config-generator.mjs`
  - `orchestrator/src/main-area-points.mjs`

- Map generation behavior, region localization, element localization, walkable areas, output naming:
  - `generators/map/src/`
  - `generators/map/prompts/`
  - `generators/map/src/utils/overlay-extraction.mjs` (shared color-diff extraction for both regions and elements)

- Character image generation, spritesheet output, and green-screen removal:
  - `generators/character/src/`
  - `generators/character/prompts/`
  - `generators/character/src/utils/chromakey.mjs`

- Agent behavior, decisions, dialogue, action execution, anchor enforcement:
  - `server/src/simulation/`
  - `server/src/core/`
  - `server/src/llm/`

- Runtime startup, asset serving, config loading, API behavior:
  - `server/src/index.ts`
  - `server/src/utils/config-loader.ts`
  - `server/src/api/routes/`

- Camera, playback, asset preload, top bar, minimap, scene presentation:
  - `client/src/scenes/`
  - `client/src/systems/`
  - `client/src/ui/`

## Runtime contract

Generated worlds are expected to look like:

```text
output/worlds/<world-id>/
├── world-design.json
├── config/
│   ├── world.json
│   ├── scene.json
│   └── characters/*.json
├── map/
│   ├── 06-final.tmj
│   ├── 06-background.png
│   ├── 06-regions-scaled.json
│   └── 06-elements-scaled.json
└── characters/
    ├── characters.json
    └── <char-id>/spritesheet.png
```

Client asset load expectations:
- `/assets/map/06-final.tmj`
- `/assets/map/06-background.png`
- `/assets/characters/<char-id>/spritesheet.png`

Config/runtime notes:
- `config/world.json` is the primary runtime world contract
- `config/scene.json` is still emitted and merged for scene-time compatibility
- `world.json` may include `worldActions`, `mainAreaPoints`, `worldSize`, and scene metadata consumed by runtime
- character configs may include `anchor` for anchored characters

Map layer assumptions:
- Functional regions live in the `regions` object layer
- Interactive elements live in the `interactive_objects` object layer
- Runtime is single-background-layer oriented
- `ysort` is not part of the current runtime path

## High-value gotchas

- Root `npm install` is not enough; `client` and `server` have their own dependencies.
- Server runtime must read root `.env`, not `server/.env`.
- If ticks advance but characters do nothing, inspect server logs for LLM failures before touching client logic.
- If Phaser reports JSON parse errors with `<!DOCTYPE`, the browser got HTML instead of assets; check asset paths and Vite `/assets` proxying.
- Runtime world selection is no longer driven by `WORLD_ID`.
- Use `WORLD_DIR` to force a world at startup, or switch worlds from the client `Scene` selector.
- Map generation no longer assumes pixel art by default; preserve user-requested style while keeping map readability for downstream region/walkable extraction.
- Character start positions for element-anchored characters are placed **outside** the element bounding box, not at its center.
- All model calls in the map generation pipeline have retry logic (max 2 consecutive failures before abort).
