/**
 * Make `visibleInPicker: false` actually keep an element out of the vacuum.
 *
 * ## Why a hook and not a field
 *
 * The engine does not read `visibleInPicker` off a definition. It *derives* picker
 * visibility from the matter type when it builds the mask:
 *
 * ```js
 * const b = g !== es.Liquid && g !== es.Gas;   // -> args.visibleInPicker
 * ```
 *
 * so everything that is not a liquid or a gas is offered, and the only thing that
 * can turn that off is a `vacuum:element:prepare` modifier. The field on our config
 * entry is a local convention the engine ignores — it is not on the engine's
 * published `ElementDefinition` at all. This module is what makes the two agree, so
 * the panel's "hidden" filter stops being a claim about the game.
 *
 * ## Caching, and why registration order matters
 *
 * The engine computes the whole mask once and caches it on
 * `(modifierRevision, elementConfigRevision)`. Two consequences:
 *
 *   - The hook must be installed at boot: it is not consulted per frame, so a value
 *     captured after the cache was filled would never be seen.
 *   - Installing *any* modifier bumps the revision. That makes late installation
 *     safe, and is why a mod that hides nothing should install nothing.
 *
 * ## Priority
 *
 * The engine sorts modifier handlers by `priority` ascending, so a higher number
 * runs later and its write survives. This runs above the default of `0` on purpose:
 * config is the source of truth, and an element the author marked hidden should stay
 * hidden even if another mod's default-weight handler would have offered it.
 */
import { configIsHidden, LOG } from "../../constants.ts";

/**
 * The numeric element types the config marks as not offered in the picker.
 *
 * Numeric rather than by id on purpose. The hook is handed `args.elementType`,
 * which is a type, so this is the only key it can be answered with — and the
 * id-to-type mapping exists only as the return value of `elements.register` at
 * boot. Resolving it here is what lets the check be a `Set` lookup on a path the
 * engine runs once per registered element.
 */
const hiddenTypes = new Set<number>();

let installed = false;
let detach: (() => void) | null = null;

/**
 * The host's hook API, or null when this build has none.
 *
 * The wrapper does not re-export `hooks`, and should not: that is the engine's
 * own surface, already typed and already guarded in `handler/core/apply.ts`. Read it
 * the same way here so both call sites degrade identically on an older host.
 */
function getHooksApi(): {
    modify?: (id: string, fn: (args: unknown) => void, opts?: unknown) => unknown;
} | null {
    try {
        return (globalThis as { sandkit?: { api?: { hooks?: unknown } } }).sandkit?.api?.hooks ??
            null;
    } catch {
        return null;
    }
}
/**
 * Record that `type` — the type just assigned to element `entry` — is one the
 * author marked `visibleInPicker: false`.
 *
 * Reads the flag through `configIsHidden`, the same predicate the list screen
 * uses, so a row the panel shows as hidden and a row the engine withholds can
 * never come from two different rules. That disagreement is the bug this whole
 * change exists to remove, so the rule is shared rather than reimplemented.
 *
 * Returns whether the type was recorded, so the caller can log it.
 */
export function noteElementVisibility(
    type: number | undefined,
    entry: Record<string, unknown>,
): boolean {
    if (typeof type !== "number" || !configIsHidden(entry, "elements")) return false;
    hiddenTypes.add(type);
    return true;
}

/**
 * Install the picker hook, once. Returns how many element types it will withhold.
 *
 * A no-op — reporting zero — when there is nothing to hide, because installing a
 * modifier invalidates the engine's mask cache and a mod with nothing to hide
 * should not pay for that.
 */
export function installElementPickerVisibility(): number {
    if (installed) return hiddenTypes.size;
    installed = true;
    if (hiddenTypes.size === 0) return 0;

    const modify = getHooksApi()?.modify;
    if (typeof modify !== "function") {
        // The flag still filters the panel; it just will not change the vacuum.
        // Say so plainly, because the two quietly disagreeing is exactly the
        // confusion this module exists to remove.
        console.warn(
            `${LOG} element picker: hooks.modify unavailable — ` +
                `${hiddenTypes.size} element(s) hidden in the panel but still in the vacuum`,
        );
        return 0;
    }

    const ret = modify(
        "vacuum:element:prepare",
        (args: unknown) => {
            // Narrow rather than assert. The engine hands over a *pooled* args
            // object it reuses across every registered element, so a handler that
            // assumed the shape would be one refactor away from writing onto the
            // wrong object. Reading the two fields we need, and touching nothing
            // else, is also what keeps us from disturbing `collectable` and
            // `isTransportable`, which are computed alongside and matter just as
            // much.
            const a = args as { elementType?: unknown; visibleInPicker?: unknown } | null;
            if (a === null || typeof a !== "object") return;
            if (typeof a.elementType === "number" && hiddenTypes.has(a.elementType)) {
                a.visibleInPicker = false;
            }
        },
        { priority: 1000 },
    );
    if (typeof ret === "function") detach = ret as () => void;

    console.log(
        `${LOG} element picker: withholding ${hiddenTypes.size} element(s) ` +
            `types ${[...hiddenTypes].join(",")}`,
    );
    return hiddenTypes.size;
}

/** The types this module will withhold — for the panel and for tests. */
export function hiddenElementTypes(): number[] {
    return [...hiddenTypes].sort((a, b) => a - b);
}

/** Detach and forget, for tests and teardown. */
export function __resetElementPickerForTests(): void {
    try {
        detach?.();
    } catch {
        // A host that has already torn down its own hooks is not a failure here.
    }
    detach = null;
    installed = false;
    hiddenTypes.clear();
}
