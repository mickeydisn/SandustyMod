# Bundle audit — verifying the mod against the shipped game

**Goal:** every engine feature the mod uses is checked against the _actual shipped bundle_ in
`__bundel/`, not just the hand-written `.d.ts` files. Anything the bundle does differently gets
fixed in the mod.

**Why this matters:** `__pakages/__other/sandkit/src/**/*.d.ts` was made authoritative earlier
because generated API docs contained methods that never existed. But `.d.ts` files are
_declarations_ — they can drift from the shipped build, and they say nothing about runtime
behaviour: arity, return shape, silently-dropped fields, or which bad input throws. The bundle is
ground truth.

## How to read the bundle

`rg` 15.2.0 is installed at `/opt/homebrew/bin/rg` — use it, the bundle README's workflow is
correct. (`grep -rl` also works and is what was used before rg landed, but rg is ~40× faster on the
8.5 MB bundle and adds line numbers.)

```sh
cd __bundel
rg -l 'someApiName' modules/                      # which module defines it
rg -n -C2 'updateDefinition' modules/bundel.js/46781.js   # read the real code
jq '."46781"' modules/bundel.js/manifest.json      # its deps + exports
jq '."46781"' modules/bundel.js/required-by.json  # who depends on it
```

- `modules/bundel.js/` — 764 modules, the main game bundle (8.5 MB unsplit).
- `modules/bundel-worker.js/`, `modules/utils-worker.js/` — worker bundles.
- `modules/extra-mod-worker.js/` — the mod sandbox, currently a 1-byte stub.
- `bund/*.js` — the original unsplit bundles; read these for whole-file context.

**The split modules are not single-line minified.** Identifiers are mangled (`e`, `t`, `n`) but the
code is multi-line and structurally readable, so the real implementation can be inspected directly
rather than guessed at:

```
1303:                    updateDefinition: (e, t, n) => {
1329:                        $t.elements.updateDefinition(e, r, {
2005:                    updateDefinition: (e, t, n) => {
```

That last line already shows `updateDefinition` taking **three** parameters, and `elements` being
re-exported off another object — both worth confirming per namespace in Phase 4.

No `.gitignore` in the repo hides `__bundel` from rg, so searching from the repo root works with the
`__bundel/` prefix.

## Mod surface to audit (35 engine methods, 15 namespaces)

Real calls, gathered from `src/packages/mysandkit.ts` (the only wrapper) plus the handful made
directly in `api.ts` / `tool.ts` / `panel.ts`:

| Area        | Methods                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| elements    | `register`, `updateDefinition`, `getTypeFromId`, `getTypeById`, `addInteractionInfo`, `getDefinitionByType`, `getIdByType`, `getNameByType`, `getRegisteredTypes`                                            |
| structures  | `register`, `updateDefinition`, `addVariant`, `registerVariant`, `recipes`, `processing`, `getDefinitionByType`, `getIdByType`, `getTypeName`, `getAvailableTypes`, `getUnlockedTypes`, `getRegisteredTypes` |
| items       | `register`, `updateDefinition`, `getAll`, `getRegistered`, `list`                                                                                                                                            |
| tech        | `updateDefinition`                                                                                                                                                                                           |
| terrains    | `register`, `updateDefinition`, `getTypeById`                                                                                                                                                                |
| sprites     | `load`, `getAll`, `getLoaded`, `getRegistered`, `list`                                                                                                                                                       |
| upgrades    | `register`, `registerCategory`, `updateDefinition`, `getLevelById`, `setLevelById`                                                                                                                           |
| processing  | `registerShaker`, `registerKineticPress`, `registerGrower`                                                                                                                                                   |
| reactions   | `registerContact`                                                                                                                                                                                            |
| projectiles | `register`, `createBlueprintFromId`                                                                                                                                                                          |
| energy      | `registerType`, `addAtCell`, `consume`                                                                                                                                                                       |
| excavation  | `registerProfile`                                                                                                                                                                                            |
| triggers    | `register`                                                                                                                                                                                                   |
| ui          | `overlays.register/update/unregister`, `inject`, `toast`                                                                                                                                                     |
| host        | `storage.ensure/get/set/remove`, `settings.onChange`, `events.on`, `React`, `sandkit`, `h`                                                                                                                   |

## PHASE 0 — Bundle index

- [ ] Build a map: namespace → defining module id, for all 15 namespaces
- [ ] Identify which module holds the `api` object literal vs. its sub-namespaces
- [ ] Confirm whether `bundel.js`, `bundel-worker.js`, `utils-worker.js` are the _same_ code under
      three entry points or genuinely different code
- [ ] Record which namespaces are absent from the bundle entirely
- [ ] Write `PHASE0-bundle-index.md`

## PHASE 1 — Host bridge (how the mod gets the API at all)

Highest risk: the mod is a sandboxed worker and the bundle ships **no API code** inside it, so the
whole mod depends on a `postMessage` bridge never yet inspected.

- [ ] Read `bund/extra-mod-worker.js` (29 KB) in full — the mod host
- [ ] Determine how `sandkit` reaches mod scope (global? proxy? postMessage?)
- [ ] Verify `React` is exposed to mods, and which build (version, hooks present)
- [ ] Verify `h` (the hyperscript pragma) and how the panel's JSX is compiled
- [ ] Check whether the bridge **validates or filters** messages — a silently dropped field here
      would explain a lot
- [ ] Confirm mod script load order vs. the `registerTool` call in `main.ts`
- [ ] Write `PHASE1-host-bridge.md`

## PHASE 2 — Registration path (write)

Does what the mod _sends_ match what the engine _accepts_?

- [ ] For each register call, extract the real parameter list from the bundle
- [ ] Check for fields the engine silently ignores (set-but-unused props)
- [ ] Check for fields the engine throws on when absent vs. present
- [ ] Verify `normalizeStructure` / `normalizeItem` / `normalizeElement` in `mysandkit.ts` handle
      what the bundle actually expects
- [ ] Verify the `registerOptions` / `useRawShape` split for structures
- [ ] Verify `addVariant` vs `registerVariant` — both are used; are they different operations, and
      is that what the mod assumes?
- [ ] Check idempotency: what happens if the same id registers twice?
- [ ] Write `PHASE2-registration.md`

## PHASE 3 — Query path (read) — feeds the catalog pickers

`catalog.ts` builds every dropdown from these. A wrong return shape here silently populates pickers
with wrong or empty options — no error, just a broken UI.

- [ ] Verify each `get*` return shape (array vs. map vs. `undefined` when empty)
- [ ] Verify `getTypeFromId` vs `getTypeById` — different names, easy to swap
- [ ] Check `getUnlockedTypes` / `getAvailableTypes` semantics against the `alwaysUnlocked` +
      tech-node `unlocks` rule established earlier
- [ ] Verify `sprites.getLoaded` / `getAll` match what the asset picker assumes
- [ ] Check `getNameByType` vs `getTypeName` (elements vs. structures naming)
- [ ] Write `PHASE3-queries.md`

## PHASE 4 — `updateDefinition` family (validates the fix just made)

Directly verifies the `updateEntry()` work from the previous task.

- [ ] Confirm all 6 exist in the bundle and get their real arity
- [ ] Determine `Partial<T>` semantics vs. full replace — does a partial update _merge_ or _wipe_
      unspecified fields?
- [ ] Check whether `id` is accepted inside the partial or must be omitted (the mod currently strips
      it — confirm that is right)
- [ ] Verify the structures variant `(id, partial, { useRawShape })`
- [ ] Verify upgrades are keyed `(itemId, upgradeId)` and that `upgradeId` is the _nested_
      `upgrade.id`, not the entry id
- [ ] Check error behaviour: throw, no-op, or corrupt on a bad id
- [ ] Write `PHASE4-update-definition.md`

## PHASE 5 — Handlers, hooks, signals and triggers

The typed handler registry is only verified _structurally_ by tests. This phase checks it against
what the engine actually invokes.

- [ ] Extract the real callback signature for each hook id — **arity** is the risk: a wrong
      parameter count fails silently
- [ ] Confirm the hook id list in `constants.ts` matches the bundle's registry
- [ ] Verify `intercept` vs `modify` semantics and return-value contracts
- [ ] Verify projectile / signal / trigger callback payloads
- [ ] Check whether the engine awaits handler results, and what a rejected or thrown handler does to
      the caller
- [ ] Verify the `handlerKey` → resolved-callback indirection survives the bridge
- [ ] Write `PHASE5-handlers-hooks.md`

## PHASE 6 — UI / overlay / React

- [ ] Verify `ui.overlays.register` id conventions and `update` / `unregister`
- [ ] Verify the `overlays.register` → `inject` fallback in `tool.ts` is correct, and whether both
      can actually be needed
- [ ] Check the React version exposed to mods against what `panel.ts` uses
- [ ] Verify `toast` signature and failure mode
- [ ] Check the `useEffect` poll for panel state actually gets a chance to run given how the overlay
      is mounted
- [ ] Write `PHASE6-ui-overlay.md`

## PHASE 7 — Storage and settings

The storage stub signature mismatch already made a batch of tests vacuous once, so this gets its own
pass.

- [ ] Verify `storage.get` / `set` arity `(modId, key)` and **exact** return type — JSON string or
      already-parsed object? The mod assumes one of these.
- [ ] Verify `ensure` semantics and what happens without it
- [ ] Verify `remove` and whether a missing key throws
- [ ] Verify `settings.onChange` fires on the right events and with what payload
- [ ] Verify `events.on` subscription and unsubscribe semantics
- [ ] Re-audit any test that "passed" while the storage stub was wrong
- [ ] Write `PHASE7-storage-settings.md`

## PHASE 8 — Reconciliation

- [ ] Compile every discrepancy found in phases 0–7 into one table
- [ ] Fix confirmed mod-side bugs; re-run `deno check` + `deno test -A` + build
- [ ] Add a regression test per fixed bug
- [ ] Mark each finding in the mod's main `PLAN.md` so it is not re-audited
- [ ] Write `PHASE8-reconciliation.md` as the final report

---

## Status

Nothing checked yet — this is the plan only. **Phase 0 is the next step.**
