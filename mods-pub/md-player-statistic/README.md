# Player Statistic (`md-player-statistic`)

`md-player-statistic` · v0.1.0 · **dev**

Event-driven KPI tracker for Sandustry. Unlike **World Statistic** (which scans the map), this mod
accumulates counters from live player events into an in-memory buffer and persists them via
`api.storage`.

## Features

| Tab            | Content                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Home**       | Configurable KPI cards (structures / dig / items / shoot / activity) with session Δ and sparklines |
| **Structures** | Structures placed · removed · moved — history graph + selectable list                      |
| **Items**      | Every item use, broken down by item — history graph + selectable list                      |
| **Shoot**      | Projectile impacts and flamethrower-over-structure, by projectile type — graph + list        |
| **Dig**        | Terrain cells destroyed, by terrain **name** — graph + selectable list                     |
| **Move**       | Distance walked and collisions — teleports excluded                                        |
| **Keys**       | Key presses — graph + selectable list, breakdown by key                                    |
| **⚙️**         | Panel chrome, **Tracking Configuration**, card editor, reset session / wipe all            |

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

One count per player action — see `ENGINE_NOTES.md` §4 for why only one of each pair is subscribed,
and §12 for why item use comes from a **hook** rather than an event.

| Signal                | Kind   | KPI category                                            |
| --------------------- | ------ | ------------------------------------------------------- |
| `building:placed`     | event  | `structures_placed` (keyed by structure type)           |
| `building:removed`    | event  | `structures_removed` (keyed by structure type)          |
| `structures:moved`    | event  | `structures_moved` (count only — no type in the payload)|
| **`action:intercept`**| **hook** | `items_used` (keyed by `args.action?.id`)             |
| **`projectile:hit`**  | **hook** | `projectiles_hit` (keyed by `projectile.type`)        |
| **`projectile:fire:overStructure`** | **hook** | `projectile_fire_structure` (keyed by `projectile.type`) |
| `terrain:destroyed`   | event  | `terrain_destroyed` (keyed by terrain **name**)         |
| `worldItem:pickedUp`  | event  | `world_items_picked`                                    |
| `resource:collected`  | event  | `resources_collected` (amount summed)                   |
| `player:moved`        | event  | `distance_walked` (pixels ÷ 16; see `src/activity.ts`)  |
| window `keydown`      | DOM    | `keys_pressed` (keyed by key, e.g. `W`, `Shift`, `Num 5`) |
| `player:collision:prepare` | hook | `collisions` (distinct bumps, not sub-steps)        |

> **Item use comes from the `action:intercept` hook.** Two more obvious signals were tried and
> neither covers built-ins: `item:used` (event) is emitted only from the use-*commit* path,
> which the engine reaches for a couple of built-ins; `item:use` (hook) fires from
> *begin-use*, reached solely from the `ActionType.Mod` branch, so no built-in weapon or tool
> triggers it. `action:intercept` fires on the click that **starts an action** and carries
> the active action, so it covers everything the player actually uses. Structure placement
> rides the same hook and is filtered out (`action.type === Building`) — `building:placed`
> already counts it, precisely.

> All three new hooks can **cancel** the engine's own handling. This mod only observes and
> never calls `context.cancel()`, so nothing is suppressed in game.

## Settings

Both statistic mods share the same three history settings, so they read the same way:

| Setting        | Default | Range            | Effect                                                                                           |
| -------------- | ------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `timeRange`    | `2`     | 1–1440, step 1   | **Every N min** — record one data point every N minutes. A point holds the totals for every KPI. |
| `maxCountSave` | `120`   | 10–2000, step 10 | **Max data points** stored. Once full the oldest is dropped (FIFO), so storage stays bounded.    |
| `historyMax`   | `30`    | 10–200, step 10  | **Display points** — how many points are rendered on sparklines and charts.                      |

Both history sizes step by **10**. These are window sizes, not precision knobs — a 1-at-a-time
stepper across 10–200 takes 190 clicks to cross. The ranges are multiples of the step so the row
never parks on a value it cannot step back to.

Plus `enabled` (default `true`) and `persistSession` (default `true`).

#### Where these values are stored

> ⚠️ **`api.settings` is read-only.** The engine gives a mod `get`, `getAll` and `onChange` — and
> nothing else. There is no `set`, so a mod **cannot write its own `configSchema` values**.
> `api.settings.set?.(k, v)` is a silent no-op.

Both mods used to call exactly that. The failure was different in each, and both were wrong:

- **World Statistic** kept no cache, so `getConfig()` re-read the engine bag and handed back the old
  number. **Max data points** and **Display points** looked frozen — you could not change them at all,
  and the mod never even got an `externalModSettings` entry.
- **Player Statistic** masked the same no-op behind an in-memory cache, so its rows moved in-session
  and then reverted on the next launch. Worse, because it looked like it worked.

All three numbers now persist in `api.storage` (one key, `tracking`) alongside the panel position,
zoom and card layout, which already persisted reliably. The engine bag **seeds** them on the very
first read, so a value set in the game's own mod-settings screen is adopted rather than overwritten;
after that the panel is the source of truth. Clamping and the row definitions live in one place —
`packages/ui/src/tracking.ts` — so the two mods cannot drift apart.

`enabled` and `persistSession` remain engine-owned: there is no write path, so they can only be
changed from the game's mod-settings screen. The panel still reflects such a change immediately,
because the settings listener re-reads the engine bag.

All three history settings are editable from the ⚙️ tab under **Tracking Configuration**.

In **World Statistic** the same three drive its scan loop: `timeRange` is the auto-refresh interval,
`maxCountSave` caps stored refreshes, and `historyMax` caps the points charts render. Changing
`timeRange` restarts the scan timer immediately. Two older names are still honoured on upgrade:
`autoRefreshMinutes` (the pre-`timeRange` engine setting) and the panel's own `panelAutoMinutes`
override, which is folded into `timeRange` once so nobody loses the cadence they picked.

### Graph views: total vs diff

Every history graph carries a **TOTAL / DIFF** button in its top-right corner:

- **Total** — the accumulated running total at each sample. For lifetime counters this is a rising
  ramp: it tells you where you are, not what you have been doing.
- **Diff** — the change between consecutive samples, i.e. what happened during one sampling
  interval. This is what shows activity.

Hover the button to see what clicking will switch to.

The two mods previously disagreed — this one always plotted diff, World Statistic always plotted
total — so each now defaults to what it was already showing (**diff** here, **total** there) and the
toggle is opt-in. The choice is per-mod and applies to every graph in the panel; it lives in panel
state, so it resets when the game restarts.

Both mods share `applyGraphMode`, so the two views are computed identically. One subtlety it handles:
a diff series loses its first point to the subtraction, so `rawPointsFor` reads one extra history
sample to keep the plot at full width. A counter reset (wipe all data) reads as a flat interval
rather than a negative spike.

### The home card

Both statistic mods render the **same** `KpiCard` from `@sandmd/ui`: an uppercase title, a big
total, a green/red session delta, then one row per tracked item with an inline sparkline built from
live history. `md-word-statistic` maps its own card model onto the same component, so the two home
tabs look identical despite different underlying data.

The word mod's cards previously drew a full `MultiLineChart` per item, which was heavy; the shared
card uses a compact `MiniSparkline` instead.

**Every number on the card is rounded to a whole.** `formatCount` normally keeps one decimal,
because raw KPIs can be fractions — `distance_walked` is `pixels ÷ 16`, and interval series are
differences of totals. A headline figure reading `1,234.5 shots` or `12.7 collisions` looks like a
bug rather than a statistic, so the card passes the total, the session delta and each row count
through `Math.round` first. This is **display-only** — stored counters and the sparkline series keep
full precision, so the graphs are unaffected. The list tabs are unchanged and still show one
decimal where the underlying value is genuinely fractional.

**The badge beside the big number is the change over the last interval** — the difference between
the final two data points, which is the same value as the last bar of the sparkline above it. Hover
it for confirmation.

It was not always this. It used to read `+N session` and mean something quite different in each mod:
Player Statistic showed the raw session counter (everything since the session started, which just
climbs), while World Statistic showed `current − reference`, i.e. everything found since the very
first scan *ever*. Both were lifetime-scale figures wearing a per-interval label, and both drifted
further from the truth the longer the install was left running.

The badge is hidden when history is shorter than two points, and when the change is exactly zero —
there is no measurement to show, and a printed `0` would read as "nothing happened" rather than
"not enough data yet".

Default cards: **Structures** (placed / removed / moved), **Digging**, **Items**, **Shoot**
(projectile hits + fire over structure), **Activity** (distance / collisions / keys). A saved
layout wins over these — `loadCards` only falls back to the defaults when nothing is stored — so
the **Shoot** card reaches an existing player via **Edit cards → Reset defaults**, or by adding it
in the editor.

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
