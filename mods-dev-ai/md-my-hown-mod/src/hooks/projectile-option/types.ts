/**
 * A **ProjectileOption**: the one handler that *builds a value* instead of doing one.
 *
 * ## Why this is not a HandlerAction
 *
 * Every other callable in this mod is an **effect**: the engine calls it, it does
 * something to the world or the console, and whatever it returns is thrown away.
 * `getOptions()` inverts that. It is called *with no arguments at all* and the
 * returned object **is** the projectile's configuration — the engine reads it
 * directly. `CALL_SITE_USES_RETURN` has exactly one `true`, and this is it.
 *
 * That inversion is not a detail, it is a different kind of thing, and modelling it
 * as an action was what made three wrong things possible at once:
 *
 *  - **A list of them.** `compileProcess` merged several returns into one object
 *    via `mergeProcessValue`, so `["defaultProjectileOptions", "projectileHeavy"]`
 *    was a legal, savable, in-game projectile whose options were the two presets'
 *    fields unioned with last-writer-wins. No author wants `{speed: 6, radius: 14,
 *    lifetime: 90, damage: 40, rotateWithVelocity: true}` and no designer wrote it.
 *    A single option function takes its **parameters** instead, which is what
 *    "build the options" was always supposed to mean.
 *  - **A plain `HandlerActionFn`.** The seven presets were typed
 *    `(payload, ctx, options) => unknown` and called with none of the three. They
 *    were `HandlerAction`s by signature and by accident only.
 *  - **A bare key.** A projectile stored `getOptionsKey: "projectileFast"` with
 *    nowhere to say *with what parameters*.
 *
 * So the type is separate, and the compiler is separate. The one invariant worth
 * stating: **an option is a function of its parameters and nothing else.** No
 * payload, no cell, no position — there is no projectile on the map yet when
 * `getOptions()` runs, so there is nothing for one to read.
 *
 * ## The shape
 *
 * ```ts
 * type ProjectileOptionFn = (params: unknown) => Record<string, unknown>;
 * ```
 *
 * The return is `Record<string, unknown>` rather than `unknown` on purpose: this is
 * the one place a returned value is guaranteed to be an object, and typing it so
 * means a preset that returns `undefined` or a number is a type error rather than a
 * projectile the engine silently mishandles at spawn.
 */

/** The canonical projectile-option signature. Deliberately narrower than an action. */
export type ProjectileOptionFn = (params: unknown) => Record<string, unknown>;

/**
 * What a projectile stores, and what a panel edits.
 *
 * A single `{ key, params }` rather than a list. There is no ordering to preserve
 * and nothing to merge, so the array was always the wrong shape — it is kept only
 * for the length check in `compileProjectile`, which reports the *real* problem
 * (an old multi-action config) rather than quietly keeping the last one.
 */
export interface ProjectileOptionRef {
    key: string;
    params?: Record<string, unknown>;
}

/** The built `getOptions` the engine receives. */
export type ProjectileGetOptions = () => Record<string, unknown>;

/** What went wrong while an option was built. Surfaced, not swallowed. */
export interface ProjectileOptionFailure {
    key: string;
    error: unknown;
}
