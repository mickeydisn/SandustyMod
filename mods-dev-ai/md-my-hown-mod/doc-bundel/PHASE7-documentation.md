# Phase 7 — Documentation package

Date: 2026-09-26 Tool: `tools/gen-reference.ts` (10 tests) Artefacts: `doc/REFERENCE.md`,
`doc/KNOWN-ISSUES.md`, `src/types/engine-api.generated.d.ts`

## Why generated rather than written

`README.md` had been hand-written once and had drifted. It still said **"Full register coverage
(sandkit v0.5.7)"** while the mod had since gained two tabs, and it told readers to _"prefer the
JSON tab for nested fields"_ — advice that was already wrong, because `shape`, `colors`, `outputs`,
upgrade `costs` and excavation patterns all have structured editors now.

A hand-maintained table of 175 fields would drift the same way within a week. So the reference is
generated from the same four artefacts the audit produced:

| source                                    | contributes                                                     |
| ----------------------------------------- | --------------------------------------------------------------- |
| `src/ui/schema.ts`                        | the live fields: label, control, section, constraints, hint     |
| `definitions.json`                        | what each register body reads, and which fields it dereferences |
| `parameter-map.json`                      | every declared parameter with its type and meaning              |
| `extract-definitions` / `ui-completeness` | which api call each config reaches                              |

## The three-name problem, made visible

The single most useful thing the reference does is put one row per field:

> **UI field → stored config key → does the engine read it**

Those three names are deliberately different, and that is invisible from the UI:

| UI field      | stores          | why                                              |
| ------------- | --------------- | ------------------------------------------------ |
| `shapeJson`   | `shape`         | the editor round-trips a 4×4 text grid           |
| `costsJson`   | `upgrade.costs` | nested under `upgrade`, not top level            |
| `idSuffix`    | `id`            | composed with the mod prefix by `fullIdOf`       |
| `colorHSLHue` | `colorHSL[0]`   | one of three controls writing a tuple            |
| `metaColor`   | `metaColor`     | a hex string in the form, a packed int in config |

## Every field resolves — and that is enforced

The first run left 16 rows with a `—` for "stores", which is exactly the kind of silent gap this
phase exists to remove. Most were real extraction bugs:

- **nested generics.** `optJson<Record<string, unknown>>(form, "k")` closes with `>>`, so a `[^>]*`
  pattern stops mid-type and the call is never matched.
- **read and write in different statements.** `const c = optJson(…); if (c)
  entry.k = c;` — the
  two halves are now joined through the local's name.
- **a trailing comma.** The argument list is written across lines, so it ends `…, \n)`.
- **a conversion on the right.** `entry.metaColor = hexToPacked(hex)` — the write is an expression,
  not the local.
- **`for (const k of [...]) setBool(k, optBool(form, k))`** — a loop over literal keys.
- **invented keys.** The `entry.x = { a, b }` pass invents `a` and `b` as if they were controls.
  Rows are now looked up by real field key, which discards them.

The residue — 16 fields whose config value is assembled by hand, like `buildModes[0].type` or
`unlocks.structures` — is a documented `COMPOSITE` table, and a test checks every entry against the
live field list. That test immediately caught one I had added speculatively
(`processing.optionsJson`, which does not exist).

`no form field is left unmapped` is now a test, not a claim.

## The generated `.d.ts`

`src/types/engine-api.generated.d.ts` — 345 members, and it **typechecks**.

The register calls are typed from the definition interfaces the sdk ships:

```ts
export function register(
    definition: {
        id: string;
        nameKey: string;
        hp: number;
        materialId: number;
        metaColor: number;
        colorHSL: [number, number, number];
        excavationRequirements: readonly string[]; /* … */
    },
): unknown;
```

Everything else is `unknown` **on purpose**. The bundle index records the _call_ — arity, whether it
takes the engine context, whether it throws — and not a signature. Its parameter names are the
minified ones (`e, t, n`), so printing them would read like real names. Inventing types here would
be precisely the fabrication the audit spent seven phases removing.

Getting it to compile took four fixes, each a real defect rather than cosmetics: flattened
`output.elementType` names are not valid in a type literal; a member can appear twice in the index;
`elements.ElementType` and `Projectile` are declared elsewhere; and an inline object literal leaks
those references.

## Known issues, generated

`doc/KNOWN-ISSUES.md` lists the 11 fields the engine reads that the `.d.ts` does not declare, the
conditions each register call dereferences, and the behaviours that contradict the obvious reading —
`copyData: false` being rewritten, `defaultData` being deep-cloned, `draw` storing the definition
twice, `blockGridType` registering an alias, `KeyCode`/`BindingId` being `LooseString` rather than
closed enums.

## Also updated

`README.md` and the mod's `PLAN.md`. The latter's "Still open" section listed `upgradeCategories` as
having no editor tab — which Phase 5 fixed — and `structureBehaviors` as unverified, which the audit
disproved. Both are now struck through with what actually happened.

## Tests

10 in `tools/gen-reference.test.ts`, covering the statement splitter, the three extraction paths,
the composite table's integrity against the live form, and the no-unmapped invariant.
