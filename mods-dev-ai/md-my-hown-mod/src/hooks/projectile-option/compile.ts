/**
 * Compiling one projectile's `getOptions`.
 *
 * The counterpart to `../process.ts`'s `compileProcess`, and deliberately *not* a
 * special case of it. That is the whole point of the split: a projectile is not a
 * process with one entry, it is a **single option function**, and the difference
 * is enforced here rather than left to the panel to honour.
 *
 * ## The three rules this enforces
 *
 * 1. **Exactly one option, or none.** Not "the first", not "the last" — one. An old
 *    config may hold a merged list from before this split; the extra entries are
 *    reported as an error so the author is told their second preset is being
 *    ignored, rather than finding out by noticing the wrong speed in-game.
 * 2. **A non-option key is refused.** `processorConvert` is an effect and returns
 *    nothing; handing the engine `undefined` as its projectile config is a spawn
 *    that misbehaves with no log. Refused at compile time instead.
 * 3. **A throwing option cannot take the projectile down with it.** The result is
 *    cached on first call, so a broken option costs one warning per projectile
 *    rather than one per shot.
 *
 * ## Why the result is cached
 *
 * `getOptions()` is called at **spawn**, so it may run many times a second in a
 * fight. Rebuilding a literal each time is cheap, but re-running an author-visible
 * failure is not, and the value cannot change: it is built from config that is
 * fixed at registration. One build, then reuse.
 */
import { resolveProjectileOption } from "./registry.ts";
import type {
    ProjectileGetOptions,
    ProjectileOptionFailure,
    ProjectileOptionRef,
} from "./types.ts";

/** What `compileProjectile` produced, and anything it had to refuse. */
export interface CompiledProjectileOption {
    /** The function handed to the engine. Always callable, even on total failure. */
    getOptions: ProjectileGetOptions;
    /**
     * The option that was compiled, or `undefined` if there was none.
     *
     * Kept for the panel's "built by" line and for tests. It is *not* a fallback
     * lookup — the closure already holds the function.
     */
    key?: string;
    /** Why nothing was compiled. Absent on success. */
    problem?: string;
}

const EMPTY: Record<string, unknown> = {};

/** Build `getOptions` for one projectile entry. `onFailure` is optional; `problem` is the same fact for the panel. */
export function compileProjectile(
    ref: ProjectileOptionRef | undefined,
    onFailure?: (f: ProjectileOptionFailure) => void,
): CompiledProjectileOption {
    // No option at all is legal: a projectile may be all static `options`, and
    // `registerProjectile` synthesises `getOptions` from those when this is absent.
    // Returning an empty object rather than `undefined` keeps the engine's
    // "getOptions is a function" requirement satisfied either way.
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
            // Once. A per-spawn warning would flood the log in a firefight and
            // drown the one line that explains the problem.
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

/**
 * Read a stored projectile entry into an option ref.
 *
 * Only the `option` object, `{ key, params }`. Two older spellings are not read:
 * `getOptionsKey`, the pre-split bare key with no params, and `actions`, the
 * short-lived list form. An entry holding either is treated as having no option,
 * so a projectile falls back to its static options rather than being handed a
 * preset the engine may not resolve. Neither is claimed by `OPTION_COVERED`, so
 * the raw key stays in the entry instead of being deleted by an unrelated save.
 */
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
