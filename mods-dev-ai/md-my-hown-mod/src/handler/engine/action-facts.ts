

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

/**
 * The `api.*` namespaces an action may reach for.
 *
 * A closed list rather than `string`, so naming a namespace that does not
 * exist is a compile error. This is also what lets the `ActionFacts` union
 * reject `cls: "api"` with an empty namespace.
 */
export type ApiNamespace =
    | "effects"
    | "elements"
    | "energy"
    | "grid"
    | "player"
    | "projectiles"
    | "random"
    | "signals"
    | "structures"
    | "tech"
    | "terrains"
    | "ui"
    | "upgrades";

interface ActionFactsBase {
    readonly effect: ActionEffect;

    readonly domain: ActionDomain;

    readonly options?: Record<string, unknown>;
}

/**
 * `cls` and `api` are kept consistent by the type rather than by a check.
 *
 * An action that reaches for `api.*` is classed "api" and must name the
 * namespace; every other class must leave it empty. Splitting the union is
 * what enforces that, so a mismatch is a compile error instead of a console
 * warning from a loop over the whole table that ran on every module load.
 */
export type ActionFacts =
    | (ActionFactsBase & { readonly cls: "api"; readonly api: ApiNamespace })
    | (ActionFactsBase & {
        readonly cls: Exclude<HandlerActionClass, "api">;
        readonly api: "";
    });

export type { ActionKey };

export type ActionFactsTable = Record<ActionKey, ActionFacts>;

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

export function actionFacts(key: string): ActionFacts | undefined {
    return (ACTION_FACTS as Record<string, ActionFacts>)[key];
}

export function effectOf(key: string): ActionEffect | undefined {
    return actionFacts(key)?.effect;
}

export function domainOf(key: string): ActionDomain | undefined {
    return actionFacts(key)?.domain;
}

