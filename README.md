# Zone Walker — Ionia

A walkable AI-generated Ionia zone featuring Yasuo. Single-page static site, deploys to Vercel as-is.

## Local preview

Any static server works:

```bash
npx serve .
# or
python -m http.server 8000
```

Open `http://localhost:8000`.

## Deploy to Vercel

```bash
vercel
```

Or connect this repo in the Vercel dashboard — no build step, framework preset = "Other".

## Layout

```
index.html             # entire game (HTML + canvas + audio + logic)
vercel.json            # cache headers for chunk PNGs / walkable JSONs
chars/yasuo.png        # spritesheet (170x204 cells, 6x5)
zones/ionia/
  config.json          # zone manifest (grid, chunks, landmarks, interactives)
  chunks/*.png         # 42 chunk backgrounds (7x6 grid, 1536x1024 each)
  walkable/*.json      # per-chunk walkable grid (v2 strict masks)
  walkable/*.tmj       # Tiled-format map (optional)
```

## Controls

- **WASD / Arrow Keys** — move
- **Shift** — sprint
- **Space** — wind dash
- **E** — interact / read landmark monologue
- **M** — music on/off
- **Esc** — settings
- **F** — fullscreen

Created with the WorldX zone generator. Full pipeline lives on the `main` branch.
