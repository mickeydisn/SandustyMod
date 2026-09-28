/**
 * REMEMBER — state that survives the save.
 *
 * `structure.data` is the author's **only persistent scratch space**: the engine
 * saves it with the world, and nothing else about an instance survives. An
 * action in this folder is how a machine *remembers*.
 *
 * The pattern that pays off here is the **accumulator** — something that stores,
 * counts, charges, or fills up. `processorCount` is the smallest example: one
 * line, and the structure now has a lifetime.
 *
 * ## Two things this folder could grow, and should
 *
 * - **`updateData(structure, partial, { propagateToWorkers })`** — the engine runs
 *   on more than one thread, and a write that is not propagated is a bug the
 *   author cannot see. Note `structures.setData` is `@deprecated`; use
 *   `updateData`. See `HandlerAction.md` §5 and §9.
 * - **`setSpritesheetIndexByValueAtCell(x, y, value, thresholds)`** — maps a
 *   number onto animation frames, so a filling tank shows its own level with
 *   **no custom rendering**. One action gives every config author a progress bar.
 *
 * See `HandlerAction.md` §5.
 *
 * @module
 */
import { defineActions } from "../../core/types.ts";

/** The instance bag every REMEMBER action writes to. */
type Data = Record<string, unknown>;

/** Read a number out of the instance bag, treating anything odd as 0. */
function num(bag: Data | undefined, key: string): number {
    return Number(bag?.[key]) || 0;
}

// ── Payload-signature actions ────────────────────────────────────────────────

export const rememberActions = defineActions({
    /** Writes one key into the instance's own data bag. */
    structureWriteData: {
        role: "remember",
        doc: "Writes one key into this instance's saved data. Set `key` / `value` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { key?: string; value?: unknown };
            const s = payload as { data?: Data } | null;
            if (!s || !o.key) return;
            if (!s.data) s.data = {};
            s.data[o.key] = o.value;
        },
    },

    /** Advances a tick counter on the instance. The smallest useful accumulator. */
    triggerTick: {
        role: "remember",
        doc: "Increments this instance's tick counter. Set `key` in options.",
        fn: (payload, _ctx, options) => {
            const key = (options as { key?: string } | null)?.key ?? "ticks";
            const s = payload as { data?: Data } | null;
            if (!s) return;
            if (!s.data) s.data = {};
            s.data[key] = num(s.data, key) + 1;
        },
    },

    /** Increments an upgrade level on the item, when the upgrade is applied. */
    upgradeCountLevel: {
        role: "remember",
        doc: "Increments a level counter on the upgraded item. Set `key` in options.",
        fn: (payload, _ctx, options) => {
            const key = (options as { key?: string } | null)?.key ?? "mdLevel";
            const s = payload as { data?: Data } | null;
            if (!s) return;
            if (!s.data) s.data = {};
            s.data[key] = num(s.data, key) + 1;
        },
    },

    /** Adds a flat amount to a numeric field, when the upgrade is applied. */
    upgradeAdd: {
        role: "remember",
        doc: "Adds `amount` to a numeric field. Set `key` and `amount` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { key?: string; amount?: number };
            if (!o.key) return;
            const s = payload as { data?: Data } | null;
            if (!s) return;
            if (!s.data) s.data = {};
            s.data[o.key] = num(s.data, o.key) + (o.amount ?? 1);
        },
    },
});

// ── Processing-signature actions ─────────────────────────────────────────────
//
// Same role, different engine argument list — see the note in `../act/index.ts`.

export const processingRememberActions = defineActions({
    /**
     * Increments a per-instance counter.
     *
     * Pairs with a `setSpritesheetIndexByValueAtCell` action to turn a stored
     * number into a visible level, with no custom rendering.
     */
    processorCount: {
        role: "remember",
        doc: "Increments a counter on this instance. Set `key` in options.",
        fn: (structure, _context, options) => {
            try {
                const key = (options as { key?: string } | null)?.key ?? "mdTicks";
                const s = structure as { data?: Data } | null;
                if (!s) return;
                if (!s.data) s.data = {};
                s.data[key] = num(s.data, key) + 1;
            } catch (e) {
                console.warn("[md-my-hown-mod:remember] count failed", e);
            }
        },
    },
});
