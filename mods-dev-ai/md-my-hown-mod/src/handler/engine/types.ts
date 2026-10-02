






export type ActionRole =
    | "sense"
    | "decide"
    | "act"
    | "remember"
    | "feel"
    | "connect"
    | "logic";

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

export const ROLE_IO: Record<ActionRole, { reads: string; writes: string }> = {
    sense: { reads: "engine, vars", writes: "vars" },
    decide: { reads: "vars, engine", writes: "proceed" },
    act: { reads: "vars", writes: "pending" },
    remember: { reads: "vars", writes: "structure.data" },
    feel: { reads: "vars", writes: "the screen" },
    connect: { reads: "vars", writes: "the engine" },
    logic: { reads: "vars, engine, cells", writes: "vars, pending" },
};



export type ActionSignature = "payload" | "processing" | "modifier";

export type HandlerActionFn = (
    payload: unknown,
    ctx: unknown,
    options: unknown,
    context?: unknown,
) => unknown;

import type { Opt } from "../../catalog.ts";

/** What kind of thing a `select` option points at. */
export type ContentKind = "element" | "structure" | "terrain";

/** One row of an action's option editor, as the panel renders it. */
export interface HandlerParam {
    key: string;
    label: string;
    kind: "text" | "number" | "bool" | "select";
    required?: boolean;
    def?: string;
    hint?: string;
    min?: number;
    max?: number;
    int?: boolean;

    options?: Opt[];

    content?: ContentKind;
}

export interface ModifierAction {
    kind: "intercept" | "modify";
    fn: HandlerActionFn;
}

/**
 * How one action describes itself to the panel.
 *
 * The `type`/`scope`/`slots`/`params` fields are declared next to the action
 * that honours them, not in a parallel table: an action and the options it
 * accepts are always read in the same place.
 */
export interface ActionDef {
    doc: string;

    role: ActionRole;

    fn: HandlerActionFn;

    kind?: "intercept" | "modify";

    /** The panel group this action is listed under. */
    type?: string;

    /** What the host must hand the action for it to run. */
    scope?: string;

    /** Handler slots this action may appear in. */
    slots?: readonly string[];

    /** Item types, when the action is item-scoped. */
    itemTypes?: readonly string[];

    /** The options the panel offers for this action. */
    params?: readonly HandlerParam[];

    /**
     * What the host must hand this action for it to run.
     *
     * Required, and declared next to the action, so adding an action cannot
     * silently leave it out: the compiler rejects a def that omits it. This
     * used to be a hand-maintained `ACTION_SCOPE` table in processing/scope.ts
     * that had to be edited in lockstep with this list; an unknown key there
     * defaulted to "needs nothing", which quietly let an action run anywhere.
     */
    needs: readonly ScopeNeed[];
}

export interface StoredAction extends ActionDef {
    signature: ActionSignature;
}



export function defineActions<T extends Record<string, ActionDef>>(defs: T): T {
    return defs;
}

export function defineModifiers<
    T extends Record<string, ActionDef & { kind: "intercept" | "modify" }>,
>(defs: T): T {
    return defs;
}



export const BLOCK_KEY = "if";

export interface HandlerActionRef {
    key: string;
    options?: Record<string, unknown>;

    as?: string;

    then?: HandlerActionRef[];

    else?: HandlerActionRef[];
}

export function isBlock(ref: HandlerActionRef): boolean {
    return ref.key === BLOCK_KEY;
}

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

export type HandlerProcessFn = (...args: unknown[]) => unknown;

export type CallSite =
    | "signal"
    | "trigger"
    | "processing"
    | "itemAction"
    | "upgrade"
    | "behavior"
    | "modifier";

/**
 * One thing an action needs the host to provide.
 *
 * Lives here rather than in processing/scope.ts so `ActionDef` can name it:
 * an action's requirements are part of the action, not a lookup keyed by its
 * name somewhere else. processing/scope.ts re-exports it for its own callers.
 */
export type ScopeNeed = "pos" | "data" | "read" | "commit";

export const CALL_SITE_LABELS: Record<CallSite, string> = {
    signal: "Structure click",
    trigger: "Timed tick",
    processing: "Process step",
    itemAction: "Item use",
    upgrade: "Upgrade applied",
    behavior: "Key press",
    modifier: "Engine hook",
};

export const CALL_SITE_SIGNATURES: Record<CallSite, string> = {
    signal: "handler(structure)",
    trigger: "callback()",
    processing: "process(structure, context)",
    itemAction: "handleAction(state, action)",
    upgrade: "onUpgrade(item)",
    behavior: "onDownKey(key) / onUpKey(key)",
    modifier: "intercept(args, ctx) / modify(args)",
};
