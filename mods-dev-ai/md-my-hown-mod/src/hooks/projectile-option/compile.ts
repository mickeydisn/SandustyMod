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

/**
 * Build the `getOptions` for one stored projectile entry.
 *
 * `onFailure` receives anything that went wrong, so registration can log it. It is
 * optional because the *return* already carries `problem` — the panel needs to show
 * the reason without a logger, and the two must not disagree, so there is one
 * source and it is read twice rather than computed twice.
 */
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
 * Read a stored projectile entry into an option ref, migrating the old shapes.
 *
 * Three historical spellings, all meaning the same thing, and they are consulted in
 * one place so a caller never has to know which is which:
 *
 *  - `option` — the new object form, `{ key, params }`.
 *  - `getOptionsKey` — the pre-split bare key, with no params.
 *  - `actions` — the short-lived list form, which this refactor removes. Read as a
 *    **single** ref so a config written during that window still loads; a list of
 *    more than one is reported rather than half-applied, because the merge that
 *    combined them is exactly what is being taken away.
 *
 * The empty list is the only ambiguous case — `actions: []` means "no option", not
 * "the option `undefined`" — so it is checked before the list is read.
 */
export const PROJECTILE_OPTION_STORE_KEY = "option";

/** Legacy stored keys that named a projectile option, newest first. */
export const PROJECTILE_OPTION_LEGACY_KEYS = ["getOptionsKey", "actions"] as const;

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

    const legacyKey = entry.getOptionsKey;
    if (typeof legacyKey === "string" && legacyKey) {
        return { ref: { key: legacyKey, params: undefined } };
    }

    const list = entry.actions;
    if (Array.isArray(list) && list.length > 0) {
        const first = list[0] as ProjectileOptionRef;
        const key = typeof first === "string" ? first : first?.key;
        if (typeof key === "string" && key) {
            return {
                ref: { key, params: (first as ProjectileOptionRef)?.params ?? undefined },
                // Say so. The old compiler merged these; the new one does not, and
                // an author whose config has two presets deserves to know one lost.
                ...(list.length > 1
                    ? {
                        problem: `${list.length} options were stored; only "${key}" is used. ` +
                            "A projectile takes one option — remove the rest.",
                    }
                    : {}),
            };
        }
    }

    return {};
}
