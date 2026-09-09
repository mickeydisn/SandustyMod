/** */
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
