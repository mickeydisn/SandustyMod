# Element Engine — Hooks (Interceptors) Reference

This is the complete reference for everything a mod can **intercept**. A hook
runs **before** the engine's default handling for an event and can **cancel**
it via the shared `cancel` token.

## Registration API

```js
sandkit.api.hooks.intercept(hookName, (e, payload, cancel) => { ... }, opts?)
```

- `(e, payload, cancel)` — `e` is the thread-scoped world handle,
  `payload` is the mutable hook payload, `cancel` is the shared
  `{ cancelled, cancel() }` token.
- `opts.guard` — optional scoping `{ elementType }` or `{ terrainType }`.
  **Some hooks require it** (see table).
- Calling `cancel.cancel()` makes `runInterceptors` return `true`, and the
  engine skips its whole default for that hook.

## Summary table

| Hook | Guard required? | Fires… | Cancel effect | Alias |
|---|---|---|---|---|
| `element:move` | no (dispatched unguarded) | before an element move succeeds | suppress the move (+ `element:moved`) | — |
| `element:blocked` | ✅ elementType | move obstructed during tick | skip default blocked clamp | `element:move:blocked` |
| `element:update` | ✅ elementType | before default per-tick update | skip default update this tick | — |
| `element:duration` | ✅ elementType | `durationLeft` reaches 0 | prevent default removal | `element:duration:expire` |
| `cell:process` | ✅ elementType | per-cell before its update | skip/pause that cell's processing | — |
| `fire:element:burn` | optional | fire contacts a burnable element | prevent burning it | — |
| `fire:element:ignite` | optional | fire ignites a flammable element/terrain | veto the ignite | — |
| `building:place` | optional | before a building is placed | veto the placement | — |
| `projectile:hit` | optional | a projectile resolves an impact | absorb the hit (no damage) | — |
| `teleport:effect` | optional | an element teleports | skip default teleport visuals | — |

---

## Hook-by-hook detail

### `element:move` — movements (the only unguarded element hook)
- **Guard:** none, and **cannot** be made type-scoped at dispatch. Runs for
  **every** element's move once registered. Filter inside the handler with
  `payload.elementType`.
- **Payload:** `{ cellId, elementIndex, elementType, source:{x,y},
  destination:{x,y} }`.
- **Fires only for a move into an empty / free cell.** This is the interceptable
  path (`runInterceptors("element:move", …)` without a guard,
  bundel.js:59598-59605 / bundel-worker.js:40565-40572).
- **Cancel:** blocks the move entirely — position stays, no color refresh, and
  **no `element:moved` event**.
- **Gotchas:**
  - **Recursion:** calling `elements.moveBetweenCells` again from inside the
    handler re-enters dispatch → use `swapBetweenCells` (not interceptable) to
    redirect into an occupied cell (examples #1, #2, "frozen zone").
  - Setting `isFreeFalling`/velocity here only affects **future** ticks, not
    the move currently being vetted.

#### 🏋️ Density displacement is **NOT** this hook
When an element sinks/pushes into a cell **already occupied** by a less-dense
element (the density swap, decided by `mover.density > occupant.density`,
bundel-worker.js:46412-46442), the engine does **not** go through
`element:move`. That path is a **swap** (helper `O`, bundel-worker.js:40633)
and ships with **no `element:move` intercept and no cancel token** — a mod
cannot veto a density swap through this hook. It **does** still emit
`element:moved` (once per participant) as a **notification**, so you can
*observe* density movement, just not *veto* it.
- To **block** density displacement, use the `element:update` hook (cancel it
  so the element's default gravity/swap resolver for that tick is skipped), or
  raise the occupant's density. You cannot gate it at `element:move`.

### `element:blocked` (+ alias `element:move:blocked`)
- **Guard:** ✅ elementType (required).
- **Payload:** `{ cellId, elementIndex, elementType, position:{x,y},
  collidedAt:{x,y}, velocity:{x,y}, collidedWith:
  "terrain"|"element"|"unauthorized", collidedElementType, collidedCellId,
  direction }`.
- **Fires:** when the intended displacement is obstructed (denser/incompatible
  occupant, terrain, or unauthorized cell) — and **only** if a handler for that
  element type is registered (`hasElementInterceptors` gate).
- **Cancel:** skips the default blocked handling (clamp `velocityY` toward
  `minVelocityY`, wake chunk if |v|>60, `isFreeFalling=0`). Use it to spawn a
  spark on impact (example #3) or convert a superheated element to steam
  (example #4).

### `element:update` — per-tick tuning
- **Guard:** ✅ elementType (required).
- **Payload:** `{ cellId, elementIndex, elementType, matterType,
  matterConfig, x, y, dt, elementData }`.
- **Fires:** every tick before the engine's default update for that element.
- **Cancel:** skips **all** of this element's default processing for that
  tick — the duration decrement (`durationLeft -= dt`, and the `element:duration`
  / death check), the flame/variant handling, **and** the gravity/movement
  resolver. Net effect: **cancelling freezes the element in place for that
  tick** — no gravity, no move, no swap, no duration decay (bundel-worker.js:
  46341-46352 — the early `return` skips `ue(...)` at 46356 and `u(...)` at
  46380).
- **Uses:** featherweight velocity clamp (example #7), magnetic pull via
  `addParticleVelocityAtCell` (example #8). To *suppress physics* for an element
  reliably, `cancel.cancel()` here is the per-tick veto (vs
  `setPhysicsAtCell(…, PHYSICS.SKIP)` which permanently removes it from the
  resolver).
- ℹ️ **This is a hook, not an event.** Despite the name it is **not** part of
  the notification API. The only per-update *event* is `update:post`
  (once per worker pass, not cancellable) — see
  [`04-events-reference.md`](./04-events-reference.md#updatepost-alias-workerupdatepost).

### `element:duration` (+ alias `element:duration:expire`)
- **Guard:** ✅ elementType (required).
- **Payload:** `{ elementIndex, elementType, x, y }`.
- **Fires:** right before the default "remove at end of duration" path.
- **Cancel:** prevents default removal — pair with `replaceAtCell` to "die
  into" another element (expire → ash, example #10; ember color cycling,
  example #9 with `setDurationAtCell(...,{updateMax:true})`).

### `cell:process` — cell-level override
- **Guard:** ✅ elementType (required).
- **Payload:** `{ cellId, x, y, dt, runOrder }`.
- **Fires:** per cell inside the chunk processing loop, before the element's
  normal update.
- **Cancel:** `continue` — the engine skips processing that cell this pass.
  Example: a "null field" element suppresses everything on top of it
  (example #13).

---

## Reaction hooks (optional guard)

### `fire:element:burn`
- **Guard:** optional. **Payload:** `{ x, y, elementType }`.
- **Cancel:** prevents the element from being burned.

### `fire:element:ignite`
- **Guard:** optional. **Payload:** `{ x, y, elementType }`.
- **Cancel:** vetoes ignition. Example: a "wet" data-field flag makes an
  element fire-resistant (example #17).

### `building:place`
- **Guard:** optional. **Payload:** `{ structureId, x, y }`.
- **Cancel:** veto the placement. Example: block building next to fire
  (example #16).

### `projectile:hit`
- **Guard:** optional. **Payload:** `{ projectile, travelResult }`
  (travelResult carries the impact coords/cell).
- **Cancel:** absorb the hit (element takes no damage). Example: a shield
  element sets `PHYSICS.SKIP` + cancels (example #18).

### `teleport:effect` (internal `element:teleport`)
- **Guard:** optional. **Payload:** includes `destination:{x,y}`.
- **Cancel:** skip the default teleport visuals. Example: play a chime +
  refresh color, but **don't cancel** so default FX still run (example #19).

---

## Cancellation rules & recursion (from `runInterceptors`, bundel.js:60507-60545)

1. Handlers share one token per dispatch; any `cancel()` skips the whole
   default. All-or-nothing — no partial/continue path.
2. Mod handler exceptions are swallowed (`try {} catch {}`); one mod failing
   never breaks the engine or other mods.
3. Only `element:move` is dispatched unguarded. Guarded hooks use an
   `elementMask`/`terrainMask` bitmap for O(1) scoping.
4. Prefer `swap` over `move` when redirecting from inside a hook: `swap` has
   **no interceptor check anywhere**, so it can never re-trigger your hook.