/**
 * placement-limit.ts — one `building:place` interceptor for every capped structure.
 *
 * ## Why this exists, and why it is not `registerPlacementConfig`
 *
 * The goal is "only one of this may be placed". There is no engine knob for
 * that, and the two that look like knobs both mislead:
 *
 *  - `structures.registerPlacementConfig({ structureId, fields })` builds the
 *    placement **hotbar fields**. It has no `maxCount`; passing one makes the
 *    engine throw (`if (!t.structureId || !t.fields.length) throw`, bundel 88861).
 *  - the engine's own `maxCount` is real but unreachable — bundel 5251 wraps the
 *    whole thing in `if (u.structureType === a.ev.GloomEmitter)`, and the
 *    `building:placement-limit` hook that would write it is consulted for that
 *    one vanilla structure only. (The hook id is kebab-case,
 *    `"building:placement-limit"`, normalised to a camelCase alias in module
 *    22395; a mod registering the camelCase name is reaching for a path that
 *    only ever runs for GloomEmitter.)
 *
 * What is left is `hooks.intercept("building:place", …)`: it runs before the
 * structure is created and `context.cancel()` aborts the placement
 * (`runInterceptorsSafe(...) → return null`, bundel 5251:585).
 *
 * ## Why one hook, not one per structure
 *
 * The engine supports per-structure dispatch — `building:place` declares
 * `option: "structureTypes", argField: "structureId"` (bundel 35564:68) and
 * buckets interceptors into a `byGuard` map. That is tempting, and wrong here:
 *
 *  1. **The guard matches on the raw `args.structureId`, which is the structure
 *     *type*** — and a `StructureRef` is "a number or a string" (the mod's own
 *     `catalog.ts` says so of `getAvailableTypes`). A `structureTypes: ["mod:id"]`
 *     guard therefore matches only if the engine happens to hand the id through
 *     unresolved. Per-structure registration would make the cap work or silently
 *     not work depending on whether that build resolved the id — the worst of
 *     both.
 *  2. Each registration is another thing to keep in step when a structure is
 *     renamed or a cap added.
 *
 * So this is a single **wildcard** interceptor that resolves the ref itself and
 * looks it up, with both the id string and the resolved type in the table.
 *
 * ## Live counts, never stored
 *
 * `forEachOfType` is read at intercept time. A running total in a buffer would
 * be wrong after a world load, a save restore, or a Demolisher removal — all of
 * which the mod this is modelled on had to paper over with a resync sweep on
 * `game:ready` plus two timers. The intercept cannot be stale, and it is free:
 * it only runs on a placement attempt.
 */
import { api } from "../../packages/mysandkit.ts";
import { LOG, type ModConfig, type StructureConfig } from "../../constants.ts";

/** One capped structure, resolved to everything the hook might be handed. */
export interface Limit {
    /** The mod's id, for the message. */
    id: string;
    /** What to call it in the toast — the author's name, not the raw id. */
    name: string;
    /** How many may exist. */
    max: number;
    /** The ref `forEachOfType` is given. */
    ref: number | string;
}

/**
 * Every key a limit answers to.
 *
 * Both forms, because the hook hands us whichever the engine resolved to and
 * nothing tells us which: the id string is what the config says, the resolved
 * type is what the engine passes if it resolved the id.
 */
function keysFor(limit: Limit): string[] {
    return limit.ref === limit.id ? [limit.id] : [limit.id, String(limit.ref)];
}

/** A cap worth enforcing: a whole positive number. */
function capOf(st: StructureConfig): number | null {
    const n = st?.maxPlaced;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return null;
    return Math.floor(n);
}

/** The table, so a cap can be asserted without standing up a host. */
export function buildLimitTable(config: ModConfig): Map<string, Limit> {
    const out = new Map<string, Limit>();
    for (const st of config.structures ?? []) {
        const id = typeof st?.id === "string" ? st.id.trim() : "";
        const max = capOf(st);
        if (!id || max === null) continue;
        const limit: Limit = {
            id,
            name: (typeof st.name === "string" && st.name.trim()) || id,
            max,
            ref: api.structures.getTypeById(id),
        };
        for (const k of keysFor(limit)) out.set(k, limit);
    }
    return out;
}

/**
 * The unsubscribe from the installed interceptor, if any.
 *
 * `hooks.intercept` returns an unsubscribe function (bundel 35564 exposes it as
 * the hook's return value; `apply.ts` relies on the same for every modifier), so
 * a re-apply can genuinely *replace* the rule rather than stack a second one. It
 * was worth being sure: an interceptor that cannot be removed would keep
 * cancelling against a table the config no longer describes, and the symptom —
 * a cap that still applies after the author deleted it — is miserable to debug.
 */
let unsubscribe: (() => void) | null = null;

/**
 * Install the cap, replacing any previous one.
 *
 * @returns how many refs are capped, or 0 when nothing is capped and therefore
 *          no hook was installed at all.
 */
export function installPlacementLimits(config: ModConfig): number {
    // Detach first, so a cap that was removed from the config stops applying
    // rather than lingering. Safe when nothing was ever installed.
    if (unsubscribe) {
        try {
            unsubscribe();
        } catch (e) {
            console.warn(`${LOG} could not detach the previous placement limit`, e);
        }
        unsubscribe = null;
    }

    const table = buildLimitTable(config);
    if (table.size === 0) {
        // Nothing to cap. Deliberately installs nothing: an interceptor that
        // always returns without cancelling is cost on every placement in the
        // game, for every structure, for no benefit.
        return 0;
    }

    const hooks = api.hooks;
    if (typeof hooks?.intercept !== "function") {
        console.warn(`${LOG} hooks.intercept missing — placement caps NOT enforced`);
        return 0;
    }
    try {
        const ret = hooks.intercept(
            "building:place",
            (args: { structureId?: number | string }, context: { cancel?: () => void }) => {
                const limit = table.get(String(args?.structureId ?? ""));
                if (!limit) return;
                // `null` means the count could not be read. Cancelling on a
                // failed read would block every placement on a build whose
                // `forEachOfType` is missing; allowing it silently drops the cap.
                // A warning is the honest third option and the one chosen here:
                // a gameplay rule that fails *open* with a console line is
                // recoverable, and one that fails closed is not.
                const n = api.structures.countOfType(limit.ref);
                if (n === null) {
                    console.warn(
                        `${LOG} cannot count ${limit.id} — cap of ${limit.max} NOT enforced`,
                    );
                    return;
                }
                if (n >= limit.max) {
                    context.cancel?.();
                    api.ui.toast(`Only ${limit.max} × ${limit.name} allowed (${n} placed)`);
                    console.log(`${LOG} place cancelled — ${limit.id} ${n}/${limit.max}`);
                }
            },
            // No `structureTypes` option on purpose — see the header on why the
            // per-structure guard was rejected.
        );
        unsubscribe = typeof ret === "function" ? (ret as () => void) : null;
    } catch (e) {
        console.error(`${LOG} placement limit hook failed`, e);
        return 0;
    }
    console.log(`${LOG} placement limits active for ${table.size} ref(s)`);
    return table.size;
}
