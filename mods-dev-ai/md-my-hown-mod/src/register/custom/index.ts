


export interface CustomEntry {
    id: string;
    name?: string;
    [key: string]: unknown;
}


export const CUSTOM_CATEGORIES = [
    
    "energyNetworks",
    
    
    "unlockNodes",
] as const;

export type CustomCategory = typeof CUSTOM_CATEGORIES[number];


export function customIds(
    category: CustomCategory,
    config: { [K in CustomCategory]?: CustomEntry[] },
): Set<string> {
    const out = new Set<string>();
    for (const e of config[category] ?? []) {
        if (e?.id) out.add(e.id);
    }
    return out;
}
