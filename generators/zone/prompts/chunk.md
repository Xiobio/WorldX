You are generating ONE scene from a larger fantasy zone. Each scene is a
standalone, beautiful, illustrative top-down view of one location in the
zone — think "atmospheric diorama", not "tile-able grid square". Connections
between scenes will be handled by transitions in-game; you don't need to
worry about pixel-perfect seam alignment.

## Zone-wide style identity
{{zoneStyleIdentity}}

## Reference images (in order)
You are given {{numReferences}} reference images, in this exact order:
{{referenceList}}

Use them as INSPIRATION, not strict constraints:
- Reference image 2 (style anchor) — match its art style: same painter, same
  palette, same lighting, same level of detail.
- Reference image 1 (overworld crop) — orient yourself geographically: this
  area's terrain types and rough features should agree with the crop.

## This scene's content
- **Scene ID**: {{chunkId}}
- **Position in the zone**: row {{row}}, col {{col}} (of {{rows}}×{{cols}})
- **What's in this scene**: {{chunkContent}}
- **Notable elements**: {{interactiveElements}}

## Output specification
- Size: **1536×1024** (landscape, 16:9)
- View: top-down or near-top-down (60-90°). Pick whichever angle looks more
  beautiful for THIS scene; you don't need to match the angle of other scenes.
- Buildings designated as "enterable" should show their interior (cross-
  section roof removed, walls low) when feasible.
- Edges: don't worry about making edges blend with neighbors. **Each scene
  is its own complete artwork**. If a path or river runs off the edge, that's
  fine — the player will transition to a different scene at that point.

## Hard constraints
1. **No text** of any kind. No labels, captions, signs with readable text.
2. **No characters or creatures.**
3. Match the zone style identity in painter / palette / lighting.
4. Make this image visually rich — it's a standalone illustration, not just
   a square of map.
