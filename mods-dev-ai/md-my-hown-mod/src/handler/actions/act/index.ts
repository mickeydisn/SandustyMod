/**
 * ACT — change a cell.
 *
 * The role that matters, and the one our catalogue is worst at: two of the six
 * original actions were silently broken, and none could write anything an author
 * would recognise as behaviour.
 *
 * ## The write contract
 *
 * `StructureProcessingContext.commit` is typed `commit(mutations: unknown)`, so
 * nothing in the type system described the payload — which is how both original
 * actions got it wrong. They passed a bare object, used `type: "set"`, and
 * ignored the return. All three workshop mods that use `commit` agree on the real
 * shape (`HandlerAction.md` §4):
 *
 *     context.commit([{ kind: "create", cellX, cellY, elementType }])   // → boolean
 *     context.commit([{ kind: "remove", cellX, cellY, expectedElementType }])
 *
 * Two details that matter and are easy to lose:
 *
 *   - it takes an **array**, so several writes can be one transaction;
 *   - it **returns a boolean**, so a refused write can be surfaced. A silent
 *     no-op is the worst outcome for an author, who then sees nothing wrong.
 *
 * `expectedElementType` makes a remove a *compare-and-remove* — the engine's own
 * atomicity, and the only safe way to say "remove it if it is still this type".
 *
 * See `HandlerAction.md` §4.
 *
 * @module
 */
import { anchorFor } from "../../core/cell-region.ts";
import { defineActions, hostNs } from "../../core/types.ts";

/** The parts of `StructureProcessingContext` the ACT actions use. */
export interface ProcessingContext {
    getResolvedTypeAtCell?: (x: number, y: number) => unknown;
    isCellEmptyAtCell?: (x: number, y: number) => boolean;
    /** Batch write. Takes an array; returns whether it landed. */
    commit?: (mutations: CellMutation[]) => boolean | void;
}

/**
 * One staged cell write.
 *
 * `kind` is the discriminator, not `type` — and `"set"` is not a valid value.
 * `kind: "create"` is what replaces as well as places, because the engine
 * overwrites the target cell.
 */
export interface CellMutation {
    kind: "create" | "remove" | "structure";
    cellX: number;
    cellY: number;
    elementType?: unknown;
    /** Compare-and-remove: only remove if the cell still holds this type. */
    expectedElementType?: unknown;
}

/** Run `commit` and say so when the engine refuses, so it is never a silent no-op. */
function commitOrWarn(
    context: unknown,
    mutations: CellMutation[],
    label: string,
): boolean {
    const ctx = context as ProcessingContext | null;
    if (!ctx?.commit) {
        console.warn(
            `[md-my-hown-mod:act] ${label}: this call site hands over no cell ` +
                "context, so nothing was written",
        );
        return false;
    }
    try {
        // A void return means the host has no such method. Every mod that uses
        // this gets a boolean, so `undefined` is a version we cannot trust.
        const ok = ctx.commit(mutations);
        if (ok === false) {
            console.warn(
                `[md-my-hown-mod:act] ${label}: the engine refused the write — ` +
                    "the cell was probably occupied or changed mid-tick",
            );
        }
        return ok !== false;
    } catch (e) {
        console.warn(`[md-my-hown-mod:act] ${label} failed`, e);
        return false;
    }
}

/** A cell position offset from the structure. */
function at(
    structure: { x?: number; y?: number } | null,
    dx: number,
    dy: number,
): { cellX: number; cellY: number } {
    return { cellX: (structure?.x ?? 0) + dx, cellY: (structure?.y ?? 0) + dy };
}

// ── Payload-signature actions ────────────────────────────────────────────────
//
// `(payload, extra)` — the general case: signals, triggers, item use.

export const actActions = defineActions({
    /**
     * Digs with the engine's own excavation, which handles terrain resistance.
     *
     * Returns nothing. This is an *action* — it performs its effect — so there is
     * no value to hand back, and the slots it sits in are void slots anyway. It was
     * on `VACUOUS_RETURNS` while it was a stub that returned a literal; that list is
     * for the factory actions, which build the options something else registers.
     */
    itemExcavate: {
        role: "act",
        doc: "Digs at this position. Set `damage` and `velocity` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { damage?: number; vx?: number; vy?: number };
            // `anchorFor`, not `payload.x`. This action reads the position the same way
            // every cell action does now, and the difference is the whole bug: an item
            // use hands over the engine **state**, which has no `x`, so the old
            // `payload.x` passed `undefined` to the engine and it excavated at
            // `undefined, undefined` while reporting no error at all. The anchor falls
            // back to `api.input.getMouseCellPosition()`, so a Tool digs under the cursor.
            const at = anchorFor(payload);
            if (at.source === "none") {
                console.warn(
                    "[md-my-hown-mod:act] itemExcavate: this call site gave no position and " +
                        "there is no cursor to read, so nothing was dug",
                );
                return;
            }
            try {
                const grid = hostNs("grid");
                grid?.excavateAtCell?.(
                    at.x,
                    at.y,
                    { x: o.vx ?? 0, y: o.vy ?? 0 },
                    o.damage ?? 1,
                );
            } catch (e) {
                console.warn("[md-my-hown-mod:act] excavate failed", e);
            }
        },
    },

    /** Spawns a projectile from this position. */
    itemShoot: {
        role: "act",
        doc: "Fires a projectile. Set `projectileId` and `velocity` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { projectileId?: string; vx?: number; vy?: number };
            if (!o.projectileId) return;
            // The same anchor, and the same reason — see `itemExcavate`.
            const at = anchorFor(payload);
            if (at.source === "none") {
                console.warn(
                    "[md-my-hown-mod:act] itemShoot: this call site gave no position and " +
                        "there is no cursor to read, so nothing was fired",
                );
                return;
            }
            try {
                const api = hostNs("projectiles");
                const type = api?.getTypeFromId?.(o.projectileId) ?? o.projectileId;
                api?.spawnAtWorld?.(type, at.x, at.y, { x: o.vx ?? 0, y: o.vy ?? 0 });
            } catch (e) {
                console.warn("[md-my-hown-mod:act] shoot failed", e);
            }
        },
    },
});

// ── Processing-signature actions ─────────────────────────────────────────────
//
// `(structure, context, options)` — the only call site that hands over the cell
// context. They live beside the payload-signature actions above because they are
// the same *role*: the signature is not a reason to split a role folder, which is
// the whole point of `ActionDef` carrying both axes.

export const processingActActions = defineActions({
    /** Logs the tick — the safest way to confirm a processor is wired at all. */
    processorLog: {
        role: "act",
        doc: "Logs the structure and cell context on every run. Use to confirm wiring.",
        fn: (structure, context) => {
            console.log("[md-my-hown-mod:process]", structure, context);
        },
    },

    /** Does nothing, but keeps the interval alive without side effects. */
    processorNoop: {
        role: "act",
        doc: "Does nothing. Keeps the interval alive without side effects.",
        fn: () => {},
    },

    /**
     * Copies the cell above the structure into the cell below it.
     *
     * One compare-and-remove plus one create in a **single** `commit` call, so the
     * move lands as a whole or not at all. Split across two commits it could
     * duplicate the element or destroy it outright — which is exactly what the
     * staged `pending` list in `HandlerAction.md` §8 is for.
     */
    processorLift: {
        role: "act",
        doc: "Copies the cell above the structure down to the cell below.",
        fn: (structure, context) => {
            try {
                const s = structure as { x?: number; y?: number } | null;
                const ctx = context as ProcessingContext | null;
                if (!s || !ctx?.getResolvedTypeAtCell) return;
                const src = at(s, 0, -1);
                const dst = at(s, 0, 1);
                const elementType = ctx.getResolvedTypeAtCell(src.cellX, src.cellY);
                if (elementType === undefined || elementType === null) return;
                commitOrWarn(context, [
                    { kind: "remove", ...src, expectedElementType: elementType },
                    { kind: "create", ...dst, elementType },
                ], "lift");
            } catch (e) {
                console.warn("[md-my-hown-mod:act] lift failed", e);
            }
        },
    },

    /**
     * Converts whatever sits above the structure into one fixed element.
     *
     * Without `options.to` it only reports what it saw, so it is safe to leave
     * enabled while experimenting — the difference is a decision, not a guard.
     */
    processorConvert: {
        role: "act",
        doc: "Replaces the cell above with one fixed element. Set `to` in options.",
        fn: (structure, context, options) => {
            try {
                const s = structure as { x?: number; y?: number } | null;
                const ctx = context as ProcessingContext | null;
                const target = (options as { to?: unknown } | null)?.to;
                if (!s || !ctx?.getResolvedTypeAtCell) return;
                const src = at(s, 0, -1);
                const current = ctx.getResolvedTypeAtCell(src.cellX, src.cellY);
                if (current === undefined || current === null) return;
                if (target === undefined || target === null) {
                    console.log("[md-my-hown-mod:process] convert sees", current);
                    return;
                }
                // `create` overwrites, so one mutation replaces the cell. The
                // original passed `type: "set"`, which is not a mutation kind at
                // all — that is why this action silently did nothing.
                commitOrWarn(context, [{ kind: "create", ...src, elementType: target }], "convert");
            } catch (e) {
                console.warn("[md-my-hown-mod:act] convert failed", e);
            }
        },
    },
});
