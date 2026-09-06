# `action:changed` event — driving the picker without the timer loop

The catalogue picker (`packages/catalogue/src/picker/overlay.ts`) currently **polls**:
it starts a `sync()` interval (default `100 ms`) that re-reads the active build
action every tick and shows/hides the overlay. This doc answers: **can the
same thing be done with a catchable event instead of the loop?** — yes, via the
engine's `action:changed` event.

> Verified against `__bundel/bundel.js` and `packages/sandkit/src/sandkit/api/`.
> Event emitted at **29032 / 53676 / 75983 / 76003 / 76057**; consumed by
> vanilla at **119456 / 122458 / 124347** via `events.on`.

---

## 1. What the timer does (and why it's replaceable)

The picker's loop body (`sync`, overlay.ts 448-471) does exactly two things,
page read-only:

1. `selectedModType()` — `api.action.getSelected()`;if it's a `Building`
   whose id starts with `<modId>:` → the overlay is shown (state minimized or full).
2. if it's **not** matching → `close()` → the overlay returns `null`.

That is a mirror of "the currently selected **action** changed". The engine already
**emits an event for exactly that** — `action:changed` — so the polling is
redundant except as a safety net.

---

## 2. `action:changed` — what it is

- **It's an engine **event** (not a hook) — subscribe via `api.events.on`, not
  `hooks.intercept`. It's delivered on the main thread. `events.on` returns an
  **unsubscribe** function (`events.d.ts:10-11`).
- It fires **every time the player action changes**, wherever the engine sets a
  new action or clears it:

| Emitter (bundle) | Context |
|---|---|
| `29032` | selecting an action/hotbar click (sets `player.action`) |
| `53676` | `building.selectStructure(...)` — picking a structure in the build menu |
| `75983` | activating a hotbar slot (action change) |
| `76003` | **clearing** the action (`player.action = null`) — deselect |
| `76057` | clearing from a hotbar-slot switch — another deselect |

- **Payload is `{}`** — empty object. The event tells you **a change happened**,
  NOT what changed. You must call `api.action.getSelected()` yourself to read
  the new state (exactly like `sync` does).
- Because `building.selectStructure` emits it (53676), a picker that listens to
  `action:changed` fires precisely when the player picks the `icons` row —
  the same instant the current `sync` loop would notice inside ≤100 ms.

---

## 3. Event-driven picker — dropping the timer is possible

Yes — and you don't need to change the shipped mod; this is a documented
alternative implementation. Replace the `setInterval(sync, 100)` with:

```ts
const sync = () => {
  const sel = sandkit.api.action.getSelected();
  if (!sel || sel.type !== sandkit.enums.ActionType.Building) return close();
  const id = itemIdFromType(list.modId, String(sel.id));
  if (!id) return close();
  list.setSelected(id);
  list.setMirrored(isMirroredType(String(sel.id)));
  if (!pickerState) pickerState = { minimized: true };
  repaint?.();
};

// event-driven: no 100 ms timer needed
const unsubscribe = sandkit.api.events.on("action:changed", sync);
sync();                                        // also run once for initial state
...
// on dispose:
unsubscribe();                                // instead of clearInterval(timer)
```

Why this works — and the caveats:

| Concern | Answer |
|---|---|
| Fires when the `icons` row is picked? | ✅ yes — `building.selectStructure` emits `action:changed` (53676). |
| Fires on deselect (hide again)? | ✅ yes — clearing the action emits it (76003, 76057. |
| Does it work at the very start? | The listener only fires **after** registration; run `sync()` once manually (or on `game:ready`) to catch the current state. |
| Payload carries the selected id? | ❌ it's `{}` — you **must call `getSelected()` yourself** (the loop did the same). |
| Is the timer needed for anything else? | No — `sync` does only the two read-only steps above. The timer is just a safety net for any engine path that mutates the action **without** emitting (none found in the bundle). |
| Interval still useful? | Keep a slow fallback (e.g. 1000 ms) if you want resilience against edge cases; 100 ms is unnecessary. |

> The overlay **registration** stays identical (`overlays.register(slot, id, render)`);
> only the driver swaps from a 100 ms poll to a push event. Everything in
> `docs_tech/10-ui-overlays.md` (§4-§5) still holds — visibility is still
> decided by what the `render` fn returns, and `close()`/`minimize()`/`expand()`
> still just set `pickerState` and `repaint()`.