import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const grid = {
    isCellEmptyAtCell(x: number, y: number): boolean | undefined {
        try {
            return g()?.api?.grid?.isCellEmptyAtCell?.(x, y);
        } catch (e) {
            console.warn(`${LOG} grid.isCellEmptyAtCell failed`, x, y, e);
            return undefined;
        }
    },
    isTerrainAtCell(x: number, y: number): boolean {
        try {
            return g()?.api?.grid?.isTerrainAtCell?.(x, y) === true;
        } catch (e) {
            console.warn(`${LOG} grid.isTerrainAtCell failed`, x, y, e);
            return false;
        }
    },
    reportActivityAtCell(x: number, y: number): void {
        try {
            g()?.api?.grid?.reportActivityAtCell?.(x, y);
        } catch (e) {
            console.warn(`${LOG} grid.reportActivityAtCell failed`, x, y, e);
        }
    },
    mutate<T extends object>(fn: (writer: T) => void): boolean {
        try {
            const ns = g()?.api?.grid;
            if (typeof ns?.mutate !== "function") return false;
            ns.mutate(fn);
            return true;
        } catch (e) {
            console.warn(`${LOG} grid.mutate failed`, e);
            return false;
        }
    },

    excavateAtCell(
        x: number,
        y: number,
        outVelocity: Record<string, number>,
        damage: number,
        opts?: Record<string, unknown>,
    ): void {
        try {
            g()?.api?.grid?.excavateAtCell?.(x, y, outVelocity, damage, opts ?? {});
        } catch (e) {
            console.warn(`${LOG} grid.excavateAtCell failed`, x, y, e);
        }
    },
};
