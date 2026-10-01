// deno-lint-ignore-file no-explicit-any -- `hostNs` below is the action system's one
// deliberate cast, and every action file reaches the engine through it precisely so
// that no other file has to write one. The comment above that function explains it.

/**
 * The sandbox the host injects. Declared here rather than pulled from the engine's
 * `.d.ts` files, which are not part of this mod's dependency graph — see the note
 * on `hostApi` below, which is the only thing that reads it.
 */
declare const sandkit: any;

/**
 * The vocabulary every action file speaks.
 *
 * ## Why the roles exist
 *
 * The old split was three registries — `ANY_HANDLERS`, `PROCESS_HANDLERS`,
 * `CODE_HANDLERS` — and the split axis was **which engine argument list the action
 * takes**. That is real (the signatures genuinely differ) but it is not what a
 * person building a mod is thinking about. Someone asks "how do I make this thing
 * *read* a cell", "how do I make it *decide* something", "how does it *write*" —
 * not "does it want `extra` or `context`".
 *
 * So actions are now filed by **role**, and the signature is metadata on the
 * action rather than a reason to put it in a different bag. Both views are kept:
 * `signature` says which argument list the engine will hand it, `role` says what
 * the author is trying to do. A role directory may hold actions of either
 * signature.
 *
 * The six roles are walked in the same order in `HandlerAction.md` §2–§7.
 *
 * @module
 */

// ── The role axis ────────────────────────────────────────────────────────────

/** What an action is *for*. The axis a person building a mod thinks in. */
export type ActionRole =
    | "sense"
    | "decide"
    | "act"
    | "remember"
    | "feel"
    | "connect"
    | "logic";

/** Display order and section headings, for the panel and the docs. */
export const ACTION_ROLES: readonly ActionRole[] = [
    "sense",
    "decide",
    "act",
    "remember",
    "feel",
    "connect",
    "logic",
] as const;

export const ROLE_LABELS: Record<ActionRole, string> = {
    sense: "Sense",
    decide: "Decide",
    act: "Act",
    remember: "Remember",
    feel: "Feel",
    connect: "Connect",
    logic: "Logic",
};

export const ROLE_BLURBS: Record<ActionRole, string> = {
    sense: "Look at the world. Changes nothing.",
    decide: "Ask a question. A false answer skips the rest of the process.",
    act: "Change a cell.",
    remember: "Write state that survives the save.",
    feel: "Feedback the player can see or hear.",
    connect: "Reach an engine system: power, tech, signals, items.",
    logic: "Walk a range of cells. The only place a process may loop.",
};

/**
 * The reading/writing table, in one place, because it is the contract §8 of
 * `HandlerAction.md` describes and a role folder should not restate it.
 */
export const ROLE_IO: Record<ActionRole, { reads: string; writes: string }> = {
    sense: { reads: "engine, vars", writes: "vars" },
    decide: { reads: "vars, engine", writes: "proceed" },
    act: { reads: "vars", writes: "pending" },
    remember: { reads: "vars", writes: "structure.data" },
    feel: { reads: "vars", writes: "the screen" },
    connect: { reads: "vars", writes: "the engine" },
    logic: { reads: "vars, engine, cells", writes: "vars, pending" },
};

// ── The signature axis ───────────────────────────────────────────────────────

/**
 * Which engine argument list an action expects.
 *
 * This is the reason the old three registries were separate, and it is real: the
 * engine hands different things to different call sites. It is recorded per
 * action now, instead of deciding which file the action lives in.
 *
 * - `payload`    — `(payload, extra)`. The general case: signals, triggers, items.
 * - `processing` — `(structure, context, options)`. Only `process(structure, ctx)`.
 * - `modifier`   — `{ kind, fn }`. Only the `hooks.intercept` / `hooks.modify` slot,
 *                  which is the one place the engine must know whether the action
 *                  can cancel before it runs.
 */
export type ActionSignature = "payload" | "processing" | "modifier";

/**
 * `(payload, ctx, options)` — the shape every non-modifier action is stored as.
 *
 * The return is `unknown` rather than `void` because a step's return value is what
 * gets bound into the process context under its `as` name (see `HandlerActionRef`).
 * That makes returning something the **normal** way for a `sense` action to answer a
 * question, and an action that returns nothing simply binds `undefined` — which is a
 * real state a later step can still read, not an error.
 *
 * A **fourth** parameter — the process context — is accepted and ignored. It is not
 * in this signature on purpose: no action is required to read the context directly
 * (it reaches them as resolved `options` instead), and declaring it would make every
 * action in the catalogue look like it should. `compileProcess` passes it for the
 * benefit of any action that *wants* the whole object; TypeScript's arity check
 * allows a function that ignores an extra argument.
 */
export type HandlerActionFn = (
    payload: unknown,
    ctx: unknown,
    options: unknown,
    context?: unknown,
) => unknown;

/**
 * The host's `sandkit.api`, typed as an open record.
 *
 * An action folder needs the api but cannot import its type: the engine's `.d.ts`
 * files are not part of this mod's dependency graph, and importing them for the
 * type alone would make every action file depend on the engine. `Record<string,
 * unknown>` says "indexable, untrusted" without `any`, so the optional-chain guards
 * below stay honest and the linter stays quiet.
 *
 * ## The resolution order, and why `globalThis` alone was not enough
 *
 * The host evaluates a mod as
 * `new Function("__sandkit", "const sandkit = __sandkit; return (async () => { … })()")`,
 * so `sandkit` is a **parameter in the mod's own scope** — it is not a property of
 * the global object. A probe of the running game confirmed it:
 *
 * ```
 * scoped=object scoped.api=object globalThis.sandkit=undefined
 * ```
 *
 * Reading only `globalThis.sandkit` therefore yielded `undefined`, `hostNs()`
 * returned `undefined` for every namespace, and **every action in every role folder
 * silently no-opped** — `hostNs("grid")?.mutate?.(…)` is an optional call on
 * `undefined`, so the failure surfaced as `return false` with nothing logged. The
 * unit tests could not catch it, because they supply a mocked api and so prove the
 * action's logic without ever asking whether the real host was reachable.
 *
 * `globalThis` is kept as a **fallback**, not discarded: it is what the worker
 * scope and any test harness provide, and `mysandkit.ts`'s `g()` resolves the same
 * two sources in the same order. Reading through a helper rather than
 * `(globalThis as any).sandkit` also means a missing host produces `undefined`
 * instead of a TypeError — the difference between an action that no-ops and one
 * that throws mid-process.
/**
 * The engine interface, re-exported for the action files.
 *
 * From `../../host.ts` — the leaf — and **not** from `packages/mysandkit.ts`.
 * That file imports `handler/custom-process` and `handler/excavation-option` to
 * compile stored processes, and `handler-registry.ts` initialises `process.ts`
 * state at load, so importing it from here closes the cycle and throws
 * `Cannot access 'BLOCK_KEY' before initialization` before any action runs.
 * `host.ts` is the same `api` object, minus the two registration helpers that
 * need the handler.
 */
export { api } from "../../host.ts";

export function hostApi(): Record<string, unknown> | undefined {
    // The injected parameter. Present in the real mod scope; absent in a worker
    // test, hence the guard rather than a bare reference.
    try {
        if (typeof sandkit !== "undefined" && sandkit) {
            const api = (sandkit as { api?: Record<string, unknown> }).api;
            if (api) return api;
        }
    } catch {
        // not injected in this scope — fall through
    }
    try {
        // The `unknown` hop is what the first cast did not need and this one
        // does. The buffer package imports the real `@sandmd/sandkit`, which puts
        // a **typed** `sandkit` global in scope for the whole program — and
        // `SandkitApi` has no string index signature, so casting it straight to
        // `{ api?: Record<string, unknown> }` is now an error rather than a
        // widening. Going through `unknown` says what is actually meant: this
        // mod reads the host structurally, not by its declared type.
        return (globalThis as unknown as { sandkit?: { api?: Record<string, unknown> } })
            .sandkit?.api;
    } catch {
        return undefined;
    }
}

/**
 * One namespace of the host api, still untyped.
 *
 * `hostApi().grid` is `unknown`, so an action cannot chain further into it without a
 * cast at every level. This is the single place that cast happens, and it is why an
 * action file can read `hostNs("grid")?.excavateAtCell?.(…)` with no `any` of its
 * own.
 */
export function hostNs(...path: string[]): Record<string, any> | undefined {
    let node: unknown = hostApi();
    for (const key of path) {
        // `typeof` is `"function"` for the function-object the measurement probes
        // use as a proxy target, and `"object"` for a real namespace. Both are
        // indexable, so both are accepted — checking only for `"object"` made
        // `hostNs` return `undefined` under every probe and silently broke the
        // scope measurement, which is a wrong answer rather than a missing one.
        if (node === null || (typeof node !== "object" && typeof node !== "function")) {
            return undefined;
        }
        node = (node as Record<string, unknown>)[key];
    }
    return node !== null && (typeof node === "object" || typeof node === "function")
        ? (node as Record<string, any>)
        : undefined;
}

/**
 * A modifier action, stored as an object rather than a bare function.
 *
 * The `kind` is not an action detail — it is the engine's own two modes, and a
 * modifier slot needs to know which one it is before it runs.
 */
export interface ModifierAction {
    kind: "intercept" | "modify";
    fn: HandlerActionFn;
}

/** One action, as a role folder declares it. */
export interface ActionDef {
    /** What it does, in one line. Shown in the picker beside the key. */
    doc: string;
    /** What the action is for. Determines the section it appears under. */
    role: ActionRole;
    /** The callable. */
    fn: HandlerActionFn;
    /** For the `modifier` signature only: intercept can cancel, modify cannot. */
    kind?: "intercept" | "modify";
}

/** An action as stored, with its signature resolved. */
export interface StoredAction extends ActionDef {
    signature: ActionSignature;
}

// ── Declaring actions ────────────────────────────────────────────────────────

/**
 * Build a role folder's table of actions.
 *
 * Exists so the compiler can read each action's `role` without re-parsing source,
 * and so a missing field is a type error rather than an `undefined` surfacing at
 * registration time. The signature is stamped at the barrel, because every action
 * in one file shares it.
 */
export function defineActions<T extends Record<string, ActionDef>>(defs: T): T {
    return defs;
}

/**
 * As `defineActions`, but for the `modifier` signature.
 *
 * Separate because `kind` is required there and meaningless elsewhere: without
 * this, a modifier action could be declared without the one field the engine
 * slot actually needs.
 */
export function defineModifiers<
    T extends Record<string, ActionDef & { kind: "intercept" | "modify" }>,
>(defs: T): T {
    return defs;
}

// ── The call site axis ───────────────────────────────────────────────────────

/**
 * The key that marks a ref as a **block** rather than an action.
 *
 * A block is a decision, not a step: the compiler reads it and never looks it up in the
 * action catalogue. It is a plain string rather than a separate type so that a block
 * and a step share one list, one JSON round trip, and one panel field — a process
 * stays an *array*, with nesting inside it rather than beside it.
 */
export const BLOCK_KEY = "if";

/** One entry in a process: a step, or a block that holds steps. */
export interface HandlerActionRef {
    key: string;
    options?: Record<string, unknown>;
    /**
     * The context variable this step's **return value** is bound to.
     *
     * The whole mechanism of the process context, in one field. It is read *after* the
     * action returns rather than passed in, so an action is an ordinary
     * `(payload, ctx, options)` function that happens to return something — no
     * action has to know the context exists, and every existing one already
     * satisfies this unchanged.
     *
     * A seed name is refused at write time (`varsWrite`), so a step cannot shadow
     * `structure.x` or `commit`.
     */
    as?: string;
    /**
     * The `then` branch, for a `BLOCK_KEY` ref. The steps run when the block's
     * condition is truthy.
     */
    then?: HandlerActionRef[];
    /** The `else` branch. Runs when the condition is falsy; absent means "nothing". */
    else?: HandlerActionRef[];
}

/** `true` when this ref is a decision block rather than a step. */
export function isBlock(ref: HandlerActionRef): boolean {
    return ref.key === BLOCK_KEY;
}

/** Every ref in a process, blocks included, depth-first. For counts and usage scans. */
export function flattenRefs(refs: readonly HandlerActionRef[]): HandlerActionRef[] {
    const out: HandlerActionRef[] = [];
    const walk = (list: readonly HandlerActionRef[]) => {
        for (const r of list) {
            out.push(r);
            if (r.then) walk(r.then);
            if (r.else) walk(r.else);
        }
    };
    walk(refs);
    return out;
}

/** The compiled process — shaped like whatever the engine will call. */
export type HandlerProcessFn = (...args: unknown[]) => unknown;

/**
 * Where the engine invokes a compiled process. Independent of the role axis: a
 * `modifier` action is not a special kind of thing, it is an action on a
 * different call site.
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

/** Whether the engine reads a process's return. Every entry is `false`, and a test holds it. */
export const CALL_SITE_USES_RETURN: Record<CallSite, boolean> = {
    signal: false,
    trigger: false,
    processing: false,
    itemAction: false,
    upgrade: false,
    behavior: false,
    modifier: false,
};
