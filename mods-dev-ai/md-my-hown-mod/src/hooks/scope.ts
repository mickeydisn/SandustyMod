/**
 * What a **process** hands its actions, and what each **action** needs from it.
 *
 * This is the model that replaces "group the actions by which `api.*` they call".
 * That axis did not survive contact with the code, and the reason is worth keeping
 * in view, because it is easy to walk back into:
 *
 *   - **`api` is ambient.** The five api-calling actions read
 *     `globalThis.sandkit.api`, a module global — not an argument. Every call site
 *     provides it, so it cannot say where an action can run, which is the only
 *     question a grouping axis has to answer. It also left all but a handful of the
 *     catalogue in one bucket, which is not a category.
 *   - **What does discriminate is the payload.** Measured, an action needs at most
 *     three things — a position, an instance's `data`, and the cell context — and
 *     each call site delivers a known subset of them.
 *
 * So the rule is one line:
 *
 *     an action may sit in a process  **iff**  its needs ⊆ what the call site delivers
 *
 * That is "the process context defines the scope of actions it can use", made
 * checkable. And because both halves are *measured*, `HANDLER_META.slots` can be
 * derived rather than hand-written 46 times — which is how two actions ended up
 * offered in a slot the engine cannot serve (see `analyze-scopes.ts`).
 */

/** The three things an action can need from the call it is running in. */
export type ScopeNeed = "pos" | "data" | "cell";

/** One call site's delivery, as a set of needs satisfied. */
export type ProcessScope = Record<ScopeNeed, boolean> & {
    /**
     * Whether the engine *reads* what the process returns.
     *
     * **Always `false` now.** The one slot that did — `projectile` — is no longer
     * a call site: it holds a single `ProjectileOption` and returns the
     * configuration directly, outside the process system. See
     * `./projectile-option/`.
     *
     * Kept as a field rather than deleted because it records a measured property
     * of the engine's callbacks, and a test asserts no call site ever sets it. The
     * alternative is re-deriving the question the next time someone adds a slot.
     */
    ret: boolean;
};

export const SCOPE_NEEDS: readonly ScopeNeed[] = ["pos", "data", "cell"] as const;

export const SCOPE_NEED_LABELS: Record<ScopeNeed, string> = {
    pos: "a position",
    data: "instance data",
    cell: "the cell grid",
};

export const SCOPE_NEED_BLURBS: Record<ScopeNeed, string> = {
    pos: "reads payload.x / payload.y — needs to know *where* it is.",
    data: "reads payload.data — needs the per-instance bag.",
    cell: "reads the processing context — commit() and getResolvedTypeAtCell().",
};

/**
 * What each call site delivers.
 *
 * Every row is read off the engine, not invented: the signatures are
 * `CALL_SITE_SIGNATURES` in `./process.ts`, and the `trigger` row is the reason
 * that table is worth having — `registerTrigger` puts `extra` in the
 * *registration*, so the engine's callback is called with literally nothing.
 */
export const CALL_SITE_SCOPE: Record<string, ProcessScope> = {
    // process(structure, context) — the only site that delivers everything.
    processing: { pos: true, data: true, cell: true, ret: false },
    // handler(structure) — a placed structure: x, y and .data
    signal: { pos: true, data: true, cell: false, ret: false },
    // handleAction(state, action) — an item instance
    itemAction: { pos: false, data: true, cell: false, ret: false },
    // onUpgrade(item) — an item instance
    upgrade: { pos: false, data: true, cell: false, ret: false },
    // intercept(args, ctx) / modify(args) — whatever the hook chose to pass
    modifier: { pos: true, data: true, cell: true, ret: true },
    // callback() — NOTHING. See registerTrigger.
    trigger: { pos: false, data: false, cell: false, ret: false },
    // onDownKey(key)
    behavior: { pos: false, data: false, cell: false, ret: false },
};

/** Does this call site deliver everything `needs` asks for? The whole rule. */
export function scopeSatisfies(provides: ProcessScope, needs: readonly ScopeNeed[]): boolean {
    return needs.every((n) => provides[n]);
}

/** How an action's needs read as a sentence, for the UI and the tool output. */
export function describeNeeds(needs: readonly ScopeNeed[]): string {
    return needs.length === 0 ? "nothing" : needs.map((n) => SCOPE_NEED_LABELS[n]).join(" + ");
}

// ── What each action needs ───────────────────────────────────────────────────

/**
 * The needs of every action, **measured** by `tools/analyze-scopes.ts`.
 *
 * Not declared. The probe runs each action against recording proxies and reads
 * off which of `payload.x/y`, `payload.data` and the context it actually touches,
 * so an action cannot start or stop needing something without this table being
 * regenerated — and `scope.test.ts` re-measures and fails if the two disagree.
 *
 * The 33 that need nothing are not a failure of the model, they are the honest
 * answer: they are option presets, projectile factories and log lines. Under the
 * old `api` axis they were lumped in with the `data` readers under "reaches for
 * nothing", which is what made that grouping useless.
 */
export const ACTION_SCOPE: Record<string, readonly ScopeNeed[]> = {
    // needs pos
    triggerScan: ["pos"],
    energyGenerateWhileHeld: ["pos"],

    // needs pos + data
    structureInspect: ["pos", "data"],

    // needs pos + cell — the only three that can commit to the grid
    processorScan: ["pos", "cell"],
    processorLift: ["pos", "cell"],
    processorConvert: ["pos", "cell"],

    // needs data
    structureReadData: ["data"],
    structureWriteData: ["data"],
    processorCount: ["data"],
    upgradeCountLevel: ["data"],
    upgradeScale: ["data"],
    upgradeAdd: ["data"],

    // needs nothing — presets, factories and logs
    noop: [],
    processorNoop: [],
    processorLog: [],
    signalLog: [],
    triggerLog: [],
    triggerTick: [],
    upgradeLog: [],
    identity: [],
    logArgs: [],
    logBuildingPayload: [],
    energyDefault: [],
    energyBank: [],
    energyWire: [],
    energyConductor: [],
    energyNetwork: [],
    energyConsumePerRun: [],
    itemDefault: [],
    itemExcavate: [],
    itemShoot: [],
    excavationDefault: [],
    excavationCrusher: [],
    excavationDrill: [],
    excavationGun: [],
    excavationShatter: [],
    // The seven `projectile*` presets used to be listed here as `[]`. They are
    // `ProjectileOptionFn`s now and are not actions at all — see
    // `./projectile-option/registry.ts`. They are deliberately absent rather than
    // defaulted: `needsOf` returns `[]` for an unknown key, so a stray row here
    // would have been the only thing distinguishing "needs nothing" from "is not
    // an action", and that distinction is exactly what the split is about.
    techAppendUnlock: [],
    techSetUpgradeLevel: [],
    techGrantItem: [],
};

/** The needs of one action. Unknown keys need nothing, so they stay offered. */
export function needsOf(key: string): readonly ScopeNeed[] {
    return ACTION_SCOPE[key] ?? [];
}

/**
 * Can this action run in a process on this call site?
 *
 * The whole rule, and the thing that was missing: the registry used to *declare*
 * slots, so an action could be offered somewhere the engine hands it nothing it
 * reads. Nothing errors in that case — the action just quietly does nothing, which
 * is the failure mode that cost `triggerScan` and `energyGenerateWhileHeld` their
 * `trigger` slot.
 */
export function canRunAt(key: string, callSite: string): boolean {
    const provides = CALL_SITE_SCOPE[callSite];
    if (!provides) return false;
    return scopeSatisfies(provides, needsOf(key));
}

/** Every call site an action can run in. The derived replacement for `slots`. */
export function slotsFor(key: string): string[] {
    return Object.keys(CALL_SITE_SCOPE).filter((site) => canRunAt(key, site));
}
