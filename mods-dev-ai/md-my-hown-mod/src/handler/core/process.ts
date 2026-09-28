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
import { createContext, varsWrite } from "./context.ts";
import { refsIn, resolveRefs } from "./refs.ts";
import { seedsFor } from "./scope-context.ts";
import {
    type CallSite,
    type HandlerActionFn,
    type HandlerActionRef,
    type HandlerProcessFn,
} from "./types.ts";

export {
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    CALL_SITE_USES_RETURN,
    type CallSite,
    type HandlerActionRef,
    type HandlerProcessFn,
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

/** What `compileProcess` produced, alongside the function itself. */
export interface CompiledProcess {
    fn: HandlerProcessFn;
    callSite: CallSite;
    /** Action keys dropped because nothing resolves them. */
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
 * A step binds with the `as` field on its ref (`{ key, options, as }`). The result
 * is written after the action returns, so an action is free to `return` a value and
 * have it land in the context — which is the whole mechanism, and is why `as` is
 * checked *after* the call rather than passed in.
 */
export function compileProcess(
    refs: readonly HandlerActionRef[],
    callSite: CallSite,
    onFailure?: (f: ProcessFailure) => void,
): CompiledProcess {
    const steps: { key: string; fn: HandlerActionFn; options: unknown; as?: string }[] = [];
    const skipped: string[] = [];

    for (const ref of refs ?? []) {
        const fn = resolveAction(ref.key);
        if (typeof fn !== "function") {
            skipped.push(ref.key);
            continue;
        }
        steps.push({
            key: ref.key,
            fn,
            options: ref.options,
            as: typeof ref.as === "string" && ref.as ? ref.as : undefined,
        });
    }

    // A ref only counts as using the context if it actually *does* something: binds
    // a name, or reads one. A process of five actions that share nothing is not a
    // process that has a context.
    const usesContext = steps.some((s) => !!s.as) ||
        steps.some((s) => refsIn(s.options).size > 0);

    const fn: HandlerProcessFn = (...args: unknown[]) => {
        const [payload, ctx] = args;
        // Per invocation, so two structures running this on the same tick cannot see
        // each other's variables. See `context.ts` for why this is not a closure.
        const context = createContext(seedsFor(callSite, args));
        for (const step of steps) {
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
        }));
}
