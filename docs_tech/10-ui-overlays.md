# `sandkit.api.ui.overlays.register` — UI overlays & the catalogue picker

Reference for the **overlay system** behind the icon picker in
`mods/sandustry-icons` / `mods/buffer-controls` (and `packages/catalogue`), and
how a deco bar turns a single build‑menu row into a full catalogue of objects.

> Verified against `__bundel/bundel.js`. The `ui` package is registered once at
> load (main thread). `overlays.register` internals at **53311-53344**; the
> region‑mount builder at **62940-63120**; `building.selectStructure` at
> **53625**.

---

## 1. The `ui` namespace at a glance

`sandkit.api.ui` groups UI controls. Verified sub‑objects in the bundle
(53199-53330 and shared `ui.d.ts`):

| Member | What it does |
|---|---|
| `ui.toast(msg, opts)` | short on‑screen message |
| `ui.update(componentId, opts)` | request any registered component re‑render |
| `ui.openPauseMenu()` | open the pause menu |
| `ui.showTooltip(data)` | show a tooltip near cursor |
| `ui.alert / confirm / prompt / select(...)` | promise‑based dialogs |
| `ui.overlays.register / unregister / update` | **this document** — slot overlays |
| `ui.regions.mount / setVisible` | generic region mount (more slots than overlays) |
| `ui.overrides.register` | wrap/append an existing (built‑in) component |
| `ui.hotbar.*` + `useHotbar` | hotbar banks/slots |
| `ui.components.{ActionSlot, Panel, Button}` | ready React components |
| `ui.useRefresh / useScale / useGameEvent` | React hooks |
| `ui.navigation.{useFocusable, useFocusScope, controllerFocusClass}` | controller focus |

---

## 2. `overlays.register(slot, overlayId, render)`

**Signature:** `register(slot, overlayId, render) => void` (dom.js / `ui.d.ts`
line 207, bundle 53312-53328).

```ts
sandkit.api.ui.overlays.register(slot, overlayId, render);
```

| Param | Type | Meaning |
|---|---|---|
| `slot` | `"hotbar" \| "global"` | where the overlay lives. `"global"` overlays float over the screen (no band). Any other string **throws** `Unknown UI overlay slot`. |
| `overlayId` | `string` | unique id of this overlay **within the slot**. |
| `render` | `() => ReactNode` | function returning React content. `null` = hidden. |

What the engine does (53112-53328):

1. Validates the slot — `"hotbar"` and `"global"` are the only allowed values.
2. Key = `` `${slot}\0${overlayId}` `` → looked up in a per‑session map.
3. If an overlay with that key **already exists**, it just **updates its render**
   function (`handle.update({ render })`) — i.e. re‑registering the same
   `slot+overlayId` is idempotent and swaps the renderer, no duplicate.
4. Otherwise it creates a **region mount** — placement `"band"` for the hotbar
   slot, none for `global` (53324) — using the same `G.e6` mount builder that
   `ui.regions.mount` calls (62940-63120).

So `overlays.register` is a thin, validated wrapper over the generic region
mount system with a fixed key and default placement.

### Nested: the internal mount object

Each registration becomes a mount (62940-63120):

| field | meaning |
|---|---|
| `id` | the overlayId |
| `placement` | `"band"` for hotbar, else `"docked"` (default) / `"raised"` |
| `order` | sort order within the region (default 0) |
| `render` | the render function |
| `sequence` | insertion order used to stabilise sorting |

The slot → component wiring lives in a frozen table (62948-62970): `hotbar`
mounts into `HotbarOverlays`, `global` into `GlobalOverlays`. Mounting a region
bumps the owning component, which is how the React tree picks the overlay up.

---

## 3. `overlays.unregister` and `overlays.update`

| Member | Bundle | Meaning |
|---|---|---|
| `unregister(slot, overlayId)` | 53329-53338 | unmount the mount, delete the key, clean the session map when the last one goes. |
| `update(slot)` | — | *declared in `ui.d.ts` (220)*; refreshes overlays in the slot (re‑render). |

Overlays you add should be matched by an `unregister` if your mod can be
reloaded/re‑used, otherwise re‑registering overwrites (see dedup rule above).

---

## 4. How open / close actually works

There is **no `open()` / `close()` call on `overlays.register`**. An overlay is
registered **once** (persistent), and its **render function decides visibility**
by what it returns:

- **returning `null`** → the overlay is hidden (the slot renders nothing for it);
- **returning a React element** → the overlay is shown.

That is exactly what the catalogue picker does (`overlay.ts`):

```ts
sandkit.api.ui.overlays.register(slot, pickerId, () => h(Picker, null));

const Picker = () => {
  const [, bump] = sandkit.react.useState(0);          // repaint handle
  // ... pickerState = null | { minimized: boolean }
  if (!pickerState) return null;                        // CLOSED
  return ( /* the panel, categories & swatches */ );
};
```

- `close()` sets `pickerState = null` then `repaint()` → render returns `null`.
- `minimize()` sets `pickerState = { minimized: true }` → a compact bar.
- `expand()` sets `{ minimized: false }` → the full panel.
- `repaint()` is wired to a React `useState` setter in a `useEffect`
  (overlay.ts 197-203), so calls from outside React trigger a re‑render.

Because the component owns its state, "opening" is just *telling it to change
state and repaint* — the engine only guarantees the React tree exists and
re‑renders on `update`/signal changes.

> The hotbar/global band placement itself (whether the band is visible) is a
> separate concern handled by the host's own layout; a `null` render is how a
> registered overlay stays invisible within an active band.

---

## 5. The `sandustry-icons` recipe — one build‑menu row → a full picker

This is the exact pattern the deco mods use. Three pieces interact:

### 5.1 `main.ts` — build the list, register structures, mount the picker

```ts
const list = createBuildList({ modId, menuId: "icons", menuLabel: "Icons",
  categories: ICON_CATEGORIES, items: ICON_ITEMS,
  selectedId: ICON_ITEMS.find(i => i.id !== "icons")?.id });

registerIconStructures(list, spriteIds);        // registers every icon structure

createPickerOverlay({ list, title: "Pick icon",
  pickerId: `${modId}/picker`,                   // default slot "hotbar"
  spriteIdFor: (item) => spriteIds[item.id] });  // correct swatch art
```

### 5.2 `register.ts` — why only ONE structure shows in the build menu

Every catalogue item becomes a `structures.register` entry (all
`hideFromBuildMenu: false`), **but only the `icons` placeholder is unlocked**:

```ts
if (isMenu) sandkit.api.player.buildings.unlockByType(typeId);  // only "icons"
```

The build menu lists **unlocked** buildings (`player.buildings`, filtered by
`hideFromBuildMenu`, bundel.js:151648). Since only
`sandustry.icons:item/icons` is unlocked, the player sees **exactly one** entry —
the `Icons` hub row. All the other icon structures are registered but stay
locked, so they never clutter the build menu.

The `icons` placeholder is the only one given `render` (with a `ui:` swatch,
register.ts 75-86), so its menu tile shows a representative sprite.

### 5.3 `picker/overlay.ts` — the click → overlay flow

1. `createPickerOverlay` registers the overlay:
   `overlays.register(slot, pickerId, () => h(Picker, null))` (overlay.ts 475),
   then starts a `sync` interval (default 100 ms, overlay.ts 477).

2. The player opens the build menu, sees the single `Icons` row, and clicks it.
   That runs `building.selectStructure("sandustry.icons:item/icons")`
   (bundel.js 53625). `selectStructure`:
   - resolves the actual registered structure type (uses its `buildModes`/`variants`);
   - sets `player.action = { type: ActionType.Building, id }`;
   - closes the build + inventory windows;
   - emits `action:changed` and refreshes `HotbarOverlays`.

3. The picker's `sync()` (overlay.ts 448-471) reads the currently selected
   action via `api.action.getSelected()` (`action.d.ts:21`). If it is a
   `Building` whose id starts with `<modId>:` (i.e. our `icons` row is active)
   and the overlay is closed, it sets `pickerState = { minimized: true }` → the
   overlay now renders the swatch pack. **This is why clicking the structure
   "opens" the overlay.**

4. Clicking a swatch runs `selectItem(item)` (overlay.ts 65-76):
   - selects the item + its category in the list;
   - `unlockTypes([type, mirroredType])` (default = `buildings.unlockByType`) so
     that exact icon becomes buildable;
   - `list.applyToBuildTool()` → `building.selectStructure(iconType)` (controller.ts
     159-161) — the build tool is now retargeted to the real icon, replacing the
     `icons` placeholder selection;
   - a `building:placed` event → `list.notifyPlace` (controller.ts 164-170).

5. Deselecting / leaving the build tool makes `sync()` see no matching action →
   `close()` → the overlay returns `null` again.

Net effect: the build menu stays clean (one row), the actual catalogue lives in
the overlay, and every placement still creates a real, unlocked structure.

---

## 6. It is **not** only for building — interacting with other overlays

`ui.overlays` is a generic UI-slot system, not a building tool. Proof from the
bundle (53311-53344 + the built-ins that call it):

- **hotbar** overlays: tool/item actions — `sweeperDrone`, `reconDrone`,
  `coloringTool`, `implosionGunVoid`, `locatorVoid`, `signals`, `prefabulator`
  (e.g. bundel.js 633.../119426/124024/124352/124853/63486/32387).
- **global** overlays: full-screen/overlay UI — `augmentChoice` (32387/83176),
  `reconDroneFeed` (124063), and mods like deco register their pickers here.

Any of those is the same `overlays.register(slot, id, render)` call — the pattern
of the icons picker (show a panel, swap the active tool/item, mirror selection)
is reused for *any* tool that needs a picker, not just buildings.

Other overlay-adjacent surfaces in the same `ui` namespace:

| API | Purpose | Example in bundle |
|---|---|---|
| `ui.overrides.register(id, wrapper)` | wrap/replace an existing built-in component, keeping the original | `ui.overrides.register` → `W.nX` (53300) |
| `ui.regions.mount(slot, id, { placement, order, render })` | mount into more slots: `mainMenu.actions`, `hud.topLeft`, `hud.topRight` (62948-62970) — the low-level mechanism `overlays.register` wraps | `G.e6` (53316 / 62936) |
| `ui.regions.setVisible(slot, id, visible)` | show/hide a whole region mount | `G.pi` (53328) |
| `ui.inject(componentId, component)` | mount a component under a built-in id, returns an unmount fn | `ui.d.ts:197` |
| `ui.components.{ActionSlot, Panel, Button}` | reusable building blocks for your overlay content | 53290-53294 |
| dialogs `alert/confirm/prompt/select` | modal dialogs (per-overlay, promise-based) | 53226-53283 |
| `ui.toast` | transient notifications | 53220 |
| `ui.navigation.*` hooks | controller focus inside your overlay | `ui.d.ts:224-320` |

### Practical rules for interacting with overlays

1. **Register idempotently.** Calling `overlays.register` twice with the same
   `slot + overlayId` only swaps the render function — it never stacks (53321-53325).
2. **Gate visibility with return value.** `render` returns `null` to hide, an
   element to show. There is no `open()`/`close()` on the registration handle.
3. **Drive re-render with a state bump.** Keep a `useState` setter as your
   "repaint" and call it from non-React code; the engine re-renders on
   `overlays.update(slot)` and on relevant signals (`action:changed`,
   `HotbarOverlays` bump).
4. **Unregister on dispose.** For reload-safe mods, pair `register` with
   `overlays.unregister(slot, overlayId)` (53329).
5. **Look at the active action, don't try to "own" the build menu.** Like the
   picker's `sync`, watch `api.action.getSelected()` and show/hide your overlay
   when the right action is active. That stays decoupled from vanilla UI.