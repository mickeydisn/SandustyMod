import { ALL_ACTIONS } from "../actions/index.ts";
import type { ActionKey } from "../actions/index.ts";
import type { CallSite, ScopeNeed } from "../engine/types.ts";

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

export const SCOPE_NEED_BLURBS: Record<ScopeNeed, string> = {
    pos: "needs to know *where* it is — the payload's x/y, or the cursor cell.",
    data: "reads payload.data — needs the per-instance bag.",
    read: "reads a cell via api.elements / api.grid, which are ambient.",
    commit: "writes through ctx.commit — only process(structure, context) hands one over.",
};

/**
 * What each call site hands its actions.
 *
 * Typed as `Record<CallSite, ...>` rather than `Record<string, ...>`, so
 * adding a call site to `CallSite` without granting it a scope here is a
 * compile error instead of a silent "cannot run anywhere".
 */
export const CALL_SITE_SCOPE: Record<CallSite, ProcessScope> = {
    processing: { pos: true, data: true, read: true, commit: true, ret: false },

    signal: { pos: true, data: true, read: true, commit: false, ret: false },

    itemAction: { pos: true, data: true, read: true, commit: false, ret: false },

    upgrade: { pos: false, data: true, read: true, commit: false, ret: false },

    modifier: { pos: true, data: true, read: true, commit: false, ret: true },

    trigger: { pos: false, data: false, read: true, commit: false, ret: false },

    behavior: { pos: false, data: false, read: true, commit: false, ret: false },
};

export function scopeSatisfies(provides: ProcessScope, needs: readonly ScopeNeed[]): boolean {
    return needs.every((n) => provides[n]);
}

export function describeNeeds(needs: readonly ScopeNeed[]): string {
    return needs.length === 0 ? "nothing" : needs.map((n) => SCOPE_NEED_LABELS[n]).join(" + ");
}


/**
 * What each action needs from the host, keyed by action key.
 *
 * Derived from the action definitions themselves: each `ActionDef` declares
 * its own `needs`, so there is no second table to keep in step. The key type
 * is `ActionKey`, so a name that is not a real action is a compile error
 * rather than a runtime surprise.
 */
export const ACTION_SCOPE: Record<ActionKey, readonly ScopeNeed[]> = Object.fromEntries(
    Object.entries(ALL_ACTIONS).map(([key, def]) => [key, def.needs]),
) as Record<ActionKey, readonly ScopeNeed[]>;

/**
 * What one action needs from the host.
 *
 * Fails closed: an unrecognised key yields every need, so an action that is
 * not in the table is treated as the most demanding one and simply fails the
 * scope check instead of silently being allowed everywhere. The old table did
 * the opposite — an unknown key meant "needs nothing", which quietly widened
 * every slot an action could be dropped into.
 */
export function needsOf(key: string): readonly ScopeNeed[] {
    return ACTION_SCOPE[key as ActionKey] ?? SCOPE_NEEDS;
}

export function canRunAt(key: string, callSite: string): boolean {
    const provides = CALL_SITE_SCOPE[callSite as CallSite];
    if (!provides) return false;
    return scopeSatisfies(provides, needsOf(key));
}

export function slotsFor(key: string): string[] {
    return (Object.keys(CALL_SITE_SCOPE) as CallSite[]).filter((site) => canRunAt(key, site));
}
