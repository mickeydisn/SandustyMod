/**
 * The **process context**: the named values a process carries between its steps.
 *
 * `HandlerAction.md` has always described a process as carrying `vars`, `proceed`
 * and `pending`, and `ROLE_IO` in `./types.ts` is written against those three names.
 * None of them existed: `grep -rn vars ../actions/` returned exactly one hit, in a
 * doc comment. This module is that missing foundation, and it is the thing a custom
 * process is actually made of.
 *
 * ## What a context is
 *
 * One object **per invocation**, threaded through the steps in order. Not a closure
 * variable and not a module-level singleton, and both would be wrong for the same
 * reason: a compiled process is a single reusable function, so two structures
 * running it on the same tick would share one set of variables and read each
 * other's cells. A per-invocation object makes that impossible by construction.
 *
 * ## Two namespaces, and why there are two
 *
 * - `seeds` — what the **scope** delivers. `structure.x`, `commit`, `tick`. Written
 *   once, when the context is created, and **never** written again.
 * - `vars` — what the **steps** produce. `isWater`, `hitCount`. Writable.
 *
 * The split is not tidiness. A `vars` write that could reach a seed would let an
 * `act` step replace `commit` and so redirect the engine's own write path, or
 * overwrite `structure.x` and make every later dig happen somewhere else. Seeds are
 * read-only by construction, and `varsWrite` refuses the reserved names rather than
 * quietly letting a step clobber the engine.
 *
 * ## Why a missing variable is an error
 *
 * `ref("nope")` returns `undefined` and the reference resolver turns that into a
 * reported error, not an empty string. A typo'd `{{isWatre}}` resolving to `""` would
 * reach the engine as a real value — the same class of bug as the `pwoer: 40`
 * parameter `withParams` already refuses to accept.
 *
 * @module
 */
import type { ContextSeed } from "./scope-context.ts";

export type { ContextSeed };

/** The read-only half, keyed by name. */
export type ContextSeeds = Readonly<Record<string, unknown>>;

/** The writable half, keyed by the variable name a step binds. */
export type ProcessVars = Record<string, unknown>;

/** A context for one run of a process. */
export interface ProcessContext {
    /** What the call site delivered. Frozen at construction; see the note above. */
    readonly seeds: ContextSeeds;
    /** What the steps have produced so far. */
    readonly vars: ProcessVars;
    /**
     * What the process **returns** to the engine, or `undefined` for none.
     *
     * Set by binding a step's result to the reserved name `result` (see
     * `RESULT_VAR`). This is the only way out of a program, and it exists because
     * one engine call site is defined by what the callback *returns*: a
     * `signals.registerSenderType` handler is read as a plain boolean, so a
     * declarative sender had no way to say "on" — every compiled process
     * returned `undefined` and read as permanently off.
     *
     * Separate from `vars` on purpose. A `vars` name is a step-to-step wire and is
     * meant to be read by later steps and by `{{…}}`; this one is the program's
     * value to its caller, and putting it in `vars` would invite a step to read
     * A one-field **holder object** rather than a plain `result?: unknown` field,
     * and that is not a style choice. The context is `Object.freeze`d in
     * `createContext` — deliberately, so a stray `ctx.x = 1` in an action cannot
     * corrupt the seeds — and a frozen object rejects new properties. A top-level
     * `ctx.result = v` therefore throws `TypeError: object is not extensible`, and
     * the step is swallowed by the per-step `try` in `runList`, which is exactly
     * how this looked like "a compiled process cannot return anything". `vars` is
     * already a nested mutable object for the same reason; this matches it.
     */
    readonly result: { value?: unknown };
}

/**
 * The reserved name a step binds to set what the process returns.
 *
 * Reserved for the same reason `structure.x` is: it is a name the engine's own
 * contract gives a meaning to, and letting an author bind it as an ordinary
 * variable would make `{{result}}` mean two different things in the same config
 * depending on whether a later step happened to overwrite it.
 */
export const RESULT_VAR = "result";

/** A variable a step wants to bind, and whether that is allowed. */
export type WriteResult =
    | { ok: true }
    | { ok: false; reason: "reserved" | "invalid" };

/**
 * A name an author may bind: not empty, not a seed, and shaped like an identifier.
 *
 * The shape rule is deliberately strict. These names appear inside `{{…}}` in a JSON
 * text box, and seeds already use dots for their path (`structure.x`) — so a step
 * that binds `structure.x` would be shadowing a seed, and one that binds `2fast`
 * cannot be referenced unambiguously. Both are refused at the point of binding
 * rather than at the point of use.
 */
export function canBind(name: string, ctx: ProcessContext): WriteResult {
    // **Reserved is checked first**, deliberately. `structure.x` is both a seed *and*
    // a name the identifier rule rejects, and reporting it as a shape error would
    // send the author looking for a typo in a name that is in fact perfectly correct —
    // it is the *engine's* name. "reserved" is the answer that tells them what to do.
    if (name in ctx.seeds) return { ok: false, reason: "reserved" };
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return { ok: false, reason: "invalid" };
    }
    return { ok: true };
}

/**
 * Bind a step's result to a name.
 *
 * Returns the verdict rather than throwing: a step that fails to bind must not take
 * the process down, and the caller reports it once. Rebinding a name already in use
 * is allowed — a later step overwriting an earlier one is a legitimate rebind, and
 * forbidding it would make a program impossible to write.
 */
export function varsWrite(ctx: ProcessContext, name: string, value: unknown): WriteResult {
    // `result` is the one name that is not a step-to-step wire, so it is handled
    // before `canBind` — which would otherwise reject it, since a binding target
    // has to be bindable. It is deliberately still *not* a `vars` entry: a later
    // step reading `{{result}}` would be reading the program's output mid-flight,
    // and the value the caller finally gets is the last one bound either way.
    if (name === RESULT_VAR) {
        ctx.result.value = value;
        return { ok: true };
    }
    const verdict = canBind(name, ctx);
    if (!verdict.ok) return verdict;
    ctx.vars[name] = value;
    return { ok: true };
}

/**
 * Read one name, from `vars` first and then the seeds.
 *
 * `vars` wins so a step that rebinds a name it can already see gets its own value
 * back — "last write wins", read back the same way.
 */
export function varsRead(ctx: ProcessContext, name: string): unknown {
    if (name === RESULT_VAR) return ctx.result.value;
    if (name in ctx.vars) return ctx.vars[name];
    return Object.hasOwn(ctx.seeds, name) ? ctx.seeds[name] : undefined;
}

/** Whether a name is readable at all, as opposed to merely absent. */
export function hasVar(ctx: ProcessContext, name: string): boolean {
    if (name === RESULT_VAR) return true;
    return name in ctx.vars || Object.hasOwn(ctx.seeds, name);
}

/**
 * Build a context for one invocation.
 *
 * The seeds are frozen, not merely typed read-only. `Object.freeze` is what makes
 * the read-only guarantee hold in a mixed-value world: a JavaScript caller reaching
 * in through a cast still gets a throw rather than a silent corruption of the
 * engine's own context object.
 *
 * Seeds are cloned **by reference, not deep-copied**: `commit` is a function and
 * `structure.data` is the live engine bag, and copying either would mean writing to
 * a copy the engine never sees. Read-only is a rule about *who may write*, and
 * freezing the map enforces exactly that much.
 */
export function createContext(seeds: ContextSeeds = {}): ProcessContext {
    return Object.freeze({
        seeds: Object.freeze({ ...seeds }),
        vars: {},
        // Nested and mutable for the reason in `ProcessContext.result`: the outer
        // object is frozen, so a top-level assignment would throw and the step
        // would be silently swallowed by the per-step `try` in `runList`.
        result: {},
    });
}
