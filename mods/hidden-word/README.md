# Hidden World

A **shadow world**: a generated terrain, the exact size of the real map, that exists only as hidden
data. Nothing in the game interacts with it — no elements, no structures, no placements. It is just
there.

While the custom **Ghost Lens** item is the player's selected item, a _ghost view_ of the hidden
terrain is drawn translucent **on top of the normal map display** (the same selection-driven pattern
the built-in hotbar tools use), and a **generation panel** opens with it. Deselect the lens and both
disappear.

## Generation panel

While the lens is selected, a small panel floats above the hotbar with every tunable of the
generator (all integers):

- **Seed** — text field + 🎲 to randomize.
- **Skyline** — the four waves (Big / Medium / Low / Roughness), each with its **period in cells**
  (frequency = 1/period) and **amplitude %**.
- **Ground level %** — skyline BaseHeight as a fraction of the map height.
- **Tunnels / Caves** — Thickness % (band width), Definition % (cluster scale), Move X/Y (noise
  offset).
- **Colors (elements)** — a legend of the element swatch used for each terrain code.

Defaults: ground **55%**, sky waves **1200/15 · 800/25 · 400/5 · 200/3** (period / amp %), tunnel
**thickness 20 / definition 85**, cave **thickness 25 / definition 70**. Every control's range is
the default **±15%**, rounded (e.g. ground 55 → 47–63, tunnel thickness 20 → 17–23, big wave period
1200 → 1020–1380). Sky amplitudes additionally allow **0** so a wave can be flattened.

Edits live in a local draft; **↻ Refresh hidden world** applies them (seed + params are persisted to
the save via `api.storage`) and regenerates the matrix. **Reset** restores the defaults.

> The Ghost Lens is added to the inventory **once** (`inventory.hasById` guard), and duplicates left
> by earlier mod reloads are collapsed on boot (kept: the first copy).

## How the hidden world works

- **Size** — always the real map size (`api.grid.getDimensions()`; fallback 640×360 cells if the API
  is unavailable).
- **Generation** — a port of the sandgenerator-web **first step** (seeded simplex noise): a 1D
  _skyline_ pass separates sky from rock, then two 2D _band_ passes (tunnel / cave) carve corridors
  into the rock. Same parameters/merge order as `sandgenerator-web/js/mapGeneration.js`.
- **Session persistence** — the terrain matrix lives in memory for the session; what is saved
  (save-backed `api.storage`) is the **seed + size + params**. Regeneration is deterministic, so the
  same hidden world comes back on every load. A new save (no record stored yet) creates a fresh one.
- **Lazy build** — the matrix + its cache canvas are built on the first frame the lens is selected
  (~100–300 ms once); failures are remembered and never retried per frame.
- **Element colors** — the hidden matrix is a **map of elements, not an image**, so the ghost layer
  paints each code with its real engine element color (read from the element definition at cache
  build time, `metaColor` → `colors.variants` → `color`). The mapping lives in `TERRAIN_ELEMENTS`
  (`src/constants.ts`):

  | Code     | Element   | Color     | Notes                        |
  | -------- | --------- | --------- | ---------------------------- |
  | `SKY`    | `empty`   | —         | fully transparent (no paint) |
  | `ROCK`   | `sand`    | `#f4a460` | brown                        |
  | `TUNNEL` | `wetSand` | `#cd853f` | darker brown                 |
  | `CAVE`   | `gloom`   | `#7a00a8` | purple caverns               |

  The packed hex values are the engine's own `metaColor`s and are also the **static fallback**
  (`FALLBACK_ELEMENT_COLORS`) used when the element lookup is unavailable. If a lookup succeeds the
  engine value wins, so the ghost view always matches the game's palette. The panel's **Colors
  (elements)** legend shows the resolved swatches (logged as `[hidden-word] element colors …`).

## Config

The mod config UI only accepts integers, so the alpha is configured as a **percent** (×100) and
divided by 100 internally:

| Field               | Default | Range | Meaning                                             |
| ------------------- | ------- | ----- | --------------------------------------------------- |
| `ghostAlphaPercent` | 45      | 5–100 | Ghost view opacity over the normal map, in percent. |

## Layout

| File                    | Responsibility                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| `src/main.ts`           | Entry point: seed bootstrap, item + overlay + config + painter wiring. |
| `src/ids.ts`            | Mod id and version.                                                    |
| `src/constants.ts`      | Item ids, generator wave sets + default params, palette, i18n.         |
| `src/types.ts`          | API surface, runtime state, `GenerationParams` shapes.                 |
| `src/api.ts`            | Typed `sandkit.api` handle.                                            |
| `src/state.ts`          | Runtime state (seed, size, params, matrix, alpha, cache canvas).       |
| `src/persistence.ts`    | Seed + params record create/load/save against `api.storage`.           |
| `src/noise.ts`          | Self-contained seeded simplex noise.                                   |
| `src/terrain.ts`        | The hidden matrix generator (the generator's "first step").            |
| `src/render.ts`         | Cache canvas + ghost blit; `refreshHiddenWorld()` for the overlay.     |
| `src/lens.ts`           | Ghost Lens registration + `isLensSelected()` visibility driver.        |
| `src/overlay.ts`        | Generation panel (hotbar overlay): draft params, Refresh, Reset.       |
| `tools/genIcon.ts`      | Generates `assets/lens.png` (stdlib PNG writer, no deps).              |
| `tools/smokeTerrain.ts` | Dev smoke test for the generator (determinism, codes, timing).         |
| `tools/smokeColors.ts`  | Dev smoke test for the element→color mapping (stubbed sandkit).        |

## Build

```
deno task check      # type-check src/main.ts + tools/genIcon.ts
deno task build      # bundle main.js + modinfo + icon + assets, copy to the game folder
```
