/**
 * An **ExcavationOption**: the second kind of callable that *builds a value*.
 *
 * ## Why this is not an action
 *
 * The five `excavation*` presets used to live in `actions/act/`, which was wrong in
 * a way the tests actually recorded. They were on `VACUOUS_RETURNS` — actions that
 * return a value into a slot the engine discards — and nothing read their return
 * anywhere. `itemAction` throws a process's result away, so `excavationCrusher` in a
 * tool's action list produced a perfect `{ power: 24, fromRocketExplosion: true }`
 * object and then handed it to nobody. Five actions that provably could not do
 * anything.
 *
 * A projectile option had already solved the same problem one directory away, and
 * this is that same answer: a profile's `getProfile`-equivalent is *one function of
 * its parameters*, its return is the configuration, and modelling it as an action
 * list is what made the value disappear.
 *
 * The invariant is identical to `../projectile-option/types.ts`:
 *
 *     an option is a function of its parameters and nothing else
 *
 * No payload, no position, no cell — a profile exists before anything is dug.
 *
 * ## What the return may contain, and why it is not the whole profile
 *
 * ```ts
 * type ExcavationOptionFn = (params: unknown) => ExcavationOptionValue;
 *
 * interface ExcavationOptionValue {
 *     power?: number;                        // the engine clamps this to 0–1000
 *     options?: Record<string, unknown>;     // the seven ExcavateOptions flags
 * }
 * ```
 *
 * **Not** `ExcavationProfileDefinitionV1`, even though that is what `registerProfile`
 * takes. Two of that type's four fields are the author's own content and a preset
 * has no business inventing them:
 *
 *   - `pattern` is the 0/1 matrix of cells a dig removes. A preset has no opinion
 *     about whether a drill is 1×1 or 3×3.
 *   - `terrainRules` is a per-terrain table of what each material drops. A "drill"
 *     says nothing about what sandstone becomes.
 *
 * So a preset supplies the *numbers and flags* — power, and the seven
 * `ExcavateOptions` booleans — and `pattern` / `terrainRules` stay in the form where
 * the author can see and edit them. `compile.ts` is where the two halves meet.
 *
 * Every option returns a **fresh object**. The engine may hold the payload and
 * mutate it, and a shared literal would then change under the next profile.
 *
 * @module
 */

/** The `ExcavateOptions` flags a preset may set. Mirrors `grid.ExcavateOptions`. */
export const EXCAVATION_FLAGS = [
    "fromGun",
    "fromRocketExplosion",
    "fromDrill",
    "useLiteralOutVelocity",
    "destroyNonDestructible",
    "forceRemoveAll",
    "drillTierDamage",
] as const;

export type ExcavationFlag = (typeof EXCAVATION_FLAGS)[number];

/**
 * The canonical excavation-option signature. Deliberately narrower than an action:
 * one argument, one returned object, no engine contact.
 */
export type ExcavationOptionFn = (params: unknown) => ExcavationOptionValue;

/** What a preset contributes to a profile. See the note at the top of this file. */
export interface ExcavationOptionValue {
    /** Dig strength. The engine clamps to 0–1000. */
    power?: number;
    /** The `ExcavateOptions` flags. Only known keys are accepted. */
    options?: Record<string, unknown>;
}

/**
 * What a profile stores, and what the panel edits.
 *
 * The same single `{ key, params }` shape as `ProjectileOptionRef` — one option,
 * no ordering, nothing to merge.
 */
export interface ExcavationOptionRef {
    key: string;
    params?: Record<string, unknown>;
}

/** The `power` + `options` half of a `registerProfile` payload. */
export interface ExcavationOptionPatch {
    power?: number;
    options?: Record<string, unknown>;
}

/** What went wrong while an option was built. Surfaced, not swallowed. */
export interface ExcavationOptionFailure {
    key: string;
    error: unknown;
}
