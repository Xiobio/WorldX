---
name: worldx-runtime-debugging
description: Runs and debugs the live WorldX stack: dev startup, create-world jobs, asset serving, Vite proxying, simulation playback, timeline switching, replay mode, world switching, anchoring, overlays, day transitions, god system, sandbox chat, i18n, and LLM auth failures. Use when `npm run dev` fails, `/create` stalls, Play does nothing, replay breaks, timelines fail, assets 404, characters behave incorrectly, i18n strings are wrong, or day transitions glitch at runtime.
---
# WorldX Runtime Debugging

## Startup checklist

Use this sequence first:

```bash
cd WorldX
npm install
cd client && npm install
cd ../server && npm install
cd ..
npm run dev
```

Force a specific generated world:

```bash
cd WorldX
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

### `/create` fails or generation never progresses

Check:
- `client/src/ui/pages/CreateWorldPage.tsx`
- `server/src/api/routes/worlds-create.ts`
- `server/src/core/create-job-manager.ts`

Current behavior:
- only one create job may run at a time
- UI can attach to an existing running job
- create flow emits phase/step/log events over the job API
- `dev=1` in the create page URL retains all intermediate artifacts for debugging

### World design JSON truncated (3 retries, all fail)

Cause:
- `max_tokens` too low for the large world design JSON

Check:
- `orchestrator/src/world-designer.mjs` — currently `maxTokens: 32768`
- `orchestrator/src/models/llm-client.mjs` — `maxTokens` param on `chat`

If the API default is 4096 and your world has 6-8 characters with full configs, the output easily exceeds that. The current setting of 32768 should be sufficient.

### Character shows as pink circle

Cause:
- character sprite generation failed; empty dir exists but no `spritesheet.png`

Current behavior:
- `purgeFailedCharacters()` in `orchestrator/src/index.mjs` automatically removes failed characters after generation
- if you see this in an older world, the cleanup was added after that world was generated

### `world.json not found`

Check:
- `output/worlds/<world-id>/config/world.json`
- `server/src/utils/config-loader.ts`
- `server/src/utils/world-directories.ts`

Current selection rules:
- startup world comes from `WORLD_DIR` or latest generated world
- runtime is not driven by `WORLD_ID`

### Phaser JSON parse error with `<!DOCTYPE`

Cause:
- browser fetched HTML instead of the TMJ/image asset

Check:
- `client/src/scenes/BootScene.ts`
- `client/vite.config.ts`
- `server/src/index.ts`

Expected asset paths:
- `/assets/map/06-final.tmj`
- `/assets/map/06-background.png`
- `/assets/characters/<char-id>/spritesheet.png`

### Play toggles but nothing happens

Check:
- `client/src/systems/PlaybackController.ts`
- `client/src/scenes/WorldScene.ts`
- `/api/simulation/tick`

Current playback notes:
- UI has a mode toggle: **Run** vs **Replay**
- in Run mode, Play/Pause controls the live simulation (server-driven ticks)
- in Replay mode, Play/Pause controls replay playback (client-driven from JSONL)
- the `PlaybackController` internally tracks `mode: "live" | "replay"` and dispatches accordingly
- `set_auto_play` event routes to `setAutoPlay` (live) or `setReplayAutoPlay` (replay) based on current mode
- the next tick waits for client playback completion before advancing
- if Play does nothing in Run mode, check `/api/simulation/tick` response
- if Play does nothing in Replay mode, check that `events.jsonl` has tick frames

### Ticks advance but characters do nothing

Check server logs for:
- `Decision wave error`
- `Dialogue session error`
- `LLM API error 401`

Relevant files:
- `server/src/llm/llm-client.ts`
- `server/src/simulation/decision-maker.ts`
- `server/src/simulation/simulation-engine.ts`
- `server/configs/prompts/reactive-decision.md`

Common causes:
- root `.env` not loaded
- `SIMULATION_*` vars invalid
- reactive prompt or perception logic making one action dominate

### Characters never talk to each other

Check:
- `server/src/simulation/action-menu-builder.ts` — `isLegalDirectTalkTarget` requires same location; `canInitiateDialogueHere` restricts anchored characters
- `server/src/simulation/perceiver.ts` — who is visible (same location characters)
- `server/configs/prompts/reactive-decision.md` — prompt may not encourage dialogue enough

Common causes:
- characters in different locations (main_area vs a region)
- main_area anchored characters cannot initiate dialogue (by design)
- extraversionLevel or socialStyle not encouraging enough

### Day transition looks wrong or freezes

Check:
- `client/src/ui/App.tsx` — `transitionPhase` state machine (`hidden` → `ending` → `starting` → `fade-out`)
- `client/src/ui/panels/SceneTransition.tsx` — overlay rendering, backdrop filter
- `client/src/systems/PlaybackController.ts` — `cycleTicks`, `scene_ending` / `scene_covered` event handshake

Current behavior:
- on the last tick of a cycle, `PlaybackController` emits `scene_ending` and waits for `scene_covered` before fetching next tick
- `App.tsx` listens for `scene_ending` → sets `transitionPhase: "ending"` → `SceneTransition` covers screen → emits `scene_covered`
- new day data loads behind the cover → `transitionPhase: "starting"` shows new day info → fades out

If transition freezes, check that `scene_covered` event is properly emitted back.

### Timeline switching fails or page doesn't reload

Check:
- `server/src/api/routes/timeline.ts` — `POST /:id/load`
- `server/src/services/app-context.ts` — `switchTimeline()` method
- `client/src/ui/panels/TopBar.tsx` — `handleTimelineChange`

Current behavior:
- switching timelines closes the old `state.db`, opens the new timeline's `state.db`, rebuilds server runtime, then the client reloads the page
- if the new timeline's `state.db` is missing or corrupted, the switch will fail

### Replay mode shows no data or finishes instantly

Check:
- `server/src/api/routes/timeline.ts` — `GET /:id/events`
- the timeline's `events.jsonl` in `output/worlds/<world-id>/timelines/<timeline-id>/`
- `client/src/systems/PlaybackController.ts` — `startReplay()`

Current behavior:
- replay reads the entire `events.jsonl` and parses it into frames
- the first frame should be type `"init"` (initial character positions)
- subsequent frames are type `"tick"` with events
- if `events.jsonl` is empty or only has an init frame, replay will show nothing
- the Replay button in the UI is disabled when `tickCount === 0`

### New Timeline or world restart fails

Check:
- `server/src/services/app-context.ts` — `createNewTimeline()` and `resetWorldState()`
- `server/src/services/timeline-manager.ts` — `createTimeline()`

Current behavior:
- "New Timeline" creates a fresh timeline directory with empty `state.db` + `events.jsonl`
- the old timeline is preserved (status set to "stopped")
- the server reinitializes the DB schema and rebuilds runtime

### Database errors or missing tables

Check:
- `server/src/store/db.ts`
- the active timeline's `state.db` path

Current behavior:
- there is **no global database**; each timeline has its own `state.db`
- `db.ts` module dynamically connects to the active timeline's DB path
- if tables are missing, the DB initialization step in `app-context.ts` may have failed
- snapshots are stored relative to the active timeline's DB directory (`server/src/store/snapshot-store.ts`)

### Anchored character moves to wrong place

Check:
- `server/src/simulation/action-menu-builder.ts`
- `server/src/simulation/action-executor.ts`
- `server/src/core/character-manager.ts`
- `server/src/utils/config-loader.ts`

If an element-anchored character spawns inside the element:
- inspect `orchestrator/src/config-generator.mjs`
- inspect `orchestrator/src/main-area-points.mjs`

### 2K/4K runtime feels slower or scaled wrong

Check:
- `client/src/config/game-config.ts`
- `client/src/objects/CharacterSprite.ts`
- `client/src/systems/CharacterMovement.ts`

Current expectation:
- characters, dialogue spacing, and movement should scale relative to map dimensions
- higher-resolution worlds should look sharper, not larger in gameplay terms

### Time resets or transitions look wrong

Check:
- `server/src/core/world-manager.ts`
- `server/src/utils/time-helpers.ts`
- `server/src/utils/config-loader.ts`
- `server/src/api/routes/world.ts`

Current expectation:
- day/tick persist through `world_global_state` in the active timeline's `state.db`
- open-scene duration comes from authored time window
- scene transitions clear transient character/object state

## Debug overlays

Available with `?dev=1`:
- walkable area
- region boxes
- main-area points
- interactive objects
- tick granularity selector (15min / 30min / 1h)

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

Timeline list:

```bash
curl -s http://localhost:3100/api/timelines
```

If the TMJ request returns HTML, debug proxy/path alignment before touching Phaser scene code.

### UI text shows raw i18n key (e.g., `topbar.run`)

Cause:
- missing key in `client/src/i18n/zh.json` or `en.json`
- or i18n not initialized (missing `import "../i18n"` in `main.tsx`)

Check:
- `client/src/i18n/index.ts` — initialization
- `client/src/i18n/zh.json` / `en.json` — locale files
- `client/src/main.tsx` — must import `"./i18n"`

### World intro banner not showing

Check:
- `client/src/ui/panels/WorldIntroBanner.tsx`
- `client/src/ui/App.tsx` — mounting condition requires `worldInfo.originalPrompt` or `worldInfo.worldDescription` to be non-empty
- `server/src/api/routes/world.ts` — `/info` endpoint must return `originalPrompt`
- `config/world.json` — must have `originalPrompt` field

### `Character state not found` during simulation

Cause:
- transient state inconsistency, often after server restart or timeline switch

Current behavior:
- `SimulationEngine.runDialogueSession` catches the error, cleans up the dialogue session, resets participant actions, and continues the tick
- this is a containment fix; if it happens persistently, investigate deeper state management

## Env split

- Server simulation uses `SIMULATION_*`
- Orchestrator and map text processing use `ORCHESTRATOR_*`
- Image generation uses `IMAGE_GEN_*`, vision review uses `VISION_*`
- Generation can work while live simulation fails if only generation keys are configured correctly

## Common current assumptions

- runtime is single-background-layer oriented
- regions come from `regions`
- interactive elements come from `interactive_objects`
- client shows formatted scene time, not raw ticks
- major visual sizes are relative to map dimensions, not absolute pixels
- each timeline is an isolated SQLite database; no shared state between timelines
- switching worlds or timelines always reloads the client page
- intermediate generation images are cleaned up in non-dev mode; only `06-background.png` and `spritesheet.png` survive
- UI is fully internationalized (Chinese/English) via `react-i18next`; language toggle persists to `localStorage`; defaults to system language
- world intro banner auto-shows on first load per world, then fades after 6 seconds
