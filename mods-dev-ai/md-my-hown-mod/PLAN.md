# PLAN.md — Custom Processes: building a handler out of atomic handlers

## The goal

Today a "process" is an **array of atomic actions** typed into each object's definition — a
`[{ key, options }, …]` list duplicated in every signal, trigger and processor that wants the same
behaviour. There is no way to name that behaviour, edit it once, or reuse it.

This plan adds a **Custom Process**: a first-class, named, reusable handler that the author builds
by combining atomic handlers, and that any call site can then select like any other handler.

Two things make it more than a macro:

- **The process is bound to a scope.** A process declares which call site it is for (`signal`,
  `trigger`, `processing`, …). That choice is not decoration: it is what determines the _context_
  the process is handed, and it is checked at compile time rather than left to the panel.
- **The process carries a context.** A scope selection seeds that context with the attributes the
  engine really delivers at that site. Actions then **add** to it, and later steps **read** it — so
  `isElementAtCell` can answer into a variable that a later `toast` quotes.

---

## What already exists (do not rebuild)

| Piece                               | Where                                                           | Status                      |
| ----------------------------------- | --------------------------------------------------------------- | --------------------------- |
| Six roles, 36 atomic actions        | `src/handler/actions/{sense,decide,act,remember,feel,connect}/` | done                        |
| Call-site + signature axes          | `src/handler/core/types.ts`                                     | done                        |
| `compileProcess(refs, callSite)`    | `src/handler/core/process.ts`                                   | done, **not context-aware** |
| Usage scans                         | `src/handler/core/handler-registry.ts`                          | done                        |
| Two "builds a value" features       | `projectile-option/`, `excavation-option/`                      | done                        |
| Role/section rendering in the panel | `src/ui/panel/handlers.ts`                                      | done                        |

## What does not exist

- Any `vars` / process context. `grep -rn vars src/handler/actions/` returns **one hit, in a doc
  comment**. The context is specified in `HandlerAction.md` and implemented nowhere. It is the
  foundation this whole plan needs.
- Any custom-process object, store, tab, definition, or compiler.
- Any runtime for a `{{variable}}` reference in an action's params.

---

## Design decisions, and why

### D1 — A custom process is a **mod-side object, inlined** — not a new engine registration

The engine's `.d.ts` has no `registerCustomHandlerProcess`. The only `register*` surfaces are for
elements, items, projectiles, terrains, upgrades, recipes, contacts, triggers, signals, processing,
tech nodes, and excavation profiles.

So a custom process is stored in the mod's own config and **resolved by `compileProcess`**, which
already takes `(refs, callSite)`. Making `resolveAction(key)` aware of custom processes is enough to
get reuse, and it means `{ key: "myProcess" }` is indistinguishable from
`{ key: "processorConvert" }` at every existing call site. No call site needs to learn a second
shape.

_Consequence:_ a process is a **macro with a scope check**, not a new engine object. That is the
honest description and it is what gets built.

### D2 — The context is a `Record<string, unknown>` created per invocation

One context object per run, threaded through the steps. Not a closure variable, so a compiled
process stays a single reusable function and two concurrent structures cannot see each other's
variables.

### D3 — Scope seeds the context; actions extend it; **seeds are read-only**

A scope-derived value (`structure.x`, `commit`) is seeded once and cannot be overwritten by a step,
because overwriting `commit` would let an `act` step replace the engine's own write path. Author
variables live in a separate namespace and are writable.

### D4 — `{{name}}` references resolve against the context, and **an unknown one is an error**

Not an empty string. A typo'd reference silently becoming `""` is the same class of bug as the
`pwoer: 40` parameter `withParams` already refuses to accept — and here it is worse, because the
value is not dropped, it is _sent_ to the engine. A missing reference is reported at the point of
use.

### D5 — A definition stores a **reference**, so editing one process updates every use

**Settled by the author.** A definition holds `processId: "sort-by-density"`, never a copy of the
steps. Editing the process changes every call site at once, and that is the _point_ rather than a
hazard — a duplicated array is precisely the thing this feature exists to delete. The panel's job is
to make the blast radius visible: the process screen shows `used ×N` prominently, and a definition
that names a process says which one.

### D6 — The `actions` array is **legacy, and is being removed**

**Settled by the author.** Today a definition stores `actions: [{ key, options }]`. After this, a
definition stores **only** a process reference, and the array is read for backward compatibility but
written by nothing.

The migration is a **read-old, write-new** one, in the config loader's normalize step:

- an entry with `actions: [...]` and no `processId` gets a **derived** process (`<entryId>#process`)
  whose steps are exactly that array, and the entry is rewritten to reference it;
- the derived process is marked `derived: true`, so the panel says "this was converted from an
  action list" and offers to give it a name;
- an author's own named process is never touched, and two entries never share a derived one.

This is the only destructive step in the whole feature, so it is deliberately the **last** phase:
the object, the compiler, the resolver and the new tab all land first, and the array is only
withdrawn once there is something to withdraw _to_.

### D7 — `actionRefsOf` is retired, not deleted

It stays as the legacy reader the migration needs, exported with a comment saying it reads a shape
nothing writes any more. Six definitions, one register path and the reachability scan all move off
it in Phase 6.

---

## Phase 1 — The process context (foundation) ✅ done

> **Four findings while building this phase**, recorded because each changed the design:
>
> 1. **The seeds are read outside the step isolation.** `compileProcess` creates the context
>    _before_ the loop, so a property read of the engine's payload that threw would escape the
>    per-step `try` and kill a game tick. The pre-existing "one action throwing does not stop the
>    ones after it" test caught it, using a `Proxy` whose every read throws. `seedsFor` now reads
>    defensively (`safeRead`).
> 2. **A role folder may hold two signatures.** `sense/` was payload-only, so a `context-bound`
>    action filed there measured as `self-sufficient` — the probe read its context argument as the
>    _options_ bag. `act/` and `remember/` already exported both; `sense/` now exports
>    `processingSenseActions` too, which is the role/signature independence working in practice
>    rather than only in the type.
> 3. **`vars` returning into a void slot is no longer automatically a defect.** The test "no call
>    site is left where a returned value survives" was inverted to "nothing at all returns into a
>    void slot", which is now **false on purpose**. A named `CONTEXT_READABLE` set replaces the
>    universal claim, because whether a return is used is a property of the process, not of the
>    action.
> 4. **Reserved is checked before shape.** `structure.x` is both a seed _and_ an invalid identifier;
>    reporting it as a shape error would send the author hunting a typo in a name that is in fact
>    correct — it is the _engine's_ name.

- [x] `src/handler/core/context.ts` — the runtime `ProcessContext` type, with a `readonly` seed map
      and a writable author map, plus `ref(name)` resolution.
- [x] `src/handler/core/scope-context.ts` — **the scope → context attributes table.** For each of
      the seven call sites, the attributes the engine _really_ delivers, taken from the `.d.ts` and
      not guessed: - `processing` → `structure.x`, `structure.y`, `structure.type`,
      `structure.data`, `context.getResolvedTypeAtCell`, `context.isCellEmptyAtCell`,
      `context.commit` - `signal` → `structure.x`, `structure.y`, `structure.type`, `structure.data`
      - `trigger` → `tick` (the callback takes no arguments — see `MainTriggerDefinition`) -
      `itemAction` → `state.x`, `state.y`, `action.type` - `modifier` → `args`, `ctx` - `upgrade` →
      `item.type` - `behavior` → `key`
- [x] A test asserting every seed attribute is one the engine genuinely passes at that site — a
      table that drifts from the engine is worse than no table.
- [x] `ROLE_IO` in `types.ts` is already written against `vars` / `proceed` / `pending`. This phase
      makes those three names real.
- [x] Thread the context through `compileProcess` as an internal third argument, so **every existing
      action keeps working unchanged** (it ignores the extra arg).

## Phase 2 — Variables: reading, writing, and referencing

- [x] `varsWrite` / `varsRead` primitives in the context module, exposed as the `sense` action
      `isElementAtCell` (the example from the brief: a cell probe that answers **into** the
      context).
- [x] `resolveRefs(value, context)` — resolve `{{name}}` inside action params: whole-string,
      embedded in text, and inside arrays. Type-preserving when the whole string is a single
      reference (`"{{count}}"` → the number, not `"3"`).
- [ ] A `ref` _kind_ on `HandlerParam` so the panel renders a variable **picker** rather than a text
      box for params the author wants to wire up.
- [x] Tests: unknown reference is an error, not an empty string; read-only seeds refuse a write; a
      value survives to the next step.

## Phase 3 — The CustomProcess object

- [x] `src/handler/custom-process/types.ts` — `CustomProcessConfig`:
      `{ id, name, scope, steps, doc? }`, where a step is `{ key, options?, as? }` and `as` names
      the variable the step writes.
- [x] `CustomProcessConfig` added to `ModConfig` in `src/constants.ts`, defaulted in the `store.ts`
      loader, with `addOrUpdate` / `remove` following the existing `addOrUpdateExcavationProfile`
      shape.
- [x] `src/handler/custom-process/registry.ts` — index of the author's processes by id, plus a
      reverse usage scan (which call sites use this process) so the panel can say `used ×3` and flag
      an unused one.
- [x] `src/handler/custom-process/compile.ts` — `compileCustomProcess`. **Recursive by design**: a
      step may name another custom process, depth-limited, with a cycle detected and reported rather
      than hanging the game.
- [x] A test that a process is usable from a call site, that a process declaring the wrong scope is
      refused there, and that a cycle is reported.

## Phase 4 — Registration ✅ done

> **One plan item was replaced by a better shape.** The plan said `resolveAction` should consult the
> process registry. It should not: `handler-registry → process →
> actions` is an existing import
> chain, so an `actions → custom-process →
> handler-registry` edge would close a cycle.
> `resolveAction` stays **pure**, and `compileCustomProcess` takes the registry as a **parameter**.
> Reuse is unaffected — `{ processId }` works at every call site — and the compiler is now testable
> with three hand-made processes and no config at all.

- [x] `compileEntryProcess` in `custom-process/entry.ts` — the single path, and the only reader of a
      legacy `actions` array. Wired into `the-rest.ts` (processing, signal, trigger) and
      `mysandkit.ts` (itemAction, upgrade).
- [x] The scope check, in `processProblem` — reported by `validateField` at save time _and_ by the
      `processRef` control while the author is still choosing.
- [x] `scanProcessUsage` + `processUsageCounts` in `custom-process/registry.ts`.
- [x] `setProcessRegistry` / `currentProcessRegistry` — a boot-installed holder, because
      `mysandkit.ts` mirrors the engine's own `registerItem(def)` signature and cannot take a
      registry argument.
- [x] A source-level test that no registration site reads `actionRefsOf` directly.

## Phase 5 — The panel: the new tab ✅ done

- [x] New `customProcess` **Tab** in `src/ui/schema.ts` + `definition/types.ts` (they must stay in
      sync — a test enforces it), a `CATEGORY_META` entry, and the `handlers` menu group. Filed in
      `custom/` because the engine has no `register()` for a process — the same reason `networks`
      and `unlockNodes` are there, and the ownership test now says so.
- [x] `src/ui/definition/custom/process.ts` — `idField`, `name`, the **scope selector** (each option
      labelled with the engine signature it binds to), `doc`, the program grid, and a hidden
      validated `steps` json field.
- [x] `src/ui/process-ref-control.ts` — the picker that replaced `actionList` on all six
      definitions. Filtered by slot; shows `used ×N`, the scope, the step count, and a legacy marker
      for an entry still holding an array.
- [x] `src/ui/program-grid-control.ts` — the grid, in the three parts the brief asked for: 1.
      **Scope selector** — on the definition, labelled `Structure click — handler(structure)`. 2.
      **Context attribute list** — `deriveContext(scope, steps)`, re-derived on every render. Seeds
      first (marked read-only), then variables, each showing which step writes it and which read it.
      A name that is _referenced but never bound_ is listed too — which is the whole reason the list
      is derived rather than maintained. 3. **Program grid** — ordered rows: an action picker
      grouped by role and filtered by slot, with the author's other processes in their own group;
      that action's declared params; and the `as` box.
- [x] All editing state is the form's own json field, re-parsed per keystroke — so what the author
      sees and what would be saved are the same value by construction.
- [x] `removeCustomProcess` un-references the process from every definition, rather than leaving a
      definition that silently stops working.

## Phase 5b — The migration: withdraw the `actions` array (D6, D7) ✅ done

- [x] `processRefOf(entry)` — `{ kind: "process", id }`, `{ kind: "legacy", refs }`, or
      `{ kind: "none" }`. One reader, so no caller has to know the legacy shape exists.
- [x] `migrateLegacyActions` in `config/store.ts`, run on **load**. Three rules: only an entry with
      no `processId`; only a non-empty array; one derived process per entry, never shared.
      Copy-on-write, so the caller's config is not mutated.
- [x] Idempotence, no-clobber, and no-shared-derived — each with a test.
- [x] `processRefField()` replaces `actionList` on all six definitions; `formCovered` swaps
      `ACTIONS_COVERED` for the ref's own key.
- [x] `actionRefsOf` kept, re-labelled as the legacy reader. Nothing writes it.
- [x] `schema_roundtrip`: the stored output contains `processId` and not `actions`.

## Phase 6 — Tests

- [x] `context.test.ts` — seeds, writes, reads, read-only refusal, `{{}}` resolution, type
      preservation, unknown-reference errors.
- [x] `custom-process.test.ts` — compile, nesting, cycle detection, scope refusal, usage scan. **16
      tests**, including that a diamond is not a cycle and that a nested process shares the parent's
      context.
- [x] `process-migration.test.ts` — idempotence, no-clobber, no-shared-derived, and that the
      migration does not mutate the config it was given. **13 tests.**
- [ ] Panel tests: the scope selector offers exactly the seven sites; the context list is derived
      from the steps; a variable written by step 2 is offered as a picker to step 3.
      (`deriveContext` and `stepChoices` are already exported for this.)
- [ ] `schema_roundtrip` — a custom process survives save → load → save unchanged, and the other 456
      tests still pass.

## Phase 7 — Documentation

- [ ] `HandlerAction.md` — the count changes again (36 atomic actions **plus** N user processes), so
      reconcile it with the measured numbers rather than editing the prose by hand.
- [ ] A worked example in the docs, using the brief's own example end to end: select `processing` →
      the context seeds `structure.x` / `structure.y` → `isElementAtCell` writes `isWater` → a later
      step reads `{{isWater}}`.
- [ ] The `vars` / `proceed` / `pending` section stops being aspirational and describes what the
      runtime does.

---

## Explicitly out of scope

- **Not** a new engine registration (D1). There is no engine hook to add one to.
- **Not** conditional branching. `proceed` is in `ROLE_IO` and stays a documented stub until a
  decision is made about what a false answer skips; inventing a mini-language here would be the
  wrong first cut.
- **Not** calling a custom process from inside another _action_ — only from inside another process's
  step list, which is the same recursion `compileProcess` already has.

## Open questions for the author

1. **Should a custom process be editable while in use?** Editing one changes every call site at
   once. Options: allow it (simple, but a late edit can break five signals at the same time), or
   warn and show `used ×N` before saving. _Leaning toward: allow, but surface `used ×N` prominently
   on the screen._
2. **Can a process be attached to an object that already has an `actions` array?** The brief
   suggests replacing the array. Options: a process entry and an actions array are mutually
   exclusive on one object (simple, but a migration), or a process is just another entry in the
   array (no migration, but the "reuse" story is weaker). _Leaning toward: mutually exclusive, with
   the array hidden once a process is chosen — the same rule the `projectileOption` field already
   uses._
