/**
 * Register buffer-action structures ("action" category).
 *
 * These are clickable buttons the player places then activates:
 *   - +1 / -1 for each number path,
 *   - toggle for each bool path.
 *
 * Activation is wired through the signals interactable handler (docs_tech/13 §B3,
 * 14 §cheat-sheet): the engine draws a hover highlight around the structure and
 * cancels the default action for us. On click we read the current buffer value,
 * apply the op, write it back through the buffer (setPath + commit), which
 * triggers the value-structure refresh so every placed value structure updates
 * immediately.
 *
 * Signal model (check the bundle): `registerSenderType(type, getter)` only
 * registers *how* the output is computed — the getter is read when a wire is
 * first linked (bundle 63873). The propagation pass (`v(e)` on frame:update)
 * reads only the **cached** `link.on` value and never re-invokes the getter,
 * so a live sender must *push* its output through `signals.setAll(cell, on)`
 * whenever it changes (bundle 63921-63936) — this sets every outgoing link's
 * `.on` and marks each receiver dirty for re-application. This is exactly what
 * every vanilla signal device does. So we:
 *   1. register the getter (the "how"),
 *   2. on buffer change, call `setAll` for every placed action structure (the
 *      "when") — event-driven, no per-frame polling.
 *
 * The bound path + op travel in defaultData so copier duplicates keep working.
 */
import "@sandmd/sandkit";
import type { CatalogueItem } from "@sandmd/catalogue";
import type { FieldKind } from "../shared.ts";

export type ActionOp = "inc" | "dec" | "toggle";

export interface ActionCatalogueItem extends CatalogueItem {
    action?: ActionOp;
    /** Real jsonBuffer path this action writes to (already index-resolved). */
    path?: string;
    kind?: FieldKind;
}

/** Read the current buffer value for a path. */
export type ActionRead = (path: string) => unknown;
/** Write a new value to the buffer and publish/commit it. */
export type ActionWrite = (path: string, value: unknown) => void;

/** Label shown in the picker / tooltip for each op. */
export const ACTION_LABEL: Record<ActionOp, string> = {
    inc: "+1",
    dec: "-1",
    toggle: "toggle",
};

/** Compute the buffer mutation for an op given the current value. */
export function applyAction(op: ActionOp, current: unknown): unknown {
    switch (op) {
        case "inc":
            return (Number(current) || 0) + 1;
        case "dec":
            return (Number(current) || 0) - 1;
        case "toggle":
            return !current;
    }
}

export interface ActionRegisterResult {
    /**
     * Recompute every placed action structure's signal output from the current
     * buffer value and push it via `signals.setAll`, so receivers re-apply it on
     * the next frame. Call this on every buffer change (including writes coming
     * from elsewhere, not just this structure's own click).
     */
    refreshSignals: () => void;
}
