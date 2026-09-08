# Element Engine — Modder's Guide (Index)

This folder is the **modder-oriented reference** for the Sandustry-style
particle/element simulation engine. It explains how the engine runs, what a
mod can **intercept** (hooks), what it can **observe** (events), and what it
can **read/write** through the `sandkit.api` elements API.

> Ground truth was verified against the engine bundles
> (`ModSand/bundel/bundel.js`, `bundel-worker.js`, `extra-mod-worker.js`).
> Line references point into `bundel.js` / `bundel-worker.js`.

---

## 📚 Documents (read in this order)

| File | What it covers |
|---|---|
| [`01-element-engine-overview.md`](./01-element-engine-overview.md) | How the sim works, **hooks vs events**, registration APIs, guards, cancellation, worker/main threading, alias map |
| [`02-element-lifecycle.md`](./02-element-lifecycle.md) | The **life of an element** — every phase and which hook/event entry point fires there |
| [`03-hooks-reference.md`](./03-hooks-reference.md) | Every **interceptable hook**: payload fields, cancel behavior, gotchas |
| [`04-events-reference.md`](./04-events-reference.md) | Every **observable event**: payload fields, firing context, gotchas |
| [`05-elements-api-reference.md`](./05-elements-api-reference.md) | The mod-facing `sandkit.api.elements` **function reference** + physics/velocity/density deep dive |
| [`06-example-state-over-density.md`](./06-example-state-over-density.md) | Worked example: override the engine's **density** rule and customise what a particle does when it **sinks / floats** into another element |
| [`07-main-vs-worker.md`](./07-main-vs-worker.md) | **Main thread vs worker** — the two `sandkit.api` surfaces, what's main-only vs worker-only, and how they talk |
| [`08-registering-elements.md`](./08-registering-elements.md) | How to define a new element: the **`api.elements.register(def)` config object**, plus `discoveries`, `reactions.registerContact`, and element↔structure `interactions` |

`worker-element-hooks-examples.js` (same folder) is a runnable file of 20
example handlers that mirror the patterns in these guides.

---

## 🧲 The two entry points in one line

```js
sandkit.api.hooks.intercept("element:update", (e, payload, cancel) => {
    // run BEFORE the engine's default. call cancel.cancel() to suppress it.
}, { guard: { elementType: myType } });

sandkit.api.events.on("element:moved", (e, payload) => {
    // run as a notification AFTER the fact. cannot cancel.
});
```

| | **Hooks** (`hooks.intercept`) | **Events** (`events.on` / `workers.events.on`) |
|---|---|---|
| English name | interceptor | listener / notification |
| Timing | **before** the engine's default handling | **after** (or independent side-effect) |
| Can cancel the default? | ✅ `cancel.cancel()` | ❌ no |
| Can mutate? | ✅ mutate `payload` freely | usually read-only (mutating is possible but off-spec) |
| Threading | registered on worker sim thread(s) | main facade, or worker-scoped via `workers.events.on` |
| Typical use | veto/alter engine behavior (move, snap, ignite, expire) | react to what happened (trail, sound, counters, VFX) |

---

## 🎯 Quick "which hook/event for which job" cheat-sheet

| Modder goal | Use |
|---|---|
| Stop an element from moving / redirect a move into a swap | `element:move` hook, or read payload & call `swapBetweenCells` + `cancel` |
| Do something when movement is blocked (impact, spark) | `element:blocked` hook (requires elementType guard) |
| Per-tick custom velocity / physics tuning | `element:update` hook (requires elementType guard) |
| Once per simulated frame / worker pass (aggregate bookkeeping) | `update:post` event (alias `worker:update:post`) |
| React to a brand-new element | `element:createdAt` event (main thread only) |
| React to an element moving | `element:moved` event (requires elementType guard) |
| Custom death / expire-into-ash | `element:duration` hook (requires elementType guard) |
| React to removal | `element:removedAt` event (main thread only; use `element:duration` in worker) |
| Override one cell's whole update | `cell:process` hook (requires elementType guard) |
| Make an element fireproof / change burn behavior | `fire:element:ignite`, `fire:element:burn` hooks |
| Veto where players place buildings | `building:place` hook |
| Custom shield/projectile response | `projectile:hit` hook |
| Fire a custom event from worker to main | `sandkit.api.workers.events.emitToMain` / `events.emit` |

---

## 🧱 The engine in 10 lines

1. The world is a **grid of cells**, grouped into **chunks**, each cell holding
   one element (or empty / terrain).
2. Every element instance stores **per-cell state** in packed arrays indexed
   by element index: `type`, `density`, `velocityX/Y`, `thresholdY`,
   `minVelocityY`, `durationMax/left`, `hasDuration`, `isFreeFalling`,
   `skipPhysics`, `dataField1–4`, …
3. Each tick, a chunk loop walks active cells and runs each element through
   `cell:process → element:update → gravity/move resolution → duration
   decrement → (optional) death/blocked reactions`.
4. Gravity is **unconditional** each tick: accel is applied, sub-cell
   displacement accumulates in `thresholdY`, and a cell-to-cell move is
   attempted once it crosses a full cell.
5. A move into an occupied cell is decided by **density** (`mover.density >
   occupant.density`) — this swap/displacement path is **not interceptable**.
6. A move into an empty cell goes through the **`element:move` hook**
   (unguarded) → on success fires **`element:moved`**.
7. A move that cannot go through sends the **`element:blocked`** hook for that
   element type → default clamp to `minVelocityY`, `isFreeFalling = 0`.
8. Burn/ignite, teleport, projectile, grower are reaction hooks that augments
   the base motion model.
9. A timed element decrements its `durationLeft`; at `0` it fires
   **`element:duration`** (default = remove).
10. Spawn fires `element:createdAt`; explicit removal fires `element:removedAt`
    — both **only on the main thread**, not inside the worker.