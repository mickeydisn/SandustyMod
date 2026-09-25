# Big Brother

`md-big-brother` · v1.0.0 · **pub**

TypeScript port of `hood.viewfinder`. Camera channels with screen feeds — one camera per channel,
unlimited screens.

- Place a **camera**: it captures a square zone around itself.
- **Click the camera** to swing the capture corner (top-left → top-right → bottom-right →
  bottom-left).
- Place **screens**: each screen paints that channel's live feed with a per-channel border, on the
  overlay, every frame.

Channel count and zone size are settings (`1–10` channels, `2–30` tiles; the manifest UI exposes
`2–12`).

## Features

- **Per-channel camera + screen structures**, registered and unlocked from settings.
- **One camera per channel** — `hooks.intercept("building:place")` cancels a second camera and
  toasts.
- **Capture corner cycle** — clicking the camera cycles the stored `corner` and repaints its
  spritesheet index.
- **Auto-switch tool** — with `hideFromBuildMenu: true` on screens, the mod drives
  `building.selectStructure` so placing a camera immediately hands you that channel's screen (and
  back to the camera when the last one is removed), driven by `action:changed`, `building:placed`
  and `building:removed`.
- **Feeds** — per-channel off-screen canvas rebuilt from the captured cells; a `NO SIGNAL`
  placeholder is shown until a camera is online. Captures are throttled in `frame:render` to ~10
  fps.
- Screens draw **on the overlay** (a structure `draw` can't replace the Pixi tilemap).

## Structures

| Id                            | Shape              | Notes                                              |
| ----------------------------- | ------------------ | -------------------------------------------------- |
| `md-big-brother.cam.${ch}`    | 1×1 tile           | category `camera`, click to swing capture corner.  |
| `md-big-brother.screen.${ch}` | `zoneTiles` square | `hideFromBuildMenu: true`; holds the channel feed. |

## Package dependencies

| Package           | Used for                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `@sandmd/sandkit` | Global `sandkit` declaration and the typed `api` handle.           |
| `@sandmd/shared`  | `StructureLike` type used throughout the structure/render helpers. |

No `@sandmd/modkit` — the mod keeps its own `api.ts` / `types.ts` typed surface.

## Sandkit API used

| Area              | Calls                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structures        | `structures.register`, `structures.forEachOfType`, `structures.getTypeById`, `structures.hasBuiltAtCell`, `structures.updateData`, `structures.setSpritesheetIndex`, `structures.setSpritesheetIndexAtCell` |
| Player / actions  | `player.buildings.unlockById` / `add` / `removeById`, `building.selectStructure`, `action.getSelected`                                                                                                      |
| Hooks             | `hooks.intercept("building:place", …, { structureTypes })`                                                                                                                                                  |
| Events            | `events.on("action:changed")`, `events.on("building:placed")`, `events.on("building:removed")`, `events.on("frame:render")`                                                                                 |
| Triggers          | `triggers.register`                                                                                                                                                                                         |
| Signals           | `signals.interactables.register`                                                                                                                                                                            |
| Rendering         | `rendering.getDrawPositionAtCell`, `rendering.getDrawPositionAtWorld`, `rendering.withOverlayContext`                                                                                                       |
| Terrains/Elements | `terrains.isAtCell`, `elements.getTypeAtCell` (feed colour sampling)                                                                                                                                        |
| Settings          | `settings.get`, `settings.getAll`, `settings.onChange`                                                                                                                                                      |
| Assets / UI       | `sprites.loadFromMod`, `ui.toast`, `i18n.register`, `sandkit.state`                                                                                                                                         |

## Settings

Uses the shared settings pattern (see `mods-dev` / `mods-progress`): `configSchema` in
`modinfo.json` → typed `SETTINGS` → `readSettings` / `onSettingsChange` from `@sandmd/modkit`
(pub mods read `api.settings` directly). Disabling a mod runs a prune/orphan/storage cleanup
over everything prefixed with its id.

Per-key values for this mod:
[`doc/doc_ia/MOD_SETTINGS.md`](../../doc/doc_ia/MOD_SETTINGS.md#md-big-brother).

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
