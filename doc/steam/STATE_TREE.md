# `sandkit.state` — live tree

Structure of `sandkit.state` as observed **live over a remote CDP connection**
to a running Sandustry game.

| | |
| --- | --- |
| Game version | `0.5.6` (`store.version`, `store.createdVersion`) |
| Build | `sandustry/0.5.6` · Electron 33.2.1 · Chrome 130.0.6723.137 |
| Platform | macOS arm64, `platform: steam` |
| World | `Cobaltveil` (seed `a1p5056f`, id `0p4za6zm7ju`) |
| Simulation | **12 worker threads** (`environment.multithreading.simulation.threads`) |
| Context | `environment.context === 1` (main thread) |

**How this was captured** — see [`RUN_AND_TEST.md`](./RUN_AND_TEST.md) §3–4:

1. the game was launched with `--remote-debugging-port=9333`,
2. `node doc/steam/sandkit-cdp.mjs log` was attached **before** boot,
3. a temporary probe inside `md-admin-clean` walked `sandkit.state` and logged
   it between `STATE-TREE-BEGIN` / `STATE-TREE-END` markers.

The probe is **not** in the repo. Values are a snapshot of one session; counts
and ids will differ in your world.

---

## Top level

```
sandkit.state  {5}
├── environment   host/runtime facts + the multithreading manager
├── sandkit       engine-owned registries (events, hooks, graphics, keyBindings)
├── session       live, volatile UI/frame state (camera, lights, rendering)
├── shared        SharedArrayBuffer views shared with the 12 sim workers
└── store         persistent save data (what a .save file holds)
```

The split that matters:

| Branch     | Lifetime                | Mutated every frame? | Safe to read from a mod? |
| ---------- | ----------------------- | -------------------- | ------------------------ |
| `store`    | persisted in the save   | on change            | yes — read-only          |
| `session`  | this app run            | **yes, every frame** | yes, but volatile        |
| `shared`   | shared memory w/ workers | **yes, every tick**  | read with the API        |
| `sandkit`  | engine registries        | on registration      | yes                       |
| `environment` | fixed for the run   | rarely               | yes                       |

> **Rule of thumb:** to *change* something use `sandkit.api.*`. `state` is for
> *observing*. Writing into `store` gets overwritten on the next tick or save
> load.

---


## 1. `environment` {2}

Host/runtime facts. Stable for the whole app run.

```
environment
├── context: 1                          ← 1 = main thread (workers use another value)
└── multithreading
    └── simulation  {16}
        ├── threads: Array(12)          ← 12 simulation workers
        ├── manager: {}                 ├── resolvers: {}
        ├── utility: {}                 └── utilityChannel: {}
        ├── post()            ├── postAll()            ├── postAllAwait()
        ├── postToEachThreadColumnSequentiallyAwait()
        ├── init()           ├── initManager()         ├── startManagerLoop()
        ├── getWorkerSession()         ├── getWorkerStore()
        ├── setHandlers()              └── loadExternalModEntries()
```

`postAll(...)` is what broadcasts a mod's `hooks.intercept` /
`events.on` registration to every worker — see
[`../doc-tech/01-element-engine-overview.md`](../doc-tech/01-element-engine-overview.md) §6.

---

## 2. `sandkit` {8}

Engine-owned registries. This is *not* `sandkit.api` — it is the mutable
bookkeeping behind it.

```
sandkit
├── events: {55}        ← event-name → handler Array. THE live listener table
├── hooks: {4}          ← intercept / modify tables
├── graphics: {100}     ← image + asset caches
├── jsonConfigs: {13}   ← parsed game JSON definitions
├── keyBindings: {21}   ← current key → action maps
├── mods: {13}          ← per-mod runtime records
├── gameReady: false
└── registeredLauncherTypes: Array(1)
```

### 2.1 `sandkit.events` — the live event table

Each key is an event name; the value is the **Array of currently registered
handlers**. This is the single most useful thing in the whole store when
debugging "my listener never fires".

```
action:changed                     Array(2)
action:triggered                   Array(1)
auralite:convergenceActivated      Array(1)
auralite:convergenceDeactivated    Array(1)
auralite:crystalPlaced             Array(1)
auralite:placeCrystal              Array(1)
auralite:placementOutOfBounds      Array(1)
auralite:productionChanged         Array(1)
aurixiteCrystallizer:queueConvert  Array(1)
building:placed                    Array(35)   ← busiest in a factory-heavy world
building:removed                    Array(14)
building:removing                  Array(1)
copperMold:transform               Array(1)
earlyAccess:complete               Array(1)
element:createdAt                  Array(2)
element:removedAt                  Array(3)
entity:collected                   Array(1)
factory:levelUp                    Array(2)
… 36 more (full list in ../doc-artifacts/doc.api)
```

Quick check from a mod:

```ts
console.log("building:placed listeners:",
    sandkit.state.sandkit.events["building:placed"]?.length);
```

A count of **0** means nothing is subscribed — your `events.on` either never ran
or the name is wrong. A very high count (35 above) means the engine itself plus
several mods are listening.

### 2.2 `store.mods.__sandkitExternalRuntimeV1`

The host's external-mod runtime record, also visible from `store`:

```
store.mods.__sandkitExternalRuntimeV1
├── version: 1
└── order: Array(14)     ← mod ids in load order
```

`store.mods` (25 keys) is **namespaced per mod id** — that is where a mod's own
data lives. Vanilla ids seen in this session:

```
augments, auralite, buffer-controls, entities, excavated-all,
factoryProcessing, implosionGun, locator, md-big-brother,

## 3. `session` {50}

Volatile per-frame state. Everything here changes constantly — never cache it.

```
session
├── action: { customData, point{x,y}, state{1,2,3} }
├── actionLocked: false          ├── paused: false          ├── saving: false
├── camera: {}                   ├── overrideCamera: false  ├── lerpCamera: false
├── zoomLevel: 1                 ├── scale: 1               ├── reconMode: false
├── movementSpeedMultiplier: 1   ├── sprintBoost: {}
├──────────────────────────────────────────────────────────────────────────────
ambient / world signals
├── ambience: { clearingFrames, conveyors, launchers, shakers, steamTurbines }
│      each → { distance, xDistance{left,right} }
├── lights: Array(100)          ├── lightZones: Array(30)
├── effects: Array(0)           ├── explosions: Array(0)    ├── visualParticles: Array(0)
├── resolution: {}              ├── rendering: {24}         ├── colors: {}
─────────────────────────────────────────────────────────────────────────────
input & ui
├── input: {9}                  ├── buttons: {}
├── ui: {8}                     ├── view: {4}              ├── monitor: {}
├── notifications: {}           ├── lexicon: {}             ├── soundBox: {}
├── music: {}                    ├── soundEngine: {8}
─────────────────────────────────────────────────────────────────────────────
build / machinery
├── building: {6}               ├── construction: {3}      ├── triggers: Array(22)
├── cache: {}                   ├── mainSensorCache: {}    ├── prefabWorldItemCache: {}
├── teleportZoneCache: {}       ├── nextTickCallbacks: Array(0)
├── factoryProcessRates: Float64Array(4)
─────────────────────────────────────────────────────────────────────────────
engine plumbing
├── platform: steam             ├── runtime: electron
├── timestep: {}                ├── animations: {}         ├── cinematic: undefined
├── cheat: {}                   ├── debug: {}
└── settings: {23}              ├── windows: {13}          ├── mods: {1}
```

`settings` (23 keys) is the **live** settings object; the persisted copy lives
in `meta/settings.json` and per-mod values under `externalModSettings`
(see [`RUN_AND_TEST.md`](./RUN_AND_TEST.md) §5.5).

---

## 4. `shared` {33}

Typed-array views over memory **shared with the 12 simulation workers**. This is
the hot path: per-cell and per-chunk data that must be visible across threads
without copying.

```
shared
─── scalars / flags (1-element views) ────────────────────────────────────────
actionState: Uint8Array(3)        energy: Uint32Array(1)      gold: Uint32Array(1)
hybridScheduling: Uint8Array(1)   mutationSync: Int32Array(1) reservoir: Uint16Array(1)
schedulingMode: Uint8Array(1)     workerDetailEnabled: Uint8Array(1)
productionPoints: Uint32Array(1)
─── per-cell grids (one entry per cell column) ───────────────────────────────
collectorGoldCount: Uint8Array(32400)   energyBatteryDirty: Uint8Array(32400)
waterPresenceZones: Uint8Array(529)     (529 = 23 × 23 zones)
energyChange: Uint32Array(4)            goldChange: Uint32Array(4)
─── positions & perf ─────────────────────────────────────────────────────────
listenerPos: Float32Array(2)     playerPos: Float32Array(2)
naturalAmbience: Float32Array(8) workerCompletion: Float32Array(24)
workerPerformance: Float32Array(48)      workerDetailPerformance: Float32Array(156)
managerPerformance: Float32Array(23)
─── structures ───────────────────────────────────────────────────────────────
mouse: {}  mapData: {3}  shadowMap: {3}  wallData: {4}  workQueue: {14}
─── mod data ──────────────────────────────────────────────────────────────────
mods: {17}      ← per-mod cross-thread buffers (JsonMapBuffer etc.)
─── the simulation itself ─────────────────────────────────────────────────────
sim: {20}       ← element/terrain parallel arrays — see doc/doc-tech/01
```

> `shared.mods.<modId>` is what `api.shared.buffers.create/ensure/get` hands
> back. It is how a mod shares state with the workers; it is **not** the same as
> `api.storage`, which is save-persisted.

Note `collectorGoldCount` is `Uint8Array(32400)` — 180 × 180 cells. Anything
sized like that is a per-cell array: read and write it through
`sandkit.api.*` rather than touching indices directly.

---

md-buffer-process, md-channel-pads, prefabBuildings, prefabData,
prefabDecor, prefabulator, prismaline, prismite, productionTracker,
signals, staticPortals, swarmConsole, tutorialBuild, usageTracker,
voidgrazer
```

> A mod that follows the `MOD_ID` prefix convention gets its own key here
> automatically. `md-admin-clean` currently stores nothing, so it has no entry.

---


## 5. `store` {31}

The persistent save data — this is what ends up in `saves/<id>.save`.
Structure is stable across sessions (unlike `session`).

```
store
├── meta
│   ├── tick: 1                  ├── time: 0
│   ├── seed: a1p5056f           ├── worldId: 0p4za6zm7ju
│   ├── worldName: Cobaltveil
│   └── nextId: { drone: 1, projectile: 1, worldItem: 1 }
├── version: 0.5.6               ├── createdVersion: 0.5.6
├── scene: { active: 1, start: 0, triggers: Array(0) }
├── player                          ← 17 keys, flat: x/y NOT a position object
│   ├── x, y, velocity: {x,y}      ├── width, height: 30
│   ├── onGround: false            ├── isHovering: false
│   ├── action: null               ├── grapplingHook: false
│   ├── threshold, tech
│   ├── hotbar: { hotbarIndex, activeSlotIndex, bars: Array(5) }
│   ├── inventory: Array(4)        ← { id, itemType, nameKey, descriptionKey,
│   │                                  categoryKey, abilities?, data? }
│   ├── buildings: Array(2)        ← unlocked building type ids
│   ├── cooldowns: { boostParticle, hoverParticle, slowdown }
│   ├── speedCapOverdrive: { x: { active, bonus, … } }
│   ├── weaponsMeta                ├── upgradesUnlocked
│   ├── dungeons                   └── artifacts
├── world
│   ├── fixtures: Array(1)       ← { name, x, y }
│   ├── horizon: Array(720)      ← per-column terrain height
│   ├── groundHorizon: Array(720)
│   ├── deferredChunkReports: Array(0)
│   └── lights: Array(0)
├── structures: Array(0)         ← placed structures (empty in this session)
├── pipes: Array(0)              ├── drones: Array(0)
├── projectiles: Array(0)        ├── worldItems: Array(0)
├── pumpsCache: Array(0)         ├── queue: Array(0)
├── stratacores: Array(0)        ├── productionPoints: 0
├── resources: {4}               ├── discoveries: { elements: Array(14), terrains: Array(4) }
├── upgrades: {15}               ← cryoblaster, digger, gravity, hp, maxDrones, drill…
│      each → { level, availableLevel }
├── progression: {2}             ├── conservatory: { tickets: 0 }
├── creatures: { lumling: {available, found}, shinelet: {available, found} }
├── gloom: { emitterPositions: Array(0) }
├── hints: {6}                   ← one-shot tutorial flags
├── tutorial: {4}                ├── objectives: { active: Array(0) }
├── viability: {3}               ├── achievements: {}
├── integrity: { cheatsUsed, modsUsed }
├── options: { buildMode, buildModeIndices, defaultFilter{elementType, mode} }
├── machineryEngine: { runLaunchers }
└── mods: {25}                   ← per-mod save data (see 2.2)
```

### 5.1 Reading what you need

```ts
const s = sandkit.state.store;

s.meta.tick;                       // current tick
s.meta.worldName;                  // "Cobaltveil"
s.player.x;                        // player coords are FLAT (x / y), not a position obj
s.player.y;
s.player.inventory;                // Array of item objects
s.player.buildings;                // unlocked building ids
s.structures.length;               // placed structures
s.discoveries.elements.length;     // unlocked elements
s.upgrades.digger.level;           // upgrade level
s.mods["my-mod"];                  // your mod's saved data
```

### 5.2 `scene` vs `api.scene`

`store.scene.active` is a number mirroring the `Scene` enum:

| Value | Enum       | Meaning              |
| ----- | ---------- | -------------------- |
| `1`   | `MainMenu` | at the main menu     |
| `2`   | `Intro`    | intro cinematic      |
| `3`   | `Deploy`   | deployment phase     |
| `4`   | `Game`     | in the running world |

This session was at `active: 1` (main menu) — the game had just booted.

---

## 6. Cheat sheet

```ts
// meta
sandkit.state.store.meta.tick
sandkit.state.store.meta.worldName

// player
sandkit.state.store.player.x
sandkit.state.store.player.y
sandkit.state.store.player.inventory.length
sandkit.state.store.player.buildings

// world
sandkit.state.store.structures.length
sandkit.state.store.world.horizon[0]

// events: is anyone listening?
sandkit.state.sandkit.events["element:moved"]?.length
sandkit.state.sandkit.events["building:placed"]?.length

// progress
sandkit.state.store.discoveries.elements.length
sandkit.state.store.progression
sandkit.state.store.upgrades.digger.level

// threads
sandkit.state.environment.multithreading.simulation.threads.length   // 12
sandkit.state.environment.context                                    // 1 = main

// my mod
sandkit.state.store.mods["md-admin-clean"]
```

---

## 7. Re-capturing this tree

The `store` shape is stable, so this file stays useful between game updates.
To re-verify after a patch:

1. add a walker to a mod (pattern in [`RUN_AND_TEST.md`](./RUN_AND_TEST.md) §4.2)
   that recurses `sandkit.state`, guards cycles with a `WeakSet`, truncates
   arrays after 2–3 entries and stops at a depth limit;
2. wrap the output in `STATE-TREE-BEGIN` / `STATE-TREE-END` markers so it can be
   extracted from the console stream;
3. `deno task build`, **fully restart the game**, then
   `CDP_WAIT_MS=120000 node doc/steam/sandkit-cdp.mjs log 120000`;
4. `awk '/STATE-TREE-BEGIN/,/STATE-TREE-END/' capture.log`;
5. delete the probe and rebuild.

Things that legitimately change between sessions: array lengths, ids, seeds,
world name, the number of simulation threads, and any key a game patch adds.
Anything else that moves is worth a closer look.
