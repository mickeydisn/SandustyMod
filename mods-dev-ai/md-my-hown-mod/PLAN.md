# Handlers → Process / Action split

Split the one thing called a "handler" into the two things it is actually doing today.

## The distinction

| | **HandlerAction** | **HandlerProcess** |
| --- | --- | --- |
| what it is | an **atomic** action | a named, ordered **composition** of actions |
| rule | must call **one `api.*` section** | groups by **which engine call invokes it** |
| lives | in code, once, forever | in config, per object |
| selected by | a process | an **object**: item, structure, signal, trigger |
| cardinality | many processes reuse one | one per object |

**They are sorted on two different axes, and that is the whole point.** An action
belongs to an API namespace; a process belongs to a call site. A process may mix
actions from different APIs, because the process is what the engine calls and the
actions are just what it does while handling that call.

```
api.energy.consume ──┐
api.player.inv.add ─┤
api.upgrades.setLV ─┴─→  Process  ──→  upgrade.onUpgrade(item)   ← call site
```

> **Payload vs params is deliberately not settled here** — it is the next topic, and
> the plan stops short of guessing at it.

## Evidence the current model is already confused

`HandlerMeta.type` is supposed to group the Handlers tab, but it measures **neither**
axis cleanly. Reading the 46 entries against what the code actually does:

| `type` value | n | which axis is it? | why it does not hold |
| --- | --- | --- | --- |
| `processor` | 6 | call site | but 2 of the 6 call `api.energy`, and the rest call no API at all |
| `projectile` | 7 | call site | consistent — but it is a call site, not an API |
| `cell` | 11 | API-ish area | spans **three** call sites: itemAction, processing, trigger |
| `tech` | 6 | API-ish name | slotted on the `upgrade` call site, and 3 of 6 call no API |
| `message` | 6 | neither | `signalLog`, `triggerLog` and `itemExcavate` share a label and nothing else |
| `global` / `modifier` | 5 | mixed | `modifier` is a call site, `global` is an absence |

`excavationDefault` (an itemAction returning a profile) and `triggerScan` (a trigger
logging cells) are filed under the same `type: "cell"`. That is the two axes collapsed
into one field, and it is why splitting them is a real change and not a rename.

## Measured: the "must call one API" rule is satisfied by 5 of 43

`handlers.ts` references exactly **four** API paths in the whole file:

| action | calls |
| --- | --- |
| `energyGenerateWhileHeld` | `api.energy.addAtCell` + `api.energy.getNetworkFreeCapacityAtCell` |
| `energyConsumePerRun` | `api.energy.consume` |
| `techAppendUnlock` | `api.tech.conservatory.appendUnlock` |
| `techSetUpgradeLevel` | `api.upgrades.setLevelById` |
| `techGrantItem` | `api.player.inventory.addById` |

The other 38 call no `api.*` at all. They fall into two kinds:

- **Context-bound** (4): `processorLift`, `processorConvert`, `processorScan` use
  `ctx.commit` / `ctx.getResolvedTypeAtCell` — the engine's `StructureProcessingContext`,
  not an API namespace. Whether that satisfies "calls an API" is an open question.
- **Pure** (the rest): loggers, `structureReadData` / `structureWriteData` (touch
  `structure.data` directly), and the value-returning factories.

So the rule is a **design rule going forward, not a description of what exists**, and
adopting it forces a decision on 38 handlers rather than 0. That is Phase 2's real work.


## Measured state (counted — not assumed)

| Fact | Value |
| --- | --- |
| `ANY_HANDLERS` (code) | 37 |
| `PROCESS_HANDLERS` (code) | 6 |
| `HANDLER_META` (declared) | 46 |
| config slots that take a `handlerKey` | 7 |
| actions per object today | **always exactly 1** |

The 46 declared vs 43 implemented is a pre-existing drift, not part of this plan beyond
noting it — `unreachableHandlers` is what catches it.

## The impact

The whole surface is 1:1 today: one `handlerKey` on an entry, one function resolved at
registration. The split makes it 1:N, so **the config shape changes on every slot**:

```
processing: [{ id, structureType, intervalMs, handlerKey }]      // now
processing: [{ id, structureType, intervalMs, actions: [{key, options}] }]
```

Consequences, in the order they will bite:

1. **Registration is where the two meet.** `apply.ts` and `mysandkit.ts` each call
   `resolveAnyHandler(key)` and hand the raw function to the engine. They must instead
   call a compiler that turns a list of action refs into *one* function. That compiler is
   the only place a process exists at runtime.
2. **Not every slot can honestly be a list.** 18 of the 43 handlers return a
   value, but **only `projectile` is a slot where that value survives** — measured
   in Phase 0, not assumed. `signal`, `trigger`, `processing`, `upgrade` and
   `itemAction` are all side-effect callbacks, so a process of N actions on those
   slots has nothing to hand back. That shrinks the return-value question to one
   slot. See **Open decisions**.
3. **13 of those 18 are returning into the void.** `energyDefault`…`energyNetwork`
   sit on `processing`; `excavation*`, `itemDefault`, `itemExcavate` and `itemShoot`
   sit on `itemAction`. `apply.ts` does `entry.process = fn` and the engine ignores
   the result; `handleAction` is documented `(state, action) => unknown`, "handles
   item use actions". These read as **data factories for a different object** — an
   energy type, an excavation profile — that were wired into a callback slot. They
   are recorded by `VACUOUS_RETURNS` so the split cannot carry the bug forward
   silently. **Deciding what they should be is a separate call, and a real one.**
4. **The UI is a browser for a flat list.** `handlers-panel.ts` shows ~46 rows grouped
   by `type`. After the split there are two different things to browse: the *action
   catalogue* (reusable) and the *processes in use* (one per object).
5. **`itemTypes` reachability moves.** A Consumable has no `ActionType`, so its process
   is empty. That check currently sits on the handler; after the split it sits on the
   process' action list, and has to survive the migration.
6. **Round-trip is a hard requirement.** `schema_roundtrip.test.ts` (590 assertions) must
   still pass, and a `handlerKey` already on disk has to keep working.

## Open decisions

- [ ] **Return-value rule for value-returning slots.** Proposed: run all actions in order,
      shallow-merge returned plain objects, last writer wins; a non-object return replaces
      the whole value and is terminal. A 1-action process then behaves exactly as it does
      today, so this is backward-compatible by construction. **Phase 0 narrowed this to
      `projectile` only** — the other slots discard the return — so the rule is small. Still
      _wants confirming against the engine's real `getOptions` call site._
- [ ] **What are the 13 vacuous handlers, really?** They return a descriptor into a slot
      that throws it away. Either they move to the energy / excavation definitions as
      **presets** (most likely — that is what a `{capacity: 1000}` or `{power: 10}` shape
      is), or they are deleted as unreachable. _This is a product call, not a refactor._
- [ ] **Does an action failure stop the chain?** Proposed: no — each action is isolated and
      the rest still run, with the error collected. Chosen because today each handler
      carries its own `try/catch`, and a list makes that boilerplate the process's job.
      _Confirm this rather than fail-fast._
- [ ] **Is a process with zero actions legal?** Proposed: yes, a no-op that still satisfies
      the engine, so an author can save a process before choosing its actions.
- [ ] **Can the same action appear twice in one process?** Proposed: yes, with different
      options — "log, then convert" and "convert, then log" are different behaviours.



## Phase 0 — freeze the current contract (first)

Nothing else is safe until current dispatch behaviour is pinned by a test, because the
split is a refactor of exactly that behaviour.

- [x] Classify all 43 implemented handlers by slot and by void-vs-value
- [x] Test: every slot resolves exactly one function today
- [x] Test: value-returning handlers still return their value
- [x] Test: a Consumable resolves no item action

**Result — `src/hooks/handler-classification.test.ts`, 8 tests.** Two things came out of
it, and one of them was a correction to this plan rather than a confirmation:

- Only `projectile` uses a returned value. 7 handlers, all `getOptions` factories.
- **13 handlers return a value that nothing reads.** The test caught two I had
  missed on the first pass — `itemExcavate` and `itemShoot` — which is the point of
  freezing the contract first: the inventory in the plan was wrong and the test is
  what made it right. Listed by name in `VACUOUS_RETURNS`, with a test that fails if
  one is re-slotted or if the engine starts honouring the return.

One test is deliberately the invariant this plan removes ("a slot resolves exactly one
function"). After the split it should be **deleted, not relaxed**.

## Phase 1 — types and naming

The names are part of the problem: `AnyHandler` is a function that is sometimes an action
and sometimes a process, and nothing says which.

- [ ] `HandlerActionFn` / `HandlerAction` — the code, atomic, one `api.*` section
- [ ] `HandlerProcessFn` — the compiled function the engine calls
- [ ] `HandlerActionRef` = `{ key: string; options?: Record<string, unknown> }`
- [ ] `CallSite` — the engine entry point, named for what invokes a process
      (`item.handleAction`, `structure.process`, `signal.onClick`, `projectile.getOptions`,
      `upgrade.onUpgrade`, `trigger.fire`, `behavior.onDownKey`, `modifier.intercept`)
- [ ] `compileProcess(refs, callSite)` → `HandlerProcessFn`
- [ ] Deprecate `AnyHandler` / `CodeHandler` / `ProcessHandler`, then delete

## Phase 2 — the action catalogue

- [ ] Replace `type` with the **API axis** — the `api.*` namespace an action calls
- [ ] `resolveAction(key)` — typed miss instead of silent `undefined`
- [ ] Reachability checks read the action list, not a single key
- [ ] **Decide the 38 non-API actions** — the real work of this phase:
  - [ ] Context-bound (`processorLift`/`Convert`/`Scan`) — does `ctx.commit` count?
  - [ ] Pure loggers — keep as a `debug` section, or delete?
  - [ ] `structureReadData`/`WriteData` — can these become an `api.structures` call?
- [ ] Confirm the 5 API-bound actions against a namespace that actually exists

## Phase 3 — the compiler

- [ ] Ordered run, per-action `try/catch`, errors collected not thrown
- [ ] Return-value merge per **Open decisions**
- [ ] Unknown action key: warn once, drop that action, keep the rest

## Phase 4 — config schema

- [ ] `actions: HandlerActionRef[]` on all 7 slots
- [ ] Read `handlerKey` as a 1-element action list (migration), write `actions`
- [ ] Round-trip both shapes; `schema_roundtrip` stays green
- [ ] Keep the Consumable exclusion working across the migration

## Phase 5 — registration

- [ ] `apply.ts`: signals, triggers, behaviours, modifiers
- [ ] `mysandkit.ts`: `item.handleAction`, projectile `getOptions`
- [ ] `processing.ts` definition: the picker becomes a list, not a dropdown

## Phase 6 — UI

- [ ] Handlers tab splits: **Actions** (grouped by `api.*`) and **Processes** (grouped by
      call site) — the two axes, no longer sharing one `type` field
- [ ] Process editor: ordered list — add, remove, reorder, per-action params
- [ ] "Copy snippet" emits the list form
- [ ] Warnings follow the action list, not the single key

## Phase 7 — verify

- [ ] `deno check src/main.ts`
- [ ] `deno test -A --no-check src/`
- [ ] `deno test -A --no-check tools/`
- [ ] `deno run -A src/ui/test/schema_roundtrip.test.ts`
- [ ] `deno run -A tools/verify-definition.ts`
- [ ] `deno task build:main`
- [ ] In-game: a 3-action process on a structure and one on an item — **needs the game**;
      stated as unverified rather than claimed
