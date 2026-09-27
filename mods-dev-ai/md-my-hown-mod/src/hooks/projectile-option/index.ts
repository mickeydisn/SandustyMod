/**
 * The projectile-option feature: the one handler that builds a value.
 *
 * Split out of the action system because it is a different kind of thing. Every
 * other callable here *does* something when the engine calls it; `getOptions()`
 * is called with no arguments and its **return** is the projectile's configuration.
 * Modelling that as a process is what allowed a list of presets to be merged into
 * an options object nobody designed.
 *
 * The three modules, in dependency order:
 *
 *   - `./types` — `ProjectileOptionFn` and the shapes that travel with it.
 *   - `./registry` — the seven presets, and the parameters each one accepts.
 *   - `./compile` — the one-option rule, and migration from the old stored shapes.
 *
 * @module
 */
export type { CompiledProjectileOption } from "./compile.ts";
export {
    compileProjectile,
    PROJECTILE_OPTION_LEGACY_KEYS,
    PROJECTILE_OPTION_STORE_KEY,
    projectileOptionOf,
} from "./compile.ts";
export {
    PROJECTILE_OPTION_DOCS,
    PROJECTILE_OPTIONS,
    projectileOptionKeys,
    projectileOptionParams,
    resolveProjectileOption,
} from "./registry.ts";
// The shapes travel with the option, so they are re-exported from one place. They
// are **not** re-exported from `compile.ts` — that module imports them, and a
// re-export there would be a second, competing path to the same type.
export type {
    ProjectileGetOptions,
    ProjectileOptionFailure,
    ProjectileOptionFn,
    ProjectileOptionRef,
} from "./types.ts";
