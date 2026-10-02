






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


export type ContentKind = "element" | "structure" | "terrain";


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


export interface ActionDef {
    doc: string;

    role: ActionRole;

    fn: HandlerActionFn;

    kind?: "intercept" | "modify";

    
    type?: string;

    
    scope?: string;

    
    slots?: readonly string[];

    
    itemTypes?: readonly string[];

    
    params?: readonly HandlerParam[];

    
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
