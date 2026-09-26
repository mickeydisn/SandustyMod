# Phase 0 — Full api index

Date: 2026-09-26 Tools: `tools/extract-api.ts`, `tools/compare-surfaces.ts` Artefacts:
`API-INDEX.md`, `api-index.json`

## Outcome

The extraction works and is verified. But it changed the shape of the project: **there is not one
api, there are three**, and I had been reading the wrong one.

## The three surfaces

| Surface                                    | Where                                  | Namespaces | Convention    |
| ------------------------------------------ | -------------------------------------- | ---------- | ------------- |
| `sandkit.api` — **public mod api**         | `__pakages/.../src/sandkit/api/*.d.ts` | 60         | context-free  |
| `sandkit.engine.api` — engine escape hatch | bundle `46781.js`, the `Dt` object     | 62         | context-first |
| `sandkit.api` — worker thread              | `__pakages/.../src/worker/*.d.ts`      | 21         | context-free  |

`sandkit` itself is a free variable, not a global. The host evaluates the mod with
`new Function("__sandkit", body)` and binds `const sandkit = __sandkit`:

> Use the free name `sandkit` in mod and modkit code — do not import a value binding. —
> `src/global.d.ts`

`Sandkit` = `{ api, apiVersion, engine, enums, react, state }`. `engine` is the state-first
internals bag; `engine.api` is the context-first object I indexed.

## Correction to the previous plan

The v2 plan asserted the mod was broken because it calls `api.elements.register(def)` while the
bundle declares `register(e, t)`.

**That was wrong, and it is withdrawn.** Those are two different surfaces. The context-first
signature is `engine.api`'s. The public `sandkit.api` a mod receives is context-free, so the mod's
existing call shape is correct.

`structureBehaviors` and `settings` do not exist under those names in the _engine_ api, but both are
declared in the _public_ api — so their absence from `Dt` proves nothing about the mod.

What survives from the earlier reading, and is still real: the engine-side arities differ from the
naive assumption, which matters for Phase 3/6:

| method                      | engine arity                                  |
| --------------------------- | --------------------------------------------- |
| `elements.updateDefinition` | 3 — `(ctx, idOrType, partial)`                |
| `upgrades.updateDefinition` | 4 — `(ctx, itemId, upgradeId, partial)`       |
| `upgrades.registerCategory` | **throws** without `id` + (`name`\|`nameKey`) |

## Version drift between the two trees

`__pakages` is `@sandustry/sandkits@2.0.0`; `__bundel` is the shipped build. They do not agree, and
the plan's "the bundle is the source of truth" rule does not cleanly resolve this, because they are
different _layers_, not just different vintages.

11 public namespaces have no counterpart in the engine api:

```
assets  blueprints  entities  gameConfig  lights  mods
pickups  settings  shared  structureBehaviors  time
```

Two of those — **`gameConfig` and `structureBehaviors` — appear in no bundle module at all**
(checked with `rg -l` across `bundel.js` and `bundel-worker.js`).

13 engine namespaces are absent from the public api:

```
config  conveyors  debug  drones  extend  launchers  matters
misc  queue  shadows  teleportZones  wall  workerLocal
```

Note `conveyors` + `launchers` (engine, each with a single `registerType`) versus
`structureBehaviors` (public, `registerConveyor` / `registerLauncher`). That looks like a rename
plus a merge, but it is an **inference, not a verified fact** — the composed public layer was not
located in the bundle.

## The mod's own surface

21 host namespaces are called, and all 21 are declared in the public api:

```
elements  energy  events  excavation  hooks  i18n  items  player
processing  projectiles  reactions  signals  sprites  storage
structureBehaviors  structures  tech  terrains  triggers  ui  upgrades
```

Only `structureBehaviors` is unverified against a shipped artifact. The mod already guards it and
logs `"structureBehaviors API missing"`, so the author had already met this wall.

Detection note: the mod has its **own** module named `api.ts`. A naive `api\.(\w+)` scan reports
`api.ts`, `api.register`, `api.registerConveyor` and `api.registerLauncher` as host calls; they are
all local imports. The extractor requires a leading `.` (`\.api\??\.`) to exclude them.

## Index (final numbers)

| metric                   | value |
| ------------------------ | ----- |
| namespaces               | 62    |
| entries                  | 393   |
| functions                | 343   |
| re-exports               | 48    |
| plain values             | 2     |
| take a context first arg | 156   |
| can `throw`              | 14    |

Reconciliation against the `.d.ts`: **137 files scanned, 33 declared members, 0 absent from the
bundle.** The other 29 are React hooks and the callback-context interfaces the api passes into your
functions (`StructureProcessingContext`, `HookContext`, `GridMutationWriter*`, `RetroConsole*`) —
declarations you receive, not things you call.

An earlier draft of this report quoted 287 functions. That was wrong, and the tests caught it:
**paren-less arrows** (`name: e => ...`) were being classed as plain values, which hid 56 of them.
`values` 58 → 2, `functions` 287 → 343. The bundle writes a great many of its delegating methods
this way.

## Extractor design and verification

`mask()` blanks string, template, regex and comment content while preserving offsets, so brace/paren
counting cannot be fooled by content. `extractApi()` then walks the object by depth.

Three bugs were found and fixed, and all three produced plausible output rather than errors — which
is why they are now pinned by tests:

1. `masked.slice(i).match(IDENT)` searches for the identifier **anywhere** in the remainder, not at
   `i`. It captured names at wrong offsets — `utils` became `ls`, `getDistance` became `etDistance`.
   Fixed with a sticky regex (`/…/y`) anchored via `lastIndex`.
2. The frame stack accumulated (`utils.cooldown.check`) instead of push/popping, and function bodies
   were re-scanned so their braces looked like namespaces.
3. Method shorthand (`name(a, b) { … }`) and paren-less arrows were not recognised as functions at
   all.

**Verification** (`tools/extract-api.test.ts`, 9 tests): every one of the 393 entries is checked
against the source — the method name must match the line, the raw parameter list must appear on it,
the recorded arity must agree with that parameter list, and the body snippet must appear nearby. 4
of the 9 are hand-written fixtures that reproduce the bugs above.

`takesContext` remains a heuristic and under-reports: delegating methods like
`storage.get: (e,t,n) => $t.storage.ensure(e,t)[n]` never name `session` or `store`, so they read as
context-free. Since the engine surface is context-first by convention, treat the column as a prompt,
not a verdict — and the public surface is context-free regardless.

## Open

- Locate the composed **public** `sandkit.api` layer in the bundle. Every per-namespace signature
  the mod depends on should come from that object, not from `Dt`.
- Resolve `structureBehaviors` and `gameConfig`: real public names with no shipped implementation,
  or `.d.ts` ahead of the build?
- 133 methods flagged as context-first is a useful cross-check but not yet a settled convention.

## Next

Phase 1 should start by finding the public api composition rather than by assuming the mod-facing
object mirrors `Dt`. That single question unblocks the reliable half of everything downstream.
