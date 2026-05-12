Generate a 1024×1024 **overworld map** for a fantasy zone — a beautiful,
illustrated topographic map (like a fantasy novel's frontispiece map) that
also clearly shows the geographic skeleton.

## Zone identity
{{zoneIdentity}}

## Geographic layout
{{geographyLayout}}

## What to draw
- A top-down (or near-top-down) painted map covering the entire zone.
- Major terrain features clearly visible: mountain ranges, rivers, coastlines,
  forests, rice fields, built-up areas, magical zones.
- Roads connecting landmarks, drawn as visible lines.
- A **clear placement marker** (a small yellow dot, ~24px) at each named
  landmark position listed below.
- Atmospheric and beautiful — this image is also used as a visual reference
  for downstream chunks, so it should already feel "inhabited" not just
  schematic.

## Required landmark positions
{{landmarkPositions}}

## Hard constraints
1. Top-down or near-top-down view (60-90°), axis-aligned (north = up).
2. NO text, labels, numbers, captions.
3. NO characters, creatures, vehicles.
4. Roads must be **continuous** lines that connect every yellow landmark dot.
5. Rivers must be **continuous** spans across the map per the geography
   description above.

The overworld doesn't have to be pure semantic-segmentation flat color — it
can be illustrative — but the geographic skeleton (roads, water, regions)
should be UNAMBIGUOUS at first glance.
