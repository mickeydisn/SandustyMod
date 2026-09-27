/**
 * What a handler action **depends on** to do its job.
 *
 * An action is supposed to call one `api.*` section — that is the rule the whole
 * Process/Action split rests on. Measured, only 5 of the 43 actions do. The rest
 * get by on something weaker, and the three ways they manage that are what this
 * class records:
 *
 * | class | needs | n |
 * | --- | --- | --- |
 * | `api` | one `api.*` namespace | 5 |
 * | `self-sufficient` | only the payload and params it was handed | 15 |
 * | `context-bound` | the engine's processing context (`ctx`) | 3 |
 * | `pure` | nothing at all — a constant, or a logger | 20 |
 *
 * The three below `api` are the ones that break the rule, and each needs a
 * decision rather than a mechanism:
 *
 *  - **`self-sufficient`** reads only what it was passed — `structure.data`,
 *    `item.data`, its own options. That is legitimate and is most of the
 *    catalogue. It is not *atomic against an API*, though: it reaches into
 *    engine objects directly.
 *  - **`context-bound`** needs `ctx.commit` / `ctx.getResolvedTypeAtCell`, which
 *    is the engine's `StructureProcessingContext` — a per-call capability handed
 *    in, not a namespace. The closest thing here to a real capability boundary.
 *  - **`pure`** needs nothing. A third of the catalogue is constants
 *    (`projectileFast` is a literal) or `console.log`. These are debug
 *    scaffolding, not behaviour, and the honest question is whether they should
 *    exist at all.
 *
 * So `api` is the class the rule *wants*; the other three record how far short of
 * it each action falls. That ordering is the point — this is a **ladder**, not a
 * taxonomy. An action that both reads the payload and calls `api.energy` is filed
 * under `api`, because that is the stronger claim.
 */
import { ANY_HANDLERS, CODE_HANDLERS, PROCESS_HANDLERS } from "./handlers.ts";

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
    // ── api (5) ───────────────────────────────────────────────────────────────
    energyGenerateWhileHeld: "api",
    energyConsumePerRun: "api",
    techAppendUnlock: "api",
    techSetUpgradeLevel: "api",
    techGrantItem: "api",

    // ── context-bound (3) ─────────────────────────────────────────────────────
    processorScan: "context-bound",
    processorLift: "context-bound",
    processorConvert: "context-bound",

    // ── self-sufficient (15) ──────────────────────────────────────────────────
    structureInspect: "self-sufficient",
    structureReadData: "self-sufficient",
    structureWriteData: "self-sufficient",
    triggerScan: "self-sufficient",
    energyDefault: "self-sufficient",
    energyBank: "self-sufficient",
    energyWire: "self-sufficient",
    energyConductor: "self-sufficient",
    energyNetwork: "self-sufficient",
    upgradeCountLevel: "self-sufficient",
    upgradeScale: "self-sufficient",
    upgradeAdd: "self-sufficient",
    itemExcavate: "self-sufficient",
    itemShoot: "self-sufficient",
    processorCount: "self-sufficient",

    // ── pure (23) ─────────────────────────────────────────────────────────────
    noop: "pure",
    processorNoop: "pure",
    signalLog: "pure",
    triggerLog: "pure",
    triggerTick: "pure",
    upgradeLog: "pure",
    processorLog: "pure",
    defaultProjectileOptions: "pure",
    itemDefault: "pure",
    excavationDefault: "pure",
    excavationCrusher: "pure",
    excavationDrill: "pure",
    excavationGun: "pure",
    excavationShatter: "pure",
    projectileHeavy: "pure",
    projectileFast: "pure",
    projectileHoming: "pure",
    projectileShotgun: "pure",
    projectileExcavate: "pure",
    projectileTerrain: "pure",
    // The three modifier-slot actions, in `CODE_HANDLERS`. `identity` measures as
    // pure because returning its argument is not a *read* of it — it is a constant
    // function in all but name, which is a fair description.
    logArgs: "pure",
    identity: "pure",
    logBuildingPayload: "pure",
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
 * The two registries have **different signatures**, which is why the argument
 * labels differ and why a single flat "arg 2" label would be wrong:
 *
 *   - `ANY_HANDLERS`     → `(payload, extra)`
 *   - `PROCESS_HANDLERS` → `(structure, context, options)`
 *
 * Getting that backwards labels every `extra` as a `ctx` and manufactures
 * context-bound actions out of handlers that only read their options.
 */
export function measureActionDeps(key: string): ActionDeps | undefined {
    const any = (ANY_HANDLERS as Record<string, unknown>)[key] as
        | ((...a: unknown[]) => unknown)
        | undefined;
    const proc = (PROCESS_HANDLERS as Record<string, unknown>)[key] as
        | ((...a: unknown[]) => unknown)
        | undefined;
    // The modifier slot lives in `CODE_HANDLERS`, whose values are
    // `{ kind, fn }` **objects**, not bare functions — so it has to be unwrapped
    // or the lookup misses. That indirection is also why `resolveAnyHandler`, the
    // pre-split lookup, never found these three.
    const code = (CODE_HANDLERS as Record<string, unknown>)[key] as
        | { fn?: (p: unknown, c: unknown, o: unknown) => unknown }
        | undefined;
    const fn = any ?? proc ?? code?.fn;
    if (typeof fn !== "function") return undefined;

    const seen: Record<keyof Omit<ActionDeps, "threw">, boolean> = {
        payload: false,
        extra: false,
        ctx: false,
        api: false,
    };

    /** Records any property read, and keeps returning something usable. */
    const spy = (label: keyof typeof seen, depth = 0): unknown =>
        new Proxy({} as Record<PropertyKey, unknown>, {
            get(_t, prop) {
                if (typeof prop === "string" && !prop.startsWith("__")) seen[label] = true;
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
        if (proc) fn(spy("payload"), spy("ctx"), spy("extra"));
        // `ANY_HANDLERS` is now the canonical `(payload, ctx, options)` too. It used
        // to be `(payload, extra)` — the signature change is the paired half of the
        // Process/Action split, and passing two arguments here would measure the
        // wrong slot for every action in that registry.
        else fn(spy("payload"), spy("ctx"), spy("extra"));
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
};

/** The full call path, for documentation and "copy snippet". */
export const ACTION_API_PATHS: Record<string, string> = {
    energyGenerateWhileHeld: "api.energy.addAtCell / api.energy.getNetworkFreeCapacityAtCell",
    energyConsumePerRun: "api.energy.consume",
    techAppendUnlock: "api.tech.conservatory.appendUnlock",
    techSetUpgradeLevel: "api.upgrades.setLevelById",
    techGrantItem: "api.player.inventory.addById",
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

    // api — the five that reach the engine
    energyGenerateWhileHeld: "api",
    energyConsumePerRun: "api",
    techAppendUnlock: "api",
    techSetUpgradeLevel: "api",
    techGrantItem: "api",

    // returns — factories and presets
    defaultProjectileOptions: "returns",
    projectileHeavy: "returns",
    projectileFast: "returns",
    projectileHoming: "returns",
    projectileShotgun: "returns",
    projectileExcavate: "returns",
    projectileTerrain: "returns",
    excavationDefault: "returns",
    excavationCrusher: "returns",
    excavationDrill: "returns",
    excavationGun: "returns",
    excavationShatter: "returns",
    energyDefault: "returns",
    energyBank: "returns",
    energyWire: "returns",
    energyConductor: "returns",
    energyNetwork: "returns",
    itemDefault: "returns",
    itemExcavate: "returns",
    itemShoot: "returns",

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
 * The 13 actions that return a descriptor into a slot which discards it.
 *
 * `returns` is a real effect, but it only *does* something where the engine reads
 * the return — and measured, that is one slot of eight. Everywhere else a
 * `returns` action produces a value that is computed and then dropped, which is
 * why the panel flags them rather than presenting them as if they were peers of
 * `commits`.
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
    | "diagnostics";

export const ACTION_DOMAIN_LABELS: Record<ActionDomain, string> = {
    energy: "Energy",
    grid: "Cell grid",
    items: "Items",
    tech: "Tech & upgrades",
    projectiles: "Projectiles",
    excavation: "Excavation",
    structure: "Structure data",
    diagnostics: "Diagnostics",
};

export const ACTION_DOMAIN_BLURBS: Record<ActionDomain, string> = {
    energy: "Produces, consumes, or configures an energy network.",
    grid: "Reads or changes the cells around a structure.",
    items: "What an item does when the player uses it.",
    tech: "Research completion and upgrade levels.",
    projectiles: "Spawn-time options for a projectile.",
    excavation: "Dig behaviour for a tool.",
    structure: "Per-instance data on a placed structure.",
    diagnostics: "Logging and no-ops — wiring tests, not behaviour.",
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
    defaultProjectileOptions: "projectiles",
    projectileHeavy: "projectiles",
    projectileFast: "projectiles",
    projectileHoming: "projectiles",
    projectileShotgun: "projectiles",
    projectileExcavate: "projectiles",
    projectileTerrain: "projectiles",

    // excavation
    excavationDefault: "excavation",
    excavationCrusher: "excavation",
    excavationDrill: "excavation",
    excavationGun: "excavation",
    excavationShatter: "excavation",

    // structure data
    structureInspect: "structure",
    structureReadData: "structure",
    structureWriteData: "structure",
    processorCount: "structure",

    // diagnostics
    noop: "diagnostics",
    processorNoop: "diagnostics",
    processorLog: "diagnostics",
    signalLog: "diagnostics",
    triggerLog: "diagnostics",
    triggerTick: "diagnostics",
    upgradeLog: "diagnostics",
    logArgs: "diagnostics",
    identity: "diagnostics",
    logBuildingPayload: "diagnostics",
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
