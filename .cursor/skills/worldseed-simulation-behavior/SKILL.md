---
name: worldseed-simulation-behavior
description: Changes WorldSeed simulation semantics: scene time, multi-day transitions, worldActions, logical locations, interactive elements, character anchoring, main-area movement, client wandering, path smoothing, and dialogue approach animation. Use when editing character behavior, movement rules, tick logic, location modeling, anchor enforcement, or server/client simulation boundaries.
---
# WorldSeed Simulation Behavior

## Core model

Keep these boundaries intact unless the task explicitly changes the architecture:

- Server owns logical state:
  - current day and tick
  - logical location
  - action decisions
  - dialogue, memories, relationships, effects

- Client owns local presentation:
  - random ambient wandering near an anchor
  - pathfinding to a chosen point
  - path smoothing (two-pass: staircase rebalancing + L-shaped shortcutting)
  - dialogue approach animation
  - camera and scene presentation

Do not add persistent server-side `x/y` state unless the task clearly requires an architectural change.

## Location model

Current rules:

- Authored map regions come from the `regions` object layer
- Interactive elements come from the `interactive_objects` object layer
- Region-less worlds still work through synthetic `main_area` fallback
- Large `main_area` spaces use generated `mainAreaPoints` for meaningful long-distance movement
- Each interactive element gets an auto-generated approach point (`element_<id>`) in `mainAreaPoints`
- Server reasons about domains and locations, not exact map coordinates
- Client converts logical locations and main-area points into walkable target points

Key files:
- `server/src/core/world-manager.ts`
- `server/src/simulation/action-menu-builder.ts`
- `server/src/simulation/action-executor.ts`
- `client/src/systems/MapManager.ts`
- `client/src/systems/CharacterMovement.ts`

## Movement model

Current intent:

- Long-distance movement is an AI/server decision
- Arrival target inside a region should be a randomized near-center walkable point, not a fixed point
- Long-distance movement inside `main_area` should stay point-to-point at the logical level; local drift after arrival is presentation only
- Once arrived, client wandering stays near `movementAnchor`
- Pinned regions bias wandering inward so characters do not leak outside bounds
- Element-anchored characters use a smaller wander radius (`ANCHORED_ELEMENT_WANDER_RADIUS_TILES`)
- Dialogue approach spacing on the client should scale from current character display size, not fixed absolute pixels

Path smoothing:
- Raw EasyStar.js paths go through a two-pass post-processor
- Pass 1: staircase rebalancing (H1-V1 → H2-V2 batching)
- Pass 2: farthest-valid L-shaped shortcutting for longer straight segments
- Both passes verify every intermediate tile is walkable before committing

If changing movement, preserve this split:
- "Go somewhere meaningful" -> server
- "Micro-move while idle" -> client

Relevant files:
- `client/src/systems/CharacterMovement.ts`
- `client/src/objects/CharacterSprite.ts`
- `client/src/systems/MapManager.ts`
- `client/src/scenes/WorldScene.ts`

## Character anchoring

Characters may have `anchor: { type: "region"|"element", targetId }` in their profile.

Server-side enforcement:
- `action-menu-builder.ts` omits `move_to` and `move_within_main_area` from anchored characters' action menus
- `action-executor.ts` has defensive guards to reject these actions even if erroneously chosen
- `character-manager.ts` resolves initial `mainAreaPointId` for element-anchored characters to the element's approach point

Client-side behavior:
- `CharacterMovement.ts` uses `isProfileAnchored` flag plus reduced `wanderRadius` for element-anchored characters
- `WorldScene.ts` sets `pinned = true` when `anchor` is present

Key files:
- `server/src/types/character.ts` (`CharacterAnchor` interface)
- `server/src/utils/config-loader.ts` (`normalizeAnchor`)
- `server/src/simulation/action-menu-builder.ts`
- `server/src/simulation/action-executor.ts`
- `server/src/core/character-manager.ts`
- `client/src/systems/CharacterMovement.ts`
- `client/src/objects/CharacterSprite.ts`
- `client/src/scenes/WorldScene.ts`

## Dialogue model

Current intent:

- Server decides dialogue based on logical state and tick flow
- For `main_area`, server-side dialogue gating uses world-size-based proximity (~40% of `(mapWidth+mapHeight)/2`)
- Within functional regions, all co-located characters can initiate dialogue directly
- Client handles the pixel-level landing layout: same-point occupants get stable slot spacing, and dialogue pairs in `main_area` stand face-to-face with distance scaled from character height
- When `main_area` dialogue landing succeeds, the initiator's logical `mainAreaPointId` is synced to the responder's point; exact pixel offsets remain client-only presentation

Relevant files:
- `server/src/simulation/simulation-engine.ts`
- `server/src/simulation/decision-maker.ts`
- `client/src/scenes/WorldScene.ts`
- `client/src/systems/CharacterMovement.ts`

## Time model

WorldSeed uses scene-configurable time, not fixed town-day assumptions.

Check these files when changing time semantics:
- `server/src/utils/time-helpers.ts`
- `server/src/types/world.ts`
- `server/src/api/routes/world.ts`
- `server/src/api/routes/simulation.ts`

Keep these principles:
- scene start time is configurable
- tick duration is configurable
- `maxTicks` can be finite or open-ended
- multi-day transitions are config-driven
- day/tick should persist across server restarts (stored in `world_global_state`)
- no sleep/home assumptions should leak back in without explicit product changes
- client displays formatted scene time, not raw tick numbers

## Decision model

Current simulation is reactive.

Keep these principles:
- do not reintroduce initial daily-plan generation unless the product explicitly changes
- do not assume a separate revise-plan loop exists
- memory retrieval should stay lightweight and not depend on embedding/vector infrastructure unless the task explicitly restores that architecture

## World actions

`worldActions` are true world-level actions, not tied to a specific region.

When changing them, verify all layers:
- design prompt and normalization
- config generation
- server action menu
- action execution and event wording
- client rendering if new event types appear

Key files:
- `orchestrator/prompts/design-world.md`
- `orchestrator/src/world-design-utils.mjs`
- `orchestrator/src/config-generator.mjs`
- `server/src/core/world-manager.ts`
- `server/src/simulation/action-menu-builder.ts`
- `server/src/simulation/action-executor.ts`

## Debug overlays

Client provides dev-only overlays toggled via `?dev=1`:
- Walkable area: blue translucent layer
- Functional regions: labeled bounding boxes
- Main-area points: navigation point ids and positions
- Interactive objects: bounding boxes and names

Key files:
- `client/src/scenes/WorldScene.ts`
- `client/src/ui/App.tsx`

## Verification

After simulation-behavior changes:

1. Test a world with authored regions.
2. Test a world without authored regions.
3. Test a world whose activity mostly happens in `main_area`.
4. Test a world with interactive elements and anchored characters.
5. Verify dialogue still starts and characters visually approach each other.
6. Verify idle wandering stays believable and bounded.
7. Verify anchored characters do not leave their anchor zone.
8. Verify tick progression still works through `Play` / `Pause`.

## Common mistakes

- Mixing logical location changes with client-only micro-movement
- Reintroducing old `location` layer or `ysort` assumptions
- Making dialogue depend on exact coordinates instead of logical state
- Breaking region-less worlds by assuming every map has authored regions
- Renaming action/location fields without updating config generation and runtime consumers
- Allowing anchored characters to receive move actions in the action menu
- Placing element-anchored characters inside the element bounding box instead of outside it
