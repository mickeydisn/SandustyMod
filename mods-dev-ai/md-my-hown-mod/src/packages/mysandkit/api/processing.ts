import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const processing = {
    registerGrower(def: Record<string, unknown>): void {
        try {
            g()?.api?.processing?.registerGrower?.(def);
        } catch (e) {
            console.error(`${LOG} processing.registerGrower failed`, e);
        }
    },
    registerShaker(def: Record<string, unknown>): void {
        try {
            g()?.api?.processing?.registerShaker?.(def);
        } catch (e) {
            console.error(`${LOG} processing.registerShaker failed`, e);
        }
    },
    registerKineticPress(def: Record<string, unknown>): void {
        try {
            g()?.api?.processing?.registerKineticPress?.(def);
        } catch (e) {
            console.error(`${LOG} processing.registerKineticPress failed`, e);
        }
    },
};
