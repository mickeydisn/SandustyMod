
import { resolveProjectileOption } from "./registry.ts";
import type {
    ProjectileGetOptions,
    ProjectileOptionFailure,
    ProjectileOptionRef,
} from "./types.ts";

export interface CompiledProjectileOption {
    
    getOptions: ProjectileGetOptions;
    
    key?: string;
    
    problem?: string;
}

const EMPTY: Record<string, unknown> = {};

export function compileProjectile(
    ref: ProjectileOptionRef | undefined,
    onFailure?: (f: ProjectileOptionFailure) => void,
): CompiledProjectileOption {
    
    
    
    
    if (!ref?.key) return { getOptions: () => EMPTY };

    const fn = resolveProjectileOption(ref.key);
    if (!fn) {
        const problem = `not a projectile option: ${ref.key}`;
        onFailure?.({ key: ref.key, error: new Error(problem) });
        return { getOptions: () => EMPTY, key: ref.key, problem };
    }

    let built: Record<string, unknown> | undefined;
    let reported = false;

    const getOptions: ProjectileGetOptions = () => {
        if (built !== undefined) return built;
        try {
            built = fn(ref.params);
        } catch (error) {
            
            
            if (!reported) {
                reported = true;
                onFailure?.({ key: ref.key, error });
            }
            built = EMPTY;
        }
        return built;
    };

    return { getOptions, key: ref.key };
}

export const PROJECTILE_OPTION_STORE_KEY = "option";

export function projectileOptionOf(
    entry: Record<string, unknown> | undefined,
): { ref?: ProjectileOptionRef; problem?: string } {
    if (!entry) return {};

    const stored = entry[PROJECTILE_OPTION_STORE_KEY];
    if (
        stored && typeof stored === "object" &&
        typeof (stored as ProjectileOptionRef).key === "string"
    ) {
        return {
            ref: {
                key: String((stored as ProjectileOptionRef).key),
                params: (stored as ProjectileOptionRef).params ?? undefined,
            },
        };
    }

    return {};
}
