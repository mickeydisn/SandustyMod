
import { ALL_ACTIONS } from "../actions/index.ts";



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




export const ACTION_CLASSES: Record<string, HandlerActionClass> = {
    
    energyGenerateWhileHeld: "api",
    energyConsumePerRun: "api",
    techAppendUnlock: "api",
    techSetUpgradeLevel: "api",
    techGrantItem: "api",
    itemExcavate: "api",
    itemShoot: "api",

    
    
    
    
    
    
    
    
    
    
    
    
    isElementAtCell: "context-bound",
    
    
    
    
    
    
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

    
    
    
    
    
    
    
    
    
    bufferRead: "self-sufficient",
    bufferWrite: "self-sufficient",
    bufferIncrement: "self-sufficient",

    
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
    
    
    
    
    
    
    readDataField: "api",
    writeDataField: "api",
    noop: "pure",
    upgradeScale: "self-sufficient",
    
    
    
    
    compare: "self-sufficient",
    
    
    
    
    randomInt: "api",
    
    
    
    math: "self-sufficient",

    
    
    
    
    signalLog: "pure",
    
    
    
    signalOutput: "api",
    triggerLog: "pure",
    processorLog: "pure",
    processorNoop: "pure",
    logArgs: "pure",
    identity: "pure",
    itemDefault: "pure",
    
    
    
    upgradeLog: "pure",
    
    
    
    logBuildingPayload: "self-sufficient",

    
    
    
    toast: "api",
    particles: "api",
};




export interface ActionDeps {
    payload: boolean;
    extra: boolean;
    ctx: boolean;
    api: boolean;
    threw: boolean;
}


export const VALID_OPTIONS: Record<string, Record<string, unknown>> = {
    logicAny: { element: "water", size: 3 },
    logicAll: { element: "water", size: 3 },
    logicCount: { element: "water", size: 3 },
    logicSum: { size: 3 },
    logicForEach: { to: "stone", size: 3 },
    
    
    
    
    
    
    getVelocity: { size: 1 },
    techAppendUnlock: { techId: "iron", structures: ["wall"] },
};


export function measureActionDeps(key: string): ActionDeps | undefined {
    const def = ALL_ACTIONS[key];
    if (!def) return undefined;
    const fn = def.fn as (...a: unknown[]) => unknown;
    
    
    const secondIsCtx = def.signature === "processing" || def.signature === "modifier";

    const seen: Record<keyof Omit<ActionDeps, "threw">, boolean> = {
        payload: false,
        extra: false,
        ctx: false,
        api: false,
    };

    
    const spy = (label: keyof typeof seen, depth = 0): unknown =>
        new Proxy({} as Record<PropertyKey, unknown>, {
            get(_t, prop) {
                if (typeof prop === "string" && !prop.startsWith("__")) seen[label] = true;
                
                if (prop === "valueOf" || prop === "toString") return () => 1;
                
                
                
                
                
                
                if (prop === Symbol.toPrimitive) return undefined;
                
                
                
                
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
    
    
    
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    let threw = false;
    try {
        
        
        
        
        
        
        if (secondIsCtx) fn(spy("payload"), spy("ctx"), spy("extra"));
        else fn(spy("payload"), spy("extra"), spy("extra"));
        
        
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


export function classFromDeps(d: ActionDeps): HandlerActionClass {
    if (d.api) return "api";
    if (d.ctx) return "context-bound";
    if (d.payload || d.extra) return "self-sufficient";
    return "pure";
}

export function actionClassOf(key: string): HandlerActionClass | undefined {
    return ACTION_CLASSES[key];
}


export const ACTION_APIS: Record<string, string> = {
    
    
    
    
    
    
    energyGenerateWhileHeld: "energy",
    energyConsumePerRun: "energy",
    techAppendUnlock: "tech",
    techSetUpgradeLevel: "upgrades",
    techGrantItem: "player",
    itemExcavate: "grid",
    itemShoot: "projectiles",
    
    
    
    randomInt: "random",
    
    signalOutput: "signals",
    
    
    
    
    
    
    logicAny: "elements",
    logicAll: "elements",
    logicCount: "elements",
    logicSum: "terrains",
    logicForEach: "grid",
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
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
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    readElement: "elements",
    countElements: "elements",
    countEmpty: "elements",
    replaceElement: "grid",
    createElement: "grid",
    emptyCells: "grid",
    removeElement: "grid",
    transformElement: "grid",
    
    
    
    
    
    getVelocity: "elements",
    
    
    
    
    
    
    readDataField: "elements",
    writeDataField: "elements",
    findFreeCell: "elements",
    setVelocity: "elements",
    addVelocity: "elements",
    setDuration: "elements",
    teleportElement: "elements",
    toParticle: "elements",
    
    toast: "ui",
    particles: "effects",

    
    
    
    
    
    
    
    
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


export const ACTION_EFFECTS: Record<string, ActionEffect> = {
    
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
    
    
    
    
    
    
    
    readDataField: "reads",
    
    
    
    
    writeDataField: "commits",
    findFreeCell: "reads",

    
    
    
    
    
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

    
    energyGenerateWhileHeld: "api",
    energyConsumePerRun: "api",
    signalOutput: "api",
    techAppendUnlock: "api",
    techSetUpgradeLevel: "api",
    techGrantItem: "api",
    
    
    
    itemExcavate: "api",
    itemShoot: "api",
    
    
    toast: "api",
    particles: "api",
    
    
    
    
    
    logicAny: "api",
    logicAll: "api",
    logicCount: "api",
    logicSum: "api",
    
    logicForEach: "api",

    
    energyDefault: "returns",
    energyBank: "returns",
    energyWire: "returns",
    energyConductor: "returns",
    energyNetwork: "returns",
    itemDefault: "returns",

    
    
    
    
    
    
    
    
    bufferRead: "returns",
    bufferWrite: "writes",
    bufferIncrement: "writes",

    
    structureWriteData: "writes",
    processorCount: "writes",
    upgradeCountLevel: "writes",
    upgradeScale: "writes",
    
    
    
    compare: "returns",
    
    randomInt: "returns",
    
    
    
    math: "returns",
    upgradeAdd: "writes",

    
    structureInspect: "reads",
    structureReadData: "reads",
    triggerScan: "reads",
    identity: "reads",

    
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


export function effectOf(key: string): ActionEffect | undefined {
    return ACTION_EFFECTS[key];
}


export function isVacuousReturn(key: string, callSiteUsesReturn: boolean): boolean {
    return ACTION_EFFECTS[key] === "returns" && !callSiteUsesReturn;
}




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

export const ACTION_DOMAINS: Record<string, ActionDomain> = {
    
    energyDefault: "energy",
    energyBank: "energy",
    energyWire: "energy",
    energyConductor: "energy",
    energyNetwork: "energy",
    energyGenerateWhileHeld: "energy",
    energyConsumePerRun: "energy",

    
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
    
    
    
    
    logicAny: "grid",
    logicAll: "grid",
    logicCount: "grid",
    logicSum: "grid",
    logicForEach: "grid",

    
    itemDefault: "items",
    itemExcavate: "items",
    itemShoot: "items",

    
    techAppendUnlock: "tech",
    techSetUpgradeLevel: "tech",
    techGrantItem: "tech",
    upgradeCountLevel: "tech",
    upgradeScale: "tech",
    upgradeAdd: "tech",

    
    
    
    
    
    

    

    
    
    
    
    
    
    
    bufferRead: "structure",
    bufferWrite: "structure",
    bufferIncrement: "structure",

    
    structureInspect: "structure",
    structureReadData: "structure",
    structureWriteData: "structure",
    processorCount: "structure",

    
    
    
    
    
    
    
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

    
    noop: "diagnostics",
    
    
    
    
    
    
    
    
    compare: "diagnostics",
    
    
    
    
    
    math: "diagnostics",
    
    
    
    
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
    
    
    
    toast: "feedback",
    particles: "feedback",
    
    
    
    signalOutput: "signals",
};

export function domainOf(key: string): ActionDomain | undefined {
    return ACTION_DOMAINS[key];
}


export function offRuleActions(): { key: string; cls: HandlerActionClass }[] {
    return Object.entries(ACTION_CLASSES)
        .filter(([, c]) => c !== "api")
        .map(([key, cls]) => ({ key, cls }));
}
