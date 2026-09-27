/**
 * The projectile-option registry: seven presets, each a function of its parameters.
 *
 * These seven used to live in `ANY_HANDLERS` alongside the effect actions, where
 * they were typed `(payload, ctx, options) => unknown` and called with none of the
 * three arguments. Moving them here is what lets the compiler stop treating a
 * projectile as a process.
 *
 * Each one takes **params** — the numbers an author actually wants to change — and
 * layers them over the preset's defaults. That is new capability, not a
 * rearrangement: as bare keys they were fixed constants, so the only way to get a
 * faster shot was to add an eighth preset. `params` is the parameterisation the
 * other six slots have always had, and the reason this is a factory rather than a
 * constant.
 *
 * Every preset returns a **fresh object** on each call. The engine may hold the
 * result and mutate it, and a shared literal would then change under the next
 * projectile that spawns.
 */
import type { ProjectileOptionFn } from "./types.ts";

/**
 * Overlay author params on a preset's defaults.
 *
 * Only numbers and booleans are accepted, and only for keys the preset declares.
 * Two reasons, both about not letting a typo become a silently-wrong projectile:
 * a string where a speed belongs would otherwise be handed to the engine as-is,
 * and an unknown key is more often a typo (`spped`) than an engine field this
 * mod has not heard of. `rotatesWithVelocity` is the deliberate exception to the
 * second rule — see `defaultProjectileOptions`.
 */
function withParams(
    base: Record<string, number | boolean>,
    params: unknown,
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...base };
    if (!params || typeof params !== "object") return out;
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (typeof v !== "number" && typeof v !== "boolean") continue;
        if (k === "rotatesWithVelocity") {
            // Spelled three ways in the wild (`rotatesWithVelocity` /
            // `rotateWithVelocity` / `rotationFollowsVelocity`), so both are
            // accepted and folded onto the one the preset declares. Guessing a
            // third spelling is not worth it — the author gets the two that occur.
            out.rotateWithVelocity = v;
            continue;
        }
        if (!(k in base)) continue;
        out[k] = v;
    }
    return out;
}

export const PROJECTILE_OPTIONS: Record<string, ProjectileOptionFn> = {
    /** Balanced default: steady travel that turns with the shot. */
    defaultProjectileOptions: (params) =>
        withParams({ speed: 10, rotateWithVelocity: true }, params),

    /** Slow, heavy shot. */
    projectileHeavy: (params) =>
        withParams({ speed: 6, radius: 14, lifetime: 90, damage: 40 }, params),

    /** Fast, light shot. */
    projectileFast: (params) =>
        withParams({ speed: 24, radius: 6, lifetime: 45, damage: 12 }, params),

    /** Homing shot — follows the nearest target. */
    projectileHoming: (params) =>
        withParams({ speed: 12, radius: 8, lifetime: 120, homing: true }, params),

    /** Short-range burst. */
    projectileShotgun: (params) =>
        withParams({ speed: 18, radius: 4, lifetime: 20, spread: 0.35 }, params),

    /** Projectile tuned for excavation (a digging shot) rather than damage. */
    projectileExcavate: (params) =>
        withParams({ speed: 14, radius: 10, lifetime: 60, damage: 15, dig: true }, params),

    /** Projectile that behaves like a thrown block of terrain. */
    projectileTerrain: (params) =>
        withParams({ speed: 8, radius: 16, lifetime: 30, carryTerrain: true }, params),
};

/**
 * The parameters each preset accepts, for the panel.
 *
 * **Derived by calling each option**, not written out by hand. A hand-written table
 * beside the registry is the same drift this whole refactor exists to remove: add
 * a field to `projectileHeavy` above and forget this row, and the author is shown a
 * parameter that is silently discarded (`withParams` drops unknown keys). One
 * source, so they cannot disagree.
 *
 * Called once at module load. Every preset is a pure literal-plus-overlay, so this
 * is the same value a call with no params produces.
 */
export function projectileOptionParams(key: string): { key: string; def: number | boolean }[] {
    const fn = PROJECTILE_OPTIONS[key];
    if (!fn) return [];
    const built = fn(undefined);
    return Object.entries(built)
        .filter(([, v]) => typeof v === "number" || typeof v === "boolean")
        .map(([k, v]) => ({ key: k, def: v as number | boolean }));
}

/** Look up one option, or `undefined` for a key that is not one. */
export function resolveProjectileOption(key: string): ProjectileOptionFn | undefined {
    return PROJECTILE_OPTIONS[key];
}

/** Every option key, sorted — the order a dropdown should offer them in. */
export function projectileOptionKeys(): string[] {
    return Object.keys(PROJECTILE_OPTIONS).sort();
}

/** Human descriptions, for the Handlers tab's option panel. */
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
