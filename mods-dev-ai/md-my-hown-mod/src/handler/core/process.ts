/**
 * A **HandlerProcess**: action references compiled into one function.
 *
 * The engine never delivers parameters — of six action-resolution call sites,
 * only `itemAction` binds a third argument. Compile time joins the engine's
 * payload to the config's options.
 *
 * `projectile.getOptions()` is not a process: the engine reads its return, so a
 * projectile holds one `ProjectileOption` — see `../projectile-option/`.
 *
 * ## Where the actions come from
 *
 * `../actions/index.ts` — one flat `key → StoredAction` table assembled from the
 * six role folders. This module no longer knows that actions used to live in
 * three separate registries; it asks for a key and gets a function.
 *
 * The call-site axis (what the engine hands an action) is declared in `./types.ts`
 * alongside the role axis, because the two are independent: a `sense` action can
 * be `payload`-signed or `processing`-signed without changing what it is for.
 */

import { resolveAction } from "../actions/index.ts";
import { createContext, type ProcessContext, varsRead, varsWrite } from "./context.ts";
import { refsIn, resolveRefs } from "./refs.ts";
import { seedsFor } from "./scope-context.ts";
import {
    type CallSite,
    type HandlerActionFn,
    type HandlerActionRef,
    type HandlerProcessFn,
    isBlock,
} from "./types.ts";

export {
    BLOCK_KEY,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    CALL_SITE_USES_RETURN,
    type CallSite,
    flattenRefs,
    type HandlerActionRef,
    type HandlerProcessFn,
    isBlock,
} from "./types.ts";

// `resolveAction` lives with the catalogue in `../actions/index.ts` — one table,
// one lookup order. It is re-exported here because `process.ts` is what
// registration already imports from, and a caller asking for "the process
// compiler" should not have to know the resolver moved.
export { resolveAction } from "../actions/index.ts";

// ── The compiler ─────────────────────────────────────────────────────────────

/** What went wrong while a process ran. Surfaced rather than swallowed. */
export interface ProcessFailure {
    key: string;
    error: unknown;
}

/**
 * How deep blocks may nest.
 *
 * A hand-written config can nest as far as the author likes and the compiler is
 * recursive. Eight is far past anything readable in a panel, and shallow enough that a
 * pathological config reports "too deep" instead of overflowing the stack on a tick.
 */
export const MAX_BLOCK_DEPTH = 8;

/** A compiled step: either a resolved action, or a decision between two step lists. */
type CompiledStep =
    | {
        kind: "step";
        key: string;
        fn: HandlerActionFn;
        options: unknown;
        as?: string;
    }
    | {
        kind: "block";
        key: string;
        /** The context variable whose truthiness picks the branch. */
        test: string;
        then: CompiledStep[];
        otherwise: CompiledStep[];
    };

/** What `compileProcess` produced, alongside the function itself. */
export interface CompiledProcess {
    fn: HandlerProcessFn;
    callSite: CallSite;
    /** Action keys dropped because nothing resolves them. Blocks included. */
    skipped: string[];
    /**
     * Whether any step wrote a value another step could read.
     *
     * Read by the panel to say "this process shares nothing" — an author who wired
     * no variables and can see no way to would otherwise have to read the JSON to
     * find out whether the feature works here.
     */
    usesContext: boolean;
}

/**
 * Turn action refs into one callable: ordered, never deduped, each action isolated,
 * `options` bound here.
 *
 * ## The context argument
 *
 * The engine delivers `(payload, ctx)` — and only `itemAction` binds a third. The
 * process context is therefore **not** an engine argument: it is created here, per
 * invocation, from the scope's seeds, and threaded to the steps as a **fourth**
 * argument that no existing action reads. That is what lets this change be additive:
 * all 36 actions keep their current three-argument signature and ignore it.
 *
 * A step binds with the `as` field on its ref (`{ key, options, as }`). The result is
 * written after the action returns, so an action is free to `return` a value and have
 * it land in the context.
 *
 * ## Blocks
 *
 * A `BLOCK_KEY` ref compiles to a decision between two step lists instead of a call.
 * Its condition is the **truthiness of a named context variable** — not an expression.
 * That is deliberate, and it is what keeps the one rule this system has: a block
 * *branches*, it never *computes*. The truth value is something an earlier step already
 * produced, so there is still no way to write a test-and-return in a config, and the
 * author can still read the whole decision off the panel.
 *
 * The consequence worth stating: a block whose variable was never bound takes the
 * `else` branch, not an error. An unbound name is a missing binding rather than a
 * false claim, and the compiler cannot tell those apart — the reference resolver
 * reports the missing name separately. A branch that quietly did nothing is far better
 * than a tick that threw.
 */
export function compileProcess(
    refs: readonly HandlerActionRef[],
    callSite: CallSite,
    onFailure?: (f: ProcessFailure) => void,
): CompiledProcess {
    const skipped: string[] = [];
    let usesContext = false;

    /**
     * Compile one list of refs, recursively.
     *
     * The result is the same shape at every depth, so a branch compiles exactly like
     * the top level — there is no separate "block compiler" that could drift from the
     * one above it.
     */
    const compileList = (list: readonly HandlerActionRef[], depth: number): CompiledStep[] => {
        const out: CompiledStep[] = [];
        for (const ref of list ?? []) {
            if (!ref || typeof ref.key !== "string" || !ref.key) continue;

            if (isBlock(ref)) {
                if (depth >= MAX_BLOCK_DEPTH) {
                    onFailure?.({
                        key: ref.key,
                        error: `blocks nested deeper than ${MAX_BLOCK_DEPTH}`,
                    });
                    continue;
                }
                const test = String((ref.options as { var?: unknown } | undefined)?.var ?? "");
                if (!test) {
                    // A block that cannot name what it is testing would pick a branch
                    // arbitrarily. Refuse rather than guess.
                    onFailure?.({ key: ref.key, error: "an if block needs options.var" });
                    continue;
                }
                // A block reads a name, so it *is* a use of the context.
                usesContext = true;
                out.push({
                    kind: "block",
                    key: ref.key,
                    test,
                    then: compileList(ref.then ?? [], depth + 1),
                    otherwise: compileList(ref.else ?? [], depth + 1),
                });
                continue;
            }

            if (ref.then || ref.else) {
                // Branches on a step that is not a block. Following them would need a
                // step that is both called and branched on; ignoring them would leave
                // steps in the config that never run. Report and drop.
                onFailure?.({ key: ref.key, error: "only an if block may have then/else" });
            }
            const fn = resolveAction(ref.key);
            if (typeof fn !== "function") {
                skipped.push(ref.key);
                continue;
            }
            const as = typeof ref.as === "string" && ref.as ? ref.as : undefined;
            // A ref only counts as using the context if it actually *does* something:
            // binds a name, or reads one. A process of five actions that share nothing
            // is not a process that has a context.
            if (as) usesContext = true;
            if (refsIn(ref.options).size > 0) usesContext = true;
            out.push({ kind: "step", key: ref.key, fn, options: ref.options, as });
        }
        return out;
    };

    const steps = compileList(refs, 0);

    /** Run one compiled list. Shared by the top level and by every branch. */
    const runList = (
        list: readonly CompiledStep[],
        payload: unknown,
        ctx: unknown,
        context: ProcessContext,
    ): void => {
        for (const step of list) {
            if (step.kind === "block") {
                runList(
                    varsRead(context, step.test) ? step.then : step.otherwise,
                    payload,
                    ctx,
                    context,
                );
                continue;
            }
            try {
                const { value, problems } = resolveRefs(
                    step.options as Record<string, unknown> | undefined,
                    context,
                    step.key,
                );
                for (const p of problems) onFailure?.({ key: step.key, error: p.name });
                const returned = step.fn(payload, ctx, value, context);
                if (step.as) {
                    const written = varsWrite(context, step.as, returned);
                    if (!written.ok) {
                        onFailure?.({ key: step.key, error: written.reason });
                    }
                }
            } catch (error) {
                // Isolated on purpose — see the doc comment.
                onFailure?.({ key: step.key, error });
            }
        }
    };

    const fn: HandlerProcessFn = (...args: unknown[]) => {
        const [payload, ctx] = args;
        // Per invocation, so two structures running this on the same tick cannot see
        // each other's variables. See `context.ts` for why this is not a closure.
        const context = createContext(seedsFor(callSite, args));
        runList(steps, payload, ctx, context);
    };

    return { fn, callSite, skipped, usesContext };
}

/** Read a stored entry's `actions` array. A pre-split `handlerKey` is not a process, and is left in place. */
export function actionRefsOf(entry: Record<string, unknown> | undefined): HandlerActionRef[] {
    if (!entry) return [];
    if (!Array.isArray(entry.actions)) return [];
    return (entry.actions as Record<string, unknown>[])
        .filter((a) => typeof a?.key === "string" && a.key)
        .map((a) => ({
            key: String(a.key),
            options: (a.options as Record<string, unknown> | undefined) ?? undefined,
            // Branches survive the read, or a saved `if` would come back as a bare step
            // and silently lose both arms. `as` too — it has always been dropped here,
            // which means a `as`-bound step lost its name the moment it was reloaded.
            ...(typeof a.as === "string" && a.as ? { as: a.as } : {}),
            ...(Array.isArray(a.then) ? { then: actionRefsOf({ actions: a.then }) } : {}),
            ...(Array.isArray(a.else) ? { else: actionRefsOf({ actions: a.else }) } : {}),
        }));
}
