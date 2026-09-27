/**
 * A **HandlerProcess**: action references compiled into one function.
 *
 * The engine never delivers parameters — of six `resolveAnyHandler` call sites,
 * only `itemAction` binds a third argument. Compile time joins the engine's
 * payload to the config's options.
 *
 * `projectile.getOptions()` is not a process: the engine reads its return, so a
 * projectile holds one `ProjectileOption` — see `./projectile-option/`.
 */

import { ANY_HANDLERS, CODE_HANDLERS, PROCESS_HANDLERS } from "./handlers.ts";

// ── The call site axis ───────────────────────────────────────────────────────

/**
 * The engine entry point that invokes a process, grouped by this; its actions
 * by API. The axes are independent.
 *
 * **`projectile` is not a call site** — it holds one `ProjectileOption`.
 */
export type CallSite =
    | "signal"
    | "trigger"
    | "processing"
    | "itemAction"
    | "upgrade"
    | "behavior"
    | "modifier";

export const CALL_SITE_LABELS: Record<CallSite, string> = {
    signal: "Structure click",
    trigger: "Timed tick",
    processing: "Process step",
    itemAction: "Item use",
    upgrade: "Upgrade applied",
    behavior: "Key press",
    modifier: "Engine hook",
};

/** The engine's own call, for the hint text. These are measured, not invented. */
export const CALL_SITE_SIGNATURES: Record<CallSite, string> = {
    signal: "handler(structure)",
    trigger: "callback()",
    processing: "process(structure, context)",
    itemAction: "handleAction(state, action)",
    upgrade: "onUpgrade(item)",
    behavior: "onDownKey(key) / onUpKey(key)",
    modifier: "intercept(args, ctx) / modify(args)",
};

/** Whether the engine reads a process's return. Every entry is `false`, and a test holds it that way. */
export const CALL_SITE_USES_RETURN: Record<CallSite, boolean> = {
    signal: false,
    trigger: false,
    processing: false,
    itemAction: false,
    upgrade: false,
    behavior: false,
    modifier: false,
};

// ── The action axis ──────────────────────────────────────────────────────────

/** One entry in a process: which action, and the params it runs with. */
export interface HandlerActionRef {
    key: string;
    options?: Record<string, unknown>;
}

/** `(payload, ctx, options)` for every action. `options` is bound by the compiler, not the engine. */
export type HandlerActionFn = (
    payload: unknown,
    ctx: unknown,
    options: unknown,
) => unknown;

/** The compiled process — shaped like whatever the engine will call. */
export type HandlerProcessFn = (...args: unknown[]) => unknown;

/** Look up an action by key across all three registries. */
export function resolveAction(key: string): HandlerActionFn | undefined {
    const any = (ANY_HANDLERS as Record<string, unknown>)[key] as
        | HandlerActionFn
        | undefined;
    const proc = (PROCESS_HANDLERS as Record<string, unknown>)[key] as
        | HandlerActionFn
        | undefined;
    // The modifier slot lives in `CODE_HANDLERS`, whose values are `{ kind, fn }`
    // **objects** rather than bare functions — so it has to be unwrapped, and that
    // extra shape is exactly why `resolveAnyHandler` (the pre-split lookup) never
    // found these three. Resolving all three registries is what makes one
    // catalogue rather than three.
    const code = (CODE_HANDLERS as Record<string, unknown>)[key] as
        | { fn?: HandlerActionFn }
        | undefined;
    return any ?? proc ?? code?.fn;
}

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
}

/** Turn action refs into one callable: ordered, never deduped, each action isolated, `options` bound here. */
export function compileProcess(
    refs: readonly HandlerActionRef[],
    callSite: CallSite,
    onFailure?: (f: ProcessFailure) => void,
): CompiledProcess {
    const steps: { key: string; fn: HandlerActionFn; options: unknown }[] = [];
    const skipped: string[] = [];

    for (const ref of refs ?? []) {
        const fn = resolveAction(ref.key);
        if (typeof fn !== "function") {
            skipped.push(ref.key);
            continue;
        }
        steps.push({ key: ref.key, fn, options: ref.options });
    }

    const fn: HandlerProcessFn = (...args: unknown[]) => {
        const [payload, ctx] = args;
        for (const step of steps) {
            try {
                step.fn(payload, ctx, step.options);
            } catch (error) {
                // Isolated on purpose — see the doc comment.
                onFailure?.({ key: step.key, error });
            }
        }
    };

    return { fn, callSite, skipped };
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
