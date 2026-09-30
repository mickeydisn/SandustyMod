/**
 * Compiling a *definition*'s program — the one path every call site goes through.
 *
 * A definition stores `processId`. It used to store an `actions` array, and the
 * migration in `../../config/store.ts` converts one into the other on load. This
 * module is where both shapes are read, so **no caller has to know the legacy one
 * exists** — which is the only way six call sites can all move off `actionRefsOf`
 * without one of them being forgotten.
 *
 * ## Why one function rather than six
 *
 * Each of the five process slots was compiling its own `actionRefsOf` +
 * `compileProcess` pair. Left alone, that is five places to remember the scope check,
 * the nesting, and the cycle guard — and the bug would be the one slot somebody did
 * not update, which is exactly the slot with a machine nobody tested.
 *
 * ## The legacy branch is a fallback, not a plan
 *
 * The migration runs in `loadConfig`, so in normal operation every definition already
 * has a `processId` and the legacy branch is dead. It stays because a hand-edited
 * config, a config written by a *newer* build, and a unit test that constructs an
 * entry by hand can all still hold an array, and a registration path that throws on
 * those loses the machine rather than running the old program.
 *
 * @module
 */
import { type HandlerSlot } from "../core/handler-registry.ts";
import { actionRefsOf, compileProcess, type ProcessFailure } from "../core/process.ts";
import { compileCustomProcess } from "./compile.ts";
import { currentProcessRegistry, type ProcessRegistry } from "./registry.ts";

/** What a definition's stored program turned out to be. */
export type ProcessSource =
    | { kind: "process"; id: string }
    /** Still an array. Nothing writes this any more; see the module note. */
    | { kind: "legacy"; refs: ReturnType<typeof actionRefsOf> }
    | { kind: "none" };

/**
 * What a definition stores, as a program source.
 *
 * One reader for both shapes, so the six call sites below cannot each grow their own
 * private knowledge of the legacy form.
 */
export function processRefOf(entry: Record<string, unknown> | undefined): ProcessSource {
    if (!entry) return { kind: "none" };
    const id = entry.processId;
    if (typeof id === "string" && id) return { kind: "process", id };
    if (Array.isArray(entry.actions)) {
        const refs = actionRefsOf(entry);
        // An array that yields no steps is the same as having no program — see rule 2
        // in the migration — and reporting it as `legacy` would compile an empty
        // process rather than being honest that there is nothing there.
        if (refs.length === 0) return { kind: "none" };
        return { kind: "legacy", refs };
    }
    return { kind: "none" };
}

/** What a compiled definition produced. */
export interface CompiledEntry {
    /**
     * The function to hand the engine. Always callable.
     *
     * Takes the engine's `(structure, context)` for a `processing` call site — the
     * arity the real signature has. It was declared `() => void`, and the cast that
     * installed it (`compiled.fn as () => void`) made that true only to the type
     * checker: the engine passes two arguments, `compileProcess` reads them, and a
     * caller who believed the declared arity could not drive a compiled program at
     * all. Optional, because the `none` branch really is a nullary no-op.
     */
    fn: (structure?: unknown, context?: unknown) => void;
    /** Where the program came from, for the log. */
    source: ProcessSource;
    /** Action keys dropped because nothing resolves them. */
    skipped: string[];
    /**
     * Option keys no action declares, as `action.option`.
     *
     * Passed through from the compiler rather than recomputed, so the register
     * path and the panel report the same list.
     */
    unknownOptions: string[];
    /** Whether the program shares a context between its steps. */
    usesContext: boolean;
    /** Every process expanded into this one. Empty for a legacy array. */
    expanded: string[];
}

/**
 * Compile whatever a definition stores into one callable.
 *
 * The legacy branch delegates to `compileProcess` directly rather than to
 * `compileCustomProcess`. Wrapping a legacy array in a throwaway process would give
 * it a synthetic id in the log on every boot and, worse, would make a *nested*
 * process reference inside that array resolve — which is a capability the pre-migration
 * shape never had and a behaviour change nobody asked for during a migration.
 */
export function compileEntryProcess(
    entry: Record<string, unknown> | undefined,
    slot: HandlerSlot,
    registry?: ProcessRegistry,
    onFailure?: (f: ProcessFailure) => void,
): CompiledEntry {
    const source = processRefOf(entry);
    const reg = registry ?? currentProcessRegistry();

    if (source.kind === "none") {
        return {
            fn: () => undefined,
            source,
            skipped: [],
            unknownOptions: [],
            usesContext: false,
            expanded: [],
        };
    }

    if (source.kind === "legacy") {
        const compiled = compileProcess(source.refs, slot, onFailure);
        return {
            fn: compiled.fn,
            source,
            skipped: compiled.skipped,
            unknownOptions: compiled.unknownOptions,
            usesContext: compiled.usesContext,
            expanded: [],
        };
    }

    const compiled = compileCustomProcess(
        reg,
        source.id,
        slot,
        (f) => onFailure?.({ key: f.id, error: f.error }),
    );
    return {
        fn: compiled.fn as () => void,
        source,
        skipped: compiled.skipped,
        unknownOptions: compiled.unknownOptions,
        usesContext: compiled.usesContext,
        expanded: compiled.expanded,
    };
}
