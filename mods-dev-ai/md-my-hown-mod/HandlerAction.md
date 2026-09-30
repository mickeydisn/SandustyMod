# HandlerAction — the atomic action catalogue

**A `HandlerAction` is one indivisible verb.** A structure's `process` is just an ordered list of
them. The author picks verbs from a list, sets each one's options, and gets working behaviour — no
code.

This document is organised as **the list**, grouped by the _role_ each verb plays in a process, not
by engine namespace. §2–§7 are that list. §8 is the part that matters most: how verbs chain.

**Everything here is measured.** Registry counts come from `tools/count-handlers.ts`, which
_imports_ the real registries. Engine counts come from the same tool with `--engine`, which walks
the type files and **excludes everything marked `@deprecated`**. Run them; do not trust the numbers
by memory.

### The two numbers that frame everything

|                                                              | count                                          |
| ------------------------------------------------------------ | ---------------------------------------------- |
| engine api functions, **current only** (deprecated excluded) | **330** across 58 namespaces                   |
| engine api functions marked `@deprecated`                    | **61**                                         |
| our atomic actions                                           | **39** — of which **23 are loggers or no-ops** |

**Nothing in this document uses a deprecated function.** Where a deprecated one is the obvious
choice, the current replacement is named instead. We had one real violation
(`player.buildings.unlockByType`) — now `unlockById`; see §9.

---

## 1. How a process works

A process is compiled in `src/handler/core/process.ts` from two independent axes:

| axis          | question                          | values                                                                             |
| ------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| **call site** | _when_ does the engine call this? | `signal`, `trigger`, `processing`, `itemAction`, `upgrade`, `behavior`, `modifier` |
| **action**    | _what_ does it do?                | any key in the catalogue                                                           |

The signature is `(payload, ctx, options)`. The engine never supplies `options`: the **compiler**
binds it from config. That is the trick that makes a config-driven mod possible — the engine's
2-argument call and the author's 3-part intent are joined once, at compile time.

### Blocks: IF / THEN / ELSE

A list entry may be a decision instead of a step, with two more lists inside it:

```json
"actions": [
  { "key": "isElementAtCell", "as": "wet", "options": { "element": "water" } },
  { "key": "if", "options": { "var": "wet" },
    "then": [ { "key": "removeElement" } ],
    "else": [ { "key": "toast", "options": { "text": "dry" } } ] }
]
```

The condition is the **truthiness of a named variable** — not an expression. A block _branches_; it
never _computes_. The truth value is something an earlier step already bound, so there is still no
way to write a test-and-return in a config; you can only branch on one you were handed.

Three rules that are enforced, not merely documented:

- **Nesting is capped** at `MAX_BLOCK_DEPTH` (8). Deeper is _reported_, not silently truncated.
- **A block with no `var`** is refused rather than guessing a branch.
- **A variable that was never bound takes `else`.** An unbound name is a missing binding, not a
  false claim, and the compiler cannot tell those apart — the reference resolver reports the missing
  name separately.

`then`/`else` on a step that is not a block is **reported and dropped**: following it would need a
step that is both called and branched on, and ignoring it would leave steps in the config that never
run.

**What an action _depends on_** is measured too (`measureActionDeps` runs each one against recording
`Proxy` objects; a test holds the map honest):

| class             | needs                              | n  |
| ----------------- | ---------------------------------- | -- |
| `pure`            | nothing — a constant or a log line | 10 |
| `self-sufficient` | only its payload and options       | 14 |
| `api`             | one `api.*` namespace              | 57 |
| `context-bound`   | the engine's processing `ctx`      | 3  |

The rule behind the split is "an action calls one `api.*` section", and **34 of 39 break it**. The
split is sound; the catalogue is a skeleton. §2–§7 fill it in.

---

## 2. SENSE — look at the world

_The verb reads. Nothing changes. Always safe, always first in a process._

| action              | reads                     | current engine call           |
| ------------------- | ------------------------- | ----------------------------- |
| `structureInspect`  | the clicked structure     | `structures.getAtCell`        |
| `structureReadData` | `structure.data[key]`     | payload only                  |
| `triggerScan`       | nearby cells              | `grid.forEachCellInRectangle` |
| `triggerTick`       | the trigger's own payload | payload only                  |

### Available, not yet built

| verb                  | current engine call                              | why it matters                                   |
| --------------------- | ------------------------------------------------ | ------------------------------------------------ |
| read a cell           | `grid.getCellIdAtCell`, `grid.isCellEmptyAtCell` | the base read                                    |
| read a terrain        | `terrains.getTypeAtCell`, `terrains.isAtCell`    | 22-fn namespace, untouched                       |
| read a definition     | `elements.getDefinitionByType`                   | mass / speed / matterType                        |
| **keep a cell awake** | `grid.reportActivityAtCell`                      | **without it your logic runs on sleeping cells** |
| grid size             | `grid.getDimensions`                             | bounds checking                                  |
| find structures       | `structures.forEachOfType`, `getTypeById`        | the 27× most-used call in the scrapes            |

`grid.reportActivityAtCell` is the sleeper of this section. One line, and a structure that touches a
cell every tick keeps the simulation awake there.

---

## 3. DECIDE — branch on what you sensed

_The verb computes a truth value. Still no side effects._

Right now this is the weakest section, and it is why the others cannot chain: a process is a
straight line of verbs with **no way to ask a question**.

| action                        | decides                                   | have it? |
| ----------------------------- | ----------------------------------------- | -------- |
| `noop`                        | —                                         | ✓        |
| `energyConductor`             | is this cell conductive?                  | ✓        |
| `upgradeScale`                | map a value through thresholds            | ✓        |
| **is cell empty?**            | `context.isCellEmptyAtCell`               | ✗        |
| **is cell a given type?**     | `context.getResolvedTypeAtCell` + compare | ✗        |
| **is there power?**           | `energy.getNetworkFreeCapacityAtCell`     | ✗        |
| **is researched / unlocked?** | `tech.isResearchedById`                   | ✗        |
| **is on cooldown?**           | `cooldown.isReady`                        | ✗        |
| **is a signal high?**         | signals payload                           | ✗        |

**This is the section to build first**, and it is not in my earlier roadmap — I had it wrong.
Deciders are what make a process a _program_ instead of a script. A conditional verb that skips the
verbs after it turns a fixed recipe into a machine that reacts. Everything in §4–§6 becomes optional
depending on a §3 answer.

The engine already ships the primitives: `cooldown` (3 fn), `energy` queries,
`tech.isResearchedById`, and `context.isCellEmptyAtCell`.

---

## 4. ACT — change a cell

_The verb writes the world. This is the tier that matters, and ours is broken._

### The engine's three write models

| tier      | mechanism                                                                                                                                                                                      | notes                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| immediate | `elements.removeAtCell(x, y)`                                                                                                                                                                  | fine from a UI click, wrong mid-simulation                                                                       |
| deferred  | `elements.createAtCell` / `removeAtCell` / `replaceAtCell` / `teleportBetweenCells` / `setVelocityAtCell` / `setPhysicsAtCell` / `setHpAtCell` / `setDurationAtCell`, `fire.burnElementAtCell` | **these are the current names.** The 18 `*WhenIdle` twins exist but every one is `@deprecated` — do not use them |
| batched   | `api.grid.mutate(writer => …)`                                                                                                                                                                 | reads see the **old** grid; writes apply together                                                                |

`grid.mutate`'s writer is `writer.elements.*` and `writer.terrains.*`, each with exactly
`createAtCell` / `replaceAtCell` / `removeAtCell` — 3 verbs × 2 cell kinds, 6 methods total.

### What we have, and why it does not work

`PROCESS_HANDLERS` is 6 actions. **Two of them are broken** — `processorLift` and `processorConvert`
— because `context.commit` is typed `(mutations: unknown)`, so nothing forced us to check the real
shape. All three workshop mods that use it agree, and we disagree on every point:

|               | ours            | correct                                           |
| ------------- | --------------- | ------------------------------------------------- |
| container     | `commit({...})` | `commit([{...}])` — an **array**                  |
| discriminator | `type: "set"`   | `kind: "create"` — `"set"` is not a mutation kind |
| return        | ignored         | **a boolean — did it land?**                      |

```js
// real: 3791498201/main.js:903, 3792673946/main.js:352
processor.commit([{ kind: "create", cellX, cellY, elementType }]); // → boolean
processor.commit([{ kind: "remove", cellX, cellY, expectedElementType }]); // → boolean
```

`kind` values across all 19 mods: `create`, `remove`, `structure`. `expectedElementType` is a
**compare-and-remove** — the engine's own atomicity, and the only safe "remove it if it is still
this type". The other four actions (`processorLog`, `processorNoop`, `processorCount`) never touch
`commit` and are fine.

A trash can, pump or converter built in the panel today is a **silent no-op**.

### Available, not yet built

| verb                    | current engine call                                             |
| ----------------------- | --------------------------------------------------------------- |
| clear a cell            | `elements.removeAtCell`                                         |
| place an element        | `elements.createAtCell`                                         |
| replace                 | `elements.replaceAtCell`                                        |
| move material           | `elements.teleportBetweenCells`                                 |
| push / set physics / hp | `elements.setVelocityAtCell`, `setPhysicsAtCell`, `setHpAtCell` |
| ignite                  | `fire.burnElementAtCell`                                        |
| terrain writes          | `terrains.createAtCell` / `replaceAtCell` / `removeAtCell`      |
| a safe batch            | `grid.mutate`                                                   |
| dig                     | `grid.excavateAtCell` (8 option flags)                          |
| dig a shape             | `patterns.createCircle` + `patterns.excavateAtCell`             |

### Two families, two write paths, and why they are not one

The element and motion families cover overlapping ground and are **deliberately split**, because
only one of them can be batched.

`api.grid.mutate((writer) => …)` is Main-only and runs "a coherent write batch" for "state-dependent
grid writes" — reads and writes inside the callback are the same atomic step. Its writer is typed,
and takes a real options bag: `createAtCell(x, y, type, options?: ElementCreateOptions)`.

The writer has **no velocity methods**, so a velocity cannot be expressed inside a coherent batch.
That single fact is the boundary between the two families.

|                            | element family                               | motion family                |
| -------------------------- | -------------------------------------------- | ---------------------------- |
| write path                 | `api.grid.mutate`                            | `api.elements.*` (per cell)  |
| atomic over a region       | **yes**                                      | **no** — N independent calls |
| reads coherent with writes | **yes**                                      | **no**                       |
| create options             | `ElementCreateOptions`                       | none                         |
| measured class             | `api` (4 writes) / `context-bound` (3 reads) | `api`                        |
| measured scope             | `["pos", "cell"]`                            | `["pos"]`                    |
| actions                    | 7                                            | 7                            |

The classification is **measured**, not declared: `measureActionDeps` runs each action and records
what it touches. It is what placed the motion family in `api` rather than `context-bound`, and what
moved the four element _writes_ into `api` when they migrated away from `ctx.commit` — leaving the
three element _reads_, which still use the context and never touched a namespace, as the only
remaining `context-bound` element actions.

### Four families, three write paths

|                            | element                         | motion           | structure             | **terrain**             |
| -------------------------- | ------------------------------- | ---------------- | --------------------- | ----------------------- |
| write path                 | `api.grid.mutate`               | `api.elements.*` | `api.structures.*`    | **split — see below**   |
| atomic over a region       | **yes**                         | **no**           | **no**                | **3 of 5 writes**       |
| reads coherent with writes | **yes**                         | **no**           | **no**                | **inside a batch only** |
| create options             | `ElementCreateOptions`          | none             | none                  | `skipShadow` only       |
| measured class             | `api` (4) / `context-bound` (3) | `api`            | `api` (18)            | **`api` (11)**          |
| measured scope             | `["pos", "cell"]`               | `["pos"]`        | `["pos"]`, three `[]` | `["pos"]` (11)          |
| namespace                  | `grid`                          | `elements`       | `structures`          | **`grid` + `terrains`** |
| reads the context?         | 3 of 7                          | no               | no                    | **no**                  |
| actions                    | 7                               | 7                | 18                    | **11**                  |

Terrain is the **only family with a split verdict**, and the split is the point rather than a
defect. `GridMutationWriter` has `elements` _and_ `terrains` (`grid.d.ts:146-152`), and the terrain
half has exactly three methods — `createAtCell`, `replaceAtCell`, `removeAtCell`
(`grid.d.ts:193-221`). So the three **shape-changing** writes are one coherent batch, with the read
that decided them inside the same callback.

The other two cannot. `damageAtCell` and `setHitPointsAtCell` change state, not shape, and there is
no writer method for either — so they are one call per cell and a sweep can half-apply. "Terrain
writes are atomic" would be a lie for two of the five, and a program that assumed it would
half-apply a damage sweep and never find out. Every action's doc string says which path it uses:
**"One atomic batch"** or **"Per-cell"**.

Terrain is also the only family reaching **two namespaces**, which is what `ACTION_APIS` records and
what the API-probe test's fake has to carry. A family recorded entirely as `terrains` would have let
the three batched writes reach `grid` unrecorded and the namespace set would have quietly lost
`grid`.

### `meltAtCell` is documented and does not exist

`api.terrains.md` lists `meltAtCell(cx, cy)` in its availability table. It is in no `.d.ts`, in
neither the `sandkit` facade nor the `shared` layer, and a grep over the whole engine package finds
zero occurrences.

So it is **not** an action, and that is a deliberate refusal. An action for it would compile,
register, appear in the panel, and then call `undefined` — the failure the motion-family comment
already names as "the worst kind of bug: it compiles, it commits, it returns `true`, and nothing
happens." The documentation is wrong; the code is not.

### Terrain has `getIdByType`; structures do not

`getTypeAtCell` returns a number. Terrains have `getIdByType` (`shared/api/terrains.d.ts:68`), so
`terrainType` returns a real id an author can type. Structures have no such function, which is why
`structureType` returns a raw handle and `isStructureType` needs a numeric retry.

The one asymmetry worth naming: a **bind is a string**, so a terrain handle that round-trips through
`as` arrives back as `"42"` while the engine still holds `42`. Both families retry a **digit-only**
reference as a number, narrow on purpose — `"planterBox2"` is more likely an id than a handle, and
coercing it would turn a real id into a false match.

### What is deliberately not an action

- **Registration** — `register`, `updateDefinition`. Mod-init and Main-only.
- **Type-level** — `getDefinitionByType`, `getTypeById`, `getTypeFromId`.
- **`isCellIdTerrain(cellId)`** — takes a _packed cell id_, not coordinates, so it is outside the
  brief's rule and the panel has no way to produce one. It is the one function here that would
  qualify by subject and not by signature.
- **The `*WhenIdle` aliases** — `createAtCellWhenIdle`, `replaceAtCellWhenIdle`,
  `removeAtCellWhenIdle`, `setHpAtCellWhenIdle`. Deprecated aliases of the deferred main path; each
  has a current form in the family.
- **Deprecated `setHpAtCell`** and the `hp` field on `TerrainDataAtCell` — read only as a fallback,
  never preferred over `hitPoints`.

### A timed spawn is atomic; a set-then-time is not

|                            | element                                      | motion                      | **structure**                      |
| -------------------------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| write path                 | `api.grid.mutate`                            | `api.elements.*` (per cell) | `api.structures.*` (per cell)      |
| atomic over a region       | **yes**                                      | **no**                      | **no** — except `removeStructures` |
| reads coherent with writes | **yes**                                      | **no**                      | **no**                             |
| create options             | `ElementCreateOptions`                       | none                        | none                               |
| measured class             | `api` (4 writes) / `context-bound` (3 reads) | `api`                       | **`api`, all 18**                  |
| measured scope             | `["pos", "cell"]`                            | `["pos"]`                   | `["pos"]`, three `[]`              |
| reads the context?         | 3 of 7                                       | no                          | **no**                             |
| actions                    | 7                                            | 7                           | **18**                             |

The structure family is the third cell family, and the only one whose dependency is forced rather
than chosen. `StructureProcessingContext` has **no** structure members — its entire surface is
`getResolvedTypeAtCell`, `isCellEmptyAtCell` and `commit` — so there was no version of any of these
actions that could have read the context. All eighteen measure `api`, and the probe had nothing to
catch.

It also cannot be batched. `GridMutationWriter` has `elements` and `terrains` and **no**
`structures`, so `buildAtCell`, `removeAtCell`, `setEnabledAtCell` and `updateData` are per-instance
calls with no writer behind them. The single exception is `removeAtCells(positions[])` — one call
for a list, and the reason `removeStructures` is a separate action from `removeStructure` rather
than one action with a mode flag.

**Region addressing is not scope.** Sixteen structure actions take `dx`/`dy`/`size` and are still
`["pos"]`, because `cell` means "needs the grid" and these never read one. The scope probe caught
that when I recorded them as `["pos", "cell"]` by copying the element family, and it was right.

### Content parameters are pickers, not text boxes

Ten parameters across the four cell families name a registered content object — `element` (four),
`structure` (three), `terrain` (three). All ten were `text` fields, and all ten now render the
**shared content selector**: a swatch, a search box, an owner filter that defaults to this mod, and
a toggle that reveals hidden objects with a count of what it revealed.

A text box was wrong in three ways at once: `dirtt` saves and validates fine and then fails in a
processor tick far from the field; the author cannot see the game's fifty elements or another mod's;
and an element the engine marked `hidden` was not merely de-emphasised but **invisible**, which is
the opposite of what `hidden` should mean.

The wiring took three pieces, and each can fail alone:

|               | where                  | what                                     |
| ------------- | ---------------------- | ---------------------------------------- |
| the parameter | `HandlerParam.content` | names a **kind**, not a lister           |
| the widget    | `paramInput`           | asks the panel; falls back to a text box |
| the panel     | `CONTENT_LISTERS`      | kind → catalogue lister                  |

**Why a kind and not `options: listTerrains`.** That spelling is a **cycle**, and the codebase says
so where it would form: `catalog.ts` imports `handler-registry.ts` as a value ("no imports of its
own, so this cannot cycle"). Worse than the cycle, `catalog.ts` reaches `api.ts`, which reads the
global `sandkit` **at module load** — so naming the function in the registry would make the
compiler, the scope tables and every test fail to load without a host. Declaring the dependency as
**data** keeps that invariant, survives serialisation, and is typed as a total `Record`, so a new
kind without a lister is a type error rather than a field that quietly reverts to a text box.

The same reasoning keeps the **renderer** in the panel rather than in the widgets:
`param-controls.ts` asks for it and never imports `selector.ts`. A widget that only draws a text box
should not depend on the whole engine, and this is the seam where it would have.

A fixed enum — "conductor" / "storage" — still renders as a native `<select>`, and `selector` is
optional on `PanelContext`, so a context with no panel degrades to a text box rather than losing the
field.

### The type-handle trap

`Structure` declares only `x`, `y`, `trapped?` and `data?` — there is **no declared `type` field** —
and there is **no** `getIdByType` for structures, only `getTypeById` (id → number). So the engine
hands you a numeric handle where an author expects a string id, and documents no way back.

`structureType` returns that handle rather than pretending it is an id. The round-trip needed care:
a **bind is a string**, so a handle read as `42` arrives back as `"42"` while the engine still holds
the number `42`, and `42 === "42"` is false. `isStructureType` therefore retries a **digit-only**
reference as a number — narrow on purpose, because an id like `"planterBox2"` is far more likely to
be an id than a handle, and coercing it would turn a real id into a false match. This was found by
the action's own test, not by reading the declaration.

### What is deliberately not an action

Every cell- or instance-taking function in the namespace is here, and these are not:

- **Registration** — `register`, `updateDefinition`, `registerVariant`, `addVariant`,
  `registerPlacementConfig`, `recipes.register`, `processing.register`. Mod-init and Main-only. A
  _per-tick process_ that registered a structure type would be a bug.
- **Type-level queries** — `getAvailableTypes`, `getUnlockedTypes`, `isLockedByType`,
  `isUnlockedByType`, `getDefinitionByType`, `getTypeById`. They take a _type_, not a cell or
  instance, so they fall outside the rule. `getTypeById` is the one that hurts.
- **Iteration** — `forEachOfType(typeOrId, callback)`. Takes a callback, so it has no place in a
  data-flow program; a region scan is the composable equivalent.
- **Deprecated aliases** — `addVariant`, `getTypeFromId`, `removeAtCellWhenIdle`,
  `removeAtCellsWhenIdle`, `removeBetweenCellsWhenIdle`, `isEnabledAt`, `setEnabledAt`. Each has a
  current form in the family.

`mapSpritesheetValue` is the one addition outside the rule — it takes neither a cell nor an
instance. It is here because `setSpritesheetByValue` maps **and** writes, so a program wanting the
frame as a _value_ (to bind, compare, or send to a different structure) has no other way to get it.
Exposing the engine's own mapper keeps the returned number identical to the one the engine would
have chosen.

### A timed spawn is atomic; a set-then-time is not

`createElement` / `replaceElement` / `transformElement` take `durationTicks`, which sets **both**
max and remaining duration at creation. Chaining `createElement` then the motion family's
`setDuration` would leave a window in which the cell exists untimed, because the second write is a
separate per-cell call applied at the flush.

The same three actions also take `vx`/`vy`, which spawn the cell as an **already-moving particle** —
`ElementCreateOptions.particle`. That is an atomic launch; the motion family's `toParticle` is the
non-atomic one. They are not redundant.

### What the migration cost

`context.commit(mutations: unknown)` is typed `unknown` and two real workshop mods use only
`{kind, cellX, cellY, elementType}` and `{kind, cellX, cellY, expectedElementType}`. There is no
evidence it takes an options bag, so `durationTicks` was never going to work there — it would have
committed and done nothing. What was lost:

- **Main-only.** The element family used to run on any thread delivering a context. It now needs
  `api.grid.mutate`, so it needs Main. Same assumption the motion family already rests on, and
  **adding a `workerEntry` would break both families** — they warn and return `false` rather than
  throwing, and there is a test for exactly that.
- **No acknowledgement.** `mutate` returns `void` where `commit` returned a boolean, so an action's
  `true` means "cells were **queued**", not "the engine accepted them".

What was gained, over and above the options: the old `expectedElementType` field existed to close
the gap between reading a cell and committing its removal a tick later. `mutate` removes the gap, so
compare-and-remove is now **structural** — and it covers creates too, which the field never did.

`setVelocity` and `addVelocity` affect **particles only** — they will not move a falling grain of
sand.

`patterns` is worth a look: a circular dig is **two calls**, which is exactly what an author expects
to find in a list. `ExcavateOptions`' 8 flags (`fromGun`, `fromDrill`, `forceRemoveAll`, …) are a
ready-made dropdown.

**Rule:** a `processing` verb that writes must go through `context.commit`, not the `api.*`
namespaces, or it loses the engine's atomicity.

---

## 5. REMEMBER — state that survives the save

_The verb writes `structure.data`. This is how a machine remembers._

| action                 | does                                                                   | have it? |
| ---------------------- | ---------------------------------------------------------------------- | -------- |
| `structureWriteData`   | set `data[key]`                                                        | ✓        |
| `processorCount`       | `data.mdTicks += 1`                                                    | ✓        |
| `triggerTick`          | advance a tick counter                                                 | ✓        |
| `energyBank`           | store energy on the structure                                          | ✓        |
| `upgradeCountLevel`    | track an upgrade level                                                 | ✓        |
| **merge partial data** | `structures.updateData(structure, partial, { propagateToWorkers })`    | ✗        |
| **push to workers**    | `structures.update(structure, { propagateToWorkers })`                 | ✗        |
| **animate by value**   | `structures.setSpritesheetIndexByValueAtCell(x, y, value, thresholds)` | ✗        |
| **remove a structure** | `structures.removeAtCell`                                              | ✗        |
| **build one**          | `structures.buildAtCell`                                               | ✗        |

`structure.data` is the author's **only persistent scratch space** and it saves with the world.
`3791498201` keeps an entire silo inventory in it — a locked type plus a count. The pattern that
pays off is the _accumulator_: something that stores, counts, charges, or fills up.

Two things make this section far more powerful than it looks:

- **`updateData(structure, partial, { propagateToWorkers })`** — merge, and push to the worker
  threads. The engine is multi-threaded; a write that is not propagated is a bug the author cannot
  see. Note `structures.setData` is `@deprecated` — use `updateData`.
- **`setSpritesheetIndexByValueAtCell(x, y, value, thresholds)`** — maps a number onto animation
  frames. This is how the scrapes show a filling tank **with no custom rendering**: the sprite index
  follows the data. One verb gives every config author a progress bar.

---

## 6. FEEL — feedback the player can see

_The verb produces no state. It is what makes a mod feel finished._

**Our catalogue has none of these.** All are current:

| verb                            | engine call                                        |
| ------------------------------- | -------------------------------------------------- |
| particles                       | `effects.createParticlesAtWorld`                   |
| light                           | `effects.createLightAtWorld`, `lights.fadeAtWorld` |
| laser                           | `effects.createLaserAtWorld`                       |
| shockwave                       | `effects.createDistortionWaveAtWorld`              |
| sound                           | `sound.play`                                       |
| a message                       | `ui.toast`                                         |
| tell the author something broke | `ui.toast`                                         |
| refresh visuals                 | `rendering.redrawAroundCell`                       |

Roughly one line each, and it is the largest perceived-quality gap we have. A mod that works and a
mod that feels finished differ almost entirely here.

---

## 7. CONNECT — join the rest of the game

_The verb reaches outside the structure. This is where the engine's own systems get reused instead
of reimplemented._

| verb                                     | engine call                                                             | have it? |
| ---------------------------------------- | ----------------------------------------------------------------------- | -------- |
| `techAppendUnlock`                       | `tech.appendUnlock`                                                     | ✓        |
| `techSetUpgradeLevel`                    | `upgrades.setLevelById`                                                 | ✓        |
| `techGrantItem`                          | items / `player.inventory`                                              | ✓        |
| `energyGenerateWhileHeld`                | `energy.addAtCell`                                                      | ✓        |
| `energyConsumePerRun`                    | `energy.consume`                                                        | ✓        |
| **query the power grid**                 | `energy.getNetworkAtCell`, `getNetworkFreeCapacityAtCell`               | ✗        |
| **register a custom power type**         | `energy.registerType`                                                   | ✗        |
| **gate research**                        | `tech.isResearchedById`, `isLockedById` / `setLockedById`               | ✗        |
| **discount research**                    | hook `progression:cost:prepare`                                         | ✗        |
| **charge for placing**                   | hook `building:place` (intercept)                                       | ✗        |
| **make a sensor**                        | `signals.registerSenderType`                                            | ✗        |
| **make an actuator**                     | `signals.registerReceiverType`, `signals.setOutputAtCell`               | ✗        |
| **enable pipes**                         | `pipes.setEnabledAtCell`                                                | ✗        |
| **gate this structure's own processing** | `structures.processing.setEnabledAtCell`                                | ✗        |
| **element transform**                    | `reactions.registerContact`                                             | ✗        |
| **conveyor / launcher**                  | `structureBehaviors.registerConveyorType` / `registerLauncherType`      | ✗        |
| **machine recipe**                       | `processing.registerGrower` / `registerShaker` / `registerKineticPress` | ✗        |
| **dig a pattern**                        | `patterns.excavateAtCell`                                               | ✗        |

`getNetworkFreeCapacityAtCell` is what makes a machine that _waits for power_ expressible, and
`energy.consumeExcludingNetworkAtCell` is the subtly different one that does not. Those two together
are a whole power system.

### Two things from `__scraped-mods/grok` worth stealing

grok is not useful as a mod to copy, but its `packages/logic-control` (853 lines) contains two
things the workshop scrapes never show:

1. **`structures.processing.setEnabledAtCell(x, y, enabled)` as a gate.** It returns a boolean. grok
   captures a _baseline_ of every machine's state and, when the signal goes away, **restores** it.
   That is the verb we are missing: not "do a thing" but "hold this thing in a state, and release it
   cleanly". A gate plus a release is how you build a redstone-style mod without reimplementing
   anything.
2. **A correction to my previous version of this document.** grok's `packages/signal-live/index.ts`
   states: _"`registerSenderType` only seeds link `.on` when a wire is drawn. Live sensors must
   update `session.mods.signals.links` + `dirtyReceivers` every change."_ So `registerSenderType`
   alone is **not** a complete sensor — I previously called it "a whole logic system in one call",
   which overstated it. Honest version: it wires a sensor, and a per-frame push is needed to keep it
   live.

### Hooks — the engine's own 55 extension points

`hooks.d.ts` is fully typed: a registry of ids, each with a known argument shape and a per-hook
filter. `intercept` can cancel (`context.cancel()`); `modify` rewrites the engine's own args in
place.

| mode        | count           | ids                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intercept` | 28 (24 current) | `item:use` · `entity:update` · `building:place` · `building:clearShape` · `action:start` · `action:intercept` · `input:keyDown` · `input:keyUp` · `input:scroll` · `input:boostDown` · `input:descendDown` · `input:escape` · `teleport:effect` · `teleport:effect:create` · `placePoints:suppress` · `placePoints:isSuppressed` · `placePoints:directionalArrows:suppress` · `placePoints:directionalArrows:isSuppressed` · `interactable:suppressHover` · `fire:element:ignite` · `projectile:fire:overStructure` · `projectile:hit` · `player:position:commit` · `progression:purchase`                    |
| `modify`    | 27 (21 current) | `excavation:prepare` · `locator:scan:prepare` · `vacuum:prepare` · `vacuum:element:prepare` · `player:movement:prepare` · `building:placementLimit:prepare` · `fluxEmanator:processing:prepare` · `render:pipes:prepare` · `structures:moved:prepare` · `structures:removed:prepare` · `weapon:reload:prepare` · `projectile:travel:prepare` · `projectile:impact:prepare` · `player:collision:prepare` · `trigger:schedule:prepare` · `progression:cost:prepare` · `resource:collection:prepare` · `resource:delivery:prepare` · `resource:balance:prepare` · `gold:removal:prepare` · `gold:removal:settle` |

The other 10 ids are deprecated aliases (`input:keydown`, `player:movement`, `render:pipes`,
`building:placement-limit`, …) and are excluded by design.

`modify` is the closest thing to a cheat code: it mutates the engine's own argument object, so
`args.amount *= 2` doubles income, and `progression:cost:prepare` with `args.amount *= 0.9`
discounts research — without reimplementing either system. Both modes take a **filter**
(`{ structureTypes }`, `{ resourceIds }`, `{ triggerIds }`, …) and a `priority`, and both return an
unsubscribe function. The filter is what makes hooks safe to expose to a non-programmer: "charge for
placing _my_ building", not every building in the game.

Worth stealing as an idiom: the two-phase `gold:removal:prepare` → `settle` pair. **prepare** reads
state and reduces the request; **settle** commits the side effect. Any two-phase economy verb should
follow it.

---

## 8. Chaining — how verbs build a context

The list in §2–§7 is a menu. This is the part that makes it a _tool_.

### The problem, stated exactly

`compileProcess` currently does this:

```ts
const [payload, ctx] = args;
for (const step of steps) step.fn(payload, ctx, step.options);
```

Every verb gets the same two arguments and **returns nothing the next verb can see.** `options` is
bound at compile time, but the _results_ of a verb are not. So a process can read a cell and then…
not use what it read. It is a script, not a program.

Three consequences:

1. A verb cannot feed another. "Read the cell above, then replace it" is impossible unless the
   author hardcodes the coordinates twice.
2. A verb cannot branch. `options` is a constant, so "only if full" cannot be expressed.
3. `ctx` is the _engine's_ context and we overwrite nothing — so the one channel that could carry
   state is reserved for the engine.

### The fix: a process-local context, threaded through the chain

Give the process a scratchpad it owns, and let every verb read and write it. This is a small change
with a large payoff.

```ts
// what each verb receives, on every call site
interface ActionContext {
    readonly payload: unknown; // the engine's own payload
    readonly engine: unknown; // the engine's ctx (StructureProcessingContext, etc.)
    /** The process scratchpad. Verbs read it and write to it. */
    readonly vars: Record<string, unknown>;
    /** Cell writes staged by verbs, flushed once at the end of the process. */
    readonly pending: Mutation[];
    /** Set by a DECIDE verb; a false value skips every later verb. */
    proceed: boolean;
}
```

`HandlerActionFn` becomes `(cx: ActionContext) => void`. What each role does with it:

| role     | reads          | writes                                   |
| -------- | -------------- | ---------------------------------------- |
| SENSE    | engine         | `vars`                                   |
| DECIDE   | `vars`, engine | `proceed`                                |
| REMEMBER | `vars`         | `structure.data`                         |
| ACT      | `vars`         | `pending` (flushed via `context.commit`) |
| FEEL     | `vars`         | the screen                               |
| CONNECT  | `vars`         | the engine                               |

`pending` is the important one. Right now a verb that writes must call `context.commit` itself, so
each write is its own transaction. Staging writes and flushing **once at the end** gives a whole
process a single atomic commit — which is what `expectedElementType` was reaching for.

### What chaining buys, concretely

A pump becomes a config, with no code:

| # | verb                      | does                                                                                      |
| - | ------------------------- | ----------------------------------------------------------------------------------------- |
| 1 | `cellIsType` (DECIDE)     | `vars.src = getResolvedTypeAtCell(x, y − 1)`; `proceed = src !== null`                    |
| 2 | `cellIsEmpty` (DECIDE)    | `proceed = proceed && isCellEmptyAtCell(x, y + 1)`                                        |
| 3 | `moveCell` (ACT)          | `pending.push({ kind: "create", cellX: x, cellY: y + 1, elementType: vars.src })`         |
| 4 | `removeIfType` (ACT)      | `pending.push({ kind: "remove", cellX: x, cellY: y − 1, expectedElementType: vars.src })` |
| 5 | `bumpCount` (REMEMBER)    | `data.pumped = (data.pumped ?? 0) + 1`                                                    |
| 6 | `frameByValue` (REMEMBER) | `setSpritesheetIndexByValueAtCell(x, y, data.pumped, [10, 50, 100])`                      |
| 7 | `playSound` (FEEL)        | only when `vars.moved`                                                                    |

Same pump, different authoring: rename `pumped` to `charge`, add a `getNetworkFreeCapacityAtCell`
DECIDE at step 0, and it is a **power-limited pump** without adding a verb. **That is the point** —
verbs are recombinable because they communicate through named slots rather than position.

### Four rules that keep it safe

1. **`proceed` is sticky-false.** Once a DECIDE fails, nothing later runs. No loops and no `else`,
   deliberately. A config that can express arbitrary control flow is a config that can hang the
   game.
2. **`pending` flushes once, at the end, and only on the `processing` call site.** A failed `commit`
   returns a boolean that should surface as a `ui.toast` — the author must never get a silent no-op.
3. **A verb's `vars` keys are namespaced by its own name** (`pump.moveCell.*`), so two verbs cannot
   collide by accident.
4. **Every verb declares its role and its valid call sites**, and the panel greys out invalid
   combinations.

### The smallest version worth building first

Not the whole model. This subset turns the catalogue from a script into a tool:

| priority | add                                         | why                                             |
| -------- | ------------------------------------------- | ----------------------------------------------- |
| 1        | `vars` threaded through `compileProcess`    | the plumbing everything else needs              |
| 2        | 2 DECIDE verbs: `cellIsEmpty`, `cellIsType` | turns a recipe into a machine                   |
| 3        | the `proceed` gate                          | one line, and §4–§7 become optional             |
| 4        | `pending` + one flush via `context.commit`  | fixes the broken writes _and_ makes them atomic |
| 5        | 2 ACT verbs: `moveCell`, `removeIfType`     | a working pump                                  |
| 6        | 1 REMEMBER verb: `frameByValue`             | it looks alive                                  |

Six additions, and an author can build a pump, a trash can, a smelter and a sensor without writing
code. That is a tool, not a menu.

---

## 9. Deprecated api — banned

61 engine functions are `@deprecated`. **The build must not call any of them.**

| deprecated                          | use instead                          |
| ----------------------------------- | ------------------------------------ |
| `player.buildings.unlockByType`     | `unlockById`                         |
| `structures.setData`                | `updateData`                         |
| `structures.addProcessor`           | `structures.processing.register`     |
| `structures.processing.isEnabledAt` | `isEnabledAtCell`                    |
| `elements.*WhenIdle` (all 18)       | the plain name — e.g. `removeAtCell` |
| `grid.forEachCellInRect`            | `forEachCellInRectangle`             |
| `elements.getTypeFromId`            | `getTypeById`                        |
| `structures.getUnlockedTypes`       | `getAvailableTypes`                  |
| `tech.unlockByType`                 | `unlockById`                         |
| `effects.createLightAtWorld`        | `lights.createAtWorld`               |
| `world.runWhenSimulationIdle`       | `grid.mutate`                        |

### Already fixed

`src/register/core/structures.ts` and `src/packages/mysandkit.ts` called
`player.buildings.unlockByType`. Now `unlockById`. The wrapper still returns a boolean — that return
is **ours**, not the engine's, and `apply.ts` uses it to warn once when unlocks silently fail.
Renaming the engine call cost nothing.

### Keeping it that way

Two guards, both cheap:

1. `tools/count-handlers.ts --engine` excludes deprecated declarations. When a new verb is added,
   its engine call should appear in that list.
2. A test that greps `src/**` for the 61 deprecated names. Cheap, and it fails loudly rather than
   letting the rot in gradually.

---

## Appendix — verifying any claim here

```sh
deno run -A tools/count-handlers.ts            # our 39 actions + class consistency
deno run -A tools/count-handlers.ts --engine   # 330 current engine functions

# the commit contract (§4) — the real payload shape
cd __scraped-mods && grep -rn -A6 "processor\\.commit(\\[" workshop/*/*.js

# what the mods actually reach for
cd __scraped-mods && grep -rhoE "api\\.[a-z]+\\.[a-zA-Z]+" workshop/*/*.js | sort | uniq -c | sort -rn

# grok: the gate + the registerSenderType caveat
cat grok/packages/logic-control/apply.ts grok/packages/signal-live/index.ts
```

`tools/count-handlers.ts` prints `NOT_CLASSIFIED` and `CLASSED_BUT_ABSENT`; both should stay `0`. If
you add an action, that tool is how you find out it was never classified.

**What this document does not know.** The `context.commit` mutation schema is `unknown` in the
types, so §4 reconstructs it from 3 mods — the full set of `kind` values may be larger. The runtime
tick-ordering of the three write tiers is read from doc comments, not observed in a running game.
And grok's `signal-live` reaches into `sandkit.state.session.mods.signals`, which is **not** public
api — so that particular trick is not something we can copy into a config-driven action.
