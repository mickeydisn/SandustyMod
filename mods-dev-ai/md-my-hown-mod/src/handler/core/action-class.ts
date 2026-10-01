/**
 * What a handler action **depends on** to do its job.
 *
 * An action is supposed to call one `api.*` section — the rule the Process/Action
 * split rests on. This is a **ladder**, not a taxonomy: an action that both reads the
 * payload and calls `api.energy` is filed under `api`, because that is the stronger
 * claim.
 *
 * | class            | needs                                    | n  |
 * | ---------------- | ---------------------------------------- | -- |
 * | `api`            | one `api.*` namespace                    | 57 |
 * | `self-sufficient`| only the payload and params it was handed | 14 |
 * | `context-bound`  | the engine's processing context (`ctx`)   |  3 |
 * | `pure`           | nothing at all — a constant, or a logger  | 10 |
 *
 * The counts are measured, and `measureActionDeps` re-measures them on every run, so a
 * drift here fails the tests rather than rotting. They are recorded because the shape is
 * the finding: 57 of 84 means the class axis has stopped discriminating and has become a
 * census of "calls the engine". What still separates the cell families is the **write
 * path** (batched vs per-cell), the **namespace** (`ACTION_APIS`), and the **scope**
 * (`./scope.ts`, the only axis still splitting a family in two).
 *
 * `context-bound` is the one real capability boundary here: it gets `ctx.commit` handed
 * in rather than reaching for a namespace.
 *
 * The 7 `projectile*` presets are not actions and are not in this table — they are
 * `ProjectileOptionFn`s, in `./projectile-option/`.
 */
import { ALL_ACTIONS } from "../actions/index.ts";

// ── The class ────────────────────────────────────────────────────────────────

export type HandlerActionClass = "api" | "self-sufficient" | "context-bound" | "pure";

export const ACTION_CLASS_LABELS: Record<HandlerActionClass, string> = {
    api: "API-bound",
    "self-sufficient": "Self-sufficient",
    "context-bound": "Context-bound",
    pure: "Pure",
};

export const ACTION_CLASS_BLURBS: Record<HandlerActionClass, string> = {
    api: "Calls one api.* section. The shape the rule wants.",
    "self-sufficient": "Uses only the payload and its own options. No engine service.",
    "context-bound": "Needs the processing context the engine passes in.",
    pure: "Needs nothing. A constant or a log line.",
};

/** The class for one action, or undefined for a key that does not exist. */

/**
 * Measured, not declared — `measureActionDeps` derives these by running every
 * action against recording proxies, and a test asserts this map still agrees. So
 * an action that starts (or stops) calling an API cannot drift quietly.
 */
export const ACTION_CLASSES: Record<string, HandlerActionClass> = {
    // ── api (7) ───────────────────────────────────────────────────────────────
    energyGenerateWhileHeld: "api",
    energyConsumePerRun: "api",
    techAppendUnlock: "api",
    techSetUpgradeLevel: "api",
    techGrantItem: "api",
    itemExcavate: "api",
    itemShoot: "api",

    // ── context-bound (4) ─────────────────────────────────────────────────────
    //
    // These four read `ctx` and reach **no** `api.*` namespace, which is the whole
    // meaning of the class: they are defined by the one dependency the engine hands a
    // processor and nothing else does.
    //
    // It used to be seven. `readElement`, `countElements` and `countEmpty` left it when
    // they gained the ambient fallback in `actions/element/index.ts` — they now call
    // `api.elements.getResolvedTypeAtCell` / `api.grid.isCellEmptyAtCell` directly when
    // no context is present, so they measure `api`. That is a real change in behaviour,
    // not a re-labelling: it is what lets them run in a slot that hands over no context
    // (see the `read` need in `./scope.ts`).
    isElementAtCell: "context-bound",
    // ── The logic family: the five range walks, all `api` ───────────────────────
    //
    // The first actions to measure `api` with no `context` access at all, and that
    // is the whole finding. `cellReaders` and `writeCells` are the element family's
    // own primitives, so a walk over a range reads and writes through exactly the
    // same ambient api the single-cell actions use. See `actions/logic/index.ts`.
    logicAny: "api",
    logicAll: "api",
    logicCount: "api",
    logicSum: "api",
    logicForEach: "api",
    processorLift: "context-bound",
    processorConvert: "context-bound",
    readElement: "api",
    countElements: "api",
    countEmpty: "api",
    replaceElement: "api",
    createElement: "api",
    emptyCells: "api",
    removeElement: "api",
    transformElement: "api",
    getVelocity: "api",
    findFreeCell: "api",
    setVelocity: "api",
    addVelocity: "api",
    setDuration: "api",
    teleportElement: "api",
    toParticle: "api",

    // ── The structure family (18), all `api` ───────────────────────────────────
    //
    // The largest single-family block, and the one with the least to say: every one
    // measures `api`, with no exceptions, no `context` readers, and no pure members.
    //
    // That uniformity is not a choice — it is forced. `StructureProcessingContext` has
    // **no** structure members at all: its whole surface is `getResolvedTypeAtCell`,
    // `isCellEmptyAtCell` and `commit`. So there was no version of any of these actions
    // that could have been `context-bound`, and the probe had nothing to catch. Every
    // cell- and instance-facing function in the engine's structures namespace is here.
    //
    // `mapSpritesheetValue` is the odd one in spirit: it takes neither a cell nor an
    // instance, so it fell outside the brief's rule, and is here because it is the only
    // way to get a frame index as a *value*. It still calls the namespace, so `api` is
    // where it measures — filed by what it does, not by where it came from.
    structureType: "api",
    hasStructure: "api",
    isStructureType: "api",
    isMyType: "api",
    isBlockedByPlayer: "api",
    isLauncher: "api",
    isStructureEnabled: "api",
    countStructures: "api",
    structureData: "api",
    mapSpritesheetValue: "api",
    buildStructure: "api",
    removeStructure: "api",
    removeStructures: "api",
    setStructureEnabled: "api",
    setSpritesheetIndex: "api",
    setSpritesheetByValue: "api",
    setStructureData: "api",
    pushStructure: "api",

    // ── The terrain family (11) ────────────────────────────────────────────────
    //
    // The only family with a **split** verdict, and the split is the interesting part.
    // Three actions go through `api.grid.mutate`'s terrain writer, five reach
    // `api.terrains.*` directly, and `countTerrain` is a region scan over `isAtCell` that
    // reaches the namespace N times.
    //
    // All eleven measure `api`, so the class does not see the split. What sees it is
    // `ACTION_EFFECTS` and the module header's table — and that is the finding worth
    // recording: **the class axis cannot express atomicity**, the single most consequential
    // property of the four families. The element family has the same shape (its writes are
    // batched, its reads are not) and the same blind spot. If this table is ever revised,
    // "what is the write path" is the axis it is missing.
    terrainType: "api",
    hasTerrain: "api",
    isTerrainType: "api",
    terrainHitPoints: "api",
    terrainTypeHandle: "api",
    countTerrain: "api",
    createTerrain: "api",
    replaceTerrain: "api",
    removeTerrain: "api",
    damageTerrain: "api",
    setTerrainHitPoints: "api",

    // ── The buffer family ─────────────────────────────────────────────────────
    //
    // `self-sufficient`, and measured rather than asserted: each one reaches only
    // for the `options` it was handed and for the already-built handle, so it
    // reads as an action with no engine service and no payload. The shared memory
    // is real and cross-thread, but it is reached through a value captured at
    // construction, not through `api.*` inside the action body — which is why
    // `ACTION_APIS` has no entry for them and "no namespace" is the honest answer
    // rather than a gap.
    bufferRead: "self-sufficient",
    bufferWrite: "self-sufficient",
    bufferIncrement: "self-sufficient",

    // ── self-sufficient (10) ──────────────────────────────────────────────────
    structureInspect: "self-sufficient",
    structureReadData: "self-sufficient",
    structureWriteData: "self-sufficient",
    triggerScan: "self-sufficient",
    triggerTick: "self-sufficient",
    energyDefault: "self-sufficient",
    energyBank: "self-sufficient",
    energyWire: "self-sufficient",
    energyConductor: "pure",
    energyNetwork: "self-sufficient",
    upgradeCountLevel: "self-sufficient",
    upgradeAdd: "self-sufficient",
    processorCount: "self-sufficient",
    // Measured, and the measurement is the reason the `api` call in these two
    // actions comes **before** the option checks: the probe watches `api`, so an
    // action that validated its slot and returned early would measure as reaching
    // nothing at all. `api`, exactly like `setVelocity` and the rest of the motion
    // family, which resolve the namespace the same way. The API axis below names
    // the namespace; the class only says that one is reached.
    readDataField: "api",
    writeDataField: "api",
    noop: "pure",
    upgradeScale: "self-sufficient",
    // Reads only the options it was handed and answers a value. Same shape as
    // `upgradeScale`, for the same reason, and it is deliberately **not** `pure`:
    // `pure` is for actions that do nothing observable, and this one's whole job
    // is to be observed by the `if` block after it.
    compare: "self-sufficient",
    // Same shape as `compare` — reads only its own options — but it **reaches
    // `api.random`**, so it is `api` and not `self-sufficient`. That is the
    // distinction the class axis is actually for: this one calls the engine, the
    // one above it does not, and they are otherwise the same kind of action.
    randomInt: "api",
    // The arithmetic sibling of `compare`, and the same class for the same reason:
    // it reads only its own options and never reaches the engine. It is `api` only
    // if it calls something, and `Math.round` is not the engine.
    math: "self-sufficient",

    // ── pure (22) ─────────────────────────────────────────────────────────────
    // The loggers. They read the payload they were handed to print it, which the
    // probe counts as a read — so `signalLog` and friends sit in `pure` only
    // because a `console.log` of a whole object never touches a *property* of it.
    signalLog: "pure",
    // Publishing a signal output is a call into `api.signals`, so it is an `api`
    // effect rather than a pure one — it changes engine state, and a panel
    // offering it should say so.
    signalOutput: "api",
    triggerLog: "pure",
    processorLog: "pure",
    processorNoop: "pure",
    logArgs: "pure",
    identity: "pure",
    itemDefault: "pure",
    // Both read nothing: `upgradeLog` prints its arguments whole, and `noop`
    // returns undefined. The three modifier actions sit here too — `identity`
    // because returning its argument is not a *read* of it.
    upgradeLog: "pure",
    // `logBuildingPayload` reads `args` (a property read on the payload), so it
    // measures as self-sufficient. It used to be `pure` when it caught the
    // serialisation failure instead of reading `args` up front.
    logBuildingPayload: "self-sufficient",

    // ── feel (2) ──────────────────────────────────────────────────────────────
    // The two actions added with the `feel/` folder. Both call `api.ui` /
    // `api.effects`, so they are `api` — measured, not assumed.
    toast: "api",
    particles: "api",
};

// ── The measurement ──────────────────────────────────────────────────────────

/** What a probe run observed. */
export interface ActionDeps {
    payload: boolean;
    extra: boolean;
    ctx: boolean;
    api: boolean;
    threw: boolean;
}

/**
 * A **valid** options bag, for the actions that validate their input.
 *
 * `measureActionDeps` feeds `options` a recording proxy, and that proxy answers
 * "defined" to every property. That is deliberate for most actions — `valueOf` returns
 * 1 so a guard like `if (!amount) return` does not short-circuit — but wrong for the
 * **range** walks, which validate their addressing options. `walkFor` refuses a matrix
 * cell set alongside a range field, and under a proxy `mx` reads as set *and* `dx`
 * coerces to 1, so every walk reported a conflict and returned before reaching the
 * engine. The measurement then said `self-sufficient` where the class table said `api`.
 *
 * So this is not the probe being tuned until the numbers agree. It is the probe being
 * unable to ask a question it has no way to pose: "what does this reach for, **given
 * options that make sense**". A blind proxy cannot express "a sensible `size`".
 *
 * A row is needed only for an action that *rejects* the proxy's answer, so this table's
 * contents are themselves the record of which actions validate.
 */
export const VALID_OPTIONS: Record<string, Record<string, unknown>> = {
    logicAny: { element: "water", size: 3 },
    logicAll: { element: "water", size: 3 },
    logicCount: { element: "water", size: 3 },
    logicSum: { size: 3 },
    logicForEach: { to: "stone", size: 3 },
};

/**
 * Run one action against recording proxies and report what it reached for.
 *
 * Exported for the test that proves `ACTION_CLASSES` is still true; not used at
 * runtime, because a probe that allocates three proxies per action has no
 * business being on a hot path.
 *
 * The action signature decides the argument labels, which is why a single flat
 * "arg 2" label would be wrong:
 *
 *   - `payload`    → `(payload, extra)`      — arg 2 is the *extra* options bag
 *   - `processing` → `(structure, context)`  — arg 2 is the *cell context*
 *
 * Getting that backwards labels every `extra` as a `ctx` and manufactures
 * context-bound actions out of actions that only read their options. The
 * signature now lives on the action itself (`StoredAction.signature`), so the
 * probe asks one table instead of consulting three registries.
 */
export function measureActionDeps(key: string): ActionDeps | undefined {
    const def = ALL_ACTIONS[key];
    if (!def) return undefined;
    const fn = def.fn as (...a: unknown[]) => unknown;
    // A modifier's second argument is a `HookContext`, not an options bag, so it
    // is probed as a context — matching what the engine actually passes.
    const secondIsCtx = def.signature === "processing" || def.signature === "modifier";

    const seen: Record<keyof Omit<ActionDeps, "threw">, boolean> = {
        payload: false,
        extra: false,
        ctx: false,
        api: false,
    };

    /**
     * Records any property read, and keeps returning something usable.
     *
     * Two traps in here, both found by the probe reporting an action as
     * `self-sufficient` when it plainly calls the api:
     *
     *  - **`valueOf` / `toString` must return 1.** Otherwise `Number(spy)` is
     *    `NaN`, so any action guarding on a numeric option — `if (!amount) return`
     *    — returns before it ever touches the api. A false negative in the
     *    measurement, which is worse than no measurement: the class table is
     *    supposed to be derived from this.
     *
     *  - **A symbol property must return a function.** `ToPrimitive` reads
     *    `Symbol.toPrimitive` first; handing back a proxy object made V8 throw
     *    "object is not a function" before coercion was even attempted, and the
     *    probe swallowed that as `threw`. `seen` only records string keys, so the
     *    extra return is invisible to the measurement.
     */
    const spy = (label: keyof typeof seen, depth = 0): unknown =>
        new Proxy({} as Record<PropertyKey, unknown>, {
            get(_t, prop) {
                if (typeof prop === "string" && !prop.startsWith("__")) seen[label] = true;
                // `valueOf` / `toString` return 1 so `Number(spy)` is 1, not NaN.
                if (prop === "valueOf" || prop === "toString") return () => 1;
                // `Symbol.toPrimitive` must be **absent**, not a stub. V8 reads it
                // first when coercing; if it is callable, V8 calls it and uses the
                // result, so a stub returning `undefined` makes `Number(spy)` NaN
                // and every action that guards on a numeric option returns before
                // it reaches the api. Returning `undefined` for the symbol makes V8
                // fall back to OrdinaryToPrimitive, which calls `valueOf` above.
                if (prop === Symbol.toPrimitive) return undefined;
                // Other symbols drive protocol lookups (`Symbol.iterator`,
                // `util.inspect.custom`, …). A callable is safer than a bare proxy
                // object here: returning an object made V8 throw "object is not a
                // function" and the probe recorded that as `threw`.
                if (typeof prop === "symbol") return () => undefined;
                return depth > 2 ? 1 : spy(label, depth + 1);
            },
            set(_t, prop) {
                if (typeof prop === "string" && !prop.startsWith("__")) seen[label] = true;
                return true;
            },
            has() {
                seen[label] = true;
                return false;
            },
            apply: () => () => undefined,
        });

    const g = globalThis as { sandkit?: unknown };
    g.sandkit = { api: spy("api") };
    // Several actions log on the way in, and some throw against a proxy where a
    // real object would not. Neither changes *which* labels were touched, which is
    // the only thing being measured — so the throw is recorded, not treated.
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    let threw = false;
    try {
        // The second slot is a `ctx` for a processing or modifier action and an
        // `extra` options bag otherwise. The old code had a `proc` branch here and
        // an identical `else` branch — both passing `spy("ctx")` — so the
        // `processing` actions were measured through the *payload* path and every
        // argument-2 read in them was labelled wrong. `secondIsCtx` restores the
        // distinction the comment above always claimed.
        if (secondIsCtx) fn(spy("payload"), spy("ctx"), spy("extra"));
        else fn(spy("payload"), spy("extra"), spy("extra"));
        // An action that *validates* its options cannot be driven by a proxy that
        // answers "defined" to everything, so it gets a real one. See `VALID_OPTIONS`.
        const valid = VALID_OPTIONS[key];
        if (valid) {
            if (secondIsCtx) fn(spy("payload"), spy("ctx"), valid);
            else fn(spy("payload"), spy("extra"), valid);
        }
    } catch {
        threw = true;
    } finally {
        console.log = log;
        console.warn = warn;
        delete (g as { sandkit?: unknown }).sandkit;
    }
    return { ...seen, threw };
}

/** Derive the class from a measurement, in the ladder's priority order. */
export function classFromDeps(d: ActionDeps): HandlerActionClass {
    if (d.api) return "api";
    if (d.ctx) return "context-bound";
    if (d.payload || d.extra) return "self-sufficient";
    return "pure";
}

export function actionClassOf(key: string): HandlerActionClass | undefined {
    return ACTION_CLASSES[key];
}

/**
 * The **API axis**: the `api.*` namespace each action calls.
 *
 * This is the axis an action is *grouped by* — as opposed to `class`, which is how
 * far it falls short of using one. Both are needed: `energyGenerateWhileHeld` is
 * grouped under `energy` and classed `api`; `processorConvert` has no API at all
 * and is classed `context-bound`.
 *
 * Only the namespace root, not the full path, because the root is the grouping key
 * and `api.energy.consume` and `api.energy.addAtCell` belong in the same section.
 *
 * Measured with the same probe as the class: a fake `sandkit` whose namespaces
 * record on property access.
 */
export const ACTION_APIS: Record<string, string> = {
    // The buffer family is deliberately absent, and not by oversight. It does
    // reach shared memory — `api.shared.buffers`, at construction, via the
    // package's `ensureBuffer` — but the action body only calls `getPath` /
    // `setPath` / `increment` on a handle built earlier. The probe watches
    // property access *during* the call, so it sees nothing, and filing them
    // under "shared" would be a claim the measurement does not support.
    energyGenerateWhileHeld: "energy",
    energyConsumePerRun: "energy",
    techAppendUnlock: "tech",
    techSetUpgradeLevel: "upgrades",
    techGrantItem: "player",
    itemExcavate: "grid",
    itemShoot: "projectiles",
    // `api.random`, the engine's own deterministic generator. Distinct from every
    // other entry: this is the only action whose namespace exists to supply
    // entropy rather than to change the world.
    randomInt: "random",
    // `api.signals.setOutputAtCell` — the live half of a `senderType` signal.
    signalOutput: "signals",
    // ── The logic family: the five range walks ──────────────────────────────────
    //
    // `elements` for the three boolean walks, because `cellReaders` resolves to the
    // ambient `api.elements.getResolvedTypeAtCell` whenever no processing context is
    // handed over. `terrains` for `sum`, and `grid` for `forEach`, which goes
    // through the element family's `writeCells` and so reaches `api.grid.mutate`.
    logicAny: "elements",
    logicAll: "elements",
    logicCount: "elements",
    logicSum: "terrains",
    logicForEach: "grid",
    // ── The structure family: 18 actions, all `api` ──────────────────────────────
    //
    // The largest single-family block in the table, and the one with the least to say:
    // every one of them measures `api` on `structures`, with no exceptions, no `context`
    // readers, and no pure members.
    //
    // That uniformity is not a choice — it is forced. `StructureProcessingContext` has
    // **no** structure members at all: its whole surface is `getResolvedTypeAtCell`,
    // `isCellEmptyAtCell` and `commit`. So there was no version of any of these actions
    // that could have been `context-bound`, and the probe had nothing to catch. Every
    // cell- and instance-facing function in the engine's structures namespace is here.
    //
    // `mapSpritesheetValue` is the odd one in spirit: it takes neither a cell nor an
    // instance, so it fell outside the brief's rule, and is here because it is the only
    // way to get a frame index as a *value*. It still calls the namespace, so `api` is
    // where it measures — filed by what it does, not by where it came from.
    structureType: "api",
    hasStructure: "api",
    isStructureType: "api",
    isMyType: "api",
    isBlockedByPlayer: "api",
    isLauncher: "api",
    isStructureEnabled: "api",
    countStructures: "api",
    structureData: "api",
    mapSpritesheetValue: "api",
    buildStructure: "api",
    removeStructure: "api",
    removeStructures: "api",
    setStructureEnabled: "api",
    setSpritesheetIndex: "api",
    setSpritesheetByValue: "api",
    setStructureData: "api",
    pushStructure: "api",
    // The four element **writes**, after the migration to `api.grid.mutate`.
    //
    // This is the one place where the `elements` and `grid` namespaces meet, and it is
    // worth being exact about which is which: these four reach **`grid`**, for the
    // writer (`api.grid.mutate` → `writer.elements.*`), not `elements`. The element
    // *reads* still go through the processing context and are `context-bound`. So the
    // family is split across two rows, and the split is the migration's whole story:
    // writes became a typed coherent batch, reads stayed where they were.
    //
    // The `elements` entries below are the motion family, and the two sets never meet:
    // no action in this catalogue calls `api.elements` **and** `api.grid`.
    //
    // The three element *readers* join the table here, and were absent from it before.
    // They used to read only through the processing context, so they reached no
    // namespace at all. `cellReaders` in `actions/element/index.ts` now falls back to
    // `api.elements.getResolvedTypeAtCell` and `api.grid.isCellEmptyAtCell` when no
    // context is handed over — so they do reach the engine, and this table is
    // **measured**, so leaving them out would be a lie the probe catches.
    //
    // `elements` rather than `grid`, because the type read is the element namespace's.
    // It is a first-listed choice, not a claim that only one is called. The result is
    // that the family is now split cleanly — readers on `elements`, writers on `grid` —
    // where before it was a migration in progress.
    readElement: "elements",
    countElements: "elements",
    countEmpty: "elements",
    replaceElement: "grid",
    createElement: "grid",
    emptyCells: "grid",
    removeElement: "grid",
    transformElement: "grid",
    // The motion family, all one namespace. It is worth being explicit that this is a
    // *different* `elements` from the one the element family would have used: the
    // element family never calls `api.elements` at all — it goes through the
    // processing context — so "elements" appearing here and nowhere else is the
    // clearest single statement of where the boundary between the two families runs.
    getVelocity: "elements",
    // The element data slots. `elements` and not `grid`, unlike every other row in
    // this family: `getDataFieldAtCell` / `setDataFieldAtCell` are declared on
    // `api.elements` in the engine's own `.d.ts` (`api.elements.definition.md`
    // lines 90–91), so the namespace is the engine's and not a judgement call. It
    // is also the clearest sign that the data slots are element state rather than
    // grid geometry — a slot rides along with a cell and moves when it moves.
    readDataField: "elements",
    writeDataField: "elements",
    findFreeCell: "elements",
    setVelocity: "elements",
    addVelocity: "elements",
    setDuration: "elements",
    teleportElement: "elements",
    toParticle: "elements",
    // Added with `feel/`. Both are api-bound, measured.
    toast: "ui",
    particles: "effects",

    // The terrain family: the only family reaching **two** namespaces, and a table with one
    // value per action forces the split to resolve here.
    //
    // The three batched writes go to `grid`, because that is where `api.grid.mutate` and its
    // `terrains` writer live — `api.terrains.createAtCell` exists and is **not** what they
    // call. The other eight go to `terrains`. Getting this right is what keeps the
    // API-probe test honest: it records the namespace an action actually reaches, and for
    // those three that is `grid`.
    terrainType: "terrains",
    hasTerrain: "terrains",
    isTerrainType: "terrains",
    terrainHitPoints: "terrains",
    terrainTypeHandle: "terrains",
    countTerrain: "terrains",
    createTerrain: "grid",
    replaceTerrain: "grid",
    removeTerrain: "grid",
    damageTerrain: "terrains",
    setTerrainHitPoints: "terrains",
};

// ── The effect axis ──────────────────────────────────────────────────────────

/**
 * What an action **does**, as opposed to what it needs (`./scope.ts`) or which
 * subject it is about (`ACTION_DOMAINS`).
 *
 * `scope` answers "where can this run", and that is enough to make the wiring
 * correct — but it is not enough to make a *list* usable. Measured, 33 of the 46
 * actions need nothing at all, so a scope-grouped panel would put two thirds of
 * the catalogue under one heading and tell a reader nothing. Effect is the axis
 * that separates them: it says whether an action returns a value, mutates the
 * world, or merely reports, which is the first thing you want to know.
 *
 * It is **measured**, by the same probe as the class, and a test re-measures it.
 * That matters more here than elsewhere: the distinction between `returns` and
 * `effect` is exactly the one the 13 vacuous handlers fall on the wrong side of,
 * so it has to be a fact about the code rather than a claim about it.
 */
export type ActionEffect =
    /** Returns a value the engine may read. A factory. */
    | "returns"
    /** Calls `api.*` — the ambient engine surface. */
    | "api"
    /** Mutates `ctx` — `ctx.commit(...)`, i.e. changes the grid. */
    | "commits"
    /** Writes to the payload, normally `payload.data[field] = value`. */
    | "writes"
    /** Reads the payload or context and does nothing with it but look. */
    | "reads"
    /** Only `console.log`/`warn`. */
    | "logs";

export const ACTION_EFFECT_LABELS: Record<ActionEffect, string> = {
    returns: "Returns a value",
    api: "Calls an API",
    commits: "Changes the grid",
    writes: "Writes instance data",
    reads: "Reads",
    logs: "Logs only",
};

export const ACTION_EFFECT_BLURBS: Record<ActionEffect, string> = {
    returns: "Produces a value — useful where the engine reads the return.",
    api: "Drives the engine through `api.*`.",
    commits: "Commits a mutation to the cell grid via the processing context.",
    writes: "Stores a value on the instance's own data.",
    reads: "Looks at what it is given, and changes nothing.",
    logs: "Prints to the console. Scaffolding, not behaviour.",
};

/**
 * The single effect of each action, **measured**.
 *
 * Ordered by how strong the claim is, and the first match wins — so an action that
 * both calls an API and writes data is filed `api`, because reaching into the
 * engine is the more consequential thing it does. This is the same
 * priority-ladder idea the old `class` axis used, applied to a question that
 * actually has an answer: `action-class.ts` asked "how far short of the api rule
 * does this fall", which is a measure of failure. This asks "what is it".
 */
export const ACTION_EFFECTS: Record<string, ActionEffect> = {
    // commits — the only three that can change the world
    processorConvert: "commits",
    processorLift: "commits",
    isElementAtCell: "reads",
    readElement: "reads",
    countElements: "reads",
    countEmpty: "reads",
    replaceElement: "commits",
    createElement: "commits",
    emptyCells: "commits",
    removeElement: "commits",
    transformElement: "commits",
    setVelocity: "commits",
    addVelocity: "commits",
    setDuration: "commits",
    teleportElement: "commits",
    toParticle: "commits",
    getVelocity: "reads",
    // The element data slots: a read and a write of one number per cell. The read
    // is `reads` and not `returns`, and the reason is the engine's own answer:
    // `getDataFieldAtCell` hands back a number *at a cell*, which is a fact about
    // the world, rather than a value this action manufactured for the process. It
    // is still bindable with `as` — the two are not exclusive, and the
    // context-readable test in `handler-classification.test.ts` is what records
    // that it is.
    readDataField: "reads",
    // `commits`, not `writes`: a data slot is per-cell state the engine persists on
    // the element, so changing it is a grid change like any other cell write — and
    // the slot lives on the cell rather than in a structure's `data` bag, which is
    // what `writes` means everywhere else in this table.
    writeDataField: "commits",
    findFreeCell: "reads",

    // The structure family. Ten read and eight write, and **none** of them can be
    // `commits`: `commits` means `ctx.commit(...)`, and the processing context has no
    // structure members at all. These go through `api.structures.*` like the motion
    // family, and the ladder takes the first match — so they are listed **before** the
    // `api` block, where `api` claims them, rather than after it where nothing would.
    structureType: "api",
    hasStructure: "api",
    isStructureType: "api",
    isMyType: "api",
    isBlockedByPlayer: "api",
    isLauncher: "api",
    isStructureEnabled: "api",
    countStructures: "api",
    structureData: "api",
    mapSpritesheetValue: "api",
    buildStructure: "api",
    removeStructure: "api",
    removeStructures: "api",
    setStructureEnabled: "api",
    setSpritesheetIndex: "api",
    setSpritesheetByValue: "api",
    setStructureData: "api",
    pushStructure: "api",

    // The terrain family, and the one place the two write paths would be told apart if this
    // axis could express them. `commits` means `ctx.commit(...)`; terrain never touches
    // `ctx`, so none of these can be `commits` — the three batched writes call
    // `api.grid.mutate` and the other eight call `api.terrains.*`. All eleven are `api`.
    //
    // That is the honest answer and also the least informative: a `true` from
    // `createTerrain` means "one batch was submitted" and from `damageTerrain` means
    // "sixteen calls were made", and this axis cannot tell those apart. The distinction a
    // program author actually needs is the one no table here records — see the split table
    // in the terrain module header.
    terrainType: "api",
    hasTerrain: "api",
    isTerrainType: "api",
    terrainHitPoints: "api",
    terrainTypeHandle: "api",
    countTerrain: "api",
    createTerrain: "api",
    replaceTerrain: "api",
    removeTerrain: "api",
    damageTerrain: "api",
    setTerrainHitPoints: "api",

    // api — the actions that reach the engine
    energyGenerateWhileHeld: "api",
    energyConsumePerRun: "api",
    signalOutput: "api",
    techAppendUnlock: "api",
    techSetUpgradeLevel: "api",
    techGrantItem: "api",
    // These two were `returns` while they were stubs that handed back a literal.
    // They dig and shoot for real now, so `api` is the stronger and true claim —
    // and the ladder takes the first match, so listing them here is what moves them.
    itemExcavate: "api",
    itemShoot: "api",
    // The two `feel/` actions. Also `api`: they drive `ui.toast` and
    // `effects.createParticlesAtWorld`.
    toast: "api",
    particles: "api",
    // The four read-only walks are `api` too, and that is the honest claim: they
    // reach `api.elements` / `api.terrains` on every call. They change nothing,
    // which is what `reads` is for — but `reads` is not one of the effect
    // categories, and filing them as `returns` would understate the engine
    // contact that is their whole cost.
    logicAny: "api",
    logicAll: "api",
    logicCount: "api",
    logicSum: "api",
    // `forEach` is the one that actually writes, through `writeCells` → `grid.mutate`.
    logicForEach: "api",

    // returns — factories and presets
    energyDefault: "returns",
    energyBank: "returns",
    energyWire: "returns",
    energyConductor: "returns",
    energyNetwork: "returns",
    itemDefault: "returns",

    // The buffer family.
    //
    // `bufferRead` is `returns` and not `reads`, and the difference is the whole
    // reason it can be used: `returns` is the class of action whose value the
    // process binds with `as:`, so a read feeds later steps. `bufferWrite` is
    // `writes` for the same reason `structureWriteData` is — it is the one effect
    // that means "changed a thing that persists" — even though what it changes is
    // shared memory rather than one instance's bag.
    bufferRead: "returns",
    bufferWrite: "writes",
    bufferIncrement: "writes",

    // writes — the instance's own data
    structureWriteData: "writes",
    processorCount: "writes",
    upgradeCountLevel: "writes",
    upgradeScale: "writes",
    // `returns` and not `writes`: it writes no payload and no context, it produces
    // the 1/0 that a later step's `as` reads. That is the effect class that means
    // "exists to be read by the next step", which is exactly its role.
    compare: "returns",
    // Same: the number it answers is for the next step's `as`.
    randomInt: "returns",
    // Also `returns`: `math` answers a number for the next step's `as`, and then
    // nothing else. It is the third member of the "exists to be read" family,
    // after `compare` and `randomInt`.
    math: "returns",
    upgradeAdd: "writes",

    // reads — looks, changes nothing
    structureInspect: "reads",
    structureReadData: "reads",
    triggerScan: "reads",
    identity: "reads",

    // logs — the rest
    signalLog: "logs",
    triggerLog: "logs",
    triggerTick: "logs",
    processorLog: "logs",
    processorNoop: "logs",
    upgradeLog: "logs",
    logArgs: "logs",
    logBuildingPayload: "logs",
    noop: "logs",
};

/** One action's effect, or undefined for a key that does not exist. */
export function effectOf(key: string): ActionEffect | undefined {
    return ACTION_EFFECTS[key];
}

/**
 * Whether a `returns` action's value is thrown away.
 *
 * **Every one of them.** `returns` only *does* something where the engine reads
 * the return, and no slot does: `projectile` is not a call site — a projectile
 * holds a single `ProjectileOption` whose return *is* the configuration — so no
 * action's return is read anywhere.
 *
 * The parameter is kept rather than deleted for two reasons. It keeps the call
 * sites honest: a caller still has to say what it knows about its slot, so if a
 * future engine version starts reading a return somewhere, the answer here changes
 * with it rather than silently claiming a value is wasted. And the 13 flagged
 * actions are unchanged by this refactor — they were already vacuous everywhere
 * except projectile, and they are not projectile options.
 *
 * Kept here rather than in the panel so the flag and the triage cannot disagree.
 */
export function isVacuousReturn(key: string, callSiteUsesReturn: boolean): boolean {
    return ACTION_EFFECTS[key] === "returns" && !callSiteUsesReturn;
}

// ── The domain axis ──────────────────────────────────────────────────────────

/**
 * Which **subject** an action is about — energy, the grid, an item, and so on.
 *
 * This is the one axis that is **declared rather than measured**, and it is worth
 * being honest about why, because the other two earn their keep by being derived.
 *
 * A domain is not a property of what an action *touches* — `energyBank` touches
 * nothing at all, it just returns `{ capacity: 100000 }`, and
 * `techGrantItem` calls `api.player.inventory`, not `api.tech`. A domain says what
 * the action is *for*, which is a naming decision, and no probe can read it off the
 * code. Trying to derive one produced exactly the failure the `api` axis already
 * had: a mechanical rule that mostly lines up and silently does not for the
 * interesting cases.
 *
 * So it is declared, and kept honest the only way a declared axis can be: a test
 * asserts every registered action has exactly one, and that the vocabulary is
 * closed. A new action cannot slip through unfiled.
 */
export type ActionDomain =
    | "energy"
    | "grid"
    | "items"
    | "tech"
    | "projectiles"
    | "excavation"
    | "structure"
    /**
     * Added with the terrain family, and the first domain named after a **namespace**
     * rather than a kind of thing. Every other entry describes a role — energy, items,
     * projectiles — while `terrain` describes a subject, because the solid world is a
     * subject rather than a role: nothing else in the catalogue is *about* rock.
     *
     * The alternative was folding it into `grid`, where the element family already sits,
     * and that was rejected deliberately: two families sharing a domain would make the
     * panel's domain filter answer "does this touch the world" for both, which is the one
     * question it exists to stop asking.
     */
    | "terrain"
    | "diagnostics"
    /** Added with `feel/`: the player sees it, the simulation does not change. */
    | "feedback"
    /**
     * Added with `signalOutput`, on the same reasoning as `terrain` and for the same
     * reason the alternative was rejected: wiring is a subject nothing else in the
     * catalogue is about, and folding it into `grid` or `structure` would make the
     * panel's domain filter answer "does this touch the world" for all three.
     */
    | "signals";

export const ACTION_DOMAIN_LABELS: Record<ActionDomain, string> = {
    energy: "Energy",
    grid: "Cell grid",
    items: "Items",
    tech: "Tech & upgrades",
    projectiles: "Projectiles",
    excavation: "Excavation",
    structure: "Structures",
    /** Added with the terrain family: the solid world, which no other domain was about. */
    terrain: "Terrain",
    diagnostics: "Diagnostics",
    /** Added with `feel/`. The player sees it; nothing in the sim changes. */
    feedback: "Feedback",
    /**
     * Added with `signalOutput`. Signals are the one engine subsystem the panel
     * could previously only *observe* through: `signalLog` filed them under
     * diagnostics, which is true of the logger and false of the thing itself. A
     * structure publishing its output is behaviour a player builds, not wiring
     * they are testing, so it needed a domain of its own rather than a worse fit.
     */
    signals: "Signals",
};

export const ACTION_DOMAIN_BLURBS: Record<ActionDomain, string> = {
    energy: "Produces, consumes, or configures an energy network.",
    grid: "Reads or changes the cells around a structure.",
    items: "What an item does when the player uses it.",
    tech: "Research completion and upgrade levels.",
    projectiles: "Spawn-time options for a projectile.",
    excavation: "Dig behaviour for a tool.",
    structure: "Placed structures: the buildings themselves.",
    terrain: "The solid world: dirt, stone, ice — and their hit points.",
    diagnostics: "Logging and no-ops — wiring tests, not behaviour.",
    feedback: "Something the player sees or hears. Changes no stored state.",
    signals: "Wiring: publishing a structure's signal output, and reading it back.",
};

export const ACTION_DOMAINS: Record<string, ActionDomain> = {
    // energy
    energyDefault: "energy",
    energyBank: "energy",
    energyWire: "energy",
    energyConductor: "energy",
    energyNetwork: "energy",
    energyGenerateWhileHeld: "energy",
    energyConsumePerRun: "energy",

    // grid — the only domain that can change the world
    processorConvert: "grid",
    processorLift: "grid",
    isElementAtCell: "grid",
    readElement: "grid",
    countElements: "grid",
    countEmpty: "grid",
    replaceElement: "grid",
    createElement: "grid",
    emptyCells: "grid",
    removeElement: "grid",
    transformElement: "grid",
    getVelocity: "grid",
    findFreeCell: "grid",
    setVelocity: "grid",
    addVelocity: "grid",
    setDuration: "grid",
    teleportElement: "grid",
    toParticle: "grid",
    readDataField: "grid",
    writeDataField: "grid",
    triggerScan: "grid",
    // The logic family, all on the grid: the four read-only walks through
    // `api.elements` / `api.terrains`, and `forEach` through the element family's
    // `writeCells`. "grid" is the domain — what they touch — which is the axis
    // `ACTION_EFFECTS` answers differently.
    logicAny: "grid",
    logicAll: "grid",
    logicCount: "grid",
    logicSum: "grid",
    logicForEach: "grid",

    // items
    itemDefault: "items",
    itemExcavate: "items",
    itemShoot: "items",

    // tech & upgrades
    techAppendUnlock: "tech",
    techSetUpgradeLevel: "tech",
    techGrantItem: "tech",
    upgradeCountLevel: "tech",
    upgradeScale: "tech",
    upgradeAdd: "tech",

    // projectiles
    // No rows: the projectile presets are `ProjectileOptionFn`s, not actions, so
    // they carry no domain. They are browsed in their own panel, under
    // `./projectile-option/`. The `projectiles` domain below still exists as a
    // label so a stored config that references one can be named in a message —
    // but no action is filed under it.

    // excavation

    // The buffer family: the mod's own shared slots.
    //
    // Filed under `structure` because that is the nearest honest fit — the
    // alternatives were all worse. Not a new domain: "does this touch the world"
    // is the question the domain filter answers, and a buffer is the one thing in
    // the catalogue that touches *neither* the world nor any structure, so a
    // domain of its own would have to be a special case in every consumer.
    bufferRead: "structure",
    bufferWrite: "structure",
    bufferIncrement: "structure",

    // structure data
    structureInspect: "structure",
    structureReadData: "structure",
    structureWriteData: "structure",
    processorCount: "structure",

    // The structure family: one namespace, eighteen actions.
    //
    // A single block because there is nothing to distinguish. Every one of these reaches
    // `api.structures`, and — unlike the element family, which split across `grid` and
    // `context` — no structure action touches any other namespace. `processing` is a
    // sub-namespace of `structures`, not a sibling, so `isStructureEnabled` and
    // `setStructureEnabled` are recorded here too rather than as their own row.
    structureType: "structure",
    hasStructure: "structure",
    isStructureType: "structure",
    isMyType: "structure",
    isBlockedByPlayer: "structure",
    isLauncher: "structure",
    isStructureEnabled: "structure",
    countStructures: "structure",
    structureData: "structure",
    mapSpritesheetValue: "structure",
    buildStructure: "structure",
    removeStructure: "structure",
    removeStructures: "structure",
    setStructureEnabled: "structure",
    setSpritesheetIndex: "structure",
    setSpritesheetByValue: "structure",
    setStructureData: "structure",
    pushStructure: "structure",

    // The terrain family. One domain like the other three cell families, and the reason is
    // the same: the domain axis is about *what kind of thing* an action touches, and
    // terrain is the world, not a player's inventory or a diagnostic. It is recorded here
    // rather than folded into `grid` because the element family already owns `grid`, and
    // two families sharing a domain would make the panel's filter useless for the one
    // question it exists to answer.
    terrainType: "terrain",
    hasTerrain: "terrain",
    isTerrainType: "terrain",
    terrainHitPoints: "terrain",
    terrainTypeHandle: "terrain",
    countTerrain: "terrain",
    createTerrain: "terrain",
    replaceTerrain: "terrain",
    removeTerrain: "terrain",
    damageTerrain: "terrain",
    setTerrainHitPoints: "terrain",

    // diagnostics
    noop: "diagnostics",
    // The weakest fit in this table, and worth saying why it was not fixed by
    // adding a domain. A domain is "the subject an action is about", and a
    // comparison of two numbers is about neither gold nor terrain nor wiring —
    // it has no subject. Filing it under `signals` or `grid` would be a worse
    // lie than this one: those are the questions the filter exists to separate.
    // `diagnostics` is where the other pure decision primitives already live
    // (`noop`, `identity`), and a "plain values" domain with exactly one member
    // would cost the filter more than it earns.
    compare: "diagnostics",
    // `diagnostics` again, and the same reasoning as `compare` above applies with
    // even less to argue about: a number that has had arithmetic done to it is
    // about no subject in the vocabulary. It is also where a `math` domain would
    // be wrong, for the reason recorded under `randomInt` — one action is not a
    // domain.
    math: "diagnostics",
    // `diagnostics` is the wrong answer here and there is nothing better in the
    // vocabulary: the nine domains describe subjects (gold, terrain, wiring), and
    // a number drawn at random is about none of them. A `random` domain would hold
    // exactly this action and would make the panel's filter one question wider.
    randomInt: "diagnostics",
    processorNoop: "diagnostics",
    processorLog: "diagnostics",
    signalLog: "diagnostics",
    triggerLog: "diagnostics",
    triggerTick: "structure",
    upgradeLog: "diagnostics",
    logArgs: "diagnostics",
    identity: "diagnostics",
    logBuildingPayload: "diagnostics",
    // The two `feel/` actions. `toast` and `particles` read and write no stored
    // state, so `diagnostics` would be wrong — those are scaffolding, and this is
    // something a player is meant to see.
    toast: "feedback",
    particles: "feedback",
    // The publisher, filed with the thing it is about rather than with the
    // loggers. `signalLog` is `diagnostics` because it prints; this one changes
    // engine state, and the panel should not offer it as a diagnostic.
    signalOutput: "signals",
};

export function domainOf(key: string): ActionDomain | undefined {
    return ACTION_DOMAINS[key];
}

/** Every action that does not satisfy the "must call one api.*" rule. */
export function offRuleActions(): { key: string; cls: HandlerActionClass }[] {
    return Object.entries(ACTION_CLASSES)
        .filter(([, c]) => c !== "api")
        .map(([key, cls]) => ({ key, cls }));
}
