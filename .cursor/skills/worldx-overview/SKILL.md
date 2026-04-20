---
name: worldx-overview
description: Maps WorldX architecture, ownership boundaries, create flows, runtime contracts, timeline system, i18n, and debugging entry points. Use when starting any WorldX task, deciding which subsystem owns a feature or bug, or orienting an agent before making changes.
---
# WorldX Overview

## Quick start

Use this skill first when the task spans multiple subsystems or the correct edit location is unclear.

Local setup:

```bash
cd WorldX
npm install
cd client && npm install
cd ../server && npm install
```

Run the stack:

```bash
npm run dev
```

Force a specific generated world only when needed:

```bash
WORLD_DIR=output/worlds/<world-id> npm run dev
```

Expected local endpoints:
- Client: `http://localhost:3200`
- Server: `http://localhost:3100`

Create flows:
- Productized UI: `client/src/ui/pages/CreateWorldPage.tsx`
- Server job orchestration: `server/src/core/create-job-manager.ts`
- CLI fallback: `npm run create -- "<prompt>"`

## Repo map

- `client/`: Phaser + React runtime, create-world UX, playback, panels, dev overlays
- `server/`: runtime APIs, create job APIs, simulation, dialogue, memory, persistence, timeline management
- `orchestrator/`: world design prompt -> normalized design -> config bridging
- `generators/map/`: map image generation, region/element localization, walkable extraction, TMJ packaging
- `generators/character/`: sprite generation and chromakey cleanup
- `output/worlds/<world-id>/`: generated worlds consumed by runtime

Runtime world selection:
- server defaults to the latest generated world under `output/worlds/`
- `WORLD_DIR` overrides startup selection
- client can switch worlds after startup

## Timeline system

Each world can have multiple **timelines** — independent simulation recordings. A timeline is a self-contained directory:

```text
output/worlds/<world-id>/timelines/<timeline-id>/
├── meta.json       # metadata: id, worldId, createdAt, tickCount, status
├── events.jsonl    # append-only event stream (init frame + tick frames)
└── state.db        # per-timeline SQLite database (live working DB)
```

Key behaviors:
- **Recording**: when the simulation runs, events are automatically appended to the active timeline's `events.jsonl`; the server writes directly to the timeline's `state.db`
- **Continuation**: loading a timeline and running continues appending to the *same* files (no branching)
- **New Timeline**: creates a fresh `state.db` + `events.jsonl` for the current world, preserving old timelines
- **Replay**: client-side-only playback from `events.jsonl`; does not involve server simulation logic
- **Per-timeline DB**: there is no global database; each timeline owns its own `state.db`, and the server dynamically connects to the active one

Server-side:
- `server/src/services/timeline-manager.ts` — timeline CRUD, JSONL writing, metadata management
- `server/src/services/app-context.ts` — centralized context; manages active world + timeline, initializes per-timeline DB, hooks recording into the event bus
- `server/src/api/routes/timeline.ts` — REST endpoints for listing, creating, loading, deleting timelines and fetching replay events
- `server/src/store/snapshot-store.ts` — snapshots are stored relative to the active timeline's DB directory

Client-side:
- `client/src/systems/PlaybackController.ts` — supports "live" (server-driven simulation) and "replay" (client-driven from JSONL) modes
- `client/src/scenes/WorldScene.ts` — handles replay-specific events, guards server-mutating calls during replay
- `client/src/ui/panels/TopBar.tsx` — mode toggle (Run / Replay), timeline selector, play/pause, progress bar
- `client/src/ui/panels/TimelineManagerModal.tsx` — modal for managing all worlds + timelines (delete, inspect)
- `client/src/ui/services/api-client.ts` — timeline API methods

## Key concepts

- **Functional regions**: enterable spaces from `worldDesign.regions`
- **Interactive elements**: `main_area` objects characters approach but do not enter
- **Character anchoring**: `anchor: { type: "region"|"element", targetId }`; anchored characters do not get long-distance move actions; main_area anchored cannot initiate dialogue; region-anchored can initiate within their region only
- **Main area points**: logical navigation graph for large `main_area` spaces, including `element_<id>` approach points
- **Scene time**: world design centers on `startTime` and optional `endTime`; orchestrator normalizes to fixed 15-minute ticks for generated worlds
- **Day transitions**: open scenes use multi-phase overlay (`ending` → `starting` → `fade-out`); `PlaybackController` pauses tick advancement until screen is covered
- **Relative sizing**: character size, dialogue spacing, labels, and movement speed scale with map dimensions rather than raw pixels
- **Timeline**: a recorded simulation run; each world can have many timelines; the UI calls them "timelines" (时间线)
- **Inner monologue**: optional `innerMonologue` field on action decisions and dialogue turns; displayed as cloud-shaped thought bubbles
- **God system**: broadcast events to all characters, whisper/dream memories into individual characters, edit character profiles at runtime
- **Sandbox chat**: isolated conversation with a character outside the simulation timeline (Mode B)
- **Appearance hints**: `appearanceHint` on each character provides a "what a bystander would notice" description, injected into perception
- **World social context**: `worldSocialContext` is a weak background injection into reactive decision and dialogue prompts
- **Content language**: `contentLanguage` field (`"zh"` | `"en"`) in `WorldConfig` signals LLM prompts to produce content in the matching language; determined by the user's creation prompt language
- **Original prompt**: `originalPrompt` field in `WorldConfig` stores the user's raw creation input; displayed in the `WorldIntroBanner` at runtime

## Internationalization (i18n)

UI language and AI-generated content language are decoupled:
- **UI language**: user-switchable via `LanguageToggle` component; persisted in `localStorage`; defaults to system language (`navigator.language`) when no stored preference exists
- **AI content language**: world-specific, determined by `contentLanguage` in `WorldConfig`; the server appends a language hint to LLM prompts when `contentLanguage === "en"`

Key files:
- `client/src/i18n/index.ts` — i18n config (`react-i18next` + `i18next`)
- `client/src/i18n/zh.json` / `client/src/i18n/en.json` — locale strings
- `client/src/ui/components/LanguageToggle.tsx` — language switch component
- `server/src/llm/prompt-builder.ts` — `setContentLanguage()` and conditional English hint injection
- `client/src/ui/utils/time-i18n.ts` — maps server-generated time period labels to i18n keys

All UI strings (TopBar, SidePanel, CharacterDetail, DialoguePanel, GodPanel, SandboxChatPanel, MapControls, SceneTransition, TimelineManagerModal, CreateWorldPage, RelationshipGraph, Timeline) use `t()` from `useTranslation()`.

## World intro banner

`client/src/ui/panels/WorldIntroBanner.tsx` shows a fading introduction banner on world load:
- Displays `originalPrompt` (fallback: `worldDescription`) and world name
- Auto-hides after 6 seconds; hover pauses the timer; manual close via ✕ button
- Mounted in `client/src/ui/App.tsx`

## Ownership guide

- World prompt/schema/time defaults/anchors/interactive elements:
  - `orchestrator/prompts/design-world.md`
  - `orchestrator/src/world-design-utils.mjs`
  - `orchestrator/src/config-generator.mjs`
  - `orchestrator/src/main-area-points.mjs`

- Map generation and localization:
  - `generators/map/src/`
  - `generators/map/prompts/`
  - `generators/map/src/utils/overlay-extraction.mjs`
  - `generators/map/src/utils/image-utils.mjs`

- Character generation and sprite cleanup:
  - `generators/character/src/`
  - `generators/character/prompts/`
  - `generators/character/src/utils/chromakey.mjs`

- Simulation semantics, actions, dialogue, memory:
  - `server/src/simulation/`
  - `server/src/core/`
  - `server/src/llm/`

- God system and sandbox chat:
  - `server/src/api/routes/god.ts`
  - `server/src/api/routes/sandbox-chat.ts`
  - `client/src/ui/panels/GodPanel.tsx`
  - `client/src/ui/panels/SandboxChatPanel.tsx`

- Timeline management and persistence:
  - `server/src/services/timeline-manager.ts`
  - `server/src/services/app-context.ts`
  - `server/src/api/routes/timeline.ts`
  - `server/src/store/snapshot-store.ts`

- Runtime APIs, world switching, dev controls, create jobs:
  - `server/src/api/routes/`
  - `server/src/core/create-job-manager.ts`
  - `server/src/utils/config-loader.ts`

- Presentation, playback, pathfinding, overlays:
  - `client/src/scenes/`
  - `client/src/systems/`
  - `client/src/objects/`
  - `client/src/ui/`

- UI internationalization:
  - `client/src/i18n/` — config, locale JSON files
  - `client/src/ui/components/LanguageToggle.tsx`
  - `client/src/ui/utils/time-i18n.ts`
  - `client/src/ui/utils/event-format.ts`

- World intro banner:
  - `client/src/ui/panels/WorldIntroBanner.tsx`
  - `client/src/ui/App.tsx` (mounting)

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
├── characters/
│   ├── characters.json
│   └── <char-id>/spritesheet.png
└── timelines/
    └── <timeline-id>/
        ├── meta.json
        ├── events.jsonl
        └── state.db
```

Note: in non-dev mode, intermediate images (map attempt PNGs, walkable overlays, spritesheet-raw.png, etc.) are automatically cleaned up after generation. Only `06-background.png` and `spritesheet.png` survive. JSON files and logs are kept. Pass `dev=1` in the create page URL to retain all artifacts.

Client asset expectations:
- `/assets/map/06-final.tmj`
- `/assets/map/06-background.png`
- `/assets/characters/<char-id>/spritesheet.png`

Runtime/config notes:
- `config/world.json` is the primary runtime contract
- `config/scene.json` is still emitted for compatibility
- `world.json` may include `worldActions`, `mainAreaPoints`, `worldSize`, and scene metadata
- `world.json` includes `contentLanguage` (`"zh"` | `"en"`) and `originalPrompt` (user's raw creation input)

## High-value gotchas

- Root `npm install` is not enough; `client` and `server` have separate dependencies.
- Server simulation uses root `.env`; four env var families: `ORCHESTRATOR_*`, `IMAGE_GEN_*`, `VISION_*`, `SIMULATION_*`.
- If Phaser parses `<!DOCTYPE` as JSON, asset serving/proxying is wrong; check `client/src/scenes/BootScene.ts`, `client/vite.config.ts`, and `server/src/index.ts`.
- Generated map style is no longer assumed to be pixel art; preserve user-requested style while keeping top-down readability.
- 2K/4K overlay localization may use resized working images, but extracted coordinates must map back to original pixels.
- Element-anchored characters should spawn outside the element box, not at its center.
- There is no global database file; each timeline has its own `state.db`. If you see references to a global `data/*.db`, they are outdated.
- Switching timelines or worlds reloads the page; the server closes the old DB and opens the new timeline's `state.db`.
- Failed character generations are automatically purged (empty dirs removed, `characters.json` and `worldDesign.characters` synced) before config generation.
- World design LLM call uses `max_tokens: 32768` to avoid truncation of large JSON outputs.
