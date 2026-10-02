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

/** A scope need, or `""` for "no filter chosen" — see `MaybeCallSite`. */
export type MaybeScopeNeed = ScopeNeed | "";

/**
 * Narrows a filter string to a real scope need, or undefined when unset/unknown.
 *
 * Validates membership rather than casting, so this is the one place allowed to
 * turn an arbitrary string into a `ScopeNeed` — and it only does so for a name
 * that is genuinely one of the four.
 */
export function asScopeNeed(value: string): ScopeNeed | undefined {
    return SCOPE_NEEDS.find((n) => n === value);
}

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

/**
 * Every call site, in the order `CALL_SITE_SCOPE` declares them.
 *
 * `Object.keys` returns `string[]`; the keys are the literal members of a
 * `Record<CallSite, …>`, so this is the one place that assertion belongs —
 * and it cannot go stale, because adding a call site to the record adds it
 * here too.
 */
export const ALL_CALL_SITES = Object.keys(CALL_SITE_SCOPE) as CallSite[];

/**
 * A call site, or `""` for "no filter chosen".
 *
 * The panel's filter state is a text field, so the honest type of what it
 * holds is "one of these names or nothing" — not an unconstrained `string`
 * that every consumer then has to cast back to a real key.
 */
export type MaybeCallSite = CallSite | "";

/** Narrows a filter string to a real call site, or undefined when unset/unknown. */
export function asCallSite(value: string): CallSite | undefined {
    return (ALL_CALL_SITES as string[]).includes(value) ? value as CallSite : undefined;
}

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
 * its own `needs`, so there is no second table to keep in step.
 */
export const ACTION_SCOPE: Record<ActionKey, readonly ScopeNeed[]> = Object.fromEntries(
    Object.entries(ALL_ACTIONS).map(([key, def]) => [key, def.needs]),
) as Record<ActionKey, readonly ScopeNeed[]>;

/**
 * What one action needs from the host.
 *
 * Takes a real `ActionKey`, so a name that is not an action is a compile
 * error at the call site rather than a lookup that quietly returns a
 * default. For genuinely unknown input at runtime, `needsOfUnknown` fails
 * closed: it reports every need, so the action fails the scope check instead
 * of being allowed everywhere.
 */
export function needsOf(key: ActionKey): readonly ScopeNeed[] {
    return ACTION_SCOPE[key];
}

/**
 * `needsOf` for a key that is not known to be an action — a name read from a
 * config file, a stale panel filter, a typo.
 *
 * Fails closed, unlike the old table, where an unknown key defaulted to `[]`
 * ("needs nothing") and so was offered every slot.
 */
export function needsOfUnknown(key: string): readonly ScopeNeed[] {
    return isActionKey(key) ? ACTION_SCOPE[key] : SCOPE_NEEDS;
}

/** Narrows a runtime string to a real action key. */
export function isActionKey(key: string): key is ActionKey {
    return Object.hasOwn(ACTION_SCOPE, key);
}

export function canRunAt(key: ActionKey, callSite: CallSite): boolean {
    return scopeSatisfies(CALL_SITE_SCOPE[callSite], needsOf(key));
}

/** `canRunAt` for a call site that may be unset (`""`) or unrecognised. */
export function canRunAtUnknown(key: string, callSite: string): boolean {
    const site = asCallSite(callSite);
    return site !== undefined && isActionKey(key) && canRunAt(key, site);
}

/**
 * Every slot this action may appear in.
 *
 * Iterates `ALL_SLOTS`, the panel's own slot list, rather than the call sites
 * and casting: `HandlerSlot` is a subset of `CallSite` (there is no slot for
 * a key press), so a slot list is by construction a subset of what
 * `canRunAt` accepts, and the result needs no cast at the call site.
 */
export function slotsFor(key: ActionKey): HandlerSlot[] {
    return ALL_SLOTS.filter((slot) => canRunAt(key, slot));
}
