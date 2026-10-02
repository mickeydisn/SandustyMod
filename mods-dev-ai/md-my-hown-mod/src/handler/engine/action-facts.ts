/**
 * One record per action. Every fact the codebase knows about an action that is not
 * "how to run it" lives here, in one place, once.
 *
 * The four tables this replaces (`ACTION_CLASSES`, `ACTION_APIS`, `ACTION_EFFECTS`,
 * `ACTION_DOMAINS`) were each `Record<string, X>` with 94 keys, kept in sync by hand.
 * A missing key in any one of them was a silent `undefined` at runtime, not a type
 * error. `ACTION_META` is keyed by the action key, and the key type is derived from
 * the action definitions themselves — so an action with no record, or a record for an
 * action that does not exist, is now a compile error.
 *
 * Derived lookups (`actionClassOf`, `effectOf`, `domainOf`, `apiOf`) read from this one
 * record. `HANDLER_META` in the registry reads from it too. Nothing writes a second
 * table.
 */

import type { ActionKey } from "../actions/index.ts";

export type HandlerActionClass = "api" | "self-sufficient" | "context-bound" | "pure";

export type ActionEffect =
    | "returns"
    | "api"
    | "commits"
    | "writes"
    | "reads"
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

export type ActionDomain =
    | "energy"
    | "grid"
    | "items"
    | "tech"
    | "projectiles"
    | "excavation"
    | "structure"
    | "terrain"
    | "diagnostics"
    | "feedback"
    | "signals";

export const ACTION_DOMAIN_LABELS: Record<ActionDomain, string> = {
    energy: "Energy",
    grid: "Cell grid",
    items: "Items",
    tech: "Tech & upgrades",
    projectiles: "Projectiles",
    excavation: "Excavation",
    structure: "Structures",
    terrain: "Terrain",
    diagnostics: "Diagnostics",
    feedback: "Feedback",
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

/** What one action is, in one place. Every field is required. */
export interface ActionFacts {
    /** How the action reaches the engine, if at all. */
    readonly cls: HandlerActionClass;
    /** The single `api.*` namespace it calls. `""` when it calls none. */
    readonly api: string;
    /** What it does to the world. */
    readonly effect: ActionEffect;
    /** Which engine area it belongs to. */
    readonly domain: ActionDomain;
    /** Options the dep probe uses to call this action successfully. Absent = none. */
    readonly options?: Record<string, unknown>;
}

/** Every action key, as a literal union, taken from the definitions. */
export type { ActionKey };

export type ActionFactsTable = Record<ActionKey, ActionFacts>;

/**
 * The record. One line per action, five facts, no partial entries — an engine-free
 * action says `api: ""` rather than leaving the key out, so "calls no api" is stated
 * instead of implied by absence.
 */
export const ACTION_FACTS: ActionFactsTable = {
    structureInspect: { cls: "self-sufficient", effect: "reads", domain: "structure", api: "" },
    structureReadData: { cls: "self-sufficient", effect: "reads", domain: "structure", api: "" },
    triggerScan: { cls: "self-sufficient", effect: "reads", domain: "grid", api: "" },
    signalLog: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    triggerLog: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    isElementAtCell: { cls: "context-bound", effect: "reads", domain: "grid", api: "" },
    randomInt: { cls: "api", effect: "returns", domain: "diagnostics", api: "random" },
    math: { cls: "self-sufficient", effect: "returns", domain: "diagnostics", api: "" },
    compare: { cls: "self-sufficient", effect: "returns", domain: "diagnostics", api: "" },
    noop: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    upgradeScale: { cls: "self-sufficient", effect: "writes", domain: "tech", api: "" },
    itemExcavate: { cls: "api", effect: "api", domain: "items", api: "grid" },
    itemShoot: { cls: "api", effect: "api", domain: "items", api: "projectiles" },
    processorLog: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    processorNoop: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    processorLift: { cls: "context-bound", effect: "commits", domain: "grid", api: "" },
    processorConvert: { cls: "context-bound", effect: "commits", domain: "grid", api: "" },
    readElement: { cls: "api", effect: "reads", domain: "grid", api: "elements" },
    readDataField: { cls: "api", effect: "reads", domain: "grid", api: "elements" },
    writeDataField: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    countElements: { cls: "api", effect: "reads", domain: "grid", api: "elements" },
    countEmpty: { cls: "api", effect: "reads", domain: "grid", api: "elements" },
    replaceElement: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    createElement: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    emptyCells: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    removeElement: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    transformElement: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    getVelocity: {
        cls: "api",
        effect: "reads",
        domain: "grid",
        api: "elements",
        options: { "size": 1 },
    },
    findFreeCell: { cls: "api", effect: "reads", domain: "grid", api: "elements" },
    setVelocity: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    addVelocity: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    setDuration: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    teleportElement: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    toParticle: { cls: "api", effect: "commits", domain: "grid", api: "elements" },
    structureType: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    hasStructure: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    isStructureType: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    isMyType: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    isBlockedByPlayer: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    isLauncher: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    isStructureEnabled: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    countStructures: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    structureData: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    mapSpritesheetValue: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    buildStructure: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    removeStructure: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    removeStructures: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    setStructureEnabled: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    setSpritesheetIndex: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    setSpritesheetByValue: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    setStructureData: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    pushStructure: { cls: "api", effect: "api", domain: "structure", api: "structures" },
    terrainType: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    hasTerrain: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    isTerrainType: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    terrainHitPoints: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    terrainTypeHandle: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    countTerrain: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    createTerrain: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    replaceTerrain: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    removeTerrain: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    damageTerrain: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    setTerrainHitPoints: { cls: "api", effect: "api", domain: "terrain", api: "terrains" },
    structureWriteData: { cls: "self-sufficient", effect: "writes", domain: "structure", api: "" },
    triggerTick: { cls: "self-sufficient", effect: "logs", domain: "structure", api: "" },
    upgradeCountLevel: { cls: "self-sufficient", effect: "writes", domain: "tech", api: "" },
    upgradeAdd: { cls: "self-sufficient", effect: "writes", domain: "tech", api: "" },
    bufferRead: { cls: "self-sufficient", effect: "returns", domain: "structure", api: "" },
    bufferWrite: { cls: "self-sufficient", effect: "writes", domain: "structure", api: "" },
    bufferIncrement: { cls: "self-sufficient", effect: "writes", domain: "structure", api: "" },
    processorCount: { cls: "self-sufficient", effect: "writes", domain: "structure", api: "" },
    toast: { cls: "api", effect: "api", domain: "feedback", api: "ui" },
    particles: { cls: "api", effect: "api", domain: "feedback", api: "effects" },
    upgradeLog: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    signalOutput: { cls: "api", effect: "api", domain: "signals", api: "signals" },
    energyConsumePerRun: { cls: "api", effect: "api", domain: "energy", api: "energy" },
    energyGenerateWhileHeld: { cls: "api", effect: "api", domain: "energy", api: "energy" },
    techAppendUnlock: {
        cls: "api",
        effect: "api",
        domain: "tech",
        api: "tech",
        options: { "techId": "iron", "structures": ["wall"] },
    },
    techGrantItem: { cls: "api", effect: "api", domain: "tech", api: "player" },
    techSetUpgradeLevel: { cls: "api", effect: "api", domain: "tech", api: "upgrades" },
    energyDefault: { cls: "self-sufficient", effect: "returns", domain: "energy", api: "" },
    energyBank: { cls: "self-sufficient", effect: "returns", domain: "energy", api: "" },
    energyWire: { cls: "self-sufficient", effect: "returns", domain: "energy", api: "" },
    energyConductor: { cls: "pure", effect: "returns", domain: "energy", api: "" },
    energyNetwork: { cls: "self-sufficient", effect: "returns", domain: "energy", api: "" },
    itemDefault: { cls: "pure", effect: "returns", domain: "items", api: "" },
    logArgs: { cls: "pure", effect: "logs", domain: "diagnostics", api: "" },
    identity: { cls: "pure", effect: "reads", domain: "diagnostics", api: "" },
    logBuildingPayload: { cls: "self-sufficient", effect: "logs", domain: "diagnostics", api: "" },
    logicAny: {
        cls: "api",
        effect: "api",
        domain: "grid",
        api: "elements",
        options: { "element": "water", "size": 3 },
    },
    logicAll: {
        cls: "api",
        effect: "api",
        domain: "grid",
        api: "elements",
        options: { "element": "water", "size": 3 },
    },
    logicCount: {
        cls: "api",
        effect: "api",
        domain: "grid",
        api: "elements",
        options: { "element": "water", "size": 3 },
    },
    logicSum: {
        cls: "api",
        effect: "api",
        domain: "grid",
        api: "terrains",
        options: { "size": 3 },
    },
    logicForEach: {
        cls: "api",
        effect: "api",
        domain: "grid",
        api: "grid",
        options: { "to": "stone", "size": 3 },
    },
};

/** The record for one action, or undefined if the key is not an action. */
export function actionFacts(key: string): ActionFacts | undefined {
    return (ACTION_FACTS as Record<string, ActionFacts>)[key];
}

export function actionClassOf(key: string): HandlerActionClass | undefined {
    return actionFacts(key)?.cls;
}

export function apiOf(key: string): string | undefined {
    const api = actionFacts(key)?.api;
    return api ? api : undefined;
}

export function effectOf(key: string): ActionEffect | undefined {
    return actionFacts(key)?.effect;
}

export function domainOf(key: string): ActionDomain | undefined {
    return actionFacts(key)?.domain;
}

export function isVacuousReturn(key: string, callSiteUsesReturn: boolean): boolean {
    return effectOf(key) === "returns" && !callSiteUsesReturn;
}

/** Actions that do not drive the engine through api.* — the off-rule list. */
export function offRuleActions(): { key: string; cls: HandlerActionClass }[] {
    return (Object.entries(ACTION_FACTS) as [ActionKey, ActionFacts][])
        .filter(([, f]) => f.cls !== "api")
        .map(([key, f]) => ({ key, cls: f.cls }));
}

/**
 * Runtime companion to the compile-time key check.
 *
 * `Record<ActionKey, ActionFacts>` already makes a missing or extra record a build
 * failure, so this should never fire. It is here for the one case the type system
 * cannot see: a record that is *present* but internally inconsistent — a `cls: "api"`
 * action that names no `api`, or an `api` value on a class that makes no engine call.
 * That mismatch is not an error by itself (the rule is a convention, not a law), so it
 * is reported rather than thrown.
 *
 * Runs once at import, next to the duplicate-key guard in `actions/index.ts`.
 */
function auditFacts(): void {
    const problems: string[] = [];
    for (const [key, f] of Object.entries(ACTION_FACTS) as [ActionKey, ActionFacts][]) {
        if (f.cls === "api" && !f.api) {
            problems.push(`${key}: cls "api" but no api namespace`);
        }
        if (f.cls !== "api" && f.api) {
            problems.push(`${key}: cls "${f.cls}" but calls api.${f.api}`);
        }
    }
    if (problems.length) {
        console.warn(
            `[md-my-hown-mod:handler] ${problems.length} action fact mismatch(es):\n  ` +
                problems.join("\n  "),
        );
    }
}

auditFacts();
