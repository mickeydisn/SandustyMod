# World Statistic (`md-word-statistic`)

Dev / inspection tool for Sandustry. Adds a **World Statistic** hotbar tool.
While the tool is selected, a centered overlay opens with four tabs:

| Tab          | Content                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| **Home**     | World size, empty cells, totals, last refresh time                      |
| **Structures** | Every known structure type + instance count on the map (`forEachOfType`) |
| **Elements** | Every registered element type + cell count on the grid                  |
| **Terrains** | Every terrain kind found on the grid + cell count                       |

Top of the panel: **↻ Refresh** re-scans the world (chunked so the UI stays responsive).

List tabs support **filter** (name / id / mod) and **sort** (count · name · id).
Each row shows a relative bar + numeric count.

## Layout

| File              | Role                                              |
| ----------------- | ------------------------------------------------- |
| `src/main.ts`     | Entry — registers tool + overlay                  |
| `src/tool.ts`     | Item registration, selection check, overlay mount |
| `src/panel.ts`    | React overlay UI (tabs, lists, refresh)           |
| `src/data.ts`     | Catalogue listing + grid scan                     |
| `src/state.ts`    | Tab / filter / snapshot                           |
| `src/styles.ts`   | Dark neon panel chrome                            |
| `src/api.ts`      | `sandkit` handle + `safe` / `toast`               |
| `src/constants.ts`| Ids, version, scan chunk size                     |
| `assets/`         | Tool icon                                         |

## Build

```bash
deno task check   # type-check
deno task build   # → build/main.js + modinfo.json + assets/
```

Copy the contents of `build/` (plus `assets/`) into your Sandustry mods folder as
`md-word-statistic/`, or point the game at this directory.

```
mods/md-word-statistic/
  main.js
  modinfo.json
  assets/statistic-icon.png
```

## Usage in-game

1. Open the inventory / toolbox and equip **World Statistic**.
2. The overlay appears while the tool is active.
3. Hit **↻ Refresh** to count.
4. Switch tabs or filter as needed. Deselect the tool to hide the overlay.
