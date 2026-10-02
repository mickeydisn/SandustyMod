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

export {
    EXCAVATION_FLAGS,
    type ExcavationFlag,
    type ExcavationOptionFailure,
    type ExcavationOptionFn,
    type ExcavationOptionPatch,
    type ExcavationOptionRef,
    type ExcavationOptionValue,
} from "./types.ts";
