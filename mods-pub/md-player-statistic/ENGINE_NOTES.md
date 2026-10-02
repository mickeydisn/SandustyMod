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

## 3. `api.settings` is read-only and already scoped to the calling mod

```js
settings: {
  get:      t => { if (n.configSchema?.[t]) return vt(e, n)[t] },  // field NAME
  getAll:   () => FG(e, n),                                       // the whole bag
  onChange: cb => { /* hands over the same per-mod bag */ },
}
```

Three things bite here.

**There is no `set`.** This is the big one. A mod cannot write its own `configSchema` values, so
`api.settings.set?.(k, v)` is a silent no-op — no throw, no warning, the value just evaporates. Only
the game's own settings screen can change these.

`get()` takes a **configSchema field name** (`"enabled"`). Passing a mod id or `"modId.field"`
returns `undefined`, so a mod that reads its own settings that way silently gets its hardcoded
fallbacks forever — the `enabled` toggle does nothing. `getAll()` returns
`{enabled, persistSession, historyMax}` and is the only reliable read. `onChange` also hands over
that same per-mod bag, **not** a map keyed by mod id.

**Consequence for the panel.** Both statistic mods used to route their three history settings
(`timeRange`, `maxCountSave`, `historyMax`) through the non-existent `set`. The symptoms differed,
which is why it survived so long:

- `md-word-statistic` had no cache, so `getConfig()` re-read the engine bag, returned the old number,
  and the steppers looked frozen — the player could not change them at all. The mod never even
  created an `externalModSettings` entry, because nothing was ever written.
- `md-player-statistic` updated an in-memory cache first, so the rows moved immediately and then
  reverted on the next launch. That is the more dangerous shape: it looks like it works.

**Fix.** Those three numbers live in `api.storage` now (one key, `tracking`), which both mods already
use for panel position, zoom and card layout and which demonstrably survives a reload. The engine bag
seeds them on the first read only. See `packages/ui/src/tracking.ts`. `enabled` and `persistSession`
stay engine-owned reads — there is no write path for them at all.

Storage for the engine's own settings lives at `session.settings.externalModSettings[modId]`; mod
storage is a different namespace reached through `api.storage.set(modId, key, value)`.

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

## 12. Item use needs `action:intercept` — two "obvious" signals are dead ends

This is what broke the Items tab. The docs list `item:used` as a normal main-thread event
(`doc.api/shared/api.hooks.md`, `api.events.md`), so it looks like the right thing to subscribe
to. It is not — and neither is the hook that sounds even more obviously correct.

### Dead end 1 — the `item:used` event fires for two items

It is emitted from exactly one function, the use-*commit*:

```js
// module 92174 — the item-use pipeline
g = (e, t, n, r) => {
  if (!t || !Number.isSafeInteger(n) || !Number.isSafeInteger(r)) return false;
  const l = i.get(e);
  return !!l && (
    ("instant" === t.kind ? l.instant?.use === t : l.active?.use === t) &&
    (o.A.emit(e, "item:used", Object.freeze({
        itemId: t.itemId, useId: t.useId, kind: t.kind,
        cellX: n, cellY: r, prepared: t.prepared })), true)
  );
};
```

That is exported as `items.commitUse`, and `commitUse` appears **three times** in the whole
bundle: the facade definition plus **two call sites** — the **laser** and the **caulk
blaster**. Vacuum, grabber, shovel, grappling hook, rocket launcher, flamethrower,
teleporter, hauler, cryoblaster and every mod-registered tool emit `item:used` **zero
times**.

### Dead end 2 — the `item:use` hook only covers `ActionType.Mod`

`item:use` is a real registered interceptor, dispatched from *begin-use*. But `beginUse`
(`g2`) has exactly **one** call site in the bundle, and it sits in the action dispatcher's
`ActionType.Mod` branch:

```js
case r.X2.Mod:
  const a = e.store.player.inventory.find(e => e.id === t.id);
  const i = e.sandkit.mods.items[a.id];
  const s = (0, w.g2)(e, i, a);           // ← fires "item:use"
  if (false !== s) { … i.handleAction(e, a, s) … }
```

`ActionType.Weapon` goes to `Jz` and `ActionType.Tool` to the `U[n.id]` map instead —
neither calls `beginUse`. So `item:use` covers mod-registered items and the built-ins
registered as such (laser, drill, flashlight, locator, prefabulator, corraller,
recallDevice, colouring tool), but **no built-in weapon or tool**: vacuum, grabber,
grappling hook, rocket launcher, flamethrower, hauler, cryoblaster, teleporter.

### What works — `action:intercept`, the action-start hook

```js
// action dispatcher, when the mouse press begins an action
if (n.action.state[r.qy.Start] &&
    (0, A.Z$)(e, "action:intercept", {action: l, cellX: …, cellY: …})) return …;
```

`Z$` is `runInterceptorsSafe`, which returns `true` **only if a handler cancels**. Not
cancelling falls through to the normal `action:triggered` + action dispatch, so a
statistics mod can observe every action without touching the game.

`l` is the resolved active action, `{type, id}` — exactly `args.action?.id`. The id is a
numeric `ItemId` for built-ins and the definition id string for a mod item; both resolve in
`displayNameFor`.

⚠️ **A structure placement is an action too** (`{type: Building, id: <structureType>}`), so
it arrives on the same hook. It is filtered out by `action.type === ActionType.Building`
(`2`) — `building:placed` already counts it, and leaving it in would file conveyor types
into the Items tab under an `ItemId` name.

## 13. The projectile hooks

Both are registered interceptors and both carry the live projectile record, so the
breakdown key is `projectile.type` — the numeric `ProjectileType`
(`Bullet=1, Rocket=2, GrapplingHook=3, Fire=4, Digger=5, Mod=6`).

```js
// every projectile that resolves an impact
if (g.FH.hooks.hasInterceptors(e, "projectile:hit") &&
    g.FH.hooks.runInterceptorsSafe(e, "projectile:hit", {projectile: t, travelResult: _})) return;

// flamethrower spread onto a structure cell — only ProjectileType.Fire reaches it
if (t.type === o.Ag.Fire &&
    g.FH.hooks.runInterceptorsSafe(e, "projectile:fire:overStructure", {projectile: t, x, y})) return;
```

⚠️ **Both short-circuit the engine on a cancel** — a cancelling `projectile:hit` skips the
impact handling, a cancelling `projectile:fire:overStructure` stops the fire spreading.
`src/events.ts` never calls `context.cancel()`; it only reads the payload.

Note `projectile.type` and `ItemId` **overlap numerically** (`Bullet=1` vs `Shovel=1`), so
each category must resolve through its own enum — a shared lookup would report "Shovel" for
a bullet. Covered by a test.

> Verified against the **shipped** `app.asar` (`dist/js/bundle.js`), not the repo copy of
> the bundle — `__bundel/bund/` is an older extract and disagrees about the drill.
