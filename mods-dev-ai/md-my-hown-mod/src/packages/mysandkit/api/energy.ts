import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

/**
 * One structure in an energy network.
 *
 * The facade adds `cellX` / `cellY` mirrors to each entry
 * (`extra-mod-runtime.js` 1524-1528), so both name pairs are present.
 */
export type EnergyNetworkEntry = {
    x: number;
    y: number;
    cellX: number;
    cellY: number;
    /** Structure type of the network member. */
    type: number;
};

export const energy = {
    registerType(
        structureId: string,
        type: "conductor" | "storage",
        options?: Record<string, unknown>,
    ): void {
        try {
            g()?.api?.energy?.registerType?.(structureId, type, options ?? {});
        } catch (e) {
            console.warn(`${LOG} energy.registerType failed`, structureId, e);
        }
    },

    addAtCell(x: number, y: number, amount: number): void {
        try {
            g()?.api?.energy?.addAtCell?.(x, y, amount);
        } catch (e) {
            console.warn(`${LOG} energy.addAtCell failed`, x, y, e);
        }
    },

    consume(amount: number, options?: Record<string, unknown>): number {
        try {
            return g()?.api?.energy?.consume?.(amount, options ?? {}) as number;
        } catch (e) {
            console.warn(`${LOG} energy.consume failed`, amount, e);
            return 0;
        }
    },

    /**
     * Consume energy while ignoring the network under this cell.
     *
     * Useful when draining a buffer that is feeding its own neighbours — the
     * normal `consume` draws from the connected network first.
     */
    consumeExcludingNetworkAtCell(x: number, y: number, amount: number): boolean {
        try {
            const ns = g()?.api?.energy;
            const fn = ns?.consumeExcludingNetworkAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, amount);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} energy.consumeExcludingNetworkAtCell failed`,
                x,
                y,
                e,
            );
            return false;
        }
    },

    /**
     * Every energy structure reachable from a cell.
     *
     * Returns an empty array when the cell is not part of a network. Members
     * whose registered options set `excludeFromNetwork` are skipped
     * (`bundel.js` 51181-51187).
     */
    getNetworkAtCell(x: number, y: number): EnergyNetworkEntry[] {
        try {
            return (g()?.api?.energy?.getNetworkAtCell?.(x, y) ??
                []) as EnergyNetworkEntry[];
        } catch (e) {
            console.warn(`${LOG} energy.getNetworkAtCell failed`, x, y, e);
            return [];
        }
    },

    /** Remaining storage headroom across the network containing a cell. */
    getNetworkFreeCapacityAtCell(x: number, y: number): number {
        try {
            return (g()?.api?.energy?.getNetworkFreeCapacityAtCell?.(x, y) ??
                0) as number;
        } catch (e) {
            console.warn(
                `${LOG} energy.getNetworkFreeCapacityAtCell failed`,
                x,
                y,
                e,
            );
            return 0;
        }
    },
};
