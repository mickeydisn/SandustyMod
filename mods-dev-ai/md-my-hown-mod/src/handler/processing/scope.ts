import { ALL_ACTIONS } from "../actions/index.ts";
import type { ActionKey } from "../actions/index.ts";
import type { CallSite, ScopeNeed } from "../engine/types.ts";
import { ALL_SLOTS, type HandlerSlot } from "../engine/registry/types.ts";

export type { ScopeNeed };

export type ProcessScope = Record<ScopeNeed, boolean> & {
    ret: boolean;
};

export const SCOPE_NEEDS: readonly ScopeNeed[] = ["pos", "data", "read", "commit"] as const;

export const SCOPE_NEED_LABELS: Record<ScopeNeed, string> = {
    pos: "a position",
    data: "instance data",
    read: "to read cells",
    commit: "to commit writes",
};


export type MaybeScopeNeed = ScopeNeed | "";


export function asScopeNeed(value: string): ScopeNeed | undefined {
    return SCOPE_NEEDS.find((n) => n === value);
}

export const SCOPE_NEED_BLURBS: Record<ScopeNeed, string> = {
    pos: "needs to know *where* it is — the payload's x/y, or the cursor cell.",
    data: "reads payload.data — needs the per-instance bag.",
    read: "reads a cell via api.elements / api.grid, which are ambient.",
    commit: "writes through ctx.commit — only process(structure, context) hands one over.",
};


export const CALL_SITE_SCOPE: Record<CallSite, ProcessScope> = {
    processing: { pos: true, data: true, read: true, commit: true, ret: false },

    signal: { pos: true, data: true, read: true, commit: false, ret: false },

    itemAction: { pos: true, data: true, read: true, commit: false, ret: false },

    upgrade: { pos: false, data: true, read: true, commit: false, ret: false },

    modifier: { pos: true, data: true, read: true, commit: false, ret: true },

    trigger: { pos: false, data: false, read: true, commit: false, ret: false },

    behavior: { pos: false, data: false, read: true, commit: false, ret: false },
};


export const ALL_CALL_SITES = Object.keys(CALL_SITE_SCOPE) as CallSite[];


export type MaybeCallSite = CallSite | "";


export function asCallSite(value: string): CallSite | undefined {
    return (ALL_CALL_SITES as string[]).includes(value) ? value as CallSite : undefined;
}

export function scopeSatisfies(provides: ProcessScope, needs: readonly ScopeNeed[]): boolean {
    return needs.every((n) => provides[n]);
}

export function describeNeeds(needs: readonly ScopeNeed[]): string {
    return needs.length === 0 ? "nothing" : needs.map((n) => SCOPE_NEED_LABELS[n]).join(" + ");
}



export const ACTION_SCOPE: Record<ActionKey, readonly ScopeNeed[]> = Object.fromEntries(
    Object.entries(ALL_ACTIONS).map(([key, def]) => [key, def.needs]),
) as Record<ActionKey, readonly ScopeNeed[]>;


export function needsOf(key: ActionKey): readonly ScopeNeed[] {
    return ACTION_SCOPE[key];
}


export function needsOfUnknown(key: string): readonly ScopeNeed[] {
    return isActionKey(key) ? ACTION_SCOPE[key] : SCOPE_NEEDS;
}


export function isActionKey(key: string): key is ActionKey {
    return Object.hasOwn(ACTION_SCOPE, key);
}

export function canRunAt(key: ActionKey, callSite: CallSite): boolean {
    return scopeSatisfies(CALL_SITE_SCOPE[callSite], needsOf(key));
}


export function canRunAtUnknown(key: string, callSite: string): boolean {
    const site = asCallSite(callSite);
    return site !== undefined && isActionKey(key) && canRunAt(key, site);
}


export function slotsFor(key: ActionKey): HandlerSlot[] {
    return ALL_SLOTS.filter((slot) => canRunAt(key, slot));
}
