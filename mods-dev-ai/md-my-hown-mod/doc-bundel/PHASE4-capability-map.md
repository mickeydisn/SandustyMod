# Phase 4 — Capability map

Date: 2026-09-26
Tool: `tools/capability-map.ts` (11 tests)
Artefacts: `CAPABILITY-MAP.md`, `capability-map.json`

## The question

The plan opened with "turn the 77/296 reality into a decision". The useful form
of that question is not *how many members exist* but *which of them can a saved
config actually drive*.

The test is whether the engine **stores** what the call is given:

| role | count | reachable from a config |
|---|---|---|
| registerable | **36** | **yes** |
| queryable | 94 | indirectly, as a picker source |
| runtime | 92 | no — game code only |
| internal | 78 | no |

So of 300 members, **36** are the entire declarative surface. The other 264 are
not gaps; they are capabilities for code that runs in the game, and no amount of
form work would reach them. A config cannot express "play this sound" or "move
this structure" any more than it can express "walk there".

## The mod already covers 35 of 36

| namespace | registerable | covered |
|---|---|---|
| `structures` | 5 | yes |
| `structures.recipes` | 4 | yes |
| `tech` | 3 | yes |
| `upgrades` | 3 | yes |
| `processing` | 3 | yes |
| `elements`, `terrains`, `items`, `structureBehaviors` | 2 each | yes |
| `i18n`, `input`, `projectiles`, `energy`, `structures.processing`, `ui.overlays`, `excavation`, `reactions`, `signals.targets`, `triggers` | 1 each | all but `input` |

14 wrappers cover 19 namespaces. That is not thin coverage — it is essentially
complete, and the three confirmed UI gaps from Phase 2 are *field*-level, not
*capability*-level.

## The one gap, and why it is the right one to leave

`input.registerBinding(bindingId, defaultKeys, definition)` takes a
`definition` whose `handlers` are **functions** (`{ down, up }`).

The mod already has the machinery for exactly this: `handler-registry.ts` turns a
config's `handlerKey` into a real function, and `signals.targets.register` is
already wrapped that way. So this is *implementable*.

It is also the one capability where the answer is not obvious:

- a key binding is inherently a **user-facing control**, and rebinding it is
  something the player does, not something a config author does
- `defaultKeys` is a `KeyCode[]` enum, so the picker would need a key list that
  no other part of the interface currently has
- there is no engine evidence of what happens on a duplicate `bindingId`

Effort is moderate; the design question is the real cost. Worth doing, not
worth rushing.

## Nothing the mod calls is missing

`mod-api-calls.json` reports **0** unknown namespaces, **0** unknown methods and
**0** arity errors across 91 call sites. The mod does not call anything that does
not exist.

## Five misclassifications this phase had to correct

The first version of the tool reported 10 gaps instead of 1. Every one was the
tool's fault, and each would have put a wrong claim in the report:

1. **members carry no `path` field** — the 10 gaps were the string `null`
2. **overloads** — the typings declare `structures.recipes.register` four times,
   so one capability was counted four times
3. **chained access** — `api?.structures?.processing?.register` was read as
   `structures`, hiding three namespaces and calling them uncovered
4. **aliases** — `const sig = g()?.api?.signals` then `sig.targets?.register`
   resolves to `signals.register` unless the first chain segment is re-appended;
   this alone hid `signals.targets`
5. **`update` as a prefix** — `resources.updateEnergy` and `ui.update` were
   counted as config-reachable when they only change live state. Narrowed to
   `updateDefinition`, which moved 8 members from registerable to runtime.

A capability map that overstates what a config can do is worse than none, since
Phase 5 would build forms against it. Each of these is now a test.

## What this changes for Phase 5

- the form set is bounded by **36 members**, not 300 — the scope is known
- 5 of the 36 are nested sub-objects (`render`, `buildModes`, `shape`, `upgrade`,
  recipe inputs), so those need their own editors rather than flat fields
- `ui.overlays.register` is already wired but needs a **render callback**, so it
  belongs with the handler registry, not the field forms
- Phase 2's three JSON gaps (`descriptionParams`, `linkedClearance`,
  `nameKey`) are still the only confirmed field-level work

## Open

- `input.registerBinding` needs a `KeyCode` enum list for its picker; the
  `KeyCode` members are in the `input` namespace and are not yet extracted
- the "runtime" label is a naming judgement from method names alone. It is
  consistent and conservative, but the engine has not confirmed it
