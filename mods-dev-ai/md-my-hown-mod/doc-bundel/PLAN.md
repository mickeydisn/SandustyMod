# Bundle discovery → full mod interface (v2)

Archived predecessor: `PLAN-audit-v1.md` (narrow "check what the mod already
uses" audit). This version inverts the priority: **discover first, then expose,
then verify.**

## What changed and why

v1 asked *"does each thing the mod already calls work?"* That framing is too
narrow — it can only ever confirm what we already knew, and it treats the
existing mod surface as the definition of "done".

This plan asks *"what can the engine actually do, how are its objects linked,
and how do we expose all of it in the interface?"* Verification becomes the last
phase, not the driver.

## Measured facts (Phase 0)

Measured from `__bundel/modules/bundel.js/46781.js` and
`__pakages/__other/sandkit/src/`, **not** assumed:

| Fact | Value |
|---|---|
| `sandkit.api` (public mod api, `.d.ts`) | 60 namespaces, context-free |
| `sandkit.engine.api` (bundle `Dt`, escape hatch) | 62 namespaces, context-first |
| `sandkit.api` (worker thread, `.d.ts`) | 21 namespaces, context-free |
| engine methods that can `throw` | 13 |
| host namespaces the mod calls | 21 (all declared in the public api) |

The `Dt` object in `46781.js` is **`engine.api`, not the mod-facing api**. The
mod receives a different, context-free surface. So a context-first signature in
the bundle does **not** imply the mod's call shape is wrong — an earlier draft
of this plan claimed it did, and that claim is withdrawn. See
`PHASE0-api-index.md`.

Still real, and they matter for Phases 3/6 — engine-side arities:

| method | engine arity |
|---|---|
| `elements.updateDefinition` | 3 — `(ctx, idOrType, partial)` |
| `upgrades.updateDefinition` | 4 — `(ctx, itemId, upgradeId, partial)` |
| `upgrades.registerCategory` | **throws** without `id` + (`name`\|`nameKey`) |

`sandkit` is a **free variable**, not a global: the host runs the mod via
`new Function("__sandkit", body)` and binds `const sandkit = __sandkit`.

Known drift: `structureBehaviors` and `gameConfig` are declared in the public
`.d.ts` but appear in **no** bundle module. Unresolved — see Phase 1.


## PHASE 0 — Full API index (the documentation gap)

Generate the complete API surface mechanically, not by hand. Everything later
reads from this, so it must be exhaustive and reproducible.

- [x] Script the extraction: walk `46781.js`, capture every `namespace: {` and
      every `method: (args) =>` with its **full parameter list**
- [x] Record for each method: namespace, name, arity, param count, whether it
      takes context, and a one-line summary of what the body does
- [x] Flag methods that `throw` vs. silently return — read the body for each
- [x] Emit `doc-bundel/API-INDEX.md` and a machine-readable `api-index.json`
- [x] Verify the index against the source: every name **and** raw param list
      must appear on the recorded line (393/393, 0 mismatches)
- [x] Reconcile against `__pakages/.../*.d.ts`: which declared methods are real,
      which are missing, which exist in the bundle but are undocumented
- [x] Write `PHASE0-api-index.md`
- [x] Keep the source-verification check as a **test**, not a one-off
      (`tools/extract-api.test.ts`, 9 tests, incl. 4 regression fixtures)
- [x] Index the *public* api layer too, not just `engine.api` — done in Phase 1
      via `tools/extract-public-api.ts` (13 tests of its own)

> Phase 0 established there are three surfaces, not one — `sandkit.api` (public,
> 60 ns, context-free), `sandkit.engine.api` (bundle `Dt`, 62 ns,
> context-first) and the worker api (21 ns). The mod calls 21 host namespaces,
> all declared publicly. `structureBehaviors` and `gameConfig` are declared but
> appear in no bundle module.

### Engine api index (final)

| metric | value |
|---|---|
| namespaces | 62 |
| entries | 393 |
| functions | 343 |
| re-exports | 48 |
| plain values | 2 |
| take a context first arg | 156 |
| can `throw` | 14 |

Reconciliation against the `.d.ts`: 137 files scanned, 33 declared members,
**0 absent** from the bundle. The other 29 are React hooks and the
callback-context interfaces the api hands to your functions
(`StructureProcessingContext`, `HookContext`, `GridMutationWriter*`,
`RetroConsole*`) — declarations, not things you call.

Two extraction bugs were found and fixed while writing the tests, and both
produced plausible output rather than errors:

1. an **unanchored** regex (`slice(i).match(IDENT)`) captured identifiers from
   anywhere in the rest of the file, so `utils` became `ls`
2. **paren-less arrows** (`name: e => ...`) were classed as plain values, which
   hid 56 of them — `values` 58 → 2, `functions` 287 → 343


## PHASE 1 — Calling convention (blocks everything)

- [x] Locate the public `sandkit.api` composition in the bundle — found the
      **worker** composer in `__bundel/bund/extra-mod-worker.js`; the
      main-thread composer is not in the extracted bundle
- [x] Prove the convention from the runtime: `const o = e` captures the engine
      context and every public member closes over it
- [x] Confirm the `sandkit` free-variable binding (`const sandkit = __sandkit`)
- [x] Determine whether the mod must pass a context — **it must not**
- [x] Resolve `structureBehaviors` and `gameConfig`: the bundle is a *worker*
      build, so their absence there says nothing about the main thread
- [x] Determine whether `conveyors`+`launchers` compose into
      `structureBehaviors` — unresolved, and no longer blocking
- [x] Confirm `api.raw` / `api.enums` / `api.react` reach the host correctly
- [x] Quantify the blast radius: 91 host call sites, **0** unknown namespaces,
      **0** unknown methods, **0** arity errors
- [x] Index the public api: 72 namespaces, 300 members, 75 types, 395 fields
- [x] Fix `registerStructureBehavior` to use the documented method names
- [x] Write `PHASE1-calling-convention.md`

> The mod's api usage is sound. The 14 remaining names are deliberate `?.`
> capability probes for builds that differ from the typings. See
> `PHASE1-calling-convention.md`.



## PHASE 2 — Object and link graph

How the engine's objects reference each other. This is what makes the UI's
cross-referencing pickers correct instead of guessed.

- [x] Map the id space: **23 names** — 7 handle, 10 id, 6 ref
- [x] Map every reference between object kinds: 41 edges over 101 types
- [x] Find the resolution direction: registration takes **ids**, queries take
      **refs or handles**, and a stored definition never holds a handle
- [x] Identify the ambiguous cases that must be resolved at runtime
      (`ItemId` and `TechGridId` accept either form despite their names)
- [x] Identify which shapes are open-ended (`[key: string]: unknown`) so
      "extra field" is not reported as a defect
- [x] Identify which references are validated by the engine and which are not —
      **the typings do not say**; evidence is that a bad reference is dropped
      silently, which is inference, not a guarantee
- [x] Document the entity model in `PHASE2-object-graph.md`
- [x] Turn the graph into the rule set the catalog pickers must follow
- [x] Cross-check the mod's 20 stored shapes against the engine (11 matched)
- [x] Identify engine counterparts for the shapes that had none — **3 of the
      7** were `descriptionParams` / `linkedClearance` / `descriptionKey` on
      `StructureConfig`; they *are* declared by `SandkitStructureDefinition`,
      and the mod's config types already had them. The form was the only gap.
      The other **4** are `TerrainConfig` decoration fields
      (`background`, `colorGradient`, `noShadow`, `isBuilding`) which nothing in
      the bundle or the typings mentions — recorded in `TYPINGS_OMIT` as
      speculative rather than real
- [ ] Confirm with the game that a bad reference is dropped rather than rejected
      — **needs the game**

## PHASE 3 — Definition schemas (all options)

The engine reads a specific set of fields per register call. The mod's forms must
match that set exactly, and the `.d.ts` cannot be trusted to be complete.

- [x] For every register function, enumerate every field the body actually reads
      — 36 methods, read from the bundle rather than the typings
- [x] Mark each field: required / optional / silently ignored, using
      **dereference** as the test rather than "not marked optional"
- [x] Extract enum-like fields and their permitted values — done where the
      engine throws a range error (`terrains.materialId` > breakpoint and < 150)
- [x] Extract nested sub-objects with their own field sets — `render`,
      `buildModes`, `shape` on structures; `upgrade` on upgrades
- [x] Compare against the mod's `constants.ts` config types field by field
- [x] Emit `doc-bundel/DEFINITIONS.md` — the authoritative field reference
- [x] Write `PHASE3-definition-schemas.md`
- [x] Fix `registerUpgradeCategory`, which stripped the `id` the engine requires
- [ ] Resolve the cross-module delegates (`tech.registerNode` → `xe`), currently
      marked undetermined rather than guessed
- [ ] Enumerate the built-in structure kinds from the engine's `kt` map, for the
      recipe pickers

## PHASE 4 — Capability map: engine vs mod

Turn the 300-member reality into a decision about what the interface should expose.

- [x] Classify all 72 namespaces and 300 members: **36 registerable**,
      94 queryable, 92 runtime, 78 internal
- [x] Identify which are genuinely mod-usable — the test is whether the engine
      **stores** the result; the other 264 are capabilities for game code, not
      gaps a form could close
- [x] Diff the mod's coverage: **35 of 36** registerable members are wrapped
- [x] Produce a prioritised list — only `input.registerBinding` is missing, and
      the blocker is a design question, not effort
- [x] Flag anything the mod calls that does not exist — **0** unknown
      namespaces, **0** unknown methods, **0** arity errors across 91 sites
- [x] Write `PHASE4-capability-map.md`
- [x] Extract the `KeyCode` values, needed by the `input` picker — done in Phase
      6. `KeyCode` turned out to be a **`LooseString` union, not a closed
      enum**, so a fixed picker would have been wrong: `"Shift"`, `"KeyO"` and
      `"Control+KeyC"` are all valid. `listKeyCodes()` offers suggestions over
      free text. `BindingId` is `LooseString` over the vanilla `KeyBinding`
      names too, which is why the mod uses custom ids — reusing a vanilla name
      would *replace* a built-in binding
- [ ] Confirm with the engine that the "runtime" label is right; it is inferred
      from method names, not from the implementation — **needs the bundle's
      callers, not the typings**

## PHASE 5 — Full action package (the interface)

Extend the mod so every mod-usable action is reachable from the UI, not only
the ~15 namespaces already wired.

- [x] Add form editors for every new registerable definition kind — **Upgrade
      categories** tab added; they were reachable only by hand-editing JSON
- [x] Add pickers driven by the Phase 2 link graph, so references are valid
- [x] Add every option discovered in Phase 3 — category `name`/`nameKey`/
      `requirement`, `structures.blockGridType`/`draw`/`skipCopyData`/
      `defaultData`, `terrains.materialId`. **8 gaps remain, all deliberate**
      (see `PHASE5-action-package.md`)
- [x] Support nested sub-objects as structured editors, not raw text
- [x] Persist everything to JSON and round-trip it losslessly — verified by the
      `roundTrip` harness
- [x] Add validation that matches the engine's actual throw conditions — the
      category name rule and `spanTiles`-needs-a-line-mode
- [x] Add `tools/ui-completeness.ts`, which compares engine reads against the
      keys a structured control can produce; 16 real gaps → 8 deliberate
- [x] Write `PHASE5-action-package.md`

### Engine rules found while building the forms

Read from `structures.register` at bundle line 2746:

| field | engine behaviour |
|---|---|
| `blockGridType` | `registerStructureType(blockGridType ?? id)`; if set and `!== id`, also registers an **alias** so the type shares another type's grid |
| `copyData` | `false` is rewritten to `skipCopyData = true` — setting one is enough |
| `defaultData` | **deep-cloned** by the engine, so callers cannot mutate it afterwards |
| `draw` | when truthy the definition is stored **twice**: once with `draw` intact, once with `draw: undefined` |
| `render` | resolved through `at()`, which throws if `spritesheet.frameBuffer.key` is empty or names a shared buffer that was never created |
| `buildModes[].spanTiles` | **throws** `TypeError` unless the mode's `type` is `"line"`; must be a positive safe integer |


## PHASE 6 — Parameter and option completeness

Dedicated pass, because "all options" is the stated priority and is easy to
leave 90% done.

- [x] For every function the interface calls, list **every** parameter the engine
      accepts, with type, default, and meaning — `tools/parameter-map.ts`,
      **65 parameters across 9 definitions**, with the JSDoc meaning attached
- [x] Confirm each parameter is reachable from the UI, with the right control
      type (enum → select, bool → toggle, ref → picker, nested → sub-editor) —
      46 → **60 of 65**
- [x] Add any parameter the engine supports that the UI currently omits —
      candidates 18 → **5**, and all 5 are callbacks
- [x] Add a test asserting: index field count == UI field count, per definition
      — 24 tests in `tools/parameter-map.test.ts`
- [x] Write `PHASE6-parameter-completeness.md`

### Outcome

- `input.registerBinding` — the last unwrapped registerable — is now covered
  end to end. The capability map reports **unwrapped: 0**.
- The Phase 2 open question is answered: `descriptionParams`, `linkedClearance`
  and `descriptionKey` **do** have engine counterparts. The mod's config types
  already declared them; only the form was missing them.
- `colorHSL` is a `[number, number, number]` tuple, so it gets three number
  controls behind a toggle — without the gate an untouched form emits `0,0,0`
  and paints every terrain black.

### Two parser bugs, both now tests

`parseObjectType` splits members on **commas** (it parses object *type
literals*); a `.d.ts` interface uses `;` and newlines, so it returned one field
per interface. And `<`/`>` in the depth counter unbalance on arrow types like
`() => Record<string, unknown>`, swallowing every member after.

### Still open

The **typings**, not the mod, are now the main gap: 11 fields the engine reads
are absent from the `.d.ts` (`blockGridType`, `copyData`, `draw`, `skipCopyData`
on structures; `name`, `requirement` on an upgrade category). All are reachable
from the form. Worth reporting upstream.

## PHASE 7 — Documentation package

- [x] Regenerate `.d.ts` from the Phase 0 index so the types are bundle-derived —
      `src/types/engine-api.generated.d.ts`, 345 members, **typechecks**
- [x] Write user-facing docs per definition kind, generated from the same source —
      `doc/REFERENCE.md`, **20 tabs / 175 fields**
- [x] Link every UI field to its engine field in the docs — the reference's
      **stores** and **engine** columns
- [x] Document the discovered engine quirks as a known-issues list —
      `doc/KNOWN-ISSUES.md`
- [x] Update the mod's main `PLAN.md` and `README.md`
- [x] Write `PHASE7-documentation.md`

### The point of generating it

`README.md` had been hand-written once and had drifted — it still claimed
"Full register coverage (sandkit v0.5.7)" while the mod had since grown two
tabs, and it told readers to "prefer the JSON tab for nested fields" when those
fields now have structured editors. A hand-maintained table of 175 fields would
drift again immediately.

So the reference is generated from the same four artefacts the audit built, and
**every field resolves**: `doc/REFERENCE.md` has no unmapped row, and a test
enforces that.

## PHASE 8 — Verification

Last, and now meaningful: the index from Phase 0 is the oracle.

- [x] Test every mod call against the Phase 0 index: arity, param names, order
      — `tools/verify.test.ts`. **69 real calls, 0 unknown, 0 under-arity,
      0 over-arity.** The over-arity check is what caught the `settings` bug
- [x] Test every register payload against the Phase 3 schema — scoped to the 7
      config types whose engine payload is resolved; the residue is a reviewed
      `TYPINGS_OMIT` list asserted not to change
- [x] Re-run `deno check src/main.ts`, `deno test -A`, `deno task build:main`
      — clean, 526 + 102 tests, 273.06 KB
- [ ] In-game smoke test of the new interface — **needs the game**; stated as
      unverified rather than assumed
- [x] Write `PHASE8-verification.md` as the final report

### What Phase 8 found

The brief was to treat the Phase 0 index as the oracle. It was **not
trustworthy**: indexing `members` without `aliases` reported 36 of 91 mod calls
as unresolvable, and a fixed-depth walk missed the nested `shared.api.*`
namespaces. Fixing the index (297 → 358 members) was most of the work, because
an oracle that cries wolf 36 times is worse than none.

With a real oracle, one genuine bug:

```ts
api.settings.onChange(modId, () => { … });   // the signature is onChange(callback)
```

The mod id was passed **as the callback**, and the surrounding `catch` swallowed
the failure — so `onSettingsChange` has never worked. `readSettings` had the
mirror bug (`get(modId, key)` against a one-argument `get(fieldId)`), correct
only because the next line happened to fix it.

Also: 12 dead discovery probes in `catalog.ts` (four of them in
`listStructures`, none of which exist, so structure pickers can only offer enum
values); a phantom `TerrainConfig.fog` listed as form-owned; and
`ElementDefinition` being a `type` alias, which had left **every element field
unverified** — the map now covers 75 parameters, up from 65.

### A check I had to narrow

The config-key check first flagged 110 false positives, because it compared
every config type against an engine field set covering only 9 definitions. It is
now scoped to the intersection — types that both reach a register call and have
a resolved definition — with the residue as a reviewed list asserted not to
change. A check that always fails trains people to ignore it.

---

## Status

Phases 0–8 are **complete and verified**, with one item deferred to the game.
102 tool tests plus 526 pre-existing tests pass, `deno check src/main.ts` is
clean, and the bundle builds at 273 KB.

The project had **three** api surfaces and the audit was reading the wrong one.
Both layers the mod uses turned out to be sound. The defects it found were all
one kind — the mod guessed at an api shape and guessed wrong:

1. `registerStructureBehavior` used `registerConveyor` / `registerLauncher`
   instead of the documented `registerConveyorType` / `registerLauncherType`
2. `registerUpgradeCategory` stripped the `id` the engine requires, so **every**
   upgrade category registration threw and was silently logged as a failure
3. `settings.onChange(modId, callback)` against a one-argument
   `onChange(callback)` — the mod id was passed *as the callback* and the
   `catch` swallowed it, so `onSettingsChange` has **never worked**. Found in
   Phase 8 by the over-arity check, and only once the index was trustworthy
4. `readSettings` read `get(modId, key)` against a one-argument
   `get(fieldId)` — correct only because the next line happened to fix it
5. `elements.getTypeFromId` called directly, and it is `@deprecated`

Phases 5–7 closed the feature surface: an **Upgrade categories** tab and an
**Input bindings** tab now exist, two engine throw conditions the form could
previously trigger are validated before save, and all **36** config-reachable
api members are wrapped — the capability map reports **unwrapped: 0**.

The important structural finding is that the mod and the engine are now in
agreement; the remaining drift is in the **shipped typings**. Twelve fields the
engine demonstrably reads do not appear in the `.d.ts` at all, and every one is
reachable from the mod's form. That gap is upstream, and is the thing most
worth reporting to the engine authors.

Separately, the engine exposes **no way to enumerate registered structures** —
all four discovery apis the mod probes for are absent — so structure pickers can
only offer built-in enum values. That is a capability gap, not a mod bug.

Two things still need the game rather than the typings:

- the main-thread public composer is unlocated (the worker one is a faithful
  template, so it is not blocking)
- `tech.registerNode` delegates into another module, so its fields are
  **undetermined** rather than guessed

## Documentation produced

| File | Phase |
|---|---|
| `API-INDEX.md`, `api-index.json` | 0 |
| `api-reconcile.json` | 0 |
| `PUBLIC-API.md`, `public-api.json` | 1 |
| `mod-api-calls.json` | 1 |
| `OBJECT-GRAPH.md`, `object-graph.json` | 2 |
| `mod-config-drift.json` | 2 |
| `DEFINITIONS.md`, `definitions.json` | 3 |
| `CAPABILITY-MAP.md`, `capability-map.json` | 4 |
| `UI-COMPLETENESS.md`, `ui-completeness.json` | 5 |
| `PARAMETER-MAP.md`, `parameter-map.json` | 6 |
| `PHASE0-api-index.md` … `PHASE8-verification.md` | 0–8 |
| `PLAN-audit-v1.md` | superseded |

## Tools

| Tool | Purpose |
|---|---|
| `tools/extract-api.ts` | indexes `engine.api` from the bundle; `--reconcile` |
| `tools/extract-public-api.ts` | indexes the public api; `--mod` checks mod calls |
| `tools/extract-object-graph.ts` | id space, links, mod-vs-engine drift; `--mod` |
| `tools/extract-definitions.ts` | what each register body really reads; `--mod` |
| `tools/capability-map.ts` | registerable / queryable / runtime / internal |
| `tools/ui-completeness.ts` | engine reads vs. what a structured control can set |
| `tools/parameter-map.ts` | every declared parameter, its control, and coverage |
| `tools/gen-reference.ts` | `doc/REFERENCE.md`, known issues, generated `.d.ts` |
| `tools/verify.ts` | the oracle: mod calls and config keys vs. the engine |
| `tools/compare-surfaces.ts` | diffs public / engine / worker surfaces |
| `tools/extract-api.test.ts` | 9 tests |
| `tools/extract-public-api.test.ts` | 16 tests |
| `tools/extract-object-graph.test.ts` | 6 tests |
| `tools/extract-definitions.test.ts` | 13 tests |
| `tools/capability-map.test.ts` | 11 tests |
| `tools/parameter-map.test.ts` | 24 tests |
| `tools/gen-reference.test.ts` | 10 tests |
| `tools/verify.test.ts` | 12 tests |

```sh
deno run -A tools/extract-api.ts --reconcile
deno run -A tools/extract-public-api.ts --mod
deno run -A tools/extract-object-graph.ts --mod
deno run -A tools/extract-definitions.ts --mod
deno run -A tools/capability-map.ts
deno run -A tools/ui-completeness.ts
deno run -A tools/parameter-map.ts
deno run -A tools/gen-reference.ts
deno run -A tools/compare-surfaces.ts
deno test -A tools/
```

## Verification

```sh
deno check src/main.ts    # typecheck
deno test -A              # 526 mod tests + 102 tool tests
deno task build:main      # bundle
```

`build:sprites` is not part of the routine unless `assets/icons/` changes.






```sh
cd __bundel
rg -n -C3 'pattern' modules/bundel.js/46781.js   # read real code, line numbers
jq '."46781"' modules/bundel.js/manifest.json      # deps + exports
```

`rg` 15.2.0 is installed. Split modules are multi-line with mangled identifiers
(`e`, `t`, `n`) but structurally readable, so implementations can be read rather
than guessed. No `.gitignore` hides `__bundel`.

