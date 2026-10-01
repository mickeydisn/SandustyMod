
import type { ProjectileOptionFn } from "./types.ts";


function withParams(
    base: Record<string, number | boolean>,
    params: unknown,
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...base };
    if (!params || typeof params !== "object") return out;
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (typeof v !== "number" && typeof v !== "boolean") continue;
        if (k === "rotatesWithVelocity") {
            
            
            
            
            out.rotateWithVelocity = v;
            continue;
        }
        if (!(k in base)) continue;
        out[k] = v;
    }
    return out;
}

export const PROJECTILE_OPTIONS: Record<string, ProjectileOptionFn> = {
    
    defaultProjectileOptions: (params) =>
        withParams({ speed: 10, rotateWithVelocity: true }, params),

    
    projectileHeavy: (params) =>
        withParams({ speed: 6, radius: 14, lifetime: 90, damage: 40 }, params),

    
    projectileFast: (params) =>
        withParams({ speed: 24, radius: 6, lifetime: 45, damage: 12 }, params),

    
    projectileHoming: (params) =>
        withParams({ speed: 12, radius: 8, lifetime: 120, homing: true }, params),

    
    projectileShotgun: (params) =>
        withParams({ speed: 18, radius: 4, lifetime: 20, spread: 0.35 }, params),

    
    projectileExcavate: (params) =>
        withParams({ speed: 14, radius: 10, lifetime: 60, damage: 15, dig: true }, params),

    
    projectileTerrain: (params) =>
        withParams({ speed: 8, radius: 16, lifetime: 30, carryTerrain: true }, params),
};


export function projectileOptionParams(key: string): { key: string; def: number | boolean }[] {
    const fn = PROJECTILE_OPTIONS[key];
    if (!fn) return [];
    const built = fn(undefined);
    return Object.entries(built)
        .filter(([, v]) => typeof v === "number" || typeof v === "boolean")
        .map(([k, v]) => ({ key: k, def: v as number | boolean }));
}


export function resolveProjectileOption(key: string): ProjectileOptionFn | undefined {
    return PROJECTILE_OPTIONS[key];
}


export function projectileOptionKeys(): string[] {
    return Object.keys(PROJECTILE_OPTIONS).sort();
}


export const PROJECTILE_OPTION_DOCS: Record<string, string> = {
    defaultProjectileOptions:
        "The balanced default — speed 10, turning with the shot. A good starting point.",
    projectileHeavy: "Slow and heavy: speed 6, radius 14, lifetime 90, damage 40.",
    projectileFast: "Fast and light: speed 24, radius 6, lifetime 45, damage 12.",
    projectileHoming: "Tracks the nearest target. Needs a target to matter.",
    projectileShotgun: "Short burst: speed 18 with a 0.35 spread.",
    projectileExcavate: "Tuned for digging rather than damage — damage 15 plus the dig flag.",
    projectileTerrain: "Slow, heavy, and flagged to carry terrain.",
};
