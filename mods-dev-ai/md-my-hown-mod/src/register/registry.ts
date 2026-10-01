


const WORKER_SCOPED = ["elements", "terrains", "structures", "recipes"] as const;

const WORKER_SCOPED_SET: ReadonlySet<string> = new Set<string>(WORKER_SCOPED);


function needsWorker(cat: string): boolean {
    return WORKER_SCOPED_SET.has(cat);
}

let windowOpen = true;

export function closeBootWindow(): void {
    windowOpen = false;
}

export function isBootWindowOpen(): boolean {
    return windowOpen;
}


export function __resetBootWindowForTests(): void {
    for (const s of Object.values(registered)) s.clear();
    windowOpen = true;
}


export function mayRegister(cat: string, id: string): boolean {
    if (!needsWorker(cat)) return true;
    return isBootWindowOpen();
}


export const registered: Record<string, Set<string>> = {
    sprites: new Set(),
    elements: new Set(),
    structures: new Set(),
    items: new Set(),
    terrains: new Set(),
    recipes: new Set(),
    processing: new Set(),
    contacts: new Set(),
    interactions: new Set(),
    modifiers: new Set(),
    techs: new Set(),
    upgradeCategories: new Set(),
    upgrades: new Set(),
    projectiles: new Set(),
    energyTypes: new Set(),
    excavationProfiles: new Set(),
    structureBehaviors: new Set(),
    placementConfigs: new Set(),
    signals: new Set(),
    triggers: new Set(),
    inputBindings: new Set(),
};
