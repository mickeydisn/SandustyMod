/**
 * The excavation-option feature: the presets that build a profile's numbers.
 *
 * The sibling of `../projectile-option/`, and the same answer to the same problem.
 * These five used to be actions in `actions/act/`, where they could not work: they
 * returned a value and `itemAction` discards a process's return, so each one built a
 * perfect `ExcavateOptions` object and handed it to nobody.
 *
 * The three modules, in dependency order:
 *
 *   - `./types` — `ExcavationOptionFn` and the shapes that travel with it.
 *   - `./registry` — the five presets, and the parameters each one accepts.
 *   - `./compile` — where the option meets the entry's own `pattern` and
 *     `terrainRules`.
 *
 * @module
 */
export {
    type CompiledExcavationOption,
    compileExcavationProfile,
    EXCAVATION_OPTION_STORE_KEY,
    excavationOptionOf,
} from "./compile.ts";
export {
    EXCAVATION_OPTION_DOCS,
    EXCAVATION_OPTIONS,
    excavationOptionKeys,
    excavationOptionParams,
    resolveExcavationOption,
} from "./registry.ts";
// The shapes travel with the option, so they are re-exported from one place. They
// are **not** re-exported from `compile.ts` — that module imports them, and a
// re-export there would be a second, competing path to the same type.
export {
    EXCAVATION_FLAGS,
    type ExcavationFlag,
    type ExcavationOptionFailure,
    type ExcavationOptionFn,
    type ExcavationOptionPatch,
    type ExcavationOptionRef,
    type ExcavationOptionValue,
} from "./types.ts";
