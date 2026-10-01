# Player Statistic (`md-player-statistic`)

`md-player-statistic` · v0.1.0 · **dev**

Event-driven KPI tracker for Sandustry. Unlike **World Statistic** (which scans the map), this mod
accumulates counters from live player events into an in-memory buffer and persists them via
`api.storage`.

## Features

| Tab            | Content                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Home**       | Configurable KPI cards (structures / dig / loot / graber / activity) with session Δ and sparklines |
| **Structures** | Structures placed · removed · moved — history graph + selectable list                              |
| **Dig**        | Terrain cells destroyed, by terrain **name** — graph + selectable list                             |
| **Move**       | Distance walked and collisions — teleports excluded                                                |
| **Keys**       | Key presses — graph + selectable list, breakdown by key                                            |
| **Graber**     | Grabber uses, and what it collected — graph + selectable list by resource                          |
| **⚙️**         | Panel chrome, **Tracking** settings, card editor, reset session / wipe all                         |

- **No world scan** — counters come only from sandkit events.
- **Live buffer** — `totals` (lifetime) + `session` (resettable) + rolling history for sparklines.
- **Configurable cards** — pick any category (and optional sub-key) for Home cards.
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

### Removed: the Items tab

The **Items** tab and the default "Items & tools" card were removed. The underlying KPIs —
`items_used`, `world_items_picked`, `resources_collected` — are **still tracked**, so cards you
configured yourself keep working with their data intact, and the card editor can add `items_used`
back to any card.

Only the tab and the default card are gone.

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

## Grabber tracking

| KPI                | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `graber_uses`      | One per grabber use                                            |
| `graber_elements`  | **What was grabbed** — element/terrain id, plus how many cells |
| `graber_resources` | Which resource the engine credited, keyed by resource          |

`graber_elements` is resolved from a **pre-cache**, not read at collection time.

`resource:collection:prepare` turned out **not** to be on the grabber's path. The scraped
`jojo5.quickgrab` mod patches the grabber's own collection loop, which fills an internal slot matrix
directly (`matrix[b + 2]` occupancy, `shared.sim.elementData.type[…]` for particles, terrain type
otherwise). That `prepare` hook lives in the `resource:collection` helper the _vacuum_ uses — which
is why hooking it recorded nothing.

So while the grabber is held, a 200 ms tick snapshots the element in a bounded window (13×13, capped
at 400 cells) around `input.getMouseCellPosition()`, and the `resource:collected` event resolves the
element from that snapshot. Only documented APIs are used. The cache is cleared the moment the
grabber is no longer held, and released on disable.

Resolution falls back in order — cache → live cell lookup → `resourceId` — so the section can never
silently come up empty: a failure shows up as a named row instead of nothing.

### Vacuum

| KPI            | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| `vacuum_uses`  | One per vacuum activation                             |
| `vacuum_cells` | Head size at the moment it fired, summed — in `cells` |

The vacuum has **dedicated hooks**, so unlike the grabber it needs no polling and no attribution
window:

- `vacuum:prepare` fires **once per activation** and carries the head `pattern` (`number[][]`),
  which yields both the use count and the head size in cells.
- `vacuum:element:prepare` fires **per element considered** — far too frequent to count raw (the
  same problem as the collision hook at ~135/s), so it is deliberately unused.

There is **no grabber event and no grabber hook**. `api.hooks` has no grabber id, and `item:use` is
emitted from the ability/use-definition resolver
(`kind: "instant" | "sustained" | "chargeThenFire"`) — so it only fires for items that declare
_uses_ with an energy cost. The grabber is a plain tool with `energyCost: 0` and no use definition,
which is why filtering `item:use` on the grabber recorded nothing.

A use is therefore recorded if **any** of three signals fires:

| Signal                              | Mechanism                                   |
| ----------------------------------- | ------------------------------------------- |
| `action:start` hook                 | fires when the grabber action begins        |
| `item:use` hook                     | inert today; correct if a use def is added  |
| `api.tools.grabber.isLoaded()` poll | rising edge = the grabber holds a selection |

All three funnel through one debounced counter (350 ms), so a single grab counts once however many
signals saw it, while a burst of real grabs still counts each one. The `isLoaded()` poll is the
safety net — the only signal backed by a documented API rather than a hook.

`graber_resources` comes from the `resource:collected` event, attributed to the grabber only within
1.5s of a use, so a collection made by something else is never miscounted.

`api.tools.grabber.isActive()` is deliberately **not** used: it is engine-internal state set only by
the real input path, and it stays `false` when the tool is selected programmatically — which is what
made the old gate useless.

### Keyboard & movement

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
