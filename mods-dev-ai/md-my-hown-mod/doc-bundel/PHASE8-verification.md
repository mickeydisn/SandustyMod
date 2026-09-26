# Phase 8 — Verification

Date: 2026-09-26 Tool: `tools/verify.ts` + `tools/verify.test.ts` (12 tests)

The brief was: _the index from Phase 0 is the oracle._ That turned out to be the hardest part. The
oracle was **incomplete**, and fixing it is most of what this phase found.

## The oracle was not trustworthy

Indexing the public api by `members` alone reported **36 of the mod's 91 calls as unresolvable**.
The cause: `export import toast = shared.api.ui.toast` — a re-export — lands in a namespace's
`aliases`, not its `members`. On top of that the index walk was fixed-depth, so
`shared.api.elements.getTypeById` (three levels down) was never reached.

Neither was a mod bug. Both meant the check was measuring the index, not the mod. An oracle that
reports 36 false failures is worse than none, so the index was fixed first: 297 → **358** members,
aliases resolved onto their declaring namespace, nesting walked recursively.

## The real mod bug

With a trustworthy oracle, one finding stood out — and it was not a guess:

```ts
api.settings.onChange(modId, () => { … });   // signature is onChange(callback)
```

`onChange` takes **one** argument. The mod id was being passed _as the callback_, so the engine
either threw on subscribe or threw when it later invoked the string — and the surrounding `catch`
turned that into a silent no-op. **`onSettingsChange` has never worked.** `main.ts:53` calls it.

The same function had the mirror bug in `readSettings`:

```ts
api.settings.get(modId, key); // takes one arg
```

The extra argument is ignored, so this read a setting named after the mod id alone, which never
exists. It only ever gave the right answer because the next line, `get(\` ${modId}.${key}\`)`,
corrected it. Accidental correctness resting on a wrong call.

Both fixed. `readSettings` now asks for the dotted field first (which is what `FieldId` means — any
string), and `onChange` receives the callback alone.

A second, smaller one: `api.elements.getTypeFromId(v)` was a **direct** call to a method the typings
mark `@deprecated` in favour of `getTypeById`. A rename would have thrown there. The facade now
tries the current name first and keeps the old one as a fallback.

## Twelve dead probes

Nine more calls resolve to nothing: `elements.getIdFromType`, four `structures.*`, four
`items.*`/`sprites.*`. All are `safe(() => api.x?.y?.(), fallback)` discovery probes in `catalog.ts`
— the mod guessing at an enumeration api the engine does not offer.

`listStructures()` tries **four** such apis, none of which exist, then falls back to the
`StructureType` enum. So structure pickers can only offer built-in enum values; they cannot see
structures at runtime, including the mod's own. The comment in `catalog.ts` said "Try common
discovery APIs" as though they worked; it now says they do not.

They are listed in `DEAD_PROBES` and a test asserts the list has not changed, so if a future engine
adds one, the test fails rather than the comment rotting.

## A phantom field, removed

`TerrainConfig.fog` was listed in `FORM_COVERED`, claiming the form owned a field it has **no
control for** — while `schema.ts` carried a comment saying `fog` is not a documented terrain
property. The only `.fog` in the bundle is a property of the _cell-type table_, not of a terrain
definition.

The bookkeeping entry is removed, so an existing stored `fog` round-trips through `advancedJson`
untouched instead of being silently claimed by a form that cannot edit it.

## `ElementDefinition` was invisible

Adding the last check surfaced that `ElementDefinition` is a `type … = { … }` alias with comma
separators, not an `interface`. The parser only matched `interface`, so **every element field was
unverified** — the largest single category. Now parsed: the map covers 10 definitions and **75
parameters**, up from 65.

## A check I had to narrow

The config-key check initially flagged **110 false positives**. It compared every `*Config` type
against an engine field set that only covers the 9 definitions `parameter-map` could resolve;
`RecipeConfig` and friends go to api calls with no `.d.ts` interface at all, so there was nothing to
check them against.

Rather than suppress the noise, the check is now scoped to the **intersection**: config types that
both reach a register call _and_ have a resolved definition. Seven types. What remains is a reviewed
`TYPINGS_OMIT` list, and the assertion is that it has neither grown nor shrunk — so a new
unexplained key still fails, but a known one does not cry wolf.

`ItemConfig` and `TechConfig` are asserted _absent_, each with its reason: the mod has no
`registerItem`, and `tech.registerNode` delegates into another module so its payload is
undetermined.

## What the checks cover

| check                                                      | result                                            |
| ---------------------------------------------------------- | ------------------------------------------------- |
| the public index resolves aliases and nested namespaces    | 358 members, 0 false failures                     |
| every mod call resolves, or is a known dead probe          | 69 real calls, 0 unknown                          |
| every call passes at least the required argument count     | 0 short                                           |
| no call passes more arguments than the api accepts         | 0 over — **this is what caught the settings bug** |
| every key of a resolved config type is known to the engine | 7 types, reviewed residue                         |
| the mod does not depend on a deprecated member             | enforced                                          |

## The routine

```sh
deno check src/main.ts      # clean
deno test -A                # 526 mod tests, 102 tool tests, 0 failed
deno task build:main        # 273.06 KB
```

## Not done: the in-game smoke test

This is the one item on the Phase 8 list that cannot be done from here. It needs the game: whether a
bad reference is dropped or rejected, whether the two engine throw conditions actually fire, and
whether `onSettingsChange` now fires. The code-level evidence is as strong as it gets from a static
audit; the runtime behaviour is still unverified and is stated as such rather than assumed.
