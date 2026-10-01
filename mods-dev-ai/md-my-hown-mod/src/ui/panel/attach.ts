
import type { Tab } from "../definition/types.ts";


export const ATTACHED: Partial<Record<Tab, readonly Tab[]>> = {
    elements: ["interactions"],
    
    
    
    
    
    
    
    
    structures: ["placementConfigs", "behaviors", "signals"],
    items: ["excavation", "projectiles", "excavationOption", "projectileOption"],
    techs: ["unlockNodes"],
    upgrades: ["categories", "upgradeAction"],
};


export const INLINE_CATALOGUES: readonly Tab[] = ["excavationOption", "projectileOption"];


export function isInlineCatalogue(tab: Tab): boolean {
    return INLINE_CATALOGUES.includes(tab);
}


const PARENT: Partial<Record<Tab, Tab>> = {};
for (const [parent, children] of Object.entries(ATTACHED)) {
    for (const child of children) PARENT[child as Tab] = parent as Tab;
}


export function parentOf(tab: Tab): Tab | undefined {
    return PARENT[tab];
}


export function attachedTo(tab: Tab): readonly Tab[] {
    return ATTACHED[tab] ?? [];
}
