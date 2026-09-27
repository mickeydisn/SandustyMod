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
 *
 * So payload and params come from **two different places and never meet**: the
 * engine supplies the payload, the config supplies the params, and until now
 * nothing joined them. Binding each action's options at compile time is what
 * makes the pair work — and it is the bug this module exists to fix, not a
 * convenience.
 *
 * ## The one slot that is *not* a process
 *
 * `projectile.getOptions()` is not in that table, and not in `CallSite`, because
 * it is a different kind of call: the engine passes it nothing and **reads its
 * return** as the projectile's configuration. Modelling it
 * as a process meant a projectile could hold a *list* of handlers whose returns
 * were merged field-by-field into a configuration nobody designed. A projectile
 * now holds exactly one `ProjectileOption` — see `./projectile-option/`, which has
 * its own signature, its own compiler and its own panel.
 *
 * `processorConvert` is the clearest casualty: its `to` option is declared
 * `required: true`, the panel forces the author to fill it in, and the engine
 * never passes it — so the action always takes its "nothing to convert to" branch
 * and only logs. An author's required field, silently ignored.
 *
 * ## How the two meet
 *
 * `compileProcess` is the only place a process exists at runtime. Registration calls
 * it at the six effect slots, and the 15 `ANY_HANDLERS` are re-signed
 * `(payload, ctx, options)` alongside it — either half alone breaks the other,
 * which is why they are sequenced as one. `resolveAnyHandler` survives only for the
 * catalog's benefit; see the note on it.
 */
import { ANY_HANDLERS, CODE_HANDLERS, PROCESS_HANDLERS } from "./handlers.ts";

// ── The call site axis ───────────────────────────────────────────────────────

/**
 * The engine entry point that invokes a process. A process is grouped by this;
 * its actions are grouped by API. The two axes are independent on purpose.
 *
 * **`projectile` is not a call site.** It is absent, and that is what stops a
 * projectile holding an ordered *list* of handlers whose returns were merged into
 * one options object. `getOptions()` is called with no arguments and its return is
 * the configuration itself, so a projectile holds one `ProjectileOption` — see
 * `./projectile-option/`. Every site below is a genuine side-effect callback.
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

/**
 * Whether the engine reads what a process returns.
 *
 * **Every entry is `false`, and that is the point.** The flag exists so a site
 * that *reads* a return can never be added without noticing: `getOptions()` is
 * not a call site, it takes a single
 * `ProjectileOption` and returns the configuration directly (see
 * `./projectile-option/`). With no site left that reads a return, a process
 * composes actions purely for their side effects.
 *
 * The flag is kept rather than deleted because it is a **measured** fact about the
 * engine's seven callbacks, and a test asserts the table stays all-`false`. If a
 * future engine version starts reading a return from one of these, that test is
 * where it should fail — not in a spawn that quietly returns nothing.
 */
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
 *  - **Return values are ignored.** Every remaining call site is a side-effect
 *    callback, so nothing reads what an action returns. A projectile is *not* one
 *    of them any more: it holds a single `ProjectileOption` and is compiled by
 *    `./projectile-option/compile.ts`, not here.
 */
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

/**
 * Read a stored config entry's actions, migrating the pre-split single-key shape.
 *
 * The config shape is changing from `handlerKey: "x"` to
 * `actions: [{ key, options }]`, and configs already on disk have the old one.
 * A bare legacy key is read as a one-action process so an existing mod keeps
 * working, and the next save writes the new form.
 *
 * Both remaining legacy names are consulted rather than one per call site, because
 * they are just spelling: `handlerKey` on signal/trigger/processing/modifier/item,
 * `onUpgradeKey` on upgrade. A caller that has to know which is which is a caller
 * that will eventually get it wrong, and the result would be a process that
 * silently vanishes.
 *
 * `getOptionsKey` is **not** an action key — a projectile holds one
 * `ProjectileOption`, and that lives in `./projectile-option/compile.ts`. Reading
 * it as an action would have kept `projectileHeavy` resolvable through
 * `resolveAction` and quietly preserved the conflation the split removes.
 */
export const ACTIONS_LEGACY_KEYS = ["handlerKey", "onUpgradeKey"] as const;

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
