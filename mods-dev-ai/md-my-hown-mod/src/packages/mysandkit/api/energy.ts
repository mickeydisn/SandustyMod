import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

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
};
