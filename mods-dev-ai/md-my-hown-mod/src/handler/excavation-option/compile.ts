/**
 * Compiling one excavation profile: the option, plus the parts the author owns.
 *
 * The counterpart to `../projectile-option/compile.ts`, and deliberately the same
 * shape rather than a special case. A profile's numbers come from **one** function;
 * its `pattern` and `terrainRules` come from the entry itself. Neither half can
 * override the other, and that is enforced here rather than left to the panel.
 *
 * ## The three rules this enforces
 *
 * 1. **At most one option, and no option is legal.** A profile may be entirely
 *    hand-written — the `power` and `options` fields are still there for that. An
 *    unknown key is reported rather than ignored, because a silently-dropped preset
 *    leaves a profile that digs at power 10 for no visible reason.
 * 2. **The option owns `power` and `options`; the entry owns everything else.**
 *    With an option chosen, the entry's own `power` / `options` are *not* consulted
 *    — that is what the panel hides, and consulting them here would mean the panel
 *    and the register disagreed about which number wins.
 * 3. **A throwing option degrades to "no option"** and says so once, rather than
 *    taking the whole profile registration down with it.
 *
 * ## Why the result is not cached
 *
 * `compileProjectile` caches, because `getOptions` runs at every spawn. This runs
 * **once**, at registration: a profile is registered when the config loads and
 * never again. There is nothing to cache, and a cache would only hide a second
 * failure.
 */
import { resolveExcavationOption } from "./registry.ts";
import type {
    ExcavationOptionFailure,
    ExcavationOptionPatch,
    ExcavationOptionRef,
} from "./types.ts";

/** The stored key holding the chosen option. */
export const EXCAVATION_OPTION_STORE_KEY = "option";

/** What `compileExcavationProfile` produced. */
export interface CompiledExcavationOption {
    /** The `power` + `options` half. Empty when there is no option. */
    patch: ExcavationOptionPatch;
    /** The option that was compiled, or `undefined`. */
    key?: string;
    /** Why nothing was compiled. Absent on success. */
    problem?: string;
}

/**
 * Read a stored profile into an option ref.
 *
 * Only the `option` object, `{ key, params }`. A pre-split profile has no such key
 * at all — the five presets used to be *actions*, so a tool referenced one as an
 * action key — so this returns `{}` and the entry's own `power` / `options` are used
 * as before. Nothing is claimed or deleted: a migration that guesses would rewrite
 * an author's profile into a different profile.
 */
export function excavationOptionOf(
    entry: Record<string, unknown> | undefined,
): { ref?: ExcavationOptionRef; problem?: string } {
    if (!entry) return {};
    const stored = entry[EXCAVATION_OPTION_STORE_KEY];
    if (
        stored && typeof stored === "object" &&
        typeof (stored as ExcavationOptionRef).key === "string"
    ) {
        return {
            ref: {
                key: String((stored as ExcavationOptionRef).key),
                params: (stored as ExcavationOptionRef).params ?? undefined,
            },
        };
    }
    return {};
}

/**
 * The `power` + `options` for one stored profile entry.
 *
 * With no option, the entry's own `power` / `options` are used — a hand-written
 * profile is a first-class thing, not a missing one.
 */
export function compileExcavationProfile(
    entry: Record<string, unknown> | undefined,
    onFailure?: (f: ExcavationOptionFailure) => void,
): CompiledExcavationOption {
    const { ref, problem: foundProblem } = excavationOptionOf(entry);
    if (!ref?.key) return { patch: fromEntry(entry) };

    const fn = resolveExcavationOption(ref.key);
    if (!fn) {
        const problem = foundProblem ?? `not an excavation option: ${ref.key}`;
        onFailure?.({ key: ref.key, error: new Error(problem) });
        // Falls back to the entry's own values rather than to nothing: a broken
        // preset should leave a working profile, not an unregisterable one.
        return { patch: fromEntry(entry), key: ref.key, problem };
    }

    try {
        const built = fn(ref.params);
        const patch: ExcavationOptionPatch = {};
        if (typeof built.power === "number") patch.power = built.power;
        if (built.options && Object.keys(built.options).length > 0) {
            patch.options = { ...built.options };
        }
        return { patch, key: ref.key };
    } catch (error) {
        onFailure?.({ key: ref.key, error });
        return { patch: fromEntry(entry), key: ref.key, problem: String(error) };
    }
}

/** The entry's own `power` / `options`, for a profile with no option chosen. */
function fromEntry(entry: Record<string, unknown> | undefined): ExcavationOptionPatch {
    const patch: ExcavationOptionPatch = {};
    if (entry && typeof entry.power === "number") patch.power = entry.power;
    if (entry?.options && typeof entry.options === "object") {
        patch.options = { ...(entry.options as Record<string, unknown>) };
    }
    return patch;
}
