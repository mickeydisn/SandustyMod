# Hiden World 2 (`hiden-word-2`)

Clean rewrite of **hidden-word** plus the generation stages that were missing
vs **sandgenerator-web**.

## What changed vs hidden-word

| Area | hidden-word | hiden-word-2 |
|------|-------------|--------------|
| Noise (skyline / tunnel / cave) | ✅ | ✅ cleaned |
| Sky-distance seal | ❌ | ✅ BFS seal of inaccessible voids |
| Fluids (water / lava / surface) | ❌ | ✅ pool + surface fill |
| Wall grow (moss / grass / redsand) | ❌ | ✅ neighbor + depth bands |
| Form grow (spore / frost / crackstone) | ❌ | ✅ noise patches by sky-distance |
| UI sections for all stages | partial | ✅ full sectioned panel |

GPU convolutions from the web tool are **CPU approximations** (BFS distance,
column pools, neighbor grow) — same design intent, playable performance.

## Pipeline (in order)

| # | Stage | sandgenerator-web | In mod? |
|---|-------|-------------------|---------|
| 1 | Skyline noise | yes | yes |
| 2 | Tunnel / cave noise merge | yes | yes |
| 3 | Sky-distance + seal inaccessible | GPU conv | yes (CPU BFS) |
| 4 | Fluids (water / lava / surface) | GPU conv | yes (pools) |
| 5 | Wall grow (moss / grass / redsand) | GPU grow | yes (neighbors) |
| 6 | Form grow (spore / frost / crackstone) | GPU form | yes (patches) |
| — | SVG icon masks / border smooth | yes | **not ported** |

Generation shows a **banner + toasts** (start → per-stage % → done) because large maps can take noticeable time.

## UI (while Ghost Lens 2 is selected)

Sections in the floating panel:

- Seed  
- 1 · Skyline (waves + ground %)  
- 2 · Tunnels / 3 · Caves  
- 4 · Seal  
- 5 · Fluids  
- 6 · Wall grow  
- 7 · Form grow  
- Colors legend  
- **↻ Refresh** / **Reset**

## Build

```bash
cd hiden-word-2
deno task build
```

Copy `build/` → game mods folder as `hiden-word-2`.

## Layout

```
src/
  main.ts          entry
  terrain.ts       multi-stage generator
  overlay.ts       sectioned UI
  render.ts        ghost cache + blit
  lens.ts          Ghost Lens 2 item
  persistence.ts   seed + full params
  constants.ts     codes, defaults
  types.ts         GenerationParams (all stages)
  noise.ts         simplex
  state.ts / api.ts / ids.ts
```
