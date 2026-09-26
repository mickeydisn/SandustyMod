# Phase 5 — Action package

Date: 2026-09-26 Tool: `tools/ui-completeness.ts` Artefacts: `UI-COMPLETENESS.md`,
`ui-completeness.json`

## The measurement came first

Phase 5 asked for form editors, so the first question was _which_ — and answering it by reading the
form was a trap. Form field keys are deliberately **not** engine field names: the form says
`shapeJson` where the engine says `shape`, `costsJson` where the engine says `costs`, `idSuffix`
where the engine says `id`. Comparing the two directly reports 29 false gaps.

The translation layer is `formToEntry`, so that is what gets read. Its per-tab `case` blocks name
the config keys a **structured** control can produce; `advancedJson` is excluded, because counting
an escape hatch makes every field look reachable.

Starting point: **29** reported gaps, **16** real. Now: **8**, and all four remaining groups are
deliberate.

## What was missing, and what it cost

| gap                                         | why it was missing                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upgrade categories had no UI at all**     | `ModConfig.upgradeCategories` was read and registered by `apply.ts`, but no tab ever produced an entry — the only way to create one was hand-editing JSON. Combined with the Phase 3 bug (the `id` was stripped), a category was impossible to create _and_ impossible to register. |
| `structures.blockGridType`                  | undocumented in the form; it is a _self_-reference in the picker, since the engine defaults it to the structure's own id                                                                                                                                                            |
| `structures.draw`                           | the engine stores the definition **twice** when set — once with `draw`, once with `draw: undefined` — which is too odd to guess from the typings                                                                                                                                    |
| `structures.skipCopyData`                   | only reachable through `copyData: false`, which the engine rewrites; `skipCopyData` itself is what the engine reads                                                                                                                                                                 |
| `structures.defaultData`                    | nested object, deep-cloned by the engine                                                                                                                                                                                                                                            |
| `terrains.materialId`                       | nested in a throw, so it never surfaced in the typings                                                                                                                                                                                                                              |
| `upgrades.name` / `nameKey` / `requirement` | the Phase 2 finding, now with a tab to put them in                                                                                                                                                                                                                                  |

## Engine rules found while building the forms

Read from `structures.register` at bundle line 2746, none of it in the typings:

| field                    | engine behaviour                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `blockGridType`          | `registerStructureType(blockGridType ?? id)`; when it differs from `id` an **alias** is registered so the type shares another type's grid |
| `copyData`               | `!1 === t.copyData && (t.skipCopyData = !0)` — one implies the other                                                                      |
| `defaultData`            | deep-cloned, so the caller cannot mutate it afterwards                                                                                    |
| `draw`                   | the definition is stored **twice** when truthy: with `draw`, and with `draw: undefined`                                                   |
| `render`                 | resolved through a helper that throws if `spritesheet.frameBuffer.key` is empty, or names a shared buffer that was never created          |
| `buildModes[].spanTiles` | **throws** `TypeError` unless the mode `type` is `"line"`; must be a positive safe integer                                                |
| `terrains.materialId`    | **throws** unless it is a number, `> obstacleBreakpoint` and `< 150`                                                                      |

Two of these are now enforced in `validateForm`:

- **`spanTiles` needs a line mode.** The form could previously produce a rectangle mode with a span,
  which the engine rejects with a `TypeError`.
- **a category needs a name or a name key.** This one could not be a plain `required: true` on the
  field — that rejects a category that supplies only a name key, which the engine accepts. It is a
  cross-field check instead, and the first attempt at it did exactly that and failed its own test.

## What is deliberately still missing

| gap                                 | why it stays                                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `structures.copyData`               | the engine rewrites `copyData: false` into `skipCopyData = true`, so `skipCopyData` is offered instead. Exposing both would be two controls for one state. |
| `upgrades.onUpgrade`                | a **function**. The mod's `onUpgradeKey` + handler registry is the config-driven equivalent, and it already works.                                         |
| `upgrades.itemName` / `itemNameKey` | the upgrade's display name is already set through the nested `upgrade.nameKey`; these are a second spelling.                                               |
| `upgrades.requirement`              | pass-through. No engine rule is documented for its shape, so a control would be a guess.                                                                   |
| `items.pivot` / `x` / `y`           | the engine **dereferences** `pivot`, so it is genuinely required — but the mod has no `registerItem` at all, so no path can reach it.                      |

All five are **optional** in engine terms: none is dereferenced on a path the mod actually takes.

## What I could not pin down

`obstacleBreakpoint` is a constant from another module, so the exact lower bound for
`terrains.materialId` is not knowable from this bundle. The field validates `1..149` — the hard
ceiling that _is_ verifiable — and the hint states the real rule rather than encoding a guessed
breakpoint.

## Progress

- 29 reported gaps → 16 real → **8**, across 4 deliberate groups
- a new **Upgrade categories** tab, with round-trip and validation tests
- 2 engine throw conditions that the form could previously trigger
- 498 tests pass (up from 478), typecheck clean, bundle 255.7 → 260.8 KB

## Open

- `ui-completeness.ts` compares by name only. A field could be exposed under a name the engine never
  reads and still pass; Phase 6 should tighten this.
- The remaining 8 are a judgement call each. If any of them turns out to matter in practice, they
  are one `FieldSpec` away.
