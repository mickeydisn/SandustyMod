
export type { CompiledProjectileOption } from "./compile.ts";
export { compileProjectile, PROJECTILE_OPTION_STORE_KEY, projectileOptionOf } from "./compile.ts";
export {
    PROJECTILE_OPTION_DOCS,
    PROJECTILE_OPTIONS,
    projectileOptionKeys,
    projectileOptionParams,
    resolveProjectileOption,
} from "./registry.ts";



export type {
    ProjectileGetOptions,
    ProjectileOptionFailure,
    ProjectileOptionFn,
    ProjectileOptionRef,
} from "./types.ts";
