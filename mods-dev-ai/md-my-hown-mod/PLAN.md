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

## The action class — what an action depends on

An action is supposed to call one `api.*` section. That is a **ladder**, and this is
where each action sits on it — measured by running it against recording proxies, not
read off the source:

| class | needs | n | status |
| --- | --- | --- | --- |
| `api` | one `api.*` namespace | 5 | **the rule** |
| `self-sufficient` | only the payload and params it was handed | 15 | legitimate, but reaches into engine objects |
| `context-bound` | the engine's `ctx.commit` / `ctx.getResolvedTypeAtCell` | 3 | a per-call capability, not a namespace |
| `pure` | nothing — a constant, or a `console.log` | 23 | debug scaffolding; should it exist? |

So `api` is what the rule *wants*, and the other three record how far short of it each
action falls. An action that both reads the payload and calls `api.energy`
(`energyGenerateWhileHeld`) is filed under `api`, because that is the stronger claim.

**The catalogue is 46, not 43.** The three `CODE_HANDLERS` (the `modifier` slot) are
actions too, and they were missed because their values are `{ kind, fn }` *objects* —
which is also why `resolveAnyHandler`, the pre-split lookup, never found them. `resolveAction`
now unwraps all three registries, which is what makes this one catalogue rather than three.

**Code: `src/hooks/action-class.ts`.** `ACTION_CLASSES` is recorded, not computed at
runtime, and `action-class.test.ts` proves the record still matches behaviour — so an
action that starts or stops calling an API fails a test instead of drifting.

One trap worth keeping: the two registries have **different signatures** —
`ANY_HANDLERS` is `(payload, extra)`, `PROCESS_HANDLERS` is `(structure, context, options)`.
Labelling argument 2 as "ctx" for both manufactures context-bound actions out of
handlers that only read options. There is a test pinning that.

## Measured: the "must call one API" rule is satisfied by 5 of 43

The 38 that fall short, by class, are Phase 2's actual work:

- [ ] **`pure` (23)** — `projectileFast` is a literal; `signalLog` is a `console.log`.
      Keep as a `debug` section, or delete?
- [ ] **`self-sufficient` (15)** — legitimate, but `structureReadData`/`structureWriteData`
      and the `upgrade*` family touch `structure.data` / `item.data` directly. Can they
      become `api.structures` / `api.upgrades` calls?
- [ ] **`context-bound` (3)** — `processorScan`, `processorLift`, `processorConvert`.
      Does `ctx.commit` count as an API, or is it a capability the process should own?



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

## Decisions

### The scope model — replacing "grouped by api"

**The `api` axis is ambient, and ambient things cannot discriminate.** The five
api-calling actions read `globalThis.sandkit.api` — a module global, not an argument.
Every call site provides it. So "which api does it call" says nothing about *where the
action can run*, which is the only question the axis was being asked. Worse, 41 of 46
actions call no api at all, so grouping by it puts four fifths of the catalogue in one
bucket labelled "reaches for nothing". The `cls` ladder then sorts that bucket by how
far short of the api rule each action falls, which is a quality measure pretending to
be a category.

**What actually discriminates is the payload the call site delivers.** Measured with
`tools/analyze-scopes.ts`, an action needs at most three things, and each is one
boolean:

| need | reads | e.g. |
| --- | --- | --- |
| `pos` | `payload.x` / `.y` | `processorLift`, `triggerScan` |
| `data` | `payload.data` | `structureReadData`, `upgradeScale` |
| `cell` | `ctx.commit` / `ctx.getResolvedTypeAtCell` | `processorConvert` |

And each call site provides a subset, read off `CALL_SITE_SIGNATURES` and the
registration code — not assumed:

| call site | engine call | pos | data | cell | ret |
| --- | --- | :-: | :-: | :-: | :-: |
| `processing` | `process(structure, context)` | ✓ | ✓ | ✓ | |
| `signal` | `handler(structure)` | ✓ | ✓ | | |
| `itemAction` | `handleAction(state, action)` | | ✓ | | |
| `upgrade` | `onUpgrade(item)` | | ✓ | | |
| `modifier` | `intercept/modify(args, ctx)` | ✓ | ✓ | ✓ | ✓ |
| `trigger` | `callback()` | | | | |
| `projectile` | `getOptions()` | | | | ✓ |
| `behavior` | `onDownKey(key)` | | | | |

**The rule is one line: an action may sit in a process iff its needs are a subset of
what the call site delivers.** That is what "the process context defines the scope of
actions it can use" means concretely — and it is *derived*, so `slots` stops being 46
hand-written arrays that can drift from the code.

`ret` is listed above but is deliberately **not** part of the subset rule: a value an
action returns is only meaningful where the engine reads it, and that is the separate
question the vacuous-return triage is about.

- [x] **Build `scope.ts`** — `ProcessScope`, `CALL_SITE_SCOPE`, `ACTION_SCOPE`,
      `canRunAt(key, site)`, `slotsFor(key)`, all probe-derived, with
      `needs ⊆ provides` pinned by a test. Done, and it paid for itself immediately:
      `tools/analyze-scopes.ts` found **five live bugs** the old axes could not see.

### The five bugs the scope model found

None of these threw, warned, or looked wrong in the editor. All five were actions
doing **nothing at all**, correctly configured.

1. **`techAppendUnlock`, `techSetUpgradeLevel`, `techGrantItem`** read their options
   from **argument 2** instead of 3 — a leftover of the pre-split 2-arg signature.
   So `extra` was bound to the engine's *context*, `o.techId` was `undefined`, and
   each returned before touching its API. Fixed to `(node, _ctx, extra)`; a test now
   calls them the way `compileProcess` does and asserts the API call happens.
   *Same class of bug as `processorConvert` had — found by measurement, not review.*
2. **`triggerScan`** and 3. **`energyGenerateWhileHeld`** were offered on `trigger`,
   where the engine calls `callback()` with **no arguments at all** —
   `registerTrigger` puts `extra` in the *registration*, not the call. Both need a
   position, so both could only ever return early. Re-slotted to `processing`.

The old `slots` arrays were hand-written 46 times, and that is exactly how these got
in: nothing checked a declaration against what the code actually reads. `scope.test.ts`
now asserts every declared slot is servable, so the class cannot recur.

- [ ] **Derive `HANDLER_META.slots` from it** instead of hand-declaring. They are now
      *correct* and the test enforces that, but they are still 46 hand-written arrays
      kept in step by hand.
- [x] **Rebuild the Handlers panel** around a **flat alphabetical list with three
      filter axes** — decided after measuring, because 33 of 46 actions need nothing
      and any grouping built on that fact would be a bucket, not a category:
      - **Needs** — `a position` / `instance data` / `the cell grid`. The only axis
        that decides legality, so it doubles as the "what can I put in *this*
        process" filter.
      - **Effect** — returns / calls an API / changes the grid / writes data /
        reads / logs. Measured; this is the axis that separates the 33.
      - **Domain** — energy, grid, items, tech, projectiles, excavation, structure,
        diagnostics. The only *declared* axis, pinned by a coverage test.
      - Plus **"Runs on"** (call site, wired to `canRunAt`) and an **in-use toggle**.
      Each row shows its three chips instead of the old deprecated `scope:` label,
      and flags the vacuous returns. "Processes in use" is unchanged below it.
- [ ] **Drop `ACTION_CLASSES` / `cls`** once scope groups the panel — it measures a
      rule we are no longer enforcing, and keeping it invites the same confusion
      back. Worth knowing before the panel work: the grouping it implies is *worse*,
      not better. **33 of 46 actions need nothing at all**, so "reaches for nothing"
      is both the honest bucket and the biggest one — which is the real reason the
      old panel felt wrong, and the thing the new one has to design around.

### Resolved by the implementation

These were questions when the plan was written. The code now answers them, and each is
pinned by a test — so they are recorded, not open.

- [x] **Return-value rule.** Run in order; plain objects shallow-merge with last writer
      winning; a non-object return replaces the value outright. Phase 0 narrowed the
      question to **`projectile` alone** — the other six slots discard the return — so
      the rule is one small function, `mergeProcessValue`. A 1-action process behaves
      exactly as that action did before, which is what makes it backward-compatible.
- [x] **A failure does not stop the chain.** Each action is isolated and the rest still
      run; the error is reported through `onFailure` rather than thrown. Fail-fast would
      let one bad action silently disable everything after it. Only `projectile` *reads*
      a return, and a throw there reaches the panel rather than the game.
- [x] **A zero-action process is legal.** It compiles to a no-op that still satisfies
      the engine, so a process can be saved before its actions are chosen.
- [x] **The same action may appear twice**, with different options — "log, then convert"
      and "convert, then log" are different behaviours. Nothing sorts or deduplicates.

### Still open — these need a person, not a refactor

- [ ] **What are the 13 vacuous handlers, really?** They return a descriptor into a slot
      that throws it away. Either they move to the energy / excavation definitions as
      **presets** — most likely, since that is what a `{capacity: 1000}` or
      `{power: 10}` shape *is* — or they are deleted as unreachable. _Product call._
- [ ] **Rule on the 41 off-rule actions**, by class — see the action class section.
- [ ] **Confirm the 5 API-bound actions** against a namespace the engine really has.
- [ ] **Should `behavior` become a process too?** It is the last slot whose stored shape
      is not `actions`, and that asymmetry is the one thing left a reader would trip over.
- [ ] **In-game verification** — see Phase 7.




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

## Payload vs params — the bug this exposed

Measured across all six `resolveAnyHandler` sites in `apply.ts`, **the engine never
delivers parameters.** Every site hands the raw function over and binds nothing:

| call site | engine calls | action signature | params delivered? |
| --- | --- | --- | --- |
| `processing` | `process(structure, context)` | `(structure, context, options)` | **no** — 3rd arg never arrives |
| `signal` | `handler(structure)` | `(payload, extra)` | **no** |
| `trigger` | `callback()` | `(payload, extra)` | **no** — no args at all |
| `behavior` | `onDownKey(key)` | `(payload, extra)` | **no** |
| `itemAction` | `handleAction(state, action)` | `(item, extra)` | yes — `mysandkit` sets `out.options` |
| `projectile` | `getOptions()` | `() => options` | n/a |
| `upgrade` | — | — | **never wired at all** |

So the payload and the params come from **two different places and never met**. The
engine supplies the payload; the config supplies the params; nothing joined them.

Three live consequences:

- **`processorConvert` is a dead path.** Its `to` option is declared `required: true`,
  the panel forces the author to fill it in, and the engine never passes it — so it
  always takes its "nothing to convert to" branch and only logs. A required field,
  silently ignored. There is a test for both halves of this.
- **The `upgrade` slot resolves no handler at all.** `registerUpgrade` destructures
  `onUpgradeKey` out and never sets `onUpgrade`; a `handlerKey` passes through to the
  engine as a bare string. So 7 of the 43 actions are unreachable in-game.
- **Trigger callbacks receive nothing.** `registerTrigger` puts `extra` in the
  *registration* object, not the call — and several actions are written `(payload, extra)`.

`compileProcess` is the fix, and it is the only place a process exists at runtime: it
captures each action's options in a closure and passes them as the third argument.

## Phase 1 — types and naming

- [x] `HandlerActionFn` — the canonical `(payload, ctx, options)`
- [x] `HandlerProcessFn` — the compiled function the engine calls
- [x] `HandlerActionRef` = `{ key, options? }`
- [x] `CallSite` + labels + the engine's own signature for each
- [x] `resolveAction(key)` — typed miss instead of silent `undefined`
- [x] `compileProcess(refs, callSite)` — ordered, isolated, params bound
- [x] `actionRefsOf(entry)` — migrates `handlerKey` to a one-action process
- [x] `mergeProcessValue` folded into the runtime failure reporter (cosmetic)
- [x] Deprecate `AnyHandler` / `CodeHandler` / `ProcessHandler`, then delete — **done in
      Phase 5/6**: the three registries are typed `HandlerActionFn`, and
      `AnyHandler` / `ProcessHandler` / `InterceptHandler` / `ModifyHandler` are gone.
      `CodeHandler` remains, for the reason in its own doc comment.


## Phase 2 — the action catalogue

- [x] `api` on every entry — the **API axis**, derived from `ACTION_APIS`
- [x] `cls` on every entry — derived from `ACTION_CLASSES`, so it cannot drift
- [x] `type` marked `@deprecated`; kept only so the Handlers tab keeps working
      until Phase 6 regroups on `api` + `cls`
- [x] `resolveAction(key)` — reads all three registries, unwraps `CODE_HANDLERS`
- [x] `scanHandlerUsage` / `unreachableHandlers` / `usageIndex` read the action
      **list**, so a 3-action process yields 3 independently-checked usages
- [ ] **Rule on the 41 off-rule actions**, by class — see the action class section
- [ ] Confirm the 5 API-bound actions against a namespace that actually exists

## Phase 3 — the compiler

- [x] Ordered run, per-action `try/catch`, errors collected not thrown
- [x] Return-value merge per **Open decisions** — `mergeProcessValue`, and Phase 0
      narrowed it to `projectile`, the one slot that reads a return
- [x] Unknown action key: warns once, drops that action, keeps the rest

## Phase 4 — config schema

- [x] `actionList` field kind on both `FieldSpec` unions
      (`definition/types.ts` and `schema.ts` — they are **duplicated**, and a new
      kind in one is a type error in the other. Worth collapsing to one later.)
- [x] `actions-field.ts` — the one `actions` field all seven objects share:
      `parseActionRefs` / `formatActionRefs` / `actionRefsToForm` / `actionListField`
- [x] Read `handlerKey` as a one-action process (`actionRefsOf`), write `actions`
- [x] `ACTIONS_COVERED` owns **both** keys, so the passthrough cannot re-add
      `handlerKey` and leave a process holding both shapes at once
- [x] Round trip is exact: order, repeated actions, and per-action options
- [x] `definition-ownership.test.ts` — `actions-field` joins the shared-helper
      allowlist (it defines no object; `custom/` owns 2 of the 7 users) and
      `.test.ts` files are excluded
- [x] Wire the field into **all 7** definitions — signal, trigger, processing,
      projectile, upgrade, modifier, item
- [x] Consumable rule preserved: `writeActions(w, enabled)` **removes** the process
      for a Consumable rather than writing it, and switching back to a Tool restores it
- [x] Validation: an unknown action key, or an action the slot cannot serve, shown as a
      field error rather than only as a red outline

**All 7 tabs migrated.** No `handlerKey` / `getOptionsKey` / `onUpgradeKey` field is left
anywhere in `definition/core/`. Each tab declares an `actionList`, reads its process
(migrating whichever legacy key it used), and on save writes `actions` and deletes all
three legacy names.

Three things the last four tabs turned up:

- **Projectile's rule moved to the list.** `optionsJson` used to hide behind
  `getOptionsKey === ""`; it now hides behind `parseActionRefs(actionsJson).length === 0`,
  because an empty process and an absent one mean the same thing and a single key could
  not say that. Tested both ways.
- **Item's `when` moved with it, but its *save* rule could not.** The field still hides
  itself for a Consumable, yet the form keeps the value so switching back to a Tool
  restores it — so the rule is applied in `writeActions`, not in the field. That is the
  `enabled: false` parameter.
- **`upgrades` was still reading itself in `schema.ts`'s inline switch**, the last tab
  that had not been delegated. The write side read `actionsJson` that nothing had ever
  put there, so a migrated `onUpgradeKey` came back as an empty process. It now
  delegates like every other tab.

`actionRefsOf` and `writeActions` now handle all three legacy names uniformly, so no
caller needs to know which tab used which spelling. That let `scanHandlerUsage`'s
`getOptionsKey` fallback go — it had been double-counting projectile.

Tooling: `gen-reference`'s `COMPOSITE` maps `actionsJson → actions[]` on all 7 tabs;
`verify-definition`'s `KEYS_INSIDE_A_COMPOSED_CONTROL` learns `actions` and
`CLAIMED_TO_SUPPRESS` learns the three legacy names (claimed, no control, dropped on
purpose — exactly that set's meaning). Its signal, trigger, projectile, upgrade, modifier
and item probes now assert the migration rather than a passthrough.

**Runtime is still Phase 5.** `apply.ts` calls `resolveAnyHandler` at 7 sites and
`mysandkit.ts` at 1; the panel now stores `actions` and nothing reads it yet. Existing
configs keep working because `actionRefsOf` migrates on read.




## Phase 5 — registration

This is the step that makes the split real, and it had to land as **one change** with the
handler re-signing below — either half alone breaks the other.

- [x] `apply.ts`: processing, projectile, signal, trigger, behavior — all five now
      `compileProcess(actionRefsOf(entry), callSite)`
- [x] `mysandkit.ts`: **item** `handleAction`, **upgrade** `onUpgrade`
- [x] `resolveAnyHandler` count in both runtime files: **0**
- [x] The 15 `ANY_HANDLERS` that read options from argument 2 re-signed to
      `(payload, ctx, options)` — argument 3, where the compiler passes them
- [x] The 7 call sites each use the **call site** as the grouping axis
- [x] `processing.ts` definition: the picker became a list (Phase 4)

### What this actually fixed

- **`processorConvert` can convert.** The engine calls `process(structure, context)` —
  two arguments — so the old registration's third parameter was always `undefined`, and a
  field its own schema marks `required` was silently ignored. The compiler binds the
  options at build time.
- **The upgrade slot runs at all.** `registerUpgrade` destructured `onUpgradeKey` out and
  never set `onUpgrade`. `onUpgrade` is a real top-level field of `upgrades.register` and
  the engine reads it, so all 7 upgrade actions were unreachable while looking perfectly
  configured.
- **Trigger callbacks get their options.** The engine calls `callback()` with *no*
  arguments; `extra` was in the registration, not the call.
- **Signals and behaviors likewise** — one argument, and the second was always empty.

`resolveAnyHandler` survives, documented, because the catalog still publishes it. It
differs from `resolveAction` in one real way: it looks in `CODE_HANDLERS` **before**
`PROCESS_HANDLERS`, so a key in both would resolve to the modifier action.

## Phase 6 — UI

- [x] `actionList` widget — `src/ui/action-list-control.ts`, in the **generic chain**, not
      in each of the 7 definitions. `actionList` is a shared kind like `json`, so giving
      any object a process is one line rather than seven widgets.
- [x] `FieldContext.tab` — the call site is a property of the *object*, not the field, so
      the dropdown can offer only what that slot can run. Threaded through the one place a
      control is called rather than inferred.
- [x] Per row: slot-scoped dropdown, ↑ / ↓ / ✕, and the action's **own** parameters built
      from `HandlerMeta.params` — typed, so a number stays a number
- [x] An action the slot cannot serve is **kept and outlined red**, never dropped:
      silently deleting a row is how a process loses a step with nobody noticing
- [x] "Add" is a **select of the slot's vocabulary**, not a button that appends the first
      action — with no rows there are no per-row dropdowns, so a button would make
      availability invisible and the author would add a row to find out what they may add
- [x] Handlers tab now shows **both axes**, and stops grouping on `type`:
  - [x] **Actions** — one collapsible section per `api.*` namespace, then the
        no-api classes in ladder order (`context-bound`, `self-sufficient`, `pure` last,
        because it is nearly half the catalogue and is mostly scaffolding)
  - [x] **Processes in use** — grouped by call site, each entry's actions **numbered**,
        because order is the point. Entries with no process are left out
  - [x] `TYPE_ORDER` deleted; `HANDLER_TYPE_*` no longer imported by the tab
- [x] "Copy snippet" emits the **list** form — `{ actions: [{ key, options }] }`. It used to
      emit `{ handlerKey, scope, options }`, which none of the seven tabs reads any more:
      a snippet that pasted cleanly and then did nothing was worse than no snippet.
      Button renamed to "Copy as a process" so the shape is not a surprise.
- [x] Validation: `validateField` gained an `actionList` case, with **two different
      messages** — `unknown action: x` (a typo, or an action that was removed) and
      `cannot run here: x` (a real action in a slot it cannot serve). An outline is a
      hint; this is what blocks the save.
- [x] `TAB_TO_CALL_SITE` is **one exported table** in `handler-registry.ts`, used by the
      widget's dropdown *and* the validator. They must agree: if they did not, the
      picker would offer an action the save then rejected, which reads as the panel
      being broken rather than the config being wrong. A test pins both directions.
- [ ] `type` itself: **still load-bearing**, and now for a real reason rather than by
      oversight — the `behavior` / input-binding slot is the one that kept a bare key
      (a key binding is a function *pair* on one entry, with nowhere to put a list), and
      `input.ts`'s hints still describe it with `typesHintFor`. Deprecating it means
      rewriting that wording as well as 46 entries. Its own change, not this one's.
- [ ] Decide whether `behavior` should become a process too — it is the last slot
      whose stored shape is not `actions`, and the asymmetry is now the only thing left
      that a reader would trip over.





## Phase 7 — verify

Run on every change; last run all green.

- [x] `deno check src/main.ts`
- [x] `deno test -A --no-check src/` — 350
- [x] `deno test -A --no-check tools/` — 102
- [x] `deno run -A src/ui/test/schema_roundtrip.test.ts` — 606
- [x] `deno run -A tools/verify-definition.ts` — all 46
- [x] `deno task build:main`
- [ ] In-game: a 3-action process on a structure and one on an item — **needs the game**;
      stated as unverified rather than claimed. Specifically: does `processorConvert`
      actually commit now that its options arrive, and does an upgrade's `onUpgrade`
      fire at all? Those are the two bugs Phase 5 fixed and only the game can confirm.
