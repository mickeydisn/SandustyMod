import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

/**
 * A cell pattern: a row-major grid where `1` marks an occupied cell.
 *
 * This is the shape `patterns.createCircle` produces and
 * `patterns.excavateAtCell` consumes.
 */
export type CellPattern = number[][];

export const patterns = {
    /**
     * Build a filled-circle pattern.
     *
     * `diameterCells` determines both dimensions; `1` marks cells inside the
     * radius, `0` those outside (`bundel.js` 51650-51660).
     */
    createCircle(diameterCells: number): CellPattern {
        try {
            const fn = g()?.api?.patterns?.createCircle;
            if (typeof fn !== "function") return [];
            return (fn.call(g()?.api?.patterns, diameterCells) ??
                []) as CellPattern;
        } catch (e) {
            console.warn(`${LOG} patterns.createCircle failed`, diameterCells, e);
            return [];
        }
    },

    /**
     * Excavate a pattern-shaped area.
     *
     * `outVelocity` is written by the host into the object you pass, so supply
     * a mutable `{ x, y }`. `power` scales the dig.
     */
    excavateAtCell(
        x: number,
        y: number,
        pattern: CellPattern,
        outVelocity: { x: number; y: number },
        power?: number,
        options?: Record<string, unknown>,
    ): boolean {
        try {
            const ns = g()?.api?.patterns;
            const fn = ns?.excavateAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, pattern, outVelocity, power, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} patterns.excavateAtCell failed`, x, y, e);
            return false;
        }
    },
};