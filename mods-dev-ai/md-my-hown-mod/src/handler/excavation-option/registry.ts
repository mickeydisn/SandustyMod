/**
 * The excavation-option registry: five presets, each a function of its parameters.
 *
 * The same shape as `../projectile-option/registry.ts`, for the same reason, and the
 * same `withParams` rule — the details are worth repeating because they are the
 * difference between a preset and a constant:
 *
 *   - Each preset takes the numbers an author actually wants to change and layers
 *     them over its defaults. As a bare key `excavationDrill` was fixed at power 8
 *     with tier damage 25, so the only way to get a drill at power 12 was to add a
 *     sixth preset.
 *   - Only **known** keys are accepted, and only numbers and booleans. A string where
 *     a number belongs would otherwise reach the engine as-is, and an unknown key is
 *     far more often a typo (`fromGunn`) than a flag this mod has not heard of.
 *
 * The parameter routing is one rule, not a special case per preset:
 *
 *     `power` goes to the top level; every other parameter is an `ExcavateOptions`
 *     flag and goes inside `options`.
 */
import { EXCAVATION_FLAGS, type ExcavationOptionFn, type ExcavationOptionValue } from "./types.ts";

/** The flags a preset may set, as a lookup set. */
const FLAG_SET: ReadonlySet<string> = new Set(EXCAVATION_FLAGS);

/**
 * Overlay author params on a preset's defaults.
 *
 * `power` lands at the top level; the seven flags land in `options`. Anything that
 * is not a declared flag, or is not a number or boolean, is **dropped** — a preset
 * that quietly accepted `pwoer: 40` would look configured and dig at the default.
 */
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
    // Only attached when there is something to attach. `options: {}` is not a
    // neutral value to the engine — it is a key the author did not ask for, and a
    // profile with no flags should have no `options` at all.
    if (Object.keys(flags).length > 0) out.options = flags;
    return out;
}

export const EXCAVATION_OPTIONS: Record<string, ExcavationOptionFn> = {
    /** Balanced: a plain dig, no special flag set. */
    excavationDefault: (params) => withParams({ power: 10 }, params),

    /** Blast-shaped: wide, and counts as rocket damage against resistance. */
    excavationCrusher: (params) =>
        withParams(
            { power: 24, flags: { fromRocketExplosion: true, forceRemoveAll: false } },
            params,
        ),

    /**
     * A drill. `drillTierDamage` is a **number** (0–1000), not a boolean like its
     * six siblings — a real trap in the engine's option shape, and the reason this
     * preset is written out rather than generated.
     */
    excavationDrill: (params) =>
        withParams({ power: 8, flags: { fromDrill: true, drillTierDamage: 25 } }, params),

    /**
     * A gun-sourced dig: single cell, and it will **not** destroy terrain marked
     * non-destructible. The only preset that says "never" about something.
     */
    excavationGun: (params) =>
        withParams({ power: 4, flags: { fromGun: true, destroyNonDestructible: false } }, params),

    /** Keeps the incoming cell's own velocity, so debris flies outward. */
    excavationShatter: (params) =>
        withParams({ power: 16, flags: { useLiteralOutVelocity: true } }, params),
};

/**
 * The parameters each preset accepts, for the panel — **derived by calling it**.
 *
 * The same reasoning as `projectileOptionParams`: a hand-written table beside the
 * registry is the drift this whole refactor exists to remove. Add a flag to
 * `excavationDrill` above, forget this function, and the author is shown a
 * parameter that `withParams` then silently discards.
 */
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

/** Look up one option, or `undefined` for a key that is not one. */
export function resolveExcavationOption(key: string): ExcavationOptionFn | undefined {
    return EXCAVATION_OPTIONS[key];
}

/** Every option key, sorted — the order a dropdown should offer them in. */
export function excavationOptionKeys(): string[] {
    return Object.keys(EXCAVATION_OPTIONS).sort();
}

/** Human descriptions, for the Handlers tab's option panel. */
export const EXCAVATION_OPTION_DOCS: Record<string, string> = {
    excavationDefault: "A plain dig: power 10, no flags. The baseline to edit from.",
    excavationCrusher: "Blast-shaped: power 24, counts as rocket damage. Digs through resistance.",
    excavationDrill:
        "A drill: power 8 plus 25 tier damage. Tier damage is a number (0–1000), not a switch.",
    excavationGun:
        "Gun-sourced: power 4, single cell, and it will not destroy non-destructible terrain.",
    excavationShatter: "Power 16 and keeps the cell's own velocity, so debris flies outward.",
};
