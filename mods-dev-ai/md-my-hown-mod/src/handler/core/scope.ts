


export type ScopeNeed = "pos" | "data" | "read" | "commit";


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

export const SCOPE_NEED_BLURBS: Record<ScopeNeed, string> = {
    pos: "needs to know *where* it is — the payload's x/y, or the cursor cell.",
    data: "reads payload.data — needs the per-instance bag.",
    read: "reads a cell via api.elements / api.grid, which are ambient.",
    commit: "writes through ctx.commit — only process(structure, context) hands one over.",
};


export const CALL_SITE_SCOPE: Record<string, ProcessScope> = {
    
    processing: { pos: true, data: true, read: true, commit: true, ret: false },
    
    signal: { pos: true, data: true, read: true, commit: false, ret: false },
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    itemAction: { pos: true, data: true, read: true, commit: false, ret: false },
    
    
    upgrade: { pos: false, data: true, read: true, commit: false, ret: false },
    
    
    
    modifier: { pos: true, data: true, read: true, commit: false, ret: true },
    
    trigger: { pos: false, data: false, read: true, commit: false, ret: false },
    
    behavior: { pos: false, data: false, read: true, commit: false, ret: false },
};


export function scopeSatisfies(provides: ProcessScope, needs: readonly ScopeNeed[]): boolean {
    return needs.every((n) => provides[n]);
}


export function describeNeeds(needs: readonly ScopeNeed[]): string {
    return needs.length === 0 ? "nothing" : needs.map((n) => SCOPE_NEED_LABELS[n]).join(" + ");
}




export const ACTION_SCOPE: Record<string, readonly ScopeNeed[]> = {
    
    triggerScan: ["pos"],
    
    
    
    
    signalOutput: ["pos"],
    structureInspect: ["pos", "data"],
    itemExcavate: ["pos"],
    itemShoot: ["pos"],
    particles: ["pos"],
    
    
    
    
    energyGenerateWhileHeld: ["pos"],
    
    
    
    
    
    
    energyConsumePerRun: [],
    
    
    
    
    techAppendUnlock: [],
    
    
    logBuildingPayload: [],

    
    
    
    
    
    
    
    bufferRead: [],
    bufferWrite: [],
    bufferIncrement: [],

    
    structureReadData: ["data"],
    structureWriteData: ["data"],
    processorCount: ["data"],
    upgradeCountLevel: ["data"],
    upgradeScale: ["data"],
    upgradeAdd: ["data"],
    
    
    
    
    triggerTick: ["data"],

    
    
    
    
    
    
    
    
    
    isElementAtCell: ["pos", "read"],
    readElement: ["pos", "read"],
    
    
    
    
    
    
    readDataField: ["pos"],
    writeDataField: ["pos"],
    countElements: ["pos", "read"],
    countEmpty: ["pos", "read"],

    
    
    
    
    
    
    
    
    
    
    
    
    
    processorLift: ["pos", "commit"],
    processorConvert: ["pos", "commit"],
    replaceElement: ["pos", "commit"],
    createElement: ["pos", "commit"],
    
    
    
    emptyCells: ["pos", "commit"],
    
    
    
    
    
    
    
    
    removeElement: ["pos", "read"],
    transformElement: ["pos", "commit"],
    getVelocity: ["pos"],
    findFreeCell: ["pos"],
    setVelocity: ["pos"],
    addVelocity: ["pos"],
    setDuration: ["pos"],
    teleportElement: ["pos"],
    toParticle: ["pos"],

    
    
    
    
    
    
    
    
    
    
    
    
    
    
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
    
    
    
    
    isMyType: [],
    pushStructure: [],
    
    
    mapSpritesheetValue: [],

    
    
    
    
    
    
    
    
    
    
    
    
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

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    logicAny: ["pos", "read"],
    logicAll: ["pos", "read"],
    logicCount: ["pos", "read"],
    logicSum: ["pos", "read"],
    logicForEach: ["pos", "commit"],

    
    noop: [],
    
    
    compare: [],
    
    
    
    
    
    math: [],
    
    
    
    
    
    randomInt: [],
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
    
    
    
    
    
    
};


export function needsOf(key: string): readonly ScopeNeed[] {
    return ACTION_SCOPE[key] ?? [];
}


export function canRunAt(key: string, callSite: string): boolean {
    const provides = CALL_SITE_SCOPE[callSite];
    if (!provides) return false;
    return scopeSatisfies(provides, needsOf(key));
}


export function slotsFor(key: string): string[] {
    return Object.keys(CALL_SITE_SCOPE).filter((site) => canRunAt(key, site));
}
