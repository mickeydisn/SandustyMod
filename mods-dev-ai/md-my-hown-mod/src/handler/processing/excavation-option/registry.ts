
import { EXCAVATION_FLAGS, type ExcavationOptionFn, type ExcavationOptionValue } from "./types.ts";

const FLAG_SET: ReadonlySet<string> = new Set(EXCAVATION_FLAGS);

function withParams(
    base: { power: number; flags?: Record<string, number | boolean> },
    params: unknown,
): ExcavationOptionValue {
    const out: ExcavationOptionValue = { power: base.power };
    const flags: Record<string, number | boolean> = { ...base.flags };
    if (params && typeof params === "object") {
        for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
            if (typeof v !== "number" && typeof v !== "boolean") continue;
            if (k === "power") {
                if (Number.isFinite(v)) out.power = v as number;
                continue;
            }
            if (!FLAG_SET.has(k)) continue;
            flags[k] = v;
        }
    }
    
    
    
    if (Object.keys(flags).length > 0) out.options = flags;
    return out;
}

export const EXCAVATION_OPTIONS: Record<string, ExcavationOptionFn> = {
    
    excavationDefault: (params) => withParams({ power: 10 }, params),

    
    excavationCrusher: (params) =>
        withParams(
            { power: 24, flags: { fromRocketExplosion: true, forceRemoveAll: false } },
            params,
        ),

    
    excavationDrill: (params) =>
        withParams({ power: 8, flags: { fromDrill: true, drillTierDamage: 25 } }, params),

    
    excavationGun: (params) =>
        withParams({ power: 4, flags: { fromGun: true, destroyNonDestructible: false } }, params),

    
    excavationShatter: (params) =>
        withParams({ power: 16, flags: { useLiteralOutVelocity: true } }, params),
};

export function excavationOptionParams(
    key: string,
): { key: string; def: number | boolean; section: "power" | "options" }[] {
    const fn = EXCAVATION_OPTIONS[key];
    if (!fn) return [];
    const built = fn(undefined);
    const out: { key: string; def: number | boolean; section: "power" | "options" }[] = [];
    if (typeof built.power === "number") {
        out.push({ key: "power", def: built.power, section: "power" });
    }
    for (const flag of EXCAVATION_FLAGS) {
        const v = built.options?.[flag];
        if (typeof v === "number" || typeof v === "boolean") {
            out.push({ key: flag, def: v, section: "options" });
        }
    }
    return out;
}

export function resolveExcavationOption(key: string): ExcavationOptionFn | undefined {
    return EXCAVATION_OPTIONS[key];
}

export function excavationOptionKeys(): string[] {
    return Object.keys(EXCAVATION_OPTIONS).sort();
}

export const EXCAVATION_OPTION_DOCS: Record<string, string> = {
    excavationDefault: "A plain dig: power 10, no flags. The baseline to edit from.",
    excavationCrusher: "Blast-shaped: power 24, counts as rocket damage. Digs through resistance.",
    excavationDrill:
        "A drill: power 8 plus 25 tier damage. Tier damage is a number (0–1000), not a switch.",
    excavationGun:
        "Gun-sourced: power 4, single cell, and it will not destroy non-destructible terrain.",
    excavationShatter: "Power 16 and keeps the cell's own velocity, so debris flies outward.",
};
