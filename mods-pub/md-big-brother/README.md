# Big Brother

TypeScript port of `hood.viewfinder`. Camera channels with screen feeds — one camera per channel,
unlimited screens.

- Place a **camera**: it captures a square zone around itself.
- **Click the camera** to swing the capture corner (top-left → top-right → bottom-right →
  bottom-left).
- Place **screens**: each screen paints that channel's live feed with a per-channel border, on the
  overlay, every frame.

Channel count and zone size are settings (`1–10` channels, `2–12` tiles).

## Layout

| File                | Responsibility                                                 |
| ------------------- | -------------------------------------------------------------- |
| `src/main.ts`       | Entry point: settings bootstrap, sprite loads, register calls. |
| `src/constants.ts`  | Mod id, geometry, palette, defaults, i18n keys.                |
| `src/state.ts`      | Mutable runtime state (channels, ids, feeds).                  |
| `src/types.ts`      | Local typing for the sandkit API surface this mod uses.        |
| `src/api.ts`        | Typed API handle + shared helpers (`clampInt`, `listType`, …). |
| `src/geometry.ts`   | Cell/world/canvas conversion, corners, zone rects.             |
| `src/colors.ts`     | Per-cell colour sampling for the schematic feed.               |
| `src/feeds.ts`      | Feed canvases: rebuild, NO SIGNAL placeholder, capture.        |
| `src/render.ts`     | Overlay painting + placement draw hooks.                       |
| `src/structures.ts` | i18n, structure registration, limit, interact, lifecycle.      |

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js, copy modinfo + assets into build/ and the game folder
```

Only the bundled `build/main.js` runs in-game; `assets/` is loaded at runtime through
`api.sprites.loadFromMod`.
