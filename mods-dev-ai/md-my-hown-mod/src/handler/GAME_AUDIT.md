# GAME_AUDIT — every engine call in `actions/`, checked against the live game

**Date:** 2026-09-29
**Game:** Sandustry 0.5.6 (Steam, macOS arm64), Electron 33.2.1, Chrome 130.0.6723.137
**Scope:** `src/handler/actions/**` only — 57 distinct engine call sites
**Method:** static check against `__pakages/__other/sandkit/src/sandkit/api/*.d.ts`,
then **live existence + arity probe** over a real CDP connection, then functional
write tests in a booted world (`api.game.start()` → `scene = 4`).

Reproduce with [`doc/steam/RUN_AND_TEST.md`](../../doc/steam/RUN_AND_TEST.md).

---

## Verdict

| | |
| --- | --- |
| Engine calls that **do not exist** | **0** — all 57 resolve at runtime |
| Calls with a **wrong signature** | **3 found, 3 fixed** (one named a method that does not exist) |
| Calls **functionally proven** | element write, terrain write, and the full structure→process chain |
| Regression from the `hostApi` fix | none — 653/653 tests pass |

**All 13 action modules are reachable and every namespace they use exists.** The
failures found are *argument-shape* bugs, not missing API — which is exactly the
class that `hostNs()`'s `any` return type makes invisible to `deno check`.

---

## The three bugs — all three FIXED

> **Status: resolved 2026-09-29.** Each fix was re-verified in a live game.
> The "What this audit does not cover" section at the end still applies.

### BUG 1 — `projectiles.getTypeFromId` did not exist, and `spawnAtWorld` had the wrong argument order — **FIXED**

`actions/act/index.ts` — was:

```ts
const type = api?.getTypeFromId?.(o.projectileId) ?? o.projectileId;   // no such member
api?.spawnAtWorld?.(type, at.x, at.y, { x: o.vx ?? 0, y: o.vy ?? 0 });
```

Live probe: `projectiles.getTypeFromId = undefined`. It is absent from
`projectiles.d.ts` **and** from the running game. It exists on `elements`,
`terrains` and `structures` — not `projectiles`.

The real signature (`projectiles.d.ts:51`, arity 4 confirmed live):

```ts
spawnAtWorld(worldX: number, worldY: number, angle: number, blueprint: ProjectileBlueprint): Projectile
```

Now:

```ts
const blueprint = api?.createBlueprintFromId?.(o.projectileId);
if (!blueprint) { console.warn(...); return; }
const angle = vx === 0 && vy === 0 ? 0 : Math.atan2(vy, vx);
api?.spawnAtWorld?.(at.x, at.y, angle, blueprint);
```

Verified live: `createBlueprintFromId` and `spawnAtWorld` both resolve, and
`getTypeFromId` is confirmed still absent — the non-existent member is gone from
the code path entirely.

> **On the guard:** `createBlueprintFromId` **throws** for an unregistered id
> (`Cannot read properties of undefined (reading 'getOptions')`) rather than
> returning `undefined`, so `if (!blueprint)` is mostly unreachable and the real
> protection is the surrounding `try/catch`. It is kept because it costs nothing
> and guards the documented `| undefined` return.

### BUG 2 — `energy.consume` is not a per-cell call — **FIXED**

`actions/connect/index.ts` — was:

```ts
hostNs("energy")?.consume?.(p.x, p.y, amount);
```

Real signature (`energy.d.ts:28`, arity **2** confirmed live):

```ts
consume(amount: number, options?: { allOrNothing?: boolean }): number
```

`consume` draws from the **global pool** and takes no coordinates. The old call
consumed `p.x` units, passed `p.y` in the `options` slot, and dropped `amount`.

Now `consume(amount, { allOrNothing: false })`, and the action's scope was
corrected from `pos` to `[]` (see below).

Verified live: `consume(5, {allOrNothing:false})` returned `0` — the correct
answer for an empty pool, and proof the *amount* is what now reaches the engine.

### BUG 3 — `effects.createParticlesAtWorld` was called with a string as a coordinate — **FIXED**

`actions/feel/index.ts` — was:

```ts
hostNs("effects")?.createParticlesAtWorld?.(o.name, p.x, p.y, o.count ?? 1);
```

Real signature (`shared/api/effects.d.ts:24`, arity **3** confirmed live):

```ts
createParticlesAtWorld(worldX: number, worldY: number, options?: ParticleEffectOptions): void
```

The call passed **`o.name` (a string) as `worldX`**, `p.x` as `worldY`, `p.y` as
the options bag, and dropped `count`.

Now `createParticlesAtWorld(p.x, p.y, { count })`.

**`name` is deliberately not forwarded.** A live matrix test:

```
(20, 20, { count: 3 })                                 → accepted
(20, 20)                                               → accepted
(20, 20, { count: 3, imageName: "spark" })             → THROWS
(20, 20, { imageName: "sand" })                        → THROWS
sprites.getById("sand"|"stone"|"dirt"|"water"|"spark") → all undefined
```

`imageName` is declared `string` in the engine's own `.d.ts` but throws when
given one, so **the declared type is wrong or incomplete**. The `LoadedSprite`
route could not be confirmed either — every sprite id probed returned
`undefined`. Rather than guess twice, only `count` is passed. If `imageName` is
investigated further, `name` can be wired to it then.

### A fourth change the fix required — the scope table

Correcting BUG 2 broke a test, and **the test was right**:

```
ACTION_SCOPE matches what the actions actually read
  energyConsumePerRun: measured [] but ACTION_SCOPE says [pos]
```

`core/scope.ts` records which *payload properties* an action reads. With the
position no longer sent to the engine there is nothing to read, so `pos` became
stale. Rather than keep a vestigial `if (!payload) return` guard to satisfy the
table, the guard was removed and the scope set to `[]` — honest, because a
global-pool draw genuinely is position-independent. **The scope table now agrees
with the code rather than being edited to match a stale measurement.**

---


## Verified-correct calls worth recording

These looked suspicious under static checking and are **fine** — recorded so the
next audit does not re-open them.

| Call | Note |
| --- | --- |
| `terrains.isAtCell` | Declared in the typings **only** under `pipes.d.ts`, but **exists** on `api.terrains` at runtime (arity 2). A typings-only audit would have reported a false positive. |
| `elements.setVelocityAtCell(x, y, {x, y})` | Third argument is a `Vector2` **object**, not two numbers. The mod is correct. |
| `player.inventory.addById(itemId)` | Arity 1 — takes no count. The mod already loops one call per item, and its comment saying so is accurate. |
| `energy.addAtCell(x, y, amount)` | `(x, y, amount, options?)` — correct. |
| `ui.toast(text)` | `(message, options?)` — the optional 2nd arg is simply omitted. |
| `structures.isType` / `isTypeAtCell` | `export import` aliases; real signatures live in `shared/api/*.d.ts`, not the per-namespace files. |
| `writer.removeAtCell` | Both writers report arity 3 (`x, y, options`). The element family calls it with 2 (options omitted) — valid. |

### Arity deltas that are benign

`fn.length` counts parameters before the first default, so a call passing fewer
args than `engine=N` is not a fault when the tail is optional. These all matched
on inspection:

```
elements.addParticleVelocityAtCell   call 3|4  engine 4   (maxSpeed optional)
elements.setDurationAtCell           call 3|4  engine 4   (options optional)
structures.buildAtCell               call 3    engine 4   (options optional)
structures.removeAtCell              call 3    engine 3
structures.update                    call 2    engine 2   (options optional)
structures.updateData                call 3    engine 3
structures.removeAtCells             call 2    engine 2   (options optional)
terrains.isTypeAtCell                call 3    engine 3
```

> A caution about this table: an earlier pass of the probe **guessed** several of
> these call arities instead of reading the call sites, which produced phantom
> mismatches (`isTypeAtCell` "call 2", `update` "call 1", `removeAtCells`
> "call 1"). The real call sites all pass the full argument list. **Arity deltas
> are only evidence once the call site has been read.**

---

## Full call inventory (all 57, live-verified)

Every entry below returned `typeof === "function"` at runtime. Format:
`method   call/engine arity`.

### `element/index.ts` — 3
```
ok  elements.getResolvedTypeAtCell       2/2
ok  grid.isCellEmptyAtCell               2/2
ok  grid.mutate                          1/1
```

### `motion/index.ts` — 7
```
ok  elements.getVelocityAtCell           2/2
ok  elements.setVelocityAtCell           3/3
ok  elements.addParticleVelocityAtCell   3|4/4
ok  elements.setDurationAtCell           3|4/4
ok  elements.teleportBetweenCells        4/4
ok  elements.convertToParticleAtCell     3/3
ok  elements.findFreeCellInStructure     3/3
```

### `terrain/index.ts` — 9
```
ok  terrains.getTypeAtCell               2/2
ok  terrains.getDataAtCell               2/2
ok  terrains.isAtCell                    2/2
ok  terrains.isTypeAtCell                3/3
ok  terrains.isCellIdTerrain             1/1
ok  terrains.damageAtCell                3/3
ok  terrains.setHitPointsAtCell          3/3
ok  terrains.getIdByType                 1/1
ok  terrains.getTypeById                 1/1
```

### `structure/index.ts` — 18
```
ok  structures.getAtCell                 2/2
ok  structures.hasBuiltAtCell            2/2
ok  structures.isTypeAtCell              3/3
ok  structures.isType                    2/2
ok  structures.isBlockedByPlayerAtCell   2/2
ok  structures.isLauncherAtCell          2/2
ok  structures.buildAtCell               3/4
ok  structures.removeAtCell              3/3
ok  structures.removeAtCells             2/2
ok  structures.update                    2/2
ok  structures.updateData                3/3
ok  structures.setSpritesheetIndex       2/2
ok  structures.setSpritesheetIndexAtCell 3/3
ok  structures.setSpritesheetIndexByValue 3/3
ok  structures.setSpritesheetIndexByValueAtCell 4/4
ok  structures.mapValueToSpritesheetIndex 2/2
ok  structures.processing.isEnabledAtCell  2/2
ok  structures.processing.setEnabledAtCell 3/3
```

### `feel/` · `connect/` · `logic/` — 7
```
BUG effects.createParticlesAtWorld  4/3
BUG energy.consume                  3/2
ok  ui.toast                        1/2
ok  energy.addAtCell                3/4
ok  tech.conservatory.appendUnlock  2/2
ok  upgrades.setLevelById           3/3
ok  player.inventory.addById        1/1
```

### `act/index.ts` — 2
```
BUG projectiles.getTypeFromId   MISSING
BUG projectiles.spawnAtWorld    4/4  (right arity, wrong argument order)
```

### `grid.mutate` writer surfaces — 2 namespaces, 6 methods
```
ok  writer.elements  [createAtCell, removeAtCell, replaceAtCell]  arity 4/3/4
ok  writer.terrains  [createAtCell, removeAtCell, replaceAtCell]  arity 4/3/4
```

The writer has **no velocity methods**, which is exactly why `motion/` is a
separate file paying for per-cell deferred writes. That design note in
`element/index.ts` is accurate.

---


## End-to-end: structure + process + place + run — **PASSES (with one caveat)**

The gap this audit could not previously close: whether a process actually
dispatches when the engine calls a placed structure's processor. Now measured.

### What was built

A throwaway probe in `main.ts` that, in a booted world:

1. compiled a real process from the mod's own catalogue —
   `readElement` (SENSE) → `createElement` (ACT) → `structureWriteData`
   (REMEMBER) → `pushStructure`;
2. registered a structure definition (`e2eProbe`, 3×3, `alwaysUnlocked`);
3. attached the compiled function with
   `api.structures.processing.register("e2eProbe#process", { structureType, intervalMs: 100, process })`;
4. placed five copies with `structures.buildAtCell`;
5. read the results back with `structures.getAtCell`.

> The process is **not** attached through the structure definition —
> `SandkitStructureDefinition` has no `process` field. The engine's route is
> `api.structures.processing.register(id, { structureType, intervalMs, process })`.

### Result

```
COMPILE processId=e2e skipped=[] usesContext=true expanded=[e2e] truncated=false
REGISTER structure e2eProbe ok
ATTACH processing.register ok (intervalMs=100)
CAND (200,690) isEnabledAtCell=true elementAtCell=null
CAND (200,710) isEnabledAtCell=true elementAtCell=null
RESULT (200,690) -> {"type":"e2eProbe","x":200,"y":690,"queued":true}
RESULT (200,700) -> {"type":"e2eProbe","x":200,"y":700,"queued":true}
RESULT (200,710) -> {"type":"e2eProbe","x":200,"y":710,"data":{"e2eRuns":"yes"}}
RESULT (200,716) -> {"type":"e2eProbe","x":200,"y":716,"data":{"e2eRuns":"yes"}}
RESULT (360,716) -> {"type":"e2eProbe","x":360,"y":716,"data":{"e2eRuns":"yes"}}
RUNS invocations=3 firstStampsMs=[6064,6065,6065]
```

**Confirmed working, end to end:**

| Stage | Evidence |
| --- | --- |
| Process compiles | `skipped=[]` — every action key resolved, none dropped |
| Process binds a var | `usesContext=true` — the `as: "here"` binding registered |
| Structure registers | `REGISTER … ok` |
| Processor attaches | `ATTACH … ok` |
| Structure places | 3 of 5 committed with the real `type` and coordinates |
| **Processor is invoked** | `invocations=3` — one per committed structure, no error |
| **Action runs and writes** | `data:{"e2eRuns":"yes"}` — REMEMBER executed and `pushStructure` pushed it to the engine, readable back through `getAtCell` |

So the full chain — compile → register → attach → place → dispatch → action →
engine-visible state — **works**. The wiring above the engine calls, which the
existence audit could not vouch for, is now proven.

### The caveat: the simulation was frozen

```
TICK t1=615   TICK t2=615   delta=0
```

`api.time.getTick()` did not advance between samples, and each processor fired
**exactly once** (all three at ~6064 ms) rather than every 100 ms. Consequently
`createElement` produced no sand.

This is a **harness limitation, not a mod defect**:

- `grid.mutate` is **deferred** — its callback and flush are driven by the
  simulation. With the tick frozen the queued mutation never applies, which is
  exactly the behaviour documented in `grid.d.ts` ("reads see the old grid until
  mutations apply") and in `actions/motion/index.ts`.
- The freeze comes from `api.game.start({})` producing a world that does not
  sustain a tick in an unfocused window. In one earlier run the tick *did*
  advance (`delta=361` over 3 s), so it is inconsistent rather than impossible.

**Therefore: the ACT family is still unproven through this path.** It was proven
directly earlier (4 sand cells written via `writer.createAtCell` and read back),
but not *driven by a placed structure's processor*.

### Re-tested against the real `ai-word` save — still unproven, for a new reason

With the remote tooling (below) in place, the same sequence was re-run in the
**actual `ai-word` save**, loaded via `db_load` rather than `api.game.start({})`.
That world is 3840×3840, the player is at cell (1995, 1915), and terrain exists
only around x≈2280–2330 (ground y≈1956) and x≈2600 (y≈2080).

| Check | Result |
| --- | --- |
| `compile` | `skipped:[]`, `usesContext:true` — the process itself is fine |
| `attachProcess` | `ok` |
| `place` × 5, on real terrain | all `committed:false`, record `{"queued":true}` |
| `__sk.counts.runs` | **`0`** — the processor is never invoked |
| `session.paused` | `false` |
| `getTick()` | advancing throughout |
| page focus forced | no change |

Placements are *accepted and queued* but never commit, so the structure never
becomes a real instance and its processor never runs. The identical code in an
`api.game.start()` world from the main menu commits and ticks normally.

So the saving is not paused and the simulation is not frozen — neither is the
cause. The open question is **why a `db_load` world accepts placements but never
settles them**; most likely that route leaves the world in a state that never
runs the placement/flush step. That is game-side, and it is the one thing between
the current state and a fully proven end-to-end chain.

### Two engine behaviours this surfaced

1. **Placement only commits in a valid region.** Two of five candidates came back
   `{"queued":true}` — placed, but not committed — while three at the same x
   committed. `isEnabledAtCell` returned `true` for all five, so **it does not
   predict whether a placement will commit.** Probe the placement result, not the
   enable flag.
2. **Structures high in the sky place but stall.** y=690/700 stayed queued while
   y=710/716 committed — the ground is near the bottom of the 720-cell world.

---


## Driving a running game from the terminal (no restarts)

`api.game.start({})` only creates a world from the **main menu**; once a world is
active it is a silent no-op. That, plus the save cache, made every experiment
cost a full app restart. These tools remove that.

All three live in `doc/steam/` and talk to the app over the CDP port the game is
already launched with.

| Script | What it does |
| --- | --- |
| `cdp-eval.py <port> '<js>'` | Evaluate an expression in the renderer, print the JSON result. |
| `db-load.py <port> <saveId>` | Navigate the renderer to `index.html?db_load=<saveId>`, which loads that save. |
| `cdp-focus.py <port>` | Force the page to be treated as focused (`Page.bringToFront` + focus emulation). |

```bash
# once, at start-up
node sandkit-cdp.mjs log 3600000 > /tmp/boot.log 2>&1 &
./Sandustry.app/Contents/MacOS/Sandustry --remote-debugging-port=9603 &

python3 doc/steam/db-load.py 9603 llljdmco4hn-exitsave
python3 doc/steam/cdp-eval.py 9603 'JSON.stringify(__sk.status())'
```

### Loading a named save

The game has **no Sandkit API for saves** — `api.maps` is for maps, and
`getAvailable()` returns `[]` at the main menu. Saves are loaded by a **URL
query parameter** instead, found in `dist/js/external-mod-runtime.js` and
`bundle.js`:

```js
load: (e, t) => {
    const n = new URL(window.location.href);
    n.search = "";
    n.searchParams.set("db_load", t);   // t = save id, not the world name
    window.location.href = n.toString();
}
```

The same id backs the main-menu **Continue** button and the quicksave path
(`${worldId}-quicksave`).

**`db_load` takes a save id, not a display name.** Ids live in
`~/Library/Application Support/sandustry/saves/`, and the file header carries the
name:

```bash
strings ~/Library/Application\ Support/sandustry/saves/<id>.save | head -1
# {"id":"llljdmco4hn-exitsave", … ,"worldId":"llljdmco4hn","worldName":"ai-word","seed":"ai-word", …}

cat ~/Library/Application\ Support/sandustry/meta/lastPlayedGame.json
# {"id":"llljdmco4hn-exitsave"}   ← what Continue loads
```

So `ai-word` → world id `llljdmco4hn` → save id `llljdmco4hn-exitsave`, which
happens to be the last-played game. Verified: after `db_load`, the store reports
`worldName: "ai-word"`, 3840×3840, `scene: 4`.

### The `__sk` bridge

A CDP `Runtime.evaluate` runs in global scope, where the game API is **not**
reachable: the host injects `sandkit` as a *parameter* of the wrapper it builds
in `external-mod-runtime.js`

```js
new Function("__sandkit", `"use strict";\nconst sandkit = __sandkit;\nreturn (async () => {\n${entrySource}\n})();`)
```

so it lives on neither `window` nor `globalThis`. The bridge in `main.ts` hands
the outside world a closure that already has it, via plain functions:

| Call | Returns |
| --- | --- |
| `__sk.status()` | scene, tick, world name, player cell |
| `__sk.playerCell()` | player position **divided by `cellSize`** |
| `__sk.worldSize()` | `{width, height}` in cells |
| `__sk.at(x, y)` | element + structure at a cell |
| `__sk.column(x, from, count)` | rows holding something — finds terrain |
| `__sk.place(id, x, y)` | places and reports `committed` vs `queued` |
| `__sk.register(id)` / `__sk.compile(steps)` / `__sk.attachProcess(id, typeId)` | the E2E chain |
| `__sk.counts` | processor invocation count, first tick, last error |
| `__sk.dump("session.paused")` | any path in `sandkit.state` |
| `__sk.newWorld()` | `api.game.start({})` (no-op once a world is active) |

`playerCell()` exists because `store.player.x/y` are **pixels** and `cellSize` is
4 — dividing is mandatory, and getting it wrong puts every placement thousands
of cells out of range.

> **The bridge is debug code.** Delete the `REMOTE BRIDGE` block in `main.ts`
> before shipping; it puts a global command surface in the mod.

### Landmine: `eval` in mod code kills the whole mod, silently

An earlier version of the bridge used a direct `eval` to reach `sandkit`. The mod
**stopped loading entirely** — no `SCRIPT START`, no error, nothing in the
console, while every other mod loaded normally. Cause: the entry is compiled
through `new Function` under a CSP that refuses string evaluation, and the
failure is swallowed rather than reported.

Two lessons, both worth keeping:

- **A mod that produces no log at all has probably failed to compile**, not
  failed to run. Silence is the only symptom.
- The fix is lexical, not clever: plain functions capture the scope they are
  defined in. `eval` is never needed to escape to an enclosing scope here.

### What the bridge could not fix

With a save loaded via `db_load`, placements **stay `queued: true` and never
commit**, and the processor is never invoked (`runs: 0`) — while `session.paused`
is `false` and the tick advances. Forcing page focus does not change it. The same
code in a world created by `api.game.start({})` from the main menu *does* commit
and *does* invoke the processor.

So the chain is proven, but **only in an `api.game.start()` world**. See
"GAME_AUDIT.md" § End-to-end for what that leaves open.

## Functional proof (direct engine calls, no structure)

A bare `typeof` check proves a function is reachable, not that calling it works.
Two families were exercised in a booted world, called directly rather than
through a placed structure:


A bare `typeof` check proves a function is reachable, not that calling it works.
Two families were exercised in a booted world, called directly rather than
through a placed structure:

**Element write, via the writer path** — a floor of `Seedling` (type 17, proven
static) with four cells of sand written through `grid.mutate` +
`writer.elements.createAtCell`:

```
pocket floor=[0:17 1:null 2:null 3:17]    ← direct createAtCell
pocket inner=[0:1 1:1 2:1 3:1]            ← 4 cells via the writer
```

All four inner cells persisted. This is the exact call `createElement` makes.

**Terrain write** — `terrains.createAtCell` then read back:

```
terrain after: cell(93,4)=2
terrain data={"cellType":2,"hitPoints":4,"hp":4}
```

---

## Known runtime behaviours that affect testing

These are properties of the engine, not defects, and each one can masquerade as a
broken action:

1. **`grid.mutate` is deferred.** The callback does not run synchronously
   (`callbackInvokedSync = 0`). Reads in the same tick see the **old** grid. A test
   that writes and immediately reads sees nothing and concludes the action is
   broken.
2. **Elements need a running world.** At `MainMenu` (`scene = 1`) there is no
   simulation and every element write is discarded. Terrain writes still land.
   Boot a world with `api.game.start()` before testing element actions.
3. **Falling elements invalidate naive tests.** Sand written into open air has left
   the cell by the time a deferred read happens. Use a static material, or a floor
   to contain it, or the test proves nothing.
4. **The host caches mod sources at app start.** A page reload re-runs the *old*
   bundle. Restart the app after every build or you are debugging stale code.
5. **`api.game.start({})` does not reliably sustain a tick.** A world can come up
   (`scene` → 4, `getDimensions()` → 720×720, `getTick()` non-zero) and still
   freeze. Check `getTick()` twice before trusting any deferred-write test.

---

## What this audit does **not** cover

Stated plainly, so the result is not over-read:

- **`core/`** — 7 other files touch the engine (`scope.ts`, `action-class.ts`,
  `apply.ts`, `cell-region.ts`, `scope-context.ts`, `handler-registry.ts`,
  `index.ts`); only `core/types.ts` was fixed and audited.
- **End-to-end dispatch is now covered** (see above) — but only in a world booted by
  `api.game.start({})`. In the real `ai-word` save, loaded through the game's own
  `?db_load=` route, placements stay `queued: true` and the processor is never
  invoked, so **the ACT family and the whole chain remain unproven for a real
  save**. Open: why a `db_load` world never commits queued placements.
- **Return-value semantics** — reads were checked by observing values, not by
  asserting the declared return type.
- **Worker thread** — all of this ran on Main. `motion/` warns that adding a
  `workerEntry` would break it; that path is untested.
- **The bugs above were signature mismatches, now corrected and re-verified.**
  `imageName`'s real value type remains **unresolved** — the declared `string`
  throws and the `LoadedSprite` route could not be confirmed — so `name` is
  currently not forwarded by the `particles` action.

---

## Related

- [`doc/steam/RUN_AND_TEST.md`](../../doc/steam/RUN_AND_TEST.md) — how to launch,
  attach and probe
- [`doc/steam/STATE_TREE.md`](../../doc/steam/STATE_TREE.md) — `sandkit.state`
- [`doc/steam/verify-api.mjs`](../../doc/steam/verify-api.mjs) — static existence
  checker used for the first pass
