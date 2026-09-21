# Hiden World 2

Hidden-world terrain generator + ghost overlay, map viewer, materializer, and optional exploration (fog of war).

## Layout

```
src/
  main.ts           boot
  api/              sandkit api surface + ids
  gen/              map generation (noise, terrain pipeline, progress)
  world/            runtime state, persistence, exploration, ghost render
  tools/            items: lens, materializer, explorer, lens banner
  viewer/           Map Viewer UI (panel, preview, controls)
```

## Build

```bash
deno task build
```

## Tools

| Tool | Role |
|------|------|
| Ghost Lens | translucent hidden map overlay |
| Map Viewer | full-map preview + generation params |
| World Manifest | paint hidden → live terrain (circle) |
| Fog Explorer | reveal exploration (when enabled in mod settings) |

## Settings

- **Ghost alpha (%)** — overlay opacity
- **Exploration mode** — fog of war
