# Phase 6 — Parameter and option completeness

Date: 2026-09-26 Tool: `tools/parameter-map.ts` (24 tests) Artefacts: `PARAMETER-MAP.md`,
`parameter-map.json`

## Why this needed its own tool

Phase 5 measured the form against what a `register` body **dereferences**. That is the right floor
but it understates the surface: these definition interfaces carry an `[key: string]: unknown` index
signature, so a field the body never reads is still stored and later consulted by the simulation.

So Phase 6 measures three independent sets per parameter, and the differences between them are the
finding:

| set          | meaning                                        |
| ------------ | ---------------------------------------------- |
| **declared** | listed in the shipped `.d.ts`                  |
| **read**     | the register body dereferences it (Phase 3)    |
| **exposed**  | a structured form control can set it (Phase 5) |

- declared ∧ ¬exposed → a **candidate**: reachable by the engine, not by the UI
- read ∧ ¬declared → the **typings are incomplete**

## Two parser bugs found first

Neither was visible until the tool produced numbers.

`parseObjectType` from `extract-public-api.ts` splits members on **commas**, because it parses
TypeScript _object type literals_ (`{ a: string, b: number }`). A `.d.ts` interface separates
members with `;` and newlines, so it returned **one** field for an entire interface body — 10
parameters across 9 definitions, where the real number is 65. `parseInterface` in the new tool fixes
this, and the regression is pinned by a test.

Then `<` and `>` in the depth counter. An arrow type like `() => Record<string, unknown>` unbalanced
the depth and swallowed every member after it, silently merging `getOptions` and `getModData` into
one field. Both bugs are now tests, not comments.

## What the map found

|                           | before | after  |
| ------------------------- | ------ | ------ |
| declared parameters       | 65     | 65     |
| exposed by a form control | 46     | **60** |
| candidates                | 18     | **5**  |
| read-but-undeclared       | 11     | 11     |

### The Phase 2 question is answered

Phase 2 left open whether three mod config shapes had engine counterparts. They do — they were
simply never in the form:

- `StructureConfig.descriptionParams` → `Record<string, string | number>`
- `StructureConfig.linkedClearance` → `string`, e.g. `"allOrNothing"`
- `StructureConfig.descriptionKey` → `string`

The mod's config types already declared all three. Only the UI was missing them.

### Fields added

**Structures** — `descriptionKey`, `descriptionParams`, `linkedClearance`, `rejectWhenBlocked`,
`tooltipHover`, `variants`. **Terrains** — `nameKey`, `colorHSL`, `excavationRequirements`,
`interactions`. **Techs / elements / items** — `descriptionKey`. **Upgrades** — `itemNameKey`.

`colorHSL` is typed `[number, number, number]`, so it gets three number controls gated behind a
toggle. Without the gate an untouched form would emit `0,0,0` and paint every terrain black; there
is a test for exactly that.

### `input.registerBinding` — the 36th member

The last registerable api member the mod had not wrapped. Now covered end to end:
`InputBindingConfig`, `registerInputBinding`, an `inputs` tab, apply-time handler resolution, and
round-trip tests.

`unwrapped: 0` in the capability map.

`KeyCode` is a **`LooseString` union, not a closed enum** — a modifier alias (`"Shift"`), a raw
`KeyboardEvent.code` (`"KeyO"`) and a chord (`"Control+KeyC"`) are all valid. A closed picker would
have been wrong, so `defaultKeys` is a suggestion-backed multiselect and the stored value is free
text. `BindingId` is likewise `LooseString` over the vanilla `KeyBinding` names; the config uses
custom ids, because reusing a vanilla name would replace a built-in binding.

## The 5 remaining candidates

| parameter                | control  | why it stays                                                                                                                              |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Projectile.getOptions`  | callback | required by the engine; the mod already substitutes `getOptionsKey` → handler at apply time, which is a working, config-driven equivalent |
| `Projectile.getModData`  | callback | same                                                                                                                                      |
| `MainTrigger.callback`   | callback | same, via `handlerKey`                                                                                                                    |
| `InputBinding.handlers`  | callback | same, via `onDownKey` / `onUpKey`                                                                                                         |
| `PlacementConfig.fields` | ref-list | belongs to `structures.registerPlacementConfig`, a **separate** api call the mod does not wrap                                            |

Four of five are functions. A JSON config cannot hold a function, and the mod's established answer
across every other registerable is a handler key resolved at apply time. The fifth is a genuinely
unwrapped api call, correctly outside the 36-member config surface.

## A mapping error of my own

`PlacementConfigDefinition` was initially mapped to `structures.register`. It is the payload of
`structures.registerPlacementConfig`. The wrong mapping re-reported eight structure fields as
undeclared against an interface that does not declare them, and doubled the apparent undeclared
count. Fixed.

## Tests added

24 in `tools/parameter-map.test.ts`, matching the `Deno.test` + `assertEquals` convention of the
other tool tests. They pin the two parser regressions, the control inference, the
identifier-resolution pass, and the two definitions that were previously in doubt.

## Open

- `undeclared` is still 11, and those are real: the engine reads `blockGridType`, `copyData`,
  `draw`, `skipCopyData` on structures and `name`, `requirement` on an upgrade category, none of
  which appear in the `.d.ts`. These are now all reachable from the form, so the gap is in the
  **typings**, not the mod. Worth reporting upstream.
- `controlFor` is a type-shape classifier, not a resolver. It does not follow union members or
  generics; `refineControls` only resolves a bare identifier to a known interface. A parameter typed
  as a union of two shapes is reported by its first recognisable form.
