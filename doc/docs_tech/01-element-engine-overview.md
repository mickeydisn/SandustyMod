# Element Engine — Overview, Hooks vs Events, Guards & Threading

This document is the conceptual foundation. It answers: **how does the element
engine work, and what are the interceptor (`hooks`) vs notification (`events`)
systems a mod can plug into?**

---

## 1. The simulation model

The engine is a **grid-based falling-particles ("falling-sand") cellular
automaton**:

- The world is a fixed-size grid of **cells**, batched into **chunks**.
- Each cell can hold **nothing (empty)**, **terrain** (a tile), or **one
  element** (Sand, Water, Steam, Fire, Lava, … and anything a mod registers).
- Elements are held in **parallel arrays** (`elementData.type[i]`,
  `velocityX[i]`, `density[i]`, `durationLeft[i]`, `dataField1[i]`, …) indexed
  by a per-instance element index. "An element" is really one entry across
  these arrays at a given cell.
- Each tick, a chunk loop walks cells and applies the physics rules
  (gravity, displacement, burning, duration) — see
  [`02-element-lifecycle.md`](./02-element-lifecycle.md) for the exact order.

> A mod never sees these internal arrays directly; it interacts through the
> **`sandkit.api`** objects: `elements` (state reads/writes), `hooks` /
> `events` (behavior hooks), `world`, `time`, `audio`, `random`, `constants`.

---

## 2. The two interaction systems a mod uses

There are **two separate signal paths**. Confusing them is the most common
modding mistake.

### A) Hooks — `sandkit.api.hooks.intercept(name, handler, opts?)`

Run **before** the engine performs its default action for that event. The
handler receives a **cancel token** and can *veto or replace* the engine's
default.

```js
sandkit.api.hooks.intercept("element:update", (e, payload, cancel) => {
    // e         → world/context handle for THIS thread
    // payload   → mutable object specific to the hook
    // cancel    → { cancelled, cancel() } shared token
    if (shouldSuppress) cancel.cancel();     // engine default is skipped
}, { guard: { elementType: myType } });
```

Engine internals: dispatch goes through
`hasAnyInterceptors()` / `hasElementInterceptors()` then `runInterceptors()`
(bundel.js:60507-60545). `runInterceptors` returns **`true`** if any handler
called `cancel.cancel()` (so the call-site skips the default), otherwise
**`false`**.

### B) Events — `sandkit.api.events.on(name, handler)` / `sandkit.api.workers.events.on(name, handler)`

Run as **notifications** — they observe what the engine already did and
**cannot cancel** anything.

```js
sandkit.api.events.on("element:moved", (e, payload) => {
    // observe; no cancel token
});
```

- `sandkit.api.events.on(...)` is the main-thread facade.
- `sandkit.api.workers.events.on(...)` registers a **worker-scoped** listener
  (e.g. `grower:touch`).

### C) Modifiers — `sandkit.api.hooks.modify(name, handler, opts?)`

A lighter layer between the two: `modify` handlers run before the default with
**no cancel token**, but can mutate the payload that the default reads (the
engine's `applyModifiers` / `applyModifiersSafe`). Use it to *tweak* input to
a behavior without vetoing it.

> Hook vs event vs modifier — summary table lives in
> [`summary.md`](./summary.md).

---

## 3. Guards — scoping handlers to a type

Hooks and events can (or must) declare a **guard** so they only run for the
element/terrain type you care about. A guard is **exactly one** of:

```js
{ elementType: sandkit.api.elements.getTypeFromId(e, "sand") }
{ elementType: -1 }                    // -1 = wildcard / any element
{ terrainType: -1 }                    // wildcard terrain
```

The engine's `h()` validator (bundel.js:60428-60445) **throws** if:

- a guard is missing where one is required,
- the guard sets **both** `elementType` and `terrainType`,
- the guard uses a type outside `-1 … 4095`.

### Which hooks *require* an elementType guard?

Confirmed set in the engine (`c`, bundel.js:60441):

| Hook | Guard required |
|---|---|
| `cell:process` | ✅ elementType |
| `element:update` | ✅ elementType |
| `element:blocked` | ✅ elementType |
| `element:duration` | ✅ elementType |

### Which events *require* a type guard?

Confirmed set in the engine (`s`, bundel.js:60435):

| Event | Guard required |
|---|---|
| `element:moved` | ✅ elementType |
| `terrain:update` | ✅ terrainType |

> ⚠️ **`element:move` is an exception.** It does **not** require a guard, and
> its dispatch site runs **unguarded** — once *any* mod registers an
> `element:move` hook, it fires for **every** element's move. You must filter
> by `payload.elementType` inside the handler yourself (see example #1).

---

## 4. The cancel token & all-or-nothing semantics

- Every intercepted handler for a single dispatch shares **one** token object
  `{ cancelled, cancel() }`.
- If **any** handler calls `cancel.cancel()`, the engine's **entire default**
  for that hook is skipped. There is no "partial" path and no
  "modify the destination and continue" path — you either **let the default
  run** or **fully replace it inside your handler**. (bundel.js:60507-60545)

For `element:move`, a cancelled move means: no position update, no color
refresh, and **no `element:moved` event**.

---

## 5. Aliases — names the mod uses vs the engine uses

The runtime normalizes a few names (bundel.js:645-656). You can use either,
but the engine recognizes these equivalences:

**Events:**

| Mod-facing / canonical | Alias (also accepted) |
|---|---|
| `terrain:update` | `terrain:updated` |
| `update:post` | `worker:update:post` |

**Hooks:**

| Mod-facing / canonical | Alias (also accepted) |
|---|---|
| `element:blocked` | `element:move:blocked` |
| `element:duration` | `element:duration:expire` |

The event emitter also accepts *any* custom event name — mods can `emit` and
`on` their own event strings.

---

## 6. Threading model — why `e` matters

The sim can run across **multiple worker threads**:

- When you call `hooks.intercept(...)` / `events.on(...)`, the runtime
  **posts a registration message** (`RegisterWorkerInterceptor`,
  `RegisterWorkerEventHandler`) to **every simulation thread**
  (`environment.multithreading.simulation.postAll`, bundel.js:60499-60504).
- Each thread therefore runs **your handler** with **its own `e` world
  handle** and its own copy of the element arrays. State you read/write via
  `e` only affects that thread's copy.

Consequences for modders:

- **Local reads/writes are fast and correct within a thread**, but do not
  assume cross-thread visibility.
- If you need to coordinate across threads (accumulate a global counter,
  send a UI message), use the worker's cross-thread helpers:
  `sandkit.api.workers.events.emitToMain(name, payload)` /
  `sandkit.api.workers.events.emit(...)`.
- A handler that behaves differently depending on thread must branch on the
  environment context (`e.environment.context === "Worker"`), e.g. this is
  exactly why `element:createdAt` / `element:removedAt` **do not fire in the
  worker** (see [`04-events-reference.md`](./04-events-reference.md)).

---

## 7. Performance notes (from the engine)

- **`element:blocked` only fires if an interceptor exists for that element
  type.** Without one, the engine never even builds the payload and just runs
  the inline default blocked-handling (bundel.js:4508-4536). So an unused
  blocked-handler costs nothing, but *registering one for common types does
  add a call per blocked tick* — guard tight, do minimal work.
- Guarded dispatch uses a precomputed **elementMask / terrainMask** bitmap
  (`workerInterceptorsByGuard[t].elementMask[type] === 1`), so scoped handlers
  are cheap to test.
- Mod handlers are wrapped in `try {} catch {}` — an exception in one mod's
  handler does not break other handlers or the engine.