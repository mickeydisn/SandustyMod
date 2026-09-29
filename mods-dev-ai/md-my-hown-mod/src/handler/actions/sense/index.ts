/**
 * SENSE — look at the world. Changes nothing.
 *
 * The first role in a process, and the only one that is always safe to run. A
 * SENSE action reads the engine (or its own options) and may leave what it found
 * in `vars` for a later action to use. It never writes a cell and never calls
 * `api.*` to change state.
 *
 * Everything here has the `payload` signature: `(payload, extra)`. A
 * `processing` action cannot be a SENSE action unless it is in `act/`, because
 * only that call site hands over the cell context — and a context read *is* a
 * sense. Both the role and the signature are declared per action rather than
 * inferred from the folder, so an action filed here is free to declare
 * `signature: "processing"` when it needs the context.
 *
 * See `HandlerAction.md` §2.
 *
 * @module
 */
import { anchorFor } from "../../core/cell-region.ts";
import { defineActions, hostNs } from "../../core/types.ts";
// The one shared shape the context-aware actions need. Declared once in `act/`
// rather than re-written here, so `isElementAtCell` and the element family cannot
// disagree about what the engine's processing context is.
import type { ProcessingContext } from "../act/index.ts";

export const senseActions = defineActions({
    /** Reports what the clicked structure is, without changing anything. */
    structureInspect: {
        role: "sense",
        doc: "Reports what the clicked structure is, without changing anything.",
        fn: (structure) => {
            const s = structure as Record<string, unknown> | null;
            if (!s) return;
            console.log(
                "[md-my-hown-mod:signal] structure",
                JSON.stringify({ type: s.type, x: s.x, y: s.y, data: s.data }, null, 2),
            );
        },
    },

    /** Reads one key out of the instance's own data bag. */
    structureReadData: {
        role: "sense",
        doc: "Reads one key out of the instance's own data bag. Set `key` in options.",
        fn: (payload, _ctx, options) => {
            const key = (options as { key?: unknown } | null)?.key;
            const d = (payload as { data?: Record<string, unknown> } | null)?.data;
            console.log("[md-my-hown-mod:signal] data", key, d?.[String(key)]);
        },
    },

    /** Logs a rectangle of cells around the payload position. */
    triggerScan: {
        role: "sense",
        doc: "Logs a rectangle of cells around this position. Set `width` / `height` in options.",
        fn: (payload) => {
            const s = payload as { x?: number; y?: number } | null;
            if (!s) return;
            console.log("[md-my-hown-mod:trigger] scan", s.x, s.y);
        },
    },

    /** Generic payload logger — the first thing to add while wiring a call site. */
    signalLog: {
        role: "sense",
        doc: "Logs the raw payload. Use to see what a call site actually delivers.",
        fn: (payload, _ctx, extra) => {
            console.log("[md-my-hown-mod:signal]", payload, extra);
        },
    },

    /** The trigger equivalent of `signalLog`. */
    triggerLog: {
        role: "sense",
        doc: "Logs the raw payload of a timed tick.",
        fn: (payload, _ctx, extra) => {
            console.log("[md-my-hown-mod:trigger]", payload, extra);
        },
    },
});

/**
 * SENSE, processing-signature — `(structure, context, options)`.
 *
 * The role is unchanged; only the argument list is. A cell probe needs the engine's
 * `StructureProcessingContext`, and `processing` is the **only** call site that
 * delivers one — so a `sense` action that wants to ask a cell what it holds has to
 * be processing-signed. This second export exists for exactly that, and it is the
 * same arrangement `act/` and `remember/` already use.
 *
 * The split used to be a rule rather than a shape: a sense action needing the
 * context had to be filed as an `act`, which is exactly the kind of
 * mis-filing the two-axis model exists to remove. The role and signature axes
 * are independent, and `isElementAtCell` is the action that needed them to be.
 */
export const processingSenseActions = defineActions({
    /**
     * Asks whether a cell holds an element, and **answers into the context**.
     *
     * The worked example from the plan, and the first action that exists only
     * because the context does. The cell is `structure.x + dx`, `structure.y + dy` by
     * default — an offset, not an absolute coordinate, because a processor is *at* a
     * cell and asking about cell 400,300 is a bug waiting to happen.
     *
     * ## Why it returns rather than logs
     *
     * The step's `as` name is what captures the return:
     *
     * ```json
     * { "key": "isElementAtCell", "as": "isWater", "options": { "element": "water" } }
     * { "key": "toast",                     "options": { "message": "{{isWater}}" } }
     * ```
     *
     * A `sense` action that only logged would be unchainable: a later step would
     * have no way to know what it found. Returning the answer is what makes this a
     * *sense* rather than a log line, and `ROLE_IO` already says this role writes
     * `vars`.
     *
     * `dx` / `dy` default to 0, so with no offsets at all this asks "is the cell I am
     * standing on water?" — the common case, and the one the brief describes.
     */
    isElementAtCell: {
        role: "sense",
        doc: "fn(dx?, dy?) → true when the offset cell holds `element`. Bind the " +
            "answer with the step's As field, then read it as {{name}}.",
        fn: (structure, context, options) => {
            try {
                const anchor = anchorFor(structure);
                // The ambient fallback, for the same reason the element family has one:
                // `api.elements.getResolvedTypeAtCell` is a top-level function
                // (`elements.d.ts:71`), so asking a cell what it holds needs no
                // `StructureProcessingContext`. The context is still preferred when
                // present, because inside a mutate batch it sees staged writes.
                const readType = (context as ProcessingContext | null)?.getResolvedTypeAtCell ??
                    hostNs("elements")?.getResolvedTypeAtCell;
                if (anchor.source === "none" || typeof readType !== "function") return false;
                const o = (options ?? {}) as {
                    element?: unknown;
                    dx?: unknown;
                    dy?: unknown;
                };
                const name = String(o.element ?? "");
                if (!name) return false;
                // Offsets are numbers from the panel, and a reference resolves to a
                // number. Anything else is treated as 0 rather than NaN, because NaN
                // would ask the engine about a cell that cannot exist.
                const dx = Number(o.dx ?? 0) || 0;
                const dy = Number(o.dy ?? 0) || 0;
                const found = (readType as (x: number, y: number) => unknown)(
                    anchor.x + dx,
                    anchor.y + dy,
                );
                return found === name;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] isElementAtCell failed", e);
                return false;
            }
        },
    },
});
