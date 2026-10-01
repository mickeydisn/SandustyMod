# Player Statistic (`md-player-statistic`)

`md-player-statistic` · v0.1.0 · **dev**

Event-driven KPI tracker for Sandustry. Unlike **World Statistic** (which scans the map), this mod
accumulates counters from live player events into an in-memory buffer and persists them via
`api.storage`.

## Features

| Tab            | Content                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Home**       | Configurable KPI cards (structures / dig / items / activity) with session Δ and sparklines |
| **Structures** | Structures placed · removed · moved — history graph + selectable list                      |
| **Items**      | Every item use, broken down by item — history graph + selectable list                      |
| **Dig**        | Terrain cells destroyed, by terrain **name** — graph + selectable list                     |
| **Move**       | Distance walked and collisions — teleports excluded                                        |
| **Keys**       | Key presses — graph + selectable list, breakdown by key                                    |
| **⚙️**         | Panel chrome, **Tracking** settings, card editor, reset session / wipe all                 |

- **No world scan** — counters come only from sandkit events.
- **Live buffer** — `totals` (lifetime) + `session` (resettable) + rolling history for sparklines.
- **Configurable cards** — pick any category (and optional sub-key) for Home cards.
- **Graph series selection** — a list defaults to its top 3 rows. Tick to add a row, untick to drop
  one, or press **◉** on a row to plot that metric alone. Solo is not a mode: ticking another row
  afterwards widens the selection again.
- **Bounded storage** — `timeRange` caps the history window, `maxCountSave` caps distinct sub-keys
  per data point, so neither can grow without limit.
- **Lock / mini mode** — keep the panel open when switching tools; compact card strip.
- Position, zoom and opacity remembered per world.

### Graphs plot per-interval counts, not accumulators

Every KPI here is a **lifetime running total**, so plotting the stored values directly gives a
monotonic ramp that says nothing about activity. Graphs and home-card sparklines instead plot
`total[n] − total[n-1]` — how much happened during each sampling interval, which is what "count by
time range" means. The graph title states the interval, e.g. `Per 2 min · last 30`.

One extra sample is read so the first displayed interval has a predecessor to subtract, and negative
steps (which only happen after a reset or wipe) clamp to zero.

> `md-word-statistic` deliberately does **not** do this. Its counts are a world census — digging
> reduces terrain, placing raises structures — so the absolute value is the meaningful quantity and
> a delta would be misleading.

### Card editing

The **⚙️** tab's **Edit cards** button replaces the panel with a full-screen editor — `+ New card`,
`Reset defaults`, `Cancel`, `Save`. Each card is collapsible: a title, an ordered item list (the
first item is the card's primary number and colour), and a picker that offers **every** KPI
category. Cancel discards; Save persists.

Management matches `md-word-statistic` so both mods work the same way.

## Tracked events

One event per player action — see `ENGINE_NOTES.md` §4 for why only one of each pair is subscribed.

| Event                | KPI category                                              |
| -------------------- | --------------------------------------------------------- |
| `building:placed`    | `structures_placed` (keyed by structure type)             |
| `building:removed`   | `structures_removed` (keyed by structure type)            |
| `structures:moved`   | `structures_moved` (count only — no type in the payload)  |
| `item:used`          | `items_used` (keyed by `itemId`)                          |
| `terrain:destroyed`  | `terrain_destroyed` (keyed by terrain **name**)           |
| `worldItem:pickedUp` | `world_items_picked`                                      |
| `resource:collected` | `resources_collected` (amount summed)                     |
| `player:moved`       | `distance_walked` (pixels ÷ 16; see `src/activity.ts`)    |
| window `keydown`     | `keys_pressed` (keyed by key, e.g. `W`, `Shift`, `Num 5`) |

## Settings

Both statistic mods share the same three history settings, so they read the same way:

| Setting        | Default | Range            | Effect                                                                                           |
| -------------- | ------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `timeRange`    | `2`     | 1–1440, step 1   | **Every N min** — record one data point every N minutes. A point holds the totals for every KPI. |
| `maxCountSave` | `120`   | 10–2000, step 10 | **Max data points** stored. Once full the oldest is dropped (FIFO), so storage stays bounded.    |
| `historyMax`   | `30`    | 5–200, step 1    | **Display points** — how many points are rendered on sparklines and charts.                      |

Plus `enabled` (default `true`) and `persistSession` (default `true`).

All three history settings are editable from the ⚙️ tab (Tracking group) as well as mod settings.
The panel writes through `api.settings.set` and updates its own cache, because the host's `onChange`
does not reliably fire for a mod-initiated write — otherwise the row would show a stale value until
reload.

In **World Statistic** the same three drive its scan loop: `timeRange` is the auto-refresh interval,
`maxCountSave` caps stored refreshes, and `historyMax` caps the points charts render. Its old
`autoRefreshMinutes` setting is still read as a fallback, so upgrading does not reset anyone's
cadence.

> **Note:** a stored value always beats the schema default. Installs that already had `historyMax`
> saved (its old default was 20) keep showing 20 until reset — press **Reset** on that row, or
> change it in mod settings.

### The home card

Both statistic mods render the **same** `KpiCard` from `@sandmd/ui`: an uppercase title, a big
total, a green/red session delta, then one row per tracked item with an inline sparkline built from
live history. `md-word-statistic` maps its own card model onto the same component, so the two home
tabs look identical despite different underlying data.

The word mod's cards previously drew a full `MultiLineChart` per item, which was heavy; the shared
card uses a compact `MiniSparkline` instead.

### Reset defaults & reset session

| Button             | Where       | Effect                                                                                                           |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| **Reset defaults** | Card editor | Restores the default home cards                                                                                  |
| **Reset session**  | ⚙️ → Data   | World: drops the stored trend, **keeps** the reference baseline. Player: zeroes session counters, keeps lifetime |
| **Wipe all**       | ⚙️ → Data   | World: drops trend _and_ the reference baseline. Player: clears every KPI                                        |

The world mod's reference snapshot is the "where I started digging" baseline that `% dug` is
measured against, so **Reset session deliberately keeps it** — only **Wipe all** discards it.

## Keyboard & movement

Neither has a first-class KPI event, so `src/activity.ts` reads them directly.

- **Keys** come from a capture-phase `keydown` listener. `api.input` only exposes _bindings_
  (`registerBinding`, `triggerBinding`, …), not a keystroke stream. Two accuracy guards: auto-repeat
  (`event.repeat`) is ignored so holding a key counts once, and keydowns aimed at a text field are
  skipped so typing into the card editor is not logged as gameplay.
- **Distance** is accumulated from consecutive `player:moved` positions, scaled by `cellSize` (4 px)
  and then by a further 4 — i.e. pixels ÷ 16, a quarter of the cell count (`cellSize` is 4 px). The
  engine emits that event on the main thread only when the position actually changed, and teleports
  arrive with `dt: 0` — steps over 64 px are treated as teleports and skipped.

## Item, overlay & sprite

| Id                            | Kind    | Notes                                                                                                                                                                                                                                                 |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `md-player-statistic:tool`    | item    | `itemType: 2` (`ItemType.Tool`), energy cost 0, 120 ms cooldown.                                                                                                                                                                                      |
| `md-player-statistic:overlay` | overlay | Registered on `global`; panel returns null unless the tool is selected (or locked).                                                                                                                                                                   |
| `md-player-statistic:icon`    | sprite  | `assets/statistic-icon.png` — **required**, not optional: `items.register` dereferences the loaded texture unguarded and throws if it is missing, which would leave the tool out of the hotbar entirely. Regenerate with `python3 tools/gen-icon.py`. |

The item is granted to the player's inventory, not auto-placed in a hotbar slot — equip it once from
the inventory / toolbox.

`api.storage` keys: `kpi_totals`, `kpi_session`, `kpi_history`, `cards`, `ui_pos`, `ui_zoom`,
`ui_alpha`, `ui_lock`, `ui_mini`.

## Package dependencies

**None.** The mod targets the global `sandkit` object and keeps its own helpers. There are no
`@sandmd/*` imports, so it stays drop-in installable.

## Settings

Read with `api.settings.getAll()`, which returns this mod's own bag — see `ENGINE_NOTES.md` §3 for
why `get(modId)` cannot work here.

| Key              | Type    | Default | Description                                                       |
| ---------------- | ------- | ------- | ----------------------------------------------------------------- |
| `enabled`        | boolean | true    | Master switch. Off → unbind events, remove overlay, wipe storage. |
| `persistSession` | boolean | true    | Keep session counters across reloads.                             |
| `historyMax`     | number  | 20      | Sparkline history depth (5–50).                                   |

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

Layout and build details for every mod live in the SandustyMod docs (`doc/doc_ia/MOD_LAYOUT.md`,
`doc/doc_ia/MOD_BUILD.md`).
