/**
 * What a **process** hands its actions, and what each **action** needs from it.
 *
 * This replaces "group the actions by which `api.*` they call", and the reason that
 * axis did not survive the code is worth keeping in view:
 *
 *   - **`api` is ambient.** The api-calling actions read `globalThis.sandkit.api`, a
 *     module global — not an argument. Every call site provides it, so it cannot say
 *     where an action can run, which is the only question a grouping axis must answer.
 *   - **What does discriminate is the payload.** Measured, an action needs at most
 *     four things — a position, an instance's `data`, a cell read, and a cell write —
 *     and each call site delivers a known subset.
 *
 * So the rule is one line:
 *
 *     an action may sit in a process  **iff**  its needs ⊆ what the call site delivers
 *
 * Because both halves are *measured*, `HANDLER_META.slots` is derived rather than
 * hand-written 84 times — which is how two actions ended up offered in a slot the engine
 * cannot serve (see `analyze-scopes.ts`).
 */

/**
 * The things an action can need from the call it is running in.
 *
 * ## Why `cell` became two
 *
 * There was one need called `cell`, described as "needs the grid", and it meant two
 * unrelated things at once:
 *
 *   - **reading** a cell — `api.elements.getResolvedTypeAtCell` and
 *     `api.grid.isCellEmptyAtCell` are ordinary top-level functions
 *     (`elements.d.ts:71`, `grid.d.ts:21`), so this is **ambient**: every call site can
 *     do it;
 *   - **committing** a write — `ctx.commit(mutations)` exists on
 *     `StructureProcessingContext` and nowhere else. Only `process()` hands one over.
 *
 * Collapsing them locked all eleven element actions to the one slot that can commit,
 * even for the four that only ever *read*. They are now `read` and `commit`, and the
 * rule is unchanged — `needs ⊆ provides` — with a smaller, truer vocabulary.
 */
export type ScopeNeed = "pos" | "data" | "read" | "commit";

/** One call site's delivery, as a set of needs satisfied. */
export type ProcessScope = Record<ScopeNeed, boolean> & {
    /**
     * Whether the engine *reads* what the process returns. Always `false` — the one
     * slot that did is no longer a call site. Kept as a field because it records a
     * measured property, and a test asserts no call site ever sets it.
     */
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
 * What each call site delivers.
 *
 * Every row is read off the engine, not invented: the signatures are
 * `CALL_SITE_SIGNATURES` in `./process.ts`, and the `trigger` row is the reason
 * that table is worth having — `registerTrigger` puts `extra` in the
 * *registration*, so the engine's callback is called with literally nothing.
 */
export const CALL_SITE_SCOPE: Record<string, ProcessScope> = {
    // process(structure, context) — the only site that delivers a `commit`.
    processing: { pos: true, data: true, read: true, commit: true, ret: false },
    // handler(structure) — a placed structure: x, y and .data
    signal: { pos: true, data: true, read: true, commit: false, ret: false },
    // handleAction(state, action) — the engine hands over the **state**, and the cell
    // under the player is the cursor. This row used to say `pos: false`, and that one
    // word is what stopped a Tool from digging: `pos` is a need of 51 of the 80
    // actions, so refusing it here refused the entire element, terrain, structure and
    // motion catalogue to the item slot, and `itemExcavate` / `itemShoot` — the two
    // actions named for items — were re-slotted *away* from it.
    //
    // The justification was "`handleAction` delivers no position", which is true of the
    // *argument* and false of the *call site*: `api.input.getMouseCellPosition()`
    // ("the cell under the cursor", `input.d.ts:37`) is available to any caller, and the
    // three shipping mods that dig from a hotbar tool all read it — `diagonal-delete`
    // walks `state.session.input.mouse.cellPosition` by hand for exactly this
    // (`__scraped-mods/…/diagonal-delete/src/entry.ts:89`).
    //
    // `anchorFor` in `./cell-region.ts` is the shared resolver that makes this true in
    // code rather than in prose: payload first, cursor second, and an honest "no anchor"
    // instead of a silent `(0,0)`.
    itemAction: { pos: true, data: true, read: true, commit: false, ret: false },
    // onUpgrade(item) — an item instance. `pos: false` because an upgrade fires with
    // no pointer involved; the cursor would be a guess, not the place the item is.
    upgrade: { pos: false, data: true, read: true, commit: false, ret: false },
    // intercept(args, ctx) / modify(args) — whatever the hook chose to pass. It reads
    // its return (`ret: true`), but it has no `commit` to commit through, which is why
    // the `commit`-shaped actions are still refused here.
    modifier: { pos: true, data: true, read: true, commit: false, ret: true },
    // callback() — NOTHING. See registerTrigger.
    trigger: { pos: false, data: false, read: true, commit: false, ret: false },
    // onDownKey(key) — a key code, and nothing else.
    behavior: { pos: false, data: false, read: true, commit: false, ret: false },
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
    // `energyGenerateWhileHeld` reads `p.x` / `p.y` to place the power, but only
    // *after* its numeric guard. The scope probe's `sandkit` stub returns a
    // recording proxy rather than `undefined`, so the guard passes and the read is
    // recorded — which is why this is `pos` and not `[]`.
    energyGenerateWhileHeld: ["pos"],
    // `energyConsumePerRun` is `[]` and this is a real change, not a stale entry.
    // It used to be `pos` because it called `energy.consume(p.x, p.y, amount)` —
    // a call that does not exist in that shape (`consume` is `(amount, options?)`
    // and takes no coordinates). With the call corrected there is no position left
    // to read, and a global-pool draw is genuinely position-independent, so `[]` is
    // the honest scope. See the action's own note in `actions/connect/index.ts`.
    energyConsumePerRun: [],
    // Reads `payload.id` when no `structures` list is given. The probe sees a
    // recording proxy for the options, so `o.structures` is truthy and the branch
    // that reads `id` is never taken — hence `[]` measured, and the table agrees
    // rather than the other way round.
    techAppendUnlock: [],
    // `logBuildingPayload` serialises `args` through `JSON.stringify`, which reads
    // nothing the proxy records at the top level. `[]` is the honest answer.
    logBuildingPayload: [],

    // The buffer family needs nothing at all: `[]`, like `techAppendUnlock` above.
    //
    // Not an oversight and not "the same as no scope" — a buffer slot is *shared*,
    // so a buffer action is the clearest case in the catalogue of an action that
    // does not care what the engine handed it. That is what makes the family legal
    // in every slot at once, and it is the property the `all slots` entry in
    // `handler-registry.ts` is claiming when it lists all six.
    bufferRead: [],
    bufferWrite: [],
    bufferIncrement: [],

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

    // needs pos + read — the actions that *ask a cell what it holds*.
    //
    // These are `read`, not `commit`, and that is the whole point of splitting the old
    // `cell` need: `api.elements.getResolvedTypeAtCell` is an ordinary top-level
    // function (`elements.d.ts:71`), so asking a cell a question needs no context at
    // all. `isElementAtCell` is a pure reader and is now offered
    // wherever a position exists.
    // A cell probe. It needs to read a cell and a position to know *which* cell, which
    // is the same pair the element readers declare.
    isElementAtCell: ["pos", "read"],
    readElement: ["pos", "read"],
    // The element data slots need a **position** and nothing else. No `read`, and
    // that is the point: they go through `api.elements`, not the processing
    // context, so they work in a slot that hands over no context at all — an item
    // use, an engine hook. `read` is only needed by the family that reads through
    // the context, and adding it here would have made these the two actions that
    // could not run outside a processor.
    readDataField: ["pos"],
    writeDataField: ["pos"],
    countElements: ["pos", "read"],
    countEmpty: ["pos", "read"],

    // needs pos + commit — the actions that *change* a cell.
    //
    // `commit` is the one genuinely scarce thing in the whole model: `ctx.commit` is a
    // member of `StructureProcessingContext` and of nothing else, so only
    // `process(structure, context)` can hand one over.
    //
    // The three original `processor*` writers commit directly. The element writers
    // batch through `api.grid.mutate` — which *is* ambient — but they read **inside**
    // that batch, and the only reader that sees the writes staged before it in the same
    // transaction is the context's. Without it a transform would read committed state,
    // decide on stale data, and write over cells a previous step in the same batch had
    // already changed. So these genuinely need the context, and `read: true` alone
    // would be a promise the code cannot keep.
    processorLift: ["pos", "commit"],
    processorConvert: ["pos", "commit"],
    replaceElement: ["pos", "commit"],
    createElement: ["pos", "commit"],
    // `emptyCells` is filed with the writers, not the readers, and the file names are
    // misleading on this one: it is a `sense`-shaped question ("is this cell empty?")
    // attached to an `act` (remove it). Removing needs the writer, so it needs `commit`.
    emptyCells: ["pos", "commit"],
    transformElement: ["pos", "commit"],
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

    // The terrain family, and the first family to be **all `["pos"]` with no `cell` at
    // all** — the same conclusion the structure family reached, for the same reason. A
    // `cell` need means "reads a cell", and the only terrain action that comes close is
    // `terrainHitPoints`, which asks `api.terrains.getDataAtCell` rather than the
    // processing context. The terrain family never touches `ctx` at all, so `cell` would
    // claim a dependency it does not have.
    //
    // And all eleven address a region, so none of them is `[]` either — including
    // `terrainTypeHandle`, which is a second read of the same cell rather than an
    // instance-level one. Unlike the structure family, terrain has **no** instance-taking
    // action: every function in the namespace is coordinate-based, so there is nothing
    // that would measure `[]`.
    terrainType: ["pos"],
    hasTerrain: ["pos"],
    isTerrainType: ["pos"],
    terrainHitPoints: ["pos"],
    terrainTypeHandle: ["pos"],
    countTerrain: ["pos"],
    createTerrain: ["pos"],
    replaceTerrain: ["pos"],
    removeTerrain: ["pos"],
    damageTerrain: ["pos"],
    setTerrainHitPoints: ["pos"],

    // ── logic ─────────────────────────────────────────────────────────────────
    // The five walks. Each needs a position to anchor its range.
    //
    // Four are `["pos", "read"]`: they ask cells through `cellReaders`, which
    // resolves to the ambient `api.elements` reader, so a walk can *count* from a
    // hotbar tool with no `StructureProcessingContext` in sight.
    //
    // `logicForEach` is `commit`, and the reason is worth stating because it is not
    // the walk that makes it so. It delegates to the element family's `writeCells`,
    // and `writeCells` reads **only** through `ctx.getResolvedTypeAtCell` — the
    // ambient fallback was added to `cellReaders`, not to the batch path. So the
    // walk inherits its parent's dependency exactly, which is the correct outcome:
    // the walk does no writing of its own, so it should not claim a need its body
    // does not have, and it should not hide the one its body really does.
    logicAny: ["pos", "read"],
    logicAll: ["pos", "read"],
    logicCount: ["pos", "read"],
    logicSum: ["pos", "read"],
    logicForEach: ["pos", "commit"],

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
