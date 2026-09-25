# Hiden World 2

`hiden-word-2` · v0.2.0 · **progress**

Hidden-world terrain generator + ghost overlay, map viewer/editor, materializer and optional
exploration (fog of war).

Generation is a cleaned port of `hidden-word` plus the missing `sandgenerator-web` stages
(sky-distance seal, fluids, wall grow, form grow) as CPU approximations. The hidden map is generated
off-screen, kept in memory, previewed/edited in-game and materialised into live terrain on demand.

## Features

- **Hidden world generation** — seeded noise pipeline (`gen/noise`, `gen/terrain`, `gen/upscale`)
  with tunable generation params, progress reporting and a sectioned generation UI.
- **Ghost overlay** — paints the hidden map over the live world every `frame:render`, with a
  configurable alpha.
- **Map Editor / Map Viewer** — full-map preview; the editor exposes the generation parameters, the
  viewer is preview-only. One global overlay decides editor vs viewer mode from the active item.
- **World Manifest (materializer)** — paint hidden → live terrain inside a brush (radius + energy
  cost), plus an infinite variant.
- **Fog Explorer** — reveals explored cells around the cursor; deep variant for a bigger reach.
- **Persistence** — seed, hidden map and explored map are stored via `api.storage` and reloaded on
  `game:ready`.

## Items

| Item id                             | Name                  | Sprite path                | Notes                            |
| ----------------------------------- | --------------------- | -------------------------- | -------------------------------- |
| `hiden-word-2.lens`                 | Ghost Lens            | `assets/lens.png`          | hidden map + exploration overlay |
| `hiden-word-2.infiniteLens`         | Infinite Ghost Lens   | `assets/lens-inf.png`      | hidden map only                  |
| `hiden-word-2.mapEditor`            | Map Editor            | `assets/map-editor.png`    | full config + preview            |
| `hiden-word-2.mapViewer`            | Map Viewer            | `assets/map-viewer.png`    | preview only                     |
| `hiden-word-2.materializer`         | World Manifest        | `assets/manifest.png`      | radius 2–24, energy 8            |
| `hiden-word-2.infiniteMaterializer` | Infinite Materializer | `assets/manifest-inf.png`  | energy 8                         |
| `hiden-word-2.explorer`             | Fog Explorer          | `assets/explorer.png`      | radius 1–16, energy 4            |
| `hiden-word-2.deepExplorer`         | Deep Explorer         | `assets/explorer-deep.png` | energy 4                         |

Overlays are registered on the global zone: `hiden-word-2.params`, `.mapEditor`, `.mapViewer`,
`.materializer`, `.infiniteMaterializer`, `.explorer`, `.deepExplorer`.

`api.storage` keys: `hiddenSeed`, `hiddenMap`, `exploredMap`.

## Package dependencies

**None.** The mod targets the global `sandkit` object directly and keeps its own thin wrappers
(`src/api/api.ts`, `src/tools/shared.ts`) — there are no `@sandmd/*` imports. This keeps the mod
drop-in installable without the repo workspace.

## Sandkit API used

| Area              | Calls                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Items             | `items.register`, `items.getActive`, `items.isActiveById`, `player.inventory`                                                                                   |
| Assets            | `sprites.loadFromMod`                                                                                                                                           |
| UI                | `ui.overlays`, `ui.toast`, `sandkit.react` (panels)                                                                                                             |
| Overlay rendering | `events.on("frame:render")`, `rendering.getGridMetrics`, `rendering.getDrawPositionAtWorld`, `rendering.getOverlayViewportSize`, `rendering.withOverlayContext` |
| Grid              | `grid.getDimensions`, `grid.mutate`, `grid.isCellEmptyAtCell`, `grid.isTerrainAtCell`                                                                           |
| Terrains          | `terrains.getDefinitionByType`, `terrains.getTypeById`                                                                                                          |
| Settings          | `settings.get`, `settings.onChange`                                                                                                                             |
| Storage           | `storage.ensure`, `storage.get`, `storage.set`                                                                                                                  |
| Lifecycle         | `events.on("game:ready")`, `events.on("action:changed")`                                                                                                        |
| Energy            | `energy.consume`                                                                                                                                                |

## Settings

Uses the shared settings pattern (see `mods-dev` / `mods-progress`): `configSchema` in
`modinfo.json` → typed `SETTINGS` → `readSettings` / `onSettingsChange` from `@sandmd/modkit`
(pub mods read `api.settings` directly). Disabling a mod runs a prune/orphan/storage cleanup
over everything prefixed with its id.

Per-key values for this mod:
[`doc/doc_ia/MOD_SETTINGS.md`](../../doc/doc_ia/MOD_SETTINGS.md#hiden-word-2).

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
