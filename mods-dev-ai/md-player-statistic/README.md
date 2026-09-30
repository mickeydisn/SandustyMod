# Player Statistic (`md-player-statistic`)

`md-player-statistic` · v0.1.0 · **dev**

Event-driven KPI tracker for Sandustry. Unlike **World Statistic** (which scans the map), this mod accumulates counters from live player events into an in-memory buffer and persists them via `api.storage`.

## Features

| Tab | Content |
| --- | --- |
| **Home** | Configurable KPI cards (structures / items / dig / loot) with session Δ and sparklines |
| **Actions** | Structures placed · removed · moved — breakdown by structure id |
| **Items** | Items used (vacuum, shoot tools, laser, …), world-item pickups, resources collected |
| **Terrain** | Terrain cells destroyed — breakdown by cell type |
| **⚙️** | Zoom / opacity, card editor, reset session / wipe all |

- **No world scan** — counters come only from sandkit events.
- **Live buffer** — `totals` (lifetime) + `session` (resettable) + rolling history for sparklines.
- **Configurable cards** — pick any category (and optional sub-key) for Home cards.
- **Lock / mini mode** — keep the panel open when switching tools; compact card strip.
- Position, zoom and opacity remembered per world.

## Tracked events

| Event | KPI category |
| --- | --- |
| `building:placed` / `structures:placed` | `structures_placed` |
| `building:removed` / `structures:removed` | `structures_removed` |
| `structures:moved` | `structures_moved` |
| `item:used` | `items_used` (keyed by `itemId`) |
| `terrain:destroyed` | `terrain_destroyed` (keyed by cell type) |
| `worldItem:pickedUp` | `world_items_picked` |
| `resource:collected` | `resources_collected` (amount summed) |

## Item, overlay & sprite

| Id | Kind | Notes |
| --- | --- | --- |
| `md-player-statistic:tool` | item | `itemType: "tool"`, energy cost 0, 120 ms cooldown. |
| `md-player-statistic:overlay` | overlay | Registered on `global`; panel returns null unless the tool is selected (or locked). |
| `md-player-statistic:icon` | sprite | `assets/statistic-icon.png` (optional — falls back gracefully). |

`api.storage` keys: `kpi_totals`, `kpi_session`, `kpi_history`, `cards`, `ui_pos`, `ui_zoom`, `ui_alpha`, `ui_lock`, `ui_mini`.

## Package dependencies

**None.** The mod targets the global `sandkit` object and keeps its own helpers. There are no `@sandmd/*` imports, so it stays drop-in installable.

## Settings

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | true | Master switch. Off → unbind events, remove tool, wipe storage. |
| `persistSession` | boolean | true | Keep session counters across reloads. |
| `historyMax` | number | 20 | Sparkline history depth (5–50). |

## Usage in-game

1. Open the inventory / toolbox and equip **Player Statistic**.
2. The overlay appears while the tool is active.
3. Play normally — KPIs update live as you place, dig, shoot, vacuum, pick up, etc.
4. Open **⚙️** to edit Home cards or reset counters.
5. **Lock** the panel to keep it open when you switch tools.

## Build

```bash
deno task build          # → build/main.js + build/modinfo.json
deno task check
```

Copy `build/` into the game mods folder (or point your local `build:toGame` path).

---

Layout and build details for every mod live in the SandustyMod docs (`doc/doc_ia/MOD_LAYOUT.md`, `doc/doc_ia/MOD_BUILD.md`).
