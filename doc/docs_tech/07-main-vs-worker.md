# Sandkit API — Main Thread vs Worker (what differs & why)

A mod ships **two entry files** that both receive `sandkit`/`sandkit.api`:

- **`main`** — runs once on the **main thread** at load. This is where you
  *register* things (elements, reactions, i18n, tech, discoveries) and build UI.
- **`worker`** — runs on the **(simulation) worker thread(s)** and is called
  again every tick. This is where you *simulate* (hooks, events, per-cell state).

They are **two different API surfaces under the same `sandkit.api` name**. The
single biggest source of modding bugs is using a main-thread registration API in
the worker (or expecting a worker hook in main).

---

## The main difference in one line

> **`main` = declare the rules once, before the world simulates.**
> **`worker` = react to / drive the simulation, every tick.**
> The worker is multiply-instantiated (one per simulation thread) and each
> instance owns a **thread-scoped** copy of the world (`e`), so anything you do
> in a worker only ever affects that thread's slice.

Everything else below is a consequence of that split.

---

## Where the two contexts run

```
                 ┌────────────────────────────────────────────┐
   main.js ─────▶│  MAIN THREAD (1×)   sandkit.api            │
                 │  register / configure / UI / tech / i18n   │
                 └────────────────────────────────────────────┘
                                  │  (shared buffers, worker msg loop)
        ┌─────────────────────────┼───────────────────────────┐
        ▼                         ▼                           ▼
   ┌──────────┐             ┌──────────┐                ┌──────────┐
   │ worker T0│             │ worker T1│   …            │ worker Tn│   each:
   │  sim copy│             │  sim copy│                │  sim copy│
   │ sandkit. │             │ sandkit. │                │ sandkit. │
   │  api     │             │  api     │                │  api     │
   └──────────┘             └──────────┘                └──────────┘
```

`main` sees the **client/UI world**; every `worker` thread sees its **own slice
of the element arrays** (`elementData.type[i]` etc.). There is no shared mutable
world object across threads — cross-thread communication is explicit
(shared buffers + worker message events).

---

## Typical API split

| Concern | `main` | `worker` |
|---|---|---|
| Register element definitions | ✅ `api.elements.register` | ❌ (elements are registered on main; worker resolves them) |
| Register contact reactions | ✅ `api.reactions.registerContact` | ❌ |
| Register i18n / translations | ✅ `api.i18n.register` | ❌ (worker may *read* via `i18n.t`) |
| Add to discoveries/tech/panel | ✅ `api.discoveries`, `api.tech`, `api.ui` | ❌ |
| Shared config buffers (panel → sim) | ✅ `create`/write | ✅ `require`/read (same buffer object) |
| `element:update` / `element:move` / `cell:process` hooks | ❌ (not dispatched on main) | ✅ `api.hooks.intercept` |
| `element:moved` etc. events | (main-only ones: `createdAt`/`removedAt`) | ✅ per-tick events |
| Read/write a cell this tick | ❌ unreliable (no per-tick cell access on main — use shared buffers) | ✅ `api.elements.getTypeAtCell`, `setDataFieldAtCell`, … |
| Move / swap / create / replace cells | only via idle/deferred helpers | ✅ direct (`swapCells`, `createAtCell`, …) |
---

## What is MAIN-ONLY

These operate on the session/UI and are not meaningful (or not dispatched) in
the worker:

| API | Purpose | Source |
|---|---|---|
| `api.elements.register(def)` | define a new element type (returns `{ elementType }`) | bundel.js:51070 |
| `api.elements.getRegisteredTypes()` | list all registered element type numbers (see `08`) | bundel.js:51051 |
| `api.reactions.registerContact({…})` | contact reaction A+B → C+D | bundel.js:52439 |
| `api.i18n.register(lang, map)` | add translation strings | bundel.js:54192 |
| `api.i18n.*` (getLocale, setLocale, …) | inspect/switch language | bundel.js:54189-54241 |
| `api.discoveries.addElement(t)` / `addTerrain(t)` | unlock "?" catalogue entries | bundel.js:54248 |
| `api.tech.registerNode(id, def, {parentId})` | add a tech-tree node | bundel.js:53529 |
| `api.ui.toast(msg, opts)` | show a toast | bundel.js:53199 |
| `api.config` / `api.settings` | read/write config & settings | bundel.js:54242 |
| `api.extend(key, value)` | expose *your* main-thread API to workers | bundel.js:54265 |

> Note: **`api.entities` does not exist on the public facade.** The engine's
> `FH.entities` (registerType / registerSpawner) is internal, used only by the
> bundled ambient-entity content (see `08`). Mods cannot currently register
> creatures through `sandkit.api`.

## What is WORKER-ONLY (or worker-emitted)

These fire / are only reliable inside the simulation thread:

| API / event | Purpose |
|---|---|
| `api.hooks.intercept("element:update"\|"element:move"\|"element:blocked"\|…)` | per-tick behavior hooks |
| `api.events` worker-side (e.g. `grower:touch`) | worker-scoped notifications |
| `api.workers.events.emitToMain / emitEvent` | send a message to main |
| `api.worker.getIndex / getCount` | which sim thread am I |
| `api.element.*` cell read/write | direct per-tick access to the sim slice |
| `api.structures`, `api.player`, `api.maps`, `api.patterns`, `api.effects` | sim-scoped subsystems |

Note that `element:createdAt` / `element:removedAt` are **emitted on the main
thread** (they come from the engine's main-thread facade), while the per-tick
cell hooks are worker-side. See `04-events-reference.md`.

---

## How the two sides talk

- **In → out:** a handler registered in the worker (`hooks.intercept` /
  `events.on`) is posted to **every** sim thread at registration
  (bundel.js:60500), and each thread runs its own copy with its own `e`.
- **Shared buffers** (`api.shared.buffers.create/require`) are the **only**
  low-latency shared memory. main writes config; worker reads it each tick.
- **Events**: worker → main via `api.workers.events.emitToMain(name, payload)`;
  main → worker via the same worker message loop.

**Practical rule:** keep mutable cross-thread state in a shared buffer, not in
per-thread element arrays or module globals. A global counter you increment in a
worker hook updates *that thread's* copy only.