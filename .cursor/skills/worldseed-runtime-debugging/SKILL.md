---
name: worldseed-runtime-debugging
description: Runs and debugs the live WorldSeed stack: dev startup, asset serving, Vite proxying, simulation playback, server config loading, anchor enforcement, debug overlays, and LLM auth failures. Use when `npm run dev` fails, Play does nothing, assets 404, Phaser parses HTML as JSON, anchored characters misbehave, or ticks advance without character behavior.
---
# WorldSeed Runtime Debugging

## Startup checklist

Use this sequence first:

```bash
cd world-seed
npm install
cd client && npm install
cd ../server && npm install
cd ..
npm run dev
```

To force a specific generated world at startup:

```bash
cd world-seed
WORLD_DIR=output/worlds/<world-id> npm run dev
```

Expected endpoints:
- Client: `http://localhost:3200`
- Server: `http://localhost:3100`

## Fast triage

### `vite` / `express` / package not found

Cause:
- subproject dependencies are missing

Fix:
- install inside `client/` and `server/`, not just root

### `world.json not found`

Cause:
- runtime is pointed at a generated world, but config loading is reading the wrong directory

Check:
- `output/worlds/<world-id>/config/world.json`
- `server/src/utils/config-loader.ts`

Note:
- runtime world selection now comes from `WORLD_DIR` or the default latest generated world, not `WORLD_ID`
- after startup, the client can switch generated worlds through the `Scene` selector

### Phaser JSON parse error with `<!DOCTYPE`

Cause:
- browser fetched HTML instead of the TMJ or image asset

Check:
- `client/src/scenes/BootScene.ts`
- `client/vite.config.ts`
- `server/src/index.ts`

Current expected asset paths:
- `/assets/map/06-final.tmj`
- `/assets/map/06-background.png`
- `/assets/characters/<char-id>/spritesheet.png`

### Play toggles but nothing happens

Check:
- `client/src/systems/PlaybackController.ts`
- `/api/simulation/tick`

If the button changes state but ticks do not advance, inspect the playback controller and event bus wiring before touching the server.

Note:
- Current UI exposes `Play` / `Pause`, not a top-bar `Step` button
- Pause can be clicked mid-tick; simulation stops after the current tick completes
- For single-tick debugging, use the simulation API directly rather than assuming a dedicated UI control exists

### Ticks advance but characters do nothing

This usually means simulation requests are running but decisions, dialogue execution, or downstream action handling are failing.

Check server logs for:
- `Decision wave error`
- `Dialogue session error`
- `LLM API error 401`

Likely causes:
- server did not load root `.env`
- `LLM_API_KEY` is empty or invalid
- `LLM_BASE_URL` / `LLM_DEFAULT_MODEL` mismatch

Relevant files:
- `server/src/index.ts`
- `server/src/llm/llm-client.ts`
- `server/src/simulation/decision-maker.ts`
- `server/src/simulation/simulation-engine.ts`

### Anchored character moves to wrong area

If an anchored character appears outside their anchor zone or is executing `move_to`:

Check:
- `server/src/simulation/action-menu-builder.ts` (should omit move actions)
- `server/src/simulation/action-executor.ts` (defensive guard)
- `server/src/core/character-manager.ts` (initial position resolution)
- `server/src/utils/config-loader.ts` (`normalizeAnchor`)

If an element-anchored character spawns **inside** the element:
- Check `orchestrator/src/config-generator.mjs` (`findNearestWalkableTileOutsideBox`)
- Check `orchestrator/src/main-area-points.mjs` (`snapToWalkableOutsideBox`)
- The start position must be outside the element's bounding box

### Time resets after restart

Check:
- `server/src/core/world-manager.ts`
- `server/src/store/db.ts`
- `server/src/utils/time-helpers.ts`

Current expectation:
- day/tick should persist through `world_global_state`
- scene display time is derived from persisted day/tick plus scene config

### Character sprites have green fringe

If characters show green edges after generation:
- Check `generators/character/src/utils/chromakey.mjs`
- The `removeGreenBackground` function applies color decontamination for soft-edge pixels
- The formula `fg = (pixel - bg*(1-t)) / t` removes green spill
- Safety threshold `t >= 0.15` prevents noise amplification
- Do not lower this threshold without verifying internal green sprite parts are preserved

### Map generation model timeouts

If the pipeline crashes during generation due to model API timeouts:
- All model calls in map generation use `withRetry` (max 2 consecutive attempts)
- Check `generators/map/src/utils/gemini-flash-img.mjs` and `generators/map/src/utils/gemini-pro.mjs`
- Timeouts that occur only once are retried automatically; only two consecutive failures abort

## Debug overlays

Available only when accessing the client with `?dev=1`:
- **Walkable area overlay**: blue translucent layer showing walkable tiles
- **Functional region overlay**: bounding boxes with labels
- **Main-area points overlay**: navigation point ids and positions
- **Interactive objects overlay**: element bounding boxes and names

Key files:
- `client/src/scenes/WorldScene.ts`
- `client/src/ui/App.tsx`

## Minimal health checks

Server health:

```bash
curl -s http://localhost:3100/api/health
```

Asset check through Vite:

```bash
curl -I http://localhost:3200/assets/map/06-final.tmj
```

If the TMJ request returns HTML or a redirect, debug proxy/path alignment before touching Phaser code.

## LLM-specific notes

- Server simulation uses `LLM_*` env vars
- Orchestrator uses `ARK_*` env vars
- A generation flow can work while live simulation still fails if only `ARK_*` is configured correctly
- If Ark returns `401`, confirm the server process is reading `world-seed/.env`, not `server/.env`

## UI/runtime ownership

- Preload and asset paths: `client/src/scenes/BootScene.ts`
- Main scene and presentation: `client/src/scenes/WorldScene.ts`
- Camera and playback: `client/src/systems/`
- Top bar / minimap / overlays: `client/src/ui/`
- Asset serving and API mounting: `server/src/index.ts`

## Common current assumptions

- Runtime is single-background-layer oriented
- `ysort` is not part of the current runtime path
- Regions come from the `regions` object layer
- Interactive elements come from the `interactive_objects` object layer
- Generated character configs are normalized by `server/src/utils/config-loader.ts`
- Client displays scene time (formatted), not raw tick counters
- All major visual sizes (character, bubble, dialogue distance) are relative to map dimensions, not absolute pixels
