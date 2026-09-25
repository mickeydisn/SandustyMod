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
    toggleRate: "%",
};

/**
 * N-frame rule for `toggleRate` art: frame 0 is `<= 0`, the last frame
 * (`N - 1`) is `>= 100`, and the `N - 2` middle frames split `(0, 100)`
 * evenly — 6 frames → steps of 25 (`>0`, `>=25`, `>=50`, `>=75`), 7 frames
 * → steps of 20 (`>0`, `>=20`, `>=40`, `>=60`, `>=80`), and so on.
 */

/** Middle-frame step for an N-frame rate sheet (`100 / (N - 2)`). */
export function rateStep(frames: number): number {
    return 100 / Math.max(1, Math.floor(frames) - 2);
}

/** Values cycled by the `toggleRate` click for an N-frame sheet. */
export function rateStops(frames: number): number[] {
    const count = Math.max(2, Math.floor(frames));
    const step = rateStep(count);
    const stops = [0];
    for (let k = 1; k <= count - 2; k++) {
        stops.push(Math.round(k * step * 100) / 100);
    }
    return stops;
}

/** Next `rateStops` value strictly above `current`, wrapping to 0 past 100. */
export function nextRateStop(current: unknown, frames: number): number {
    const n = Number(current) || 0;
    if (n < 0) return 0;
    for (const stop of rateStops(frames)) {
        if (stop > n) return stop;
    }
    return 0;
}

/** Spritesheet frame for a 0–100 rate value on an N-frame sheet. */
export function toggleRateFrame(value: unknown, frames: number): number {
    const count = Math.max(1, Math.floor(frames));
    if (count <= 1) return 0;
    const n = Number(value) || 0;
    if (n <= 0) return 0;
    if (count <= 2) return 1;
    if (n >= 100) return count - 1;
    return Math.min(count - 1, 1 + Math.floor(n / rateStep(count)));
}

/** Compute the buffer mutation for a non-rate action. */
export function applyAction(
    op: Exclude<ActionOp, "toggleRate">,
    current: unknown,
): unknown {
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

/** Compute the next value for an explicitly sized rate sheet. */
export function applyRateAction(current: unknown, frames: number): number {
    return nextRateStop(current, frames);
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
