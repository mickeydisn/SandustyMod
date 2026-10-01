# Engine notes — md-player-statistic

Behaviours of Sandustry 0.5.6 that this mod depends on. Every claim below was read out of the
shipped `app.asar` and/or confirmed live through `mods-dev/md-admin-steam-bridge` (CDP eval +
console capture). They are the reason several lines in `src/` look defensive.

## 1. `items.register` hard-requires a loaded sprite

```js
register: (e, t) => {
  xt(t, /* category */, t.id);

## Shared UI layer

Everything visual lives in the workspace package `@sandmd/ui`, so this mod and
`md-word-statistic` render identically:

| Package file | What it owns |
| --- | --- |
| `src/api.ts` | sandkit handle, `safe`, `h`, `React`, `toast` |
| `src/styles.ts` | the whole style sheet — one visual language for both mods |
| `src/chrome.ts` | header, tab bar, drag, right-anchored placement, zoom/opacity, mini widget, lock |
| `src/section.ts` | `Breakdown`, `CfgRow`, `CfgSection`, `Hint`, `formatKpi`, `maxCount` |
| `src/graph.ts` | `Sparkline`, `MultiLineChart`, `yDomain`, `seriesColor`, `formatDelta` |
| `src/state.ts` | `createPanelState` — chrome state + `bump()` repaint |
| `src/uiStore.ts` | `createUiStore` — position/zoom/opacity/lock/minimize persistence |
| `src/tool.ts` | `registerStatisticTool` — sprite → item → inventory → overlay |

`deno bundle` inlines the package into `build/main.js`, so the shipped mod is
still self-contained despite the workspace import.

This mod supplies only its own data layer (KPI buffer, event tracking, tab
bodies) and wires the chrome through `createUiStore` / `createPanelState`.

> **Storage note:** this mod persists its panel prefs under the legacy
> underscore keys (`ui_pos`, `ui_zoom`, `ui_alpha`, `ui_lock`, `ui_mini`), passed
> explicitly via the store's `keys` option. The shared default would be
> `uiPosition` etc., which would have silently reset everyone's panel position
> on upgrade.

## Known issue: the panel does not mount

`api.ui.overlays.register` reports success and no fallback warning is logged,
but the host never invokes the registered render function — no panel DOM is
created, and the render is not called even once. This reproduces identically on
the pre-refactor build, so it is **pre-existing, not caused by the `@sandmd/ui`
extraction**. The item registers, the tool reaches the hotbar, and KPI tracking
all work; only the overlay surface is missing. Worth investigating
`ui.overlays.register` separately.

  const n = e.sandkit.graphics[t.sprite.id];
  const o = n.texture;              // ← TypeError if the sprite never loaded
  ...
  e.sandkit.mods.items[t.id] = t;
}
```

No guard. A failed `sprites.loadFromMod` therefore does **not** degrade gracefully — it throws, the
item is never registered, and the next call (`player.inventory.addById`, which reads
`items[id].cooldown`) throws as well. The tool never reaches the hotbar, `items.isActiveById` is
permanently false, and an overlay gated on it can never open. `assets/statistic-icon.png` is
therefore **required**, not optional. `src/tool.ts` verifies with `sprites.getById` before
registering.

## 2. `ItemType` is a numeric enum

`Weapon = 1, Tool = 2, Consumable = 3, Mod = 4`, and the engine branches on `itemType === SP.Tool`.
The string `"tool"` is never equal to `2`, so the item is filed under the generic `"items"` category
instead of `"tools"`. `constants.ts` exports `ITEM_TYPE_TOOL = 2` for this reason.

## 3. `api.settings` is already scoped to the calling mod

```js
settings: {
  get:    t => { if (n.configSchema?.[t]) return vt(e, n)[t] },  // field NAME
  getAll: () => FG(e, n),                                        // the whole bag
}
```

`get()` takes a **configSchema field name** (`"enabled"`). Passing a mod id or `"modId.field"`
returns `undefined`, so a mod that reads its own settings that way silently gets its hardcoded
fallbacks forever — the `enabled` toggle does nothing. `getAll()` returns
`{enabled, persistSession, historyMax}` and is the only reliable read. `onChange` also hands over
that same per-mod bag, **not** a map keyed by mod id.

Storage lives at `session.settings.externalModSettings[modId]`.

## 4. One player action, two event ids

| action   | per-structure event | batch event          |
| -------- | ------------------- | -------------------- |
| place    | `building:placed`   | `structures:placed`  |
| demolish | `building:removed`  | `structures:removed` |
| move     | _(none)_            | `structures:moved`   |

The engine emits **both** columns for the same action, so subscribing to both double-counts. A move
additionally fires `structures:removed` with `byMove: true`, so it would land in "removed" _and_
"moved". `src/events.ts` uses `building:*` for place/remove and `structures:moved` for moves only.

Payload shapes that matter:

- `building:placed` → `{structure, x, y, isBatch, isCopied}` (type in `structure.type`)
- `building:removed` → `{structureId, x, y, isBatch}` (`structureId` is the type)
- `structures:moved` → `{moved, failedToPlace}` where each `moved` entry is a `{from, to}` **cell
  record**, not a structure — there is no type to break down by, so moves are counted against the
  category total.

## 5. Terrain cell types are numbers

`terrain:destroyed` carries `cellType: number`. `terrains.getIdByType(type)` turns it into `"stone"`
/ `"dirt"` / … `src/events.ts` uses it so the Terrain tab shows names instead of raw ids.

## 6. `game:ready` is never emitted on the main thread

Every occurrence in the bundle is `events.on(e, "game:ready", …)`. The only world-start event
actually emitted to mods is `game:started` (`emit(e, "game:started", {state: e})`). A mod that waits
for `game:ready` to grant a hotbar item waits forever.

Related: mods boot at the **main menu**, where there is no player and no inventory, so an inventory
grant at boot is a no-op. `main.ts` pairs the `game:started` listener with a bounded retry
(`startInventoryWatch`).

## 7. Missing removal APIs

The runtime facades expose no `items.unregister` and no `player.inventory.removeById`
(`player.inventory` has only `hasById`, `addById`, `addFromId`). A mod therefore cannot un-register
its item or take it out of the hotbar; disabling the mod hides the overlay but leaves the tool in
the inventory.

## 8. `storage.get(modId)` takes a key

`storage.get(modId, key)` — there is no whole-bag read, so `cleanup.ts` uses
`storage.remove(modId, key)` per known key rather than trying to enumerate a bag.

## 9. `ui.overlays.register` re-registers in place

Calling it twice for the same `(slot, id)` updates the existing mount (`i.update({render})`) rather
than throwing, so the enable → disable → enable cycle is safe.

## 10. `player:moved` is a main-thread event, and is position-guarded

```js
if (a.x !== l || a.y !== c) { /* … */ try { emit(e, "player:moved", {state: e, dt: t}) } }
```

It fires on the **main** thread (unlike `game:ready` in §6) and only when the position actually
changed, so consecutive samples give real per-step distance. Teleports take a different path and
emit `{state, dt: 0, teleportMapLerpMs}` — a raw position diff across one of those is a huge phantom
jump, so `src/activity.ts` discards any step over 64 px.

`player.getPositionAtWorld()` returns a `Vector2` in **pixels**; `cellSize` is 4 in a real save
(read it from `rendering.getGridMetrics().cellSize`).

## 11. There is no keystroke API

`api.input` exposes only bindings — `registerBinding`, `triggerBinding`, `pressBinding`,
`releaseBinding`, `getBoundKeys`, `getDisplayKey`, `getMousePositionAtCell`, … There is no
per-keystroke event, so keyboard tracking has to be a DOM `keydown` listener on the window.

Two consequences that matter for a stats mod:

- A capture-phase listener on `window` also sees keystrokes aimed at the mod's **own** React inputs.
  The card editor renders `<input>` elements, so a `tagName` guard is required or every character
  typed into a card title is logged as a game key.
- `event.repeat` is true for OS auto-repeat. Counting it makes "hold W for two seconds" register
  dozens of presses.

Neither is mentioned in the typings.
