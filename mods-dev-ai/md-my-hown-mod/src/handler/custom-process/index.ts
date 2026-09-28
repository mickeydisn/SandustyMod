/**
 * The custom-process feature: named, reusable, author-built handlers.
 *
 * A definition **references** one by id rather than copying its steps, so editing a
 * process updates every definition that names it. That is the feature; everything
 * else here is the machinery to make it true.
 *
 *   - `./types` — the stored shape, and the one field (`as`) the process context needs.
 *   - `./registry` — the index of the author's processes, and the usage scan.
 *   - `./compile` — expansion into one callable, with the cycle guard.
 *
 * @module
 */
export {
    compileCustomProcess,
    type CompiledCustomProcess,
    MAX_NESTING,
    type ProcessCompileFailure,
    processProblem,
} from "./compile.ts";
export {
    currentProcessRegistry,
    DERIVED_ID_SUFFIX,
    derivedProcessId,
    ProcessRegistry,
    type ProcessUsage,
    processUsageCounts,
    scanProcessUsage,
    setProcessRegistry,
} from "./registry.ts";

// The one path every call site goes through, and the only reader of the legacy
// `actions` array. It comes last in the barrel because it depends on both of the
// modules above it.
export {
    type CompiledEntry,
    compileEntryProcess,
    processRefOf,
    type ProcessSource,
} from "./entry.ts";
export type { CustomProcessConfig, ProcessRef, ProcessStep } from "./types.ts";
