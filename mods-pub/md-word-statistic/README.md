# World Statistic (`md-word-statistic`)

`md-word-statistic` · v0.7.4 · **pub**

Dev / inspection tool for Sandustry. Adds a **World Statistic** hotbar tool. While the tool is
selected, a centered overlay opens with four tabs.

## Features

| Tab            | Content                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| **Home**       | World size, empty cells, totals, last refresh time + custom resource cards |
| **Structures** | Every known structure type + instance count on the map (`forEachOfType`)   |
| **Elements**   | Every registered element type + cell count on the grid                     |
| **Terrains**   | Every terrain kind found on the grid + cell count + **% dug vs reference** |

- **↻ Refresh** re-scans the world, chunked (`SCAN_CHUNK = 4096` cells/frame) so the UI stays
  responsive.
- List tabs support **filter** (name / id / mod) and **sort** (count · name · id); each row shows a
  relative bar + numeric count. Zero-count rows stay hidden.
- **History** — up to 20 stored refreshes plus a permanent reference baseline (first scan), multiple
  series per chart; tick rows to choose which series appear.
- **Home resource cards** — pick any element/terrain/structure from the live catalogue; the first
  item drives the card colour and each item gets its own graph.
- **Mini mode** — compact card strip with live totals and trend Δ vs the previous scan.
- **Lock** the panel to keep it open when you switch tools; position, zoom and opacity are
  remembered per world.
- **Auto refresh** — scan after load then on a timer (1–20 min, default 10).
- Counts respect **authorization**: cells you cannot interact with are skipped.

## Item, overlay & sprite

| Id                          | Kind    | Notes                                                                   |
| --------------------------- | ------- | ----------------------------------------------------------------------- |
| `md-word-statistic:tool`    | item    | `itemType: "tool"`, energy cost 0, 120 ms cooldown.                     |
| `md-word-statistic:overlay` | overlay | Registered on `global`; panel returns null unless the tool is selected. |
| `md-word-statistic:icon`    | sprite  | `assets/statistic-icon.png`.                                            |

`api.storage` keys include `STATS_HISTORY_KEY`, `STATS_REF_KEY`, the card storage keys, and the UI
keys from `uiStore.ts` (`UI_POS_KEY`, `UI_ZOOM_KEY`, `UI_ALPHA_KEY`, `UI_LOCK_KEY`, `UI_MINI_KEY`,
`UI_AUTO_MIN_KEY`).

## Package dependencies

**None.** The mod targets the global `sandkit` object and keeps its own `api.ts`, `config.ts`,
`cleanup.ts` and `types.ts`. There are no `@sandmd/*` imports, so it stays drop-in installable.

## Sandkit API used

| Area       | Calls                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elements   | `elements.getRegisteredTypes`, `elements.getDefinitionByType`, `elements.getNameByType`, `elements.getTypeAtCell`, `elements.getTypeById`, `elements.getTypeFromId`                                                                                                             |
| Structures | `structures.getAvailableTypes`, `structures.getDefinitionById`, `structures.getDefinitionByType`, `structures.getTypeById`, `structures.getTypeFromId`, `structures.forEachOfType`                                                                                              |
| Terrains   | `terrains.getRegisteredTypes`, `terrains.getTypeAtCell`, `terrains.getTypeById`, `terrains.getTypeFromId`, `terrains.getIdByType`, `terrains.getIdFromType`, `terrains.getDefinitionByType`, `terrains.getNameByType`, `terrains.getColorByType`, `terrains.getMetaColorByType` |
| Items      | `items.register`, `items.isActiveById`, `player.inventory`                                                                                                                                                                                                                      |
| UI         | `ui.overlays`, `ui.inject`, `ui.toast`, `i18n.register`, `sandkit.react`                                                                                                                                                                                                        |
| Settings   | `settings.get`, `settings.set`, `settings.onChange`                                                                                                                                                                                                                             |
| Storage    | `storage.get`, `storage.set`                                                                                                                                                                                                                                                    |
| Lifecycle  | `events.on("game:ready")`, `events.on("action:changed")`                                                                                                                                                                                                                        |
| Registries | `sandkit.state.store.player.buildings` / `structures` (cleanup prefix scans)                                                                                                                                                                                                    |

## Settings

Uses the shared settings pattern (see `mods-dev` / `mods-progress`): `configSchema` in
`modinfo.json` → typed `SETTINGS` → `readSettings` / `onSettingsChange` from `@sandmd/modkit`
(pub mods read `api.settings` directly). Disabling a mod runs a prune/orphan/storage cleanup
over everything prefixed with its id.

Per-key values for this mod:
[`doc/doc_ia/MOD_SETTINGS.md`](../../doc/doc_ia/MOD_SETTINGS.md#md-word-statistic).

## Usage in-game

1. Open the inventory / toolbox and equip **World Statistic**.
2. The overlay appears while the tool is active.
3. Hit **↻ Refresh** to count; switch tabs or filter as needed.
4. **Lock** the panel to keep it open, or deselect the tool to hide it.

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
