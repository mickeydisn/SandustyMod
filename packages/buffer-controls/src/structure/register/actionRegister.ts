/** */
import "@sandmd/sandkit";
import { ActionOp } from "../../types.ts";

/** Read the current buffer value for a path. */
export type ActionRead = (path: string) => unknown;
/** Write a new value to the buffer and publish/commit it. */
export type ActionWrite = (path: string, value: unknown) => void;

/** Label shown in the picker / tooltip for each op. */
export const ACTION_LABEL: Record<ActionOp, string> = {
    inc: "+1",
    incX: "+10",
    dec: "-1",
    decX: "-10",
    toggle: "toggle",
    toggleNum: "±",
};

/** Compute the buffer mutation for an op given the current value. */
export function applyAction(op: ActionOp, current: unknown): unknown {
    switch (op) {
        case "inc":
            return (Number(current) || 0) + 1;
        case "dec":
            return (Number(current) || 0) - 1;
        case "incX":
            return (Number(current) || 0) + 10;
        case "decX":
            return (Number(current) || 0) - 10;
        case "toggle":
            return !current;
        case "toggleNum": {
            // Sign toggle: `0` stays `0` (nothing to flip), every other value
            // becomes its opposite.
            const n = Number(current) || 0;
            return n === 0 ? 0 : -n;
        }
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
