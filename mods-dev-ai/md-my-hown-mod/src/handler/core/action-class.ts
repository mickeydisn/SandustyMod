/**
 * What a handler action **depends on** to do its job.
 *
 * An action is supposed to call one `api.*` section — the rule the Process/Action
 * split rests on. Measured, only 5 of 43 do. This is a **ladder**, not a taxonomy:
 * an action that both reads the payload and calls `api.energy` is filed under
 * `api`, because that is the stronger claim.
 *
 * | class | needs | n |
 * | --- | --- | --- |
 * | `api` | one `api.*` namespace | 5 |
 * | `self-sufficient` | only the payload and params it was handed | 15 |
 * | `context-bound` | the engine's processing context (`ctx`) | 3 |
 * | `pure` | nothing at all — a constant, or a logger | 16 |
 *
 * `context-bound` is the closest thing here to a real capability boundary: it gets
 * `ctx.commit` handed in rather than reaching for a namespace. `pure` is a third of
 * the catalogue and is mostly debug scaffolding.
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

    // ── context-bound (3) ─────────────────────────────────────────────────────
    processorScan: "context-bound",
    isElementAtCell: "context-bound",
    processorLift: "context-bound",
    processorConvert: "context-bound",
    readElement: "context-bound",
    countElements: "context-bound",
    countEmpty: "context-bound",
    replaceElement: "api",
    createElement: "api",
    emptyCells: "api",
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
    noop: "pure",
    upgradeScale: "self-sufficient",

    // ── pure (22) ─────────────────────────────────────────────────────────────
    // The loggers. They read the payload they were handed to print it, which the
    // probe counts as a read — so `signalLog` and friends sit in `pure` only
    // because a `console.log` of a whole object never touches a *property* of it.
    signalLog: "pure",
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
 * `ACTION_API_PATHS` keeps the leaves for documentation and the snippet output.
 *
 * Measured with the same probe as the class: a fake `sandkit` whose namespaces
 * record on property access.
 */
export const ACTION_APIS: Record<string, string> = {
    energyGenerateWhileHeld: "energy",
    energyConsumePerRun: "energy",
    techAppendUnlock: "tech",
    techSetUpgradeLevel: "upgrades",
    techGrantItem: "player",
    itemExcavate: "grid",
    itemShoot: "projectiles",
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
    replaceElement: "grid",
    createElement: "grid",
    emptyCells: "grid",
    transformElement: "grid",
    // The motion family, all one namespace. It is worth being explicit that this is a
    // *different* `elements` from the one the element family would have used: the
    // element family never calls `api.elements` at all — it goes through the
    // processing context — so "elements" appearing here and nowhere else is the
    // clearest single statement of where the boundary between the two families runs.
    getVelocity: "elements",
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

/** The full call path, for documentation and "copy snippet". */
export const ACTION_API_PATHS: Record<string, string> = {
    energyGenerateWhileHeld: "api.energy.addAtCell / api.energy.getNetworkFreeCapacityAtCell",
    energyConsumePerRun: "api.energy.consume",
    // The namespace is real and the second argument is an object of id lists —
    // this is the call `handler-classification.test.ts` asserts fires.
    techAppendUnlock: "api.tech.conservatory.appendUnlock",
    techSetUpgradeLevel: "api.upgrades.setLevelById",
    techGrantItem: "api.player.inventory.addById",
    itemExcavate: "api.grid.excavateAtCell",
    itemShoot: "api.projectiles.spawnAtWorld",
    toast: "api.ui.toast",
    particles: "api.effects.createParticlesAtWorld",
};

/** The namespace an action calls, or undefined if it calls none. */
export function apiOf(key: string): string | undefined {
    return ACTION_APIS[key];
}

/** Every action a given `api.*` namespace owns, for the catalogue's grouping. */
export function actionsOfApi(namespace: string): string[] {
    return Object.keys(ACTION_APIS).filter((k) => ACTION_APIS[k] === namespace);
}

/** Every action with no API at all — the ones the rule has to rule on. */
export function actionsWithoutApi(): string[] {
    return Object.keys(ACTION_CLASSES).filter((k) => !ACTION_APIS[k]);
}

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
    processorScan: "reads",
    isElementAtCell: "reads",
    readElement: "reads",
    countElements: "reads",
    countEmpty: "reads",
    replaceElement: "commits",
    createElement: "commits",
    emptyCells: "commits",
    transformElement: "commits",
    setVelocity: "commits",
    addVelocity: "commits",
    setDuration: "commits",
    teleportElement: "commits",
    toParticle: "commits",
    getVelocity: "reads",
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

    // returns — factories and presets
    energyDefault: "returns",
    energyBank: "returns",
    energyWire: "returns",
    energyConductor: "returns",
    energyNetwork: "returns",
    itemDefault: "returns",

    // writes — the instance's own data
    structureWriteData: "writes",
    processorCount: "writes",
    upgradeCountLevel: "writes",
    upgradeScale: "writes",
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
    | "feedback";

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
    processorScan: "grid",
    isElementAtCell: "grid",
    readElement: "grid",
    countElements: "grid",
    countEmpty: "grid",
    replaceElement: "grid",
    createElement: "grid",
    emptyCells: "grid",
    transformElement: "grid",
    getVelocity: "grid",
    findFreeCell: "grid",
    setVelocity: "grid",
    addVelocity: "grid",
    setDuration: "grid",
    teleportElement: "grid",
    toParticle: "grid",
    triggerScan: "grid",

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
};

export function domainOf(key: string): ActionDomain | undefined {
    return ACTION_DOMAINS[key];
}

/** How many actions each domain holds, for the filter chips. */
export function domainCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const d of Object.values(ACTION_DOMAINS)) out[d] = (out[d] ?? 0) + 1;
    return out;
}

/** Every action that does not satisfy the "must call one api.*" rule. */
export function offRuleActions(): { key: string; cls: HandlerActionClass }[] {
    return Object.entries(ACTION_CLASSES)
        .filter(([, c]) => c !== "api")
        .map(([key, cls]) => ({ key, cls }));
}
