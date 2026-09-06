# Element Engine — Events (Notifications) Reference

This is the complete reference for everything a mod can **observe** as a
notification. Events run **after** an action (or as an independent side-effect)
and **cannot cancel** the engine. Use them for reactions: effects, audio,
counters, tooltips, cross-thread signals.

## Registration API

```js
// main-thread facade
sandkit.api.events.on(eventName, (e, payload) => { ... });

// worker-scoped listeners (events emitted inside the simulation worker)
sandkit.api.workers.events.on(eventName, (e, payload) => { ... });
```

- Fired from the engine with `emit(..., payload, opts)`; handlers receive the
  payload (and `e` as the context in worker-scoped form).
- Some events **require a type guard** in `opts`: `{ elementType }` for
  `element:moved`, `{ terrainType }` for `terrain:update`.
- Unlike hooks, there is **no cancel token**.

---

## Summary table

| Event | Type guard | Fires when… | Cancellable? | Context |
|---|---|---|---|---|
| `element:moved` | ✅ elementType | an element relocates (after a move / swap) | ❌ | main + worker |
| `element:createdAt` | none | an element is spawned | ❌ | **main only** (not worker) |
| `element:removedAt` | none | an element is explicitly removed | ❌ | **main only** (not worker) |
| `terrain:update` (alias `terrain:updated`) | ✅ terrainType | terrain tile changes shape/type | ❌ | main + worker |
| `terrain:destroyed` | none | a terrain tile is destroyed | ❌ | main + worker |
| `update:post` (alias `worker:update:post`) | none | end of a worker update pass | ❌ | worker |
| `grower:touch` | none | a Grower contacts an element | ❌ | worker (use `workers.events.on`) |
| *custom* | — | whatever your mod `emit`s | ❌ | whatever you choose |

---

## ⚠️ Where is `element:update`? — it's a **hook**, not an event

You won't find `element:update` in the list above **because it is not a
notification event**. It is an **interceptable hook**, dispatched through the
engine's interceptor path (`hasElementInterceptors` + `runInterceptors`,
bundel-worker.js:46341-46352), **not** the `emit(...)` notification path. Its
real home is [`03-hooks-reference.md` → `element:update`](./03-hooks-reference.md#elementupdate--per-tick-tuning).

The confusion is expected: `element:update` *sounds* like an event, and a
separate **event** genuinely is named `update:post` (below). Here is the full
"this name is a **hook**, not an event" map so you look in the right file:

| Name that sounds like an event | Reality | Where it's actually documented |
|---|---|---|
| `element:update` | **hook** — fires before the per-tick update for *that element* (requires `elementType` guard); `cancel.cancel()` skips the default update | [`03-hooks-reference.md` → `element:update`](./03-hooks-reference.md#elementupdate--per-tick-tuning) |
| `element:move` | **hook** — vetos/redirects a move; `cancel.cancel()` suppresses the move *and* the `element:moved` event | [`03-hooks-reference.md` → `element:move`](./03-hooks-reference.md#elementmove--movements-the-only-unguarded-element-hook) |
| `element:blocked` (alias `element:move:blocked`) | **hook** — move is obstructed during the tick (requires `elementType` guard) | [`03-hooks-reference.md` → `element:blocked`](./03-hooks-reference.md#elementblocked-alias-elementmoveblocked) |
| `element:duration` (alias `element:duration:expire`) | **hook** — `durationLeft` hits `0`, before default removal (requires `elementType` guard) | [`03-hooks-reference.md` → `element:duration`](./03-hooks-reference.md#elementduration-alias-elementdurationexpire) |
| `cell:process` | **hook** — per-cell, before its update (requires `elementType` guard); cancel = skip the cell's pass | [`03-hooks-reference.md` → `cell:process`](./03-hooks-reference.md#cellprocess--cell-level-override) |
| `fire:element:burn` / `fire:element:ignite` | **hooks** — veto burn / veto ignition | [`03-hooks-reference.md` → reaction hooks](./03-hooks-reference.md#reaction-hooks-optional-guard) |
| `building:place`, `projectile:hit`, `teleport:effect` | **hooks** — veto/replace the default action | [`03-hooks-reference.md` → reaction hooks](./03-hooks-reference.md#reaction-hooks-optional-guard) |

**Rule of thumb:** if your goal is to **veto, redirect, or replace** an engine
action, it's a **hook** — look in `03-hooks-reference.md`. If your goal is to
**observe** something that already happened (with no cancel token), it's an
**event** — this file.

---

## Event-by-event detail

### `element:moved`
- **Guard:** ✅ `{ elementType }` (required by the engine's validator).
- **Fires:** after an element successfully relocates — **once** per `move`,
  **up to twice** per `swap` (once per participant).
- **Payload:** `{ source:{x,y}, destination:{x,y}, … (element fields) }`.
- **Cancel:** n/a (notification).
- **Uses:** leave a fading trail cell behind (example #5), velocity-scaled
  "whoosh" sound (example #6).
- ⚠️ A cancelled `element:move` hook means this event **does not fire**.

### `element:createdAt`
- **Guard:** none.
- **Fires:** when `createAtCell`/`createAt` spawns an element
  (bundel.js:51254).
- **Payload:** `{ x, y }` (the emitter does not include `elementType`).
- ⚠️ **Main thread only** — skipped when running in the worker context.
- **Uses:** record a "birth tick" for age-based behavior (example #11).

### `element:removedAt`
- **Guard:** none.
- **Fires:** when an element is removed via `removeAtCell`/`removeAt`
  (bundel.js:51202).
- **Payload:** `{ x, y, elementType }`.
- ⚠️ **Main thread only** — guaranteed not to fire for worker-side physics /
  duration removals. For **reliable** death logic use the `element:duration`
  hook instead (examples #9/#10).
- **Uses:** death VFX / cleanup on the main thread (example #12).

### `terrain:update` (alias `terrain:updated`)
- **Guard:** ✅ `{ terrainType }` (required).
- **Fires:** when a terrain tile changes shape/type (e.g. dug out).
- **Uses:** re-wake physics near changed terrain once the ground under a
  resting element disappears (`world.reportActivityToChunk`, example #14).

### `terrain:destroyed`
- **Guard:** none specified.
- **Fires:** when a terrain tile is destroyed (removed).
- **Uses:** scatter rubble/drop contents (example #15).

### `update:post` (alias `worker:update:post`)
- **Guard:** none.
- **Fires:** at the end of a worker update pass — a clean place for
  per-tick-scaled aggregate bookkeeping you don't want per-element.
- ℹ️ **This is the only per-update *notification* event — don't confuse it
  with `element:update`.** `element:update` is a **hook** that fires once per
  *element* before that element's default update and **can cancel** it (see
  [`03-hooks-reference.md`](./03-hooks-reference.md#elementupdate--per-tick-tuning)).
  `update:post` is an **event** that fires once per *worker simulation pass*
  after all elements updated and **cannot cancel** anything. Pick based on
  granularity and intent: per-element control → `element:update` (hook);
  once-per-pass bookkeeping → `update:post` (event).

### `grower:touch`
- **Guard:** none.
- **Fires:** when a Grower structure contacts an element.
- **Payload:** `{ elementType, x, y }`.
- **⚠️ Worker-scoped — register with `sandkit.api.workers.events.on`, not the
  main `events.on`.** Same pattern the bundled "void flowers" content uses
  (bundel.js:125939-125957).
- **Uses:** seed → sprout growth on contact (example #20).

---

## Emitting your own events

Mods can define and fire their own names through the worker API:

```js
sandkit.api.workers.events.on("my:counter", (e, payload) => { /* main */ });

// elsewhere (worker thread):
sandkit.api.workers.events.emitToMain("my:counter", { value });
sandkit.api.workers.events.emit("my:workerLocal", { value }); // worker-local
```

This is the sanctioned way to move data **off the per-thread element arrays**
(which are not safe to treat as cross-thread globals) back to UI or to
accumulate across threads.

---

## Firing-context gotchas (why `element:createdAt` / `element:removedAt` vanish in the worker)

Both emitters are gated on `e.environment.context !== "Worker"` in the engine
(bundel.js:51202, 51254). The simulation runs on worker threads, so elements
created/removed *by physics, duration expiry, or worker-side hooks* never emit
these two. Rule of thumb:

- **Main-thread-driven** spawns/removals (player placing, `createAtCell` called
  on the main façade) → `element:createdAt` / `element:removedAt` **do** fire.
- **Worker-driven** life changes → **do not** rely on them; use the
  `element:duration` hook (and `cell:process` / `element:update` / etc.) to act
  inside the worker, and `emitToMain` to notify the UI.