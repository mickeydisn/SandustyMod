/**
 * A **ProjectileOption**: the one handler that *builds a value* instead of doing one.
 *
 * Every other callable here is an effect — the return is thrown away. `getOptions()`
 * inverts that: it is called with no arguments and the returned object **is** the
 * projectile's configuration. That is a different kind of thing, so it gets its own
 * type and its own compiler rather than being modelled as an action.
 *
 * The invariant: **an option is a function of its parameters and nothing else.** No
 * payload, no cell, no position — there is no projectile on the map yet.
 *
 * ```ts
 * type ProjectileOptionFn = (params: unknown) => Record<string, unknown>;
 * ```
 *
 * The return is `Record<string, unknown>` on purpose: this is the one place a
 * returned value is guaranteed to be an object, so a preset returning `undefined`
 * is a type error rather than a projectile mishandled at spawn.
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
