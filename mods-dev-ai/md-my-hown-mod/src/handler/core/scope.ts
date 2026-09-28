/**
 * What a **process** hands its actions, and what each **action** needs from it.
 *
 * This replaces "group the actions by which `api.*` they call", and the reason
 * that axis did not survive the code is worth keeping in view:
 *
 *   - **`api` is ambient.** The five api-calling actions read
 *     `globalThis.sandkit.api`, a module global — not an argument. Every call site
 *     provides it, so it cannot say where an action can run, which is the only
 *     question a grouping axis has to answer.
 *   - **What does discriminate is the payload.** Measured, an action needs at most
 *     three things — a position, an instance's `data`, and the cell context — and
 *     each call site delivers a known subset.
 *
 * So the rule is one line:
 *
 *     an action may sit in a process  **iff**  its needs ⊆ what the call site delivers
 *
 * Because both halves are *measured*, `HANDLER_META.slots` is derived rather than
 * hand-written 46 times — which is how two actions ended up offered in a slot the
 * engine cannot serve (see `analyze-scopes.ts`).
 */

/** The three things an action can need from the call it is running in. */
export type ScopeNeed = "pos" | "data" | "cell";

/** One call site's delivery, as a set of needs satisfied. */
export type ProcessScope = Record<ScopeNeed, boolean> & {
    /**
     * Whether the engine *reads* what the process returns. Always `false` — the one
     * slot that did is no longer a call site. Kept as a field because it records a
     * measured property, and a test asserts no call site ever sets it.
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
    // needs pos — the action reads `x` / `y` off the engine's payload
    triggerScan: ["pos"],
    structureInspect: ["pos", "data"],
    itemExcavate: ["pos"],
    itemShoot: ["pos"],
    particles: ["pos"],
    // `energyGenerateWhileHeld` and `energyConsumePerRun` read `p.x` / `p.y`, but
    // only *after* their numeric guard. The scope probe's `sandkit` stub returns a
    // recording proxy rather than `undefined`, so the guard passes and the read is
    // recorded — which is why these are `pos` and not `[]`.
    energyGenerateWhileHeld: ["pos"],
    energyConsumePerRun: ["pos"],
    // Reads `payload.id` when no `structures` list is given. The probe sees a
    // recording proxy for the options, so `o.structures` is truthy and the branch
    // that reads `id` is never taken — hence `[]` measured, and the table agrees
    // rather than the other way round.
    techAppendUnlock: [],
    // `logBuildingPayload` serialises `args` through `JSON.stringify`, which reads
    // nothing the proxy records at the top level. `[]` is the honest answer.
    logBuildingPayload: [],

    // needs data — the action reads `payload.data`
    structureReadData: ["data"],
    structureWriteData: ["data"],
    processorCount: ["data"],
    upgradeCountLevel: ["data"],
    upgradeScale: ["data"],
    upgradeAdd: ["data"],
    // `triggerTick` writes `data[key]`, so it genuinely needs the instance bag —
    // and that is why it is **not** offered in the `trigger` slot, which delivers
    // no payload at all. `canRunAt` derives that from this row; see
    // `no action is offered a call site that delivers less than it reads`.
    triggerTick: ["data"],

    // needs pos + cell — the only three that can commit to the grid
    processorScan: ["pos", "cell"],
    // A cell probe. It needs the cell (to read it) and a position (to know *which*
    // cell), which is the same pair `processorScan` declares.
    isElementAtCell: ["pos", "cell"],
    processorLift: ["pos", "cell"],
    processorConvert: ["pos", "cell"],

    // The element family. All seven need the same pair, for the same reason
    // `isElementAtCell` does — a position to know *which* cell, and the cell API to
    // read or change it. The reads and the writes are not separated here because
    // `commit` is what makes a write possible and `commit` is the same context
    // member a read comes from; a family split across the two lists would suggest
    // the engine has two contexts, and it has one.
    readElement: ["pos", "cell"],
    countElements: ["pos", "cell"],
    countEmpty: ["pos", "cell"],
    replaceElement: ["pos", "cell"],
    createElement: ["pos", "cell"],
    emptyCells: ["pos", "cell"],
    transformElement: ["pos", "cell"],
    getVelocity: ["pos"],
    findFreeCell: ["pos"],
    setVelocity: ["pos"],
    addVelocity: ["pos"],
    setDuration: ["pos"],
    teleportElement: ["pos"],
    toParticle: ["pos"],

    // The structure family: **`["pos"]`, uniformly**, and the scope probe is what proved
    // it. I recorded `["pos", "cell"]` on the sixteen cell-addressed actions by copying
    // the element family, and the probe disagreed with every one of them.
    //
    // It was right and I was wrong, because `cell` does not mean "addresses a cell" — it
    // means "**needs the grid**", i.e. a context that can read one. These actions address
    // cells constantly and never read one: `hasBuiltAtCell` and friends ask
    // `api.structures`, not the context. The element family is `["pos", "cell"]` because
    // it reads `ctx.getResolvedTypeAtCell`; this family has no such call, so `cell` would
    // claim a dependency it does not have.
    //
    // Worth stating plainly, because the two tables otherwise look identical: **region
    // addressing is not scope.** Sixteen of these take `dx`/`dy`/`size` and are still
    // `["pos"]`.
    structureType: ["pos"],
    hasStructure: ["pos"],
    isStructureType: ["pos"],
    isBlockedByPlayer: ["pos"],
    isLauncher: ["pos"],
    isStructureEnabled: ["pos"],
    countStructures: ["pos"],
    structureData: ["pos"],
    buildStructure: ["pos"],
    removeStructure: ["pos"],
    removeStructures: ["pos"],
    setStructureEnabled: ["pos"],
    setSpritesheetIndex: ["pos"],
    setSpritesheetByValue: ["pos"],
    setStructureData: ["pos"],
    // The two instance actions measure `[]`. They take no offset, touch no cell, and do
    // not read the payload's `x`/`y` either — `isMyType` hands the instance straight to
    // `api.structures.isType`, `pushStructure` to `update`. So there is nothing to need,
    // and `[]` is honest rather than a shy `["pos"]`.
    isMyType: [],
    pushStructure: [],
    // The third `[]`, the exception by arithmetic: it maps a value against a threshold
    // list and addresses nothing.
    mapSpritesheetValue: [],

    // needs nothing — presets, factories, logs and the option-only actions
    noop: [],
    processorNoop: [],
    processorLog: [],
    signalLog: [],
    triggerLog: [],
    upgradeLog: [],
    identity: [],
    logArgs: [],
    energyDefault: [],
    energyBank: [],
    energyWire: [],
    energyConductor: [],
    energyNetwork: [],
    itemDefault: [],
    toast: [],
    techGrantItem: [],
    techSetUpgradeLevel: [],
    // The seven `projectile*` presets are deliberately absent: they are
    // `ProjectileOptionFn`s, not actions — see
    // `../projectile-option/registry.ts`. They are deliberately absent rather than
    // defaulted: `needsOf` returns `[]` for an unknown key, so a stray row here
    // would have been the only thing distinguishing "needs nothing" from "is not
    // an action", and that distinction is exactly what the split is about.
};

/** The needs of one action. Unknown keys need nothing, so they stay offered. */
export function needsOf(key: string): readonly ScopeNeed[] {
    return ACTION_SCOPE[key] ?? [];
}

/**
 * Can this action run in a process on this call site?
 *
 * The whole rule: a registry that merely *declares* slots can offer an action
 * somewhere the engine hands it nothing it reads. Nothing errors in that case —
 * the action just quietly does nothing, which
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
