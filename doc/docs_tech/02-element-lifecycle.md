# Element Engine — The Life of an Element

This document walks a single element from **birth to death**, showing at every
phase which **hook** (`hooks.intercept`) or **event** (`events.on`) a mod can
catch, and which `sandkit.api.elements` functions it can use.

## Lifecycle map (at a glance)

```
   CREATE            PER-TICK LOOP                   DURATION / DEATH
    │                     │                                │
    │ createAtCell        │  chunk loop walks cell         │
    ▼                     ▼                                │
 created ──▶ cell:process ─▶ element:update ──▶ [[physics]]  ▸ burn / ignite
   │      (hook, guard)     (hook, guard)       │           ▸ projectiles
   │                                            │           ▸ teleport
   │              ┌─────────────────────────────┤           ▸ grower touch
   │              ▼                             ▼
   │      element:move (hook, unguarded)   element:blocked (hook, guard)
   │              │ success                        │
   │              ▼                                ▼
   │      [position write] ─▶ element:moved      default clamp / 0-velocity
   │                         (event, guard)
   │
   └──── durationLeft hits 0 ──▶ element:duration (hook, guard)
                                   │ (cancel = replace expiry, e.g. → ash)
                                   ▼ default = remove
                            removed (removeAt)
                                   │
                                   ▼
                          element:removedAt (event, MAIN THREAD ONLY)
```

---

## Phase 0 — Creation 👶

**Entry points:** `elements.createAtCell(e, x, y, type, opts)` ·
`elements.replaceAtCell(...)`.

- `createAtCell` only succeeds on an **empty** cell; `replaceAtCell` overwrites
  unconditionally. Options accepted: `{ dataFields: {field1..4}, duration,
  density, isFreeFalling, data, particle:{velocity}, skipCollectorCheck }`.
- Setting `duration` initializes `durationMax` / `durationLeft`; setting
  `dataFields.fieldN` writes `dataFieldN`.
- Default per-type `dataFields` (from the element definition) are applied first,
  then the passed `opts.dataFields` override them.

**Event catch:** `sandkit.api.events.on("element:createdAt", (e, p) => …)`
- payload: `{ x, y }` only (no elementType in the emitter — bundel.js:51254).
- ⚠️ **Fires only on the main thread**, never inside the worker context.
- Classic use: record a "birth tick" via `elements.setDataFieldAtCell(e, x, y,
  3, sandkit.api.time.currentTick(e))` for later age-based behavior (example
  #11).

---

## Phase 1 — Per-tick processing 🔁

Every tick the active chunk loop visits each element. Two hooks fire before the
engine's default physics:

### `cell:process` — fires once per cell
- **Hook** (`hooks.intercept`), **requires an elementType guard**.
- payload: `{ cellId, x, y, dt, runOrder }`.
- Runs **before** the element's normal `element:update`/update logic; the payload
  lacks per-element velocity/duration helpers (it's the cell-level pass).
- **`cancel.cancel()` skips the whole update for that cell** (`continue` in the
  chunk loop, bundel-worker.js:40272). Use it to neutralise a "null field"
  element that suppresses what sits on top of it (example #13).

### `element:update` — fires once per element per tick
- **Hook** (`hooks.intercept`), **requires an elementType guard**.
- payload: `{ cellId, elementIndex, elementType, matterType, matterConfig, x,
  y, dt, elementData }`.
- Runs **before** the engine's default update for that element.
- **`cancel.cancel()` skips the default update** for that element this tick.
- Default update includes: `skipPhysics` checks (≥ `AGGRESSIVE_SKIP` removes it
  from the resolver), duration decrement, then the gravity/move resolver (`ce`/`ue`
  helpers, bundel-worker.js:46333+).
- Classic uses: per-tick velocity clamp for a "featherweight" element (example
  #7), magnetic pull via `addParticleVelocityAtCell` (example #8).

> Setting velocity / `isFreeFalling` inside `element:update` (or
> `element:move`) affects **future ticks**, not the current move — the
> destination for this tick was already computed before your hook ran.

---

## Phase 2 — Movement (gravity/resolver) 🏃

This is the core simulated behavior and the most-hooked phase.

### `element:move` — veto or redirect a single move
- **Hook** (`hooks.intercept`), **NO guard required, dispatched unguarded.**
- payload: `{ cellId, elementIndex, elementType, source:{x,y},
  destination:{x,y} }`.
- Fires whenever an element is about to relocate into an empty/approved cell.
  Because dispatch is unguarded, **filter by `payload.elementType` yourself**
  (example #1/#2).
- **`cancel.cancel()` blocks the move** — position stays, **no `element:moved`
  fires**.
- ⚠️ **Recursion risk:** calling `elements.moveBetweenCells(...)` from inside
  `element:move` re-enters the dispatch and can loop. Prefer the **non
  interceptable** `swapBetweenCells` to redirect a move into an occupied cell
  (example #1).

### After a successful move
- Engine performs the position write (+ color refresh, and a special SoundBox
  piano-note side effect if the source was a SoundBox structure tile,
  bundel.js:59617-59635).
- **Event catch:** `sandkit.api.events.on("element:moved", …)`,
  **requires an elementType guard**.
- payload: `{ source:{x,y}, destination:{x,y}, … }`.
- Fires **one** time for a `move`; **up to two** times for a `swap`
  (one per participant).
- Classic uses: leave a fading trail one cell behind (example #5),
  velocity-scaled "whoosh" sound (example #6).

### `element:blocked` — the move could not complete
- **Hook** (`hooks.intercept`), **requires an elementType guard**.
- payload: `{ cellId, elementIndex, elementType, position:{x,y},
  collidedAt:{x,y}, velocity:{x,y}, collidedWith: "terrain" | "element" |
  "unauthorized", collidedElementType, collidedCellId, direction }`.
- Fires when the intended displacement is obstructed (destination occupied by
  a denser/incompatible element, or an unauthorized/terrain cell).
- ⚠️ **Only fires if an interceptor exists for that element type**
  (`hasElementInterceptors`, bundel.js:4512). Default (no handlers): clamp
  `velocityY` toward `minVelocityY`, wake the chunk if |v| > 60,
  `isFreeFalling = 0` — the same reset `markMovementBlockedByIndex` triggers.
- **`cancel.cancel()` skips that default blocked handling** (e.g. you manually
  spawn a spark / convert to steam instead — examples #3/#4).

### Density & displacement (not interceptable)
- A move into an occupied cell is decided purely by **density**:
  `mover.density > occupant.density`; equal density never displaces. This
  `swap` path has **no hook** — a mod cannot cancel a density-swap.
- `move` (empty-only, interceptable) vs `swap` (two occupied cells, atomic,
  not interceptable) — full comparison in
  [`05-elements-api-reference.md`](./05-elements-api-reference.md).

---

## Phase 3 — Reactions & interactions 🔥

Beyond basic motion, the engine wires reaction hooks:

| Situation | Hook / Event | Cancelable? | Notes |
|---|---|---|---|
| Fire contacting a burnable element | `fire:element:burn` (hook) | ✅ cancel prevents burning | payload `{x,y,elementType}` |
| Fire igniting a flammable element/terrain | `fire:element:ignite` (hook) | ✅ cancel vetoes the ignite | payload `{x,y,elementType}` |
| Projectile impact | `projectile:hit` (hook) | ✅ cancel absorbs the hit (no damage) | payload `{projectile, travelResult}` |
| Element teleported | `teleport:effect` (hook) | ✅ cancel skips default teleport visuals | payload has `destination{x,y}`; don't cancel if you want default FX too |
| Grower contact | `grower:touch` (worker event) | ❌ | payload `{elementType, x, y}`; register via `sandkit.api.workers.events.on` |

---

## Phase 4 — Duration expiry / death 💀

Timed elements carry `durationLeft` / `durationMax`. Each tick the engine
decrements `durationLeft`; when it hits `0`:

### `element:duration` — control how an element ends
- **Hook** (`hooks.intercept`), **requires an elementType guard**.
- payload: `{ elementIndex, elementType, x, y }`.
- Fires right before the default "remove it" path (bundel-worker.js:46395-46400).
- **`cancel.cancel()` prevents the default removal** — typically you call
  `replaceAtCell(e, x, y, otherType)` before cancelling, so it "dies into"
  something else:
  - expire **into ash** instead of vanishing (example #10),
  - cycle through ember color variants and only let the last one expire
    (example #9) — use `setDurationAtCell(..., {updateMax:true})` to re-arm.
- ⚠️ **This is the reliable death hook in the worker.** `element:removedAt`
  does not fire in worker context.

### `element:removedAt` — explicit-removal notification
- **Event** (`events.on`), payload `{ x, y, elementType }`.
- ⚠️ **Fires only on the main thread** (bundel.js:51202 — gated on
  `context !== "Worker"`). Worker-side physics/duration removals never emit it.
- Classic use: death VFX on the main thread (example #12) — but for reliable
  death logic prefer `element:duration`.

---

## Phase 5 — Removal 🧹

- `elements.removeAtCell(e, x, y, opts)` — removes only if something is
  resolved; emits `element:removedAt` (main thread only).
- `replaceAtCell(...)` — overwrites in place (a form of "death" without
  `removedAt`).
- Duration expiry — default goes through `removeAt` on the main thread; in the
  worker it removes directly (so `element:duration` is your worker-side hook).

---

## Which entry point should I catch? (decision table)

| You want to… | Catch this | Type |
|---|---|---|
| Stop/prevent movement | `element:move` | hook |
| Act *when* movement visibly happens | `element:moved` | event |
| Act when a move is blocked (impact) | `element:blocked` | hook |
| Tune physics every tick | `element:update` | hook |
| Nuke one cell's update entirely | `cell:process` | hook |
| Custom death/transform on expiry | `element:duration` | hook |
| React to a spawn | `element:createdAt` | event (main only) |
| React to a removal | `element:removedAt` | event (main only) |
| Reaction during fire spread | `fire:element:burn` / `fire:element:ignite` | hook |
| Reliable death inside the worker | `element:duration` | hook |