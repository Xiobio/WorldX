<p align="center">
  <h1 align="center">WorldX</h1>
  <p align="center"><strong>One Sentence, One World.</strong></p>
  <p align="center">
    Type a single sentence. Watch an entire AI world come to life — unique maps, autonomous characters, emergent stories.
  </p>
</p>

<!-- TODO: Add hero screenshot/video here -->
<!-- <p align="center"><img src="docs/hero.png" width="720" /></p> -->

---

**WorldX** turns a single text prompt into a fully autonomous AI world. The system designs the world, generates original maps and character art, then runs a living simulation where AI agents make decisions, form relationships, have conversations, and create emergent narratives — all without human intervention.

> "A Song Dynasty night market with fortune tellers and wandering poets"

That's all it takes. WorldX handles the rest.

## Highlights

- **One-sentence world creation** — describe any scenario and watch it materialize
- **AI-generated maps & characters** — original art created to match your description, not templates
- **Autonomous agent simulation** — characters make decisions, form relationships, hold conversations
- **Memory & personality** — agents remember past events and act according to distinct personalities
- **Multi-day evolution** — worlds evolve across day/night cycles with scene transitions
- **God mode** — broadcast events, whisper memories, edit character profiles at runtime
- **Timeline system** — branch, replay, and compare different simulation runs
- **Bilingual UI** — Chinese / English interface with one-click switching

## Architecture

```
 "A cozy mountain village with a mysterious blacksmith"
                         │
                         ▼
              ┌─────────────────────┐
              │   Orchestrator      │  LLM designs world, characters, rules
              └──────────┬──────────┘
                    ┌────┴────┐
                    ▼         ▼
              Map Gen    Character Gen    AI-generated art pipelines
                    │         │
                    └────┬────┘
                         ▼
              ┌─────────────────────┐
              │  Simulation Server  │  Decisions, dialogue, memory, relationships
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │    Game Client      │  Phaser + React — watch AI lives unfold
              └─────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js 18+**
- **API keys** — see [Model Configuration](#model-configuration) below

### Option A: Preview Mode (fastest)

Just want to see WorldX in action? Two pre-built worlds are included. You only need a **Simulation** model key.

```bash
git clone https://github.com/YGYOOO/WorldX.git
cd WorldX
cp .env.example .env
# Edit .env — fill in SIMULATION_* fields only
npm install && cd client && npm install && cd ../server && npm install && cd ..
npm run dev
```

Open `http://localhost:3200` — pick a pre-built world and hit Play.

### Option B: Full Creation

Generate your own worlds from scratch. Requires all 4 model keys.

```bash
# Edit .env — fill in all 4 model sections
npm run dev
```

Open `http://localhost:3200/create`, type a sentence, and watch your world come to life.

Or use the CLI:

```bash
npm run create -- "A cyberpunk noodle shop where hackers and androids share rumors"
```

## Model Configuration

WorldX uses **4 model roles**, each configurable independently. All use the OpenAI-compatible `chat/completions` protocol — any compatible platform works.

| Role | Env Prefix | What It Does | Recommended |
|------|-----------|-------------|-------------|
| **Orchestrator** | `ORCHESTRATOR_` | Designs world structure, characters, rules | Strong reasoning model (e.g. `gemini-2.5-pro`) |
| **Image Gen** | `IMAGE_GEN_` | Generates map art and character sprites | Image-capable model (e.g. `gemini-3.1-flash-image-preview`) |
| **Vision** | `VISION_` | Reviews map quality, locates regions/elements | Strong multimodal model (e.g. `gemini-3.1-pro-preview`) |
| **Simulation** | `SIMULATION_` | Drives runtime character behavior | Any model — cheaper is fine (e.g. `gemini-2.5-flash`) |

Each role needs 3 env vars:

```env
{ROLE}_BASE_URL=https://openrouter.ai/api/v1    # API base URL
{ROLE}_API_KEY=sk-or-v1-xxxx                     # API key
{ROLE}_MODEL=google/gemini-2.5-pro-preview       # Model identifier
```

### Platform Examples

<details>
<summary><strong>OpenRouter</strong> (recommended — one key for all models)</summary>

Get a key at [openrouter.ai](https://openrouter.ai):

```env
ORCHESTRATOR_BASE_URL=https://openrouter.ai/api/v1
ORCHESTRATOR_API_KEY=sk-or-v1-xxxx
ORCHESTRATOR_MODEL=google/gemini-2.5-pro-preview

IMAGE_GEN_BASE_URL=https://openrouter.ai/api/v1
IMAGE_GEN_API_KEY=sk-or-v1-xxxx
IMAGE_GEN_MODEL=google/gemini-3.1-flash-image-preview

VISION_BASE_URL=https://openrouter.ai/api/v1
VISION_API_KEY=sk-or-v1-xxxx
VISION_MODEL=google/gemini-3.1-pro-preview

SIMULATION_BASE_URL=https://openrouter.ai/api/v1
SIMULATION_API_KEY=sk-or-v1-xxxx
SIMULATION_MODEL=google/gemini-2.5-flash-preview
```

</details>

<details>
<summary><strong>Google AI Studio</strong> (free tier available)</summary>

Get a key at [aistudio.google.com](https://aistudio.google.com/apikey):

```env
ORCHESTRATOR_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
ORCHESTRATOR_API_KEY=AIzaSy...
ORCHESTRATOR_MODEL=gemini-2.5-pro-preview

IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
IMAGE_GEN_API_KEY=AIzaSy...
IMAGE_GEN_MODEL=gemini-3.1-flash-image-preview

VISION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
VISION_API_KEY=AIzaSy...
VISION_MODEL=gemini-3.1-pro-preview

SIMULATION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
SIMULATION_API_KEY=AIzaSy...
SIMULATION_MODEL=gemini-2.5-flash-preview
```

</details>

<details>
<summary><strong>Mix & match</strong> (different platforms per role)</summary>

You can use a different platform for each role. For example, Google AI Studio for generation (free tier) and a cheaper provider for simulation:

```env
# World design — Google AI Studio
ORCHESTRATOR_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
ORCHESTRATOR_API_KEY=AIzaSy...
ORCHESTRATOR_MODEL=gemini-2.5-pro-preview

# Art generation — Google AI Studio
IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
IMAGE_GEN_API_KEY=AIzaSy...
IMAGE_GEN_MODEL=gemini-3.1-flash-image-preview

# Vision review — Google AI Studio
VISION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
VISION_API_KEY=AIzaSy...
VISION_MODEL=gemini-3.1-pro-preview

# Simulation — DeepSeek (cost-effective for high-volume runtime calls)
SIMULATION_BASE_URL=https://api.deepseek.com/v1
SIMULATION_API_KEY=sk-...
SIMULATION_MODEL=deepseek-chat
```

</details>

## Controls

Once a world is running:

| Control | Description |
|---------|-------------|
| **Run / Replay** | Toggle between live simulation and recorded playback |
| **Play / Pause** | Start or pause the simulation |
| **Relations** | View the relationship graph between characters |
| **Event Log** | Browse the timeline of all events |
| **God Panel** | Broadcast events, whisper to characters, edit profiles |
| **Sandbox Chat** | Have a private conversation with any character |
| **New Timeline** | Branch a fresh simulation from the same world |

## Project Structure

```
WorldX/
├── orchestrator/         # LLM-driven world design & config generation
│   ├── src/
│   │   ├── index.mjs           # Pipeline entry: sentence → world
│   │   ├── world-designer.mjs  # LLM world design
│   │   └── config-generator.mjs
│   └── prompts/
│       └── design-world.md     # World design prompt template
├── generators/           # Art generation pipelines
│   ├── map/              # Map generation (multi-step with review loop)
│   └── character/        # Spritesheet generation (with chromakey)
├── server/               # Simulation engine (Express + SQLite + LLM)
│   └── src/
│       ├── core/         # WorldManager, CharacterManager
│       ├── simulation/   # SimulationEngine, DecisionMaker, DialogueGenerator
│       ├── llm/          # LLMClient, PromptBuilder
│       └── store/        # SQLite persistence (per-timeline)
├── client/               # Game client (Phaser 3 + React 19)
│   └── src/
│       ├── scenes/       # BootScene, WorldScene
│       ├── ui/           # React overlay panels
│       └── systems/      # Camera, Pathfinding, Playback
├── shared/               # Shared utilities (structured output parsing)
├── library/worlds/       # Pre-built example worlds
├── output/worlds/        # Your generated worlds
└── .env.example          # Configuration template
```

## How It Works

### World Generation

1. **Design** — The orchestrator LLM designs the world: regions, characters, social dynamics, time rules
2. **Map** — AI generates a top-down map image, then localizes walkable areas, regions, and interactive elements through a multi-step review pipeline
3. **Characters** — AI generates sprite sheets for each character, with automatic chromakey cleanup
4. **Config** — Everything is bridged into runtime-ready configs (world.json, scene.json, character JSONs, TMJ map)

### Simulation

Each tick, every character:
1. **Perceives** — sees nearby characters, locations, recent events
2. **Decides** — chooses an action (move, talk, observe, interact) based on personality and context
3. **Acts** — executes the decision, potentially triggering dialogue, memory formation, or relationship changes
4. **Remembers** — stores significant events as memories that influence future behavior

### Timeline System

Each simulation run is recorded as a **timeline** — an independent event stream with its own database. You can:
- Run multiple timelines for the same world
- Replay any timeline frame by frame
- Compare how the same world evolves differently

## Development

```bash
npm run dev          # Start both client and server in dev mode
npm run create       # Generate a new world via CLI
```

- Client: `http://localhost:3200`
- Server: `http://localhost:3100`
- Dev overlays: append `?dev=1` to the client URL

## License

MIT
