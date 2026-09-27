/**
 * A **HandlerProcess**: the thing an object links to, composed of HandlerActions.
 *
 * This is the only place a process exists at runtime. A process is not a function
 * anyone wrote — it is a list of action references *compiled* into one function
 * that matches the engine's call, and that is the whole point of the split:
 *
 *   - a **HandlerAction** is atomic, reusable, and lives in code
 *   - a **HandlerProcess** is a per-object composition, and lives in config
 *
 * ## Why the compiler exists at all
 *
 * Because **the engine never delivers parameters.** Measured across all six
 * `resolveAnyHandler` call sites in `apply.ts`, every one of them hands the raw
 * function to the engine and binds nothing:
 *
 * | call site | engine calls | action signature | params delivered? |
 * | --- | --- | --- | --- |
 * | `processing` | `process(structure, context)` | `(structure, context, options)` | **no** — 3rd arg never arrives |
 * | `signal` | `handler(structure)` | `(payload, extra)` | **no** |
 * | `trigger` | `callback()` | `(payload, extra)` | **no** — no args at all |
 * | `behavior` | `onDownKey(key)` | `(payload, extra)` | **no** |
 * | `itemAction` | `handleAction(state, action)` | `(item, extra)` | yes — `mysandkit` sets `out.options` |
 * | `projectile` | `getOptions()` | `() => options` | n/a |
 *
 * So payload and params come from **two different places and never meet**: the
 * engine supplies the payload, the config supplies the params, and until now
 * nothing joined them. Binding each action's options at compile time is what
 * makes the pair work — and it is the bug this module exists to fix, not a
 * convenience.
 *
 * `processorConvert` is the clearest casualty: its `to` option is declared
 * `required: true`, the panel forces the author to fill it in, and the engine
 * never passes it — so the action always takes its "nothing to convert to" branch
 * and only logs. An author's required field, silently ignored.
 *
 * ## How the two meet
 *
 * `compileProcess` is the only place a process exists at runtime. Registration calls
 * it at all seven slots, and the 15 `ANY_HANDLERS` that used to read their options
 * from argument 2 were re-signed to `(payload, ctx, options)` **in the same change** —
 * either half alone breaks the other, which is why they were sequenced as one.
 * `resolveAnyHandler` survives only for the catalog's benefit; see the note on it.
 */
import { ANY_HANDLERS, CODE_HANDLERS, PROCESS_HANDLERS } from "./handlers.ts";

// ── The call site axis ───────────────────────────────────────────────────────

/**
 * The engine entry point that invokes a process. A process is grouped by this;
 * its actions are grouped by API. The two axes are independent on purpose.
 */
export type CallSite =
    | "signal"
    | "trigger"
    | "processing"
    | "itemAction"
    | "projectile"
    | "upgrade"
    | "behavior"
    | "modifier";

export const CALL_SITE_LABELS: Record<CallSite, string> = {
    signal: "Structure click",
    trigger: "Timed tick",
    processing: "Process step",
    itemAction: "Item use",
    projectile: "Projectile spawn",
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
    projectile: "getOptions()",
    upgrade: "onUpgrade(item)",
    behavior: "onDownKey(key) / onUpKey(key)",
    modifier: "intercept(args, ctx) / modify(args)",
};

/**
 * Whether the engine reads what the process returns.
 *
 * Measured: only `projectile` does. Everything else is a side-effect callback,
 * so a process there composes actions and returns nothing — which is why the
 * merge rule below is a small question rather than a general one.
 */
export const CALL_SITE_USES_RETURN: Record<CallSite, boolean> = {
    signal: false,
    trigger: false,
    processing: false,
    itemAction: false,
    projectile: true,
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

/**
 * The canonical action signature.
 *
 * `(payload, ctx, options)` for every action, whatever registry it came from.
 * `payload` and `ctx` are the engine's; `options` is bound by the compiler from
 * the process' own config, which is the pair the engine never makes itself.
 */
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

// ── The return-value rule ────────────────────────────────────────────────────

/** A plain object — the only thing two action returns may be merged across. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Combine what two actions returned.
 *
 * Plain objects merge, last writer wins per key. Anything else — an array, a
 * number, `null` — **replaces** the accumulated value outright and is terminal:
 * there is no sensible way to merge a projectile's options with a number, and
 * silently half-applying one would be worse than picking one.
 *
 * A one-action process therefore behaves exactly as that action did before the
 * split, which is what makes the whole thing backward-compatible.
 */
export function mergeProcessValue(prev: unknown, next: unknown): unknown {
    if (next === undefined) return prev;
    if (isPlainObject(prev) && isPlainObject(next)) return { ...prev, ...next };
    return next;
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

/**
 * Turn a list of action refs into one function the engine can call.
 *
 * Behaviour, and why each part:
 *
 *  - **Ordered.** The list *is* the process. "log then convert" and "convert then
 *    log" are different behaviours, so nothing is sorted or deduplicated — the
 *    same action may appear twice with different options.
 *  - **Params bound here.** `options` is captured per action and passed as the
 *    third argument. This is the fix: the engine does not deliver them.
 *  - **One failure does not stop the chain.** Each action is isolated and the
 *    rest still run. Fail-fast would mean a single bad action silently disables
 *    every action after it — a far worse failure than the one that caused it.
 *  - **Unknown keys are dropped, not fatal.** A bad reference in one action
 *    should not cost the author the rest of the process, so it warns and the
 *    remaining actions survive.
 *  - **An empty process is legal.** It compiles to a no-op that still satisfies
 *    the engine, so a process can be saved before its actions are chosen.
 */
export function compileProcess(
    refs: readonly HandlerActionRef[],
    callSite: CallSite,
    onFailure?: (f: ProcessFailure) => void,
): CompiledProcess {
    const usesReturn = CALL_SITE_USES_RETURN[callSite];
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
        let result: unknown;
        for (const step of steps) {
            try {
                const value = step.fn(payload, ctx, step.options);
                if (usesReturn) result = mergeProcessValue(result, value);
            } catch (error) {
                // Isolated on purpose — see the doc comment.
                onFailure?.({ key: step.key, error });
            }
        }
        return usesReturn ? result : undefined;
    };

    return { fn, callSite, skipped };
}

/**
 * Read a stored config entry's actions, migrating the pre-split single-key shape.
 *
 * The config shape is changing from `handlerKey: "x"` to
 * `actions: [{ key, options }]`, and configs already on disk have the old one.
 * A bare legacy key is read as a one-action process so an existing mod keeps
 * working, and the next save writes the new form.
 *
 * All three legacy names are consulted rather than one per call site, because
 * they are just spelling: `handlerKey` on signal/trigger/processing/modifier/item,
 * `getOptionsKey` on projectile, `onUpgradeKey` on upgrade. A caller that has to
 * know which is which is a caller that will eventually get it wrong, and the
 * result would be a process that silently vanishes.
 */
export const ACTIONS_LEGACY_KEYS = ["handlerKey", "getOptionsKey", "onUpgradeKey"] as const;

export function actionRefsOf(entry: Record<string, unknown> | undefined): HandlerActionRef[] {
    if (!entry) return [];
    if (Array.isArray(entry.actions)) {
        return (entry.actions as Record<string, unknown>[])
            .filter((a) => typeof a?.key === "string" && a.key)
            .map((a) => ({
                key: String(a.key),
                options: (a.options as Record<string, unknown> | undefined) ?? undefined,
            }));
    }
    // The pre-split shape: one key, and no params — they were never delivered.
    for (const legacy of ACTIONS_LEGACY_KEYS) {
        const k = entry[legacy];
        if (typeof k === "string" && k) return [{ key: k, options: undefined }];
    }
    return [];
}
