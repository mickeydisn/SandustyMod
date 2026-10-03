import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const upgrades = {
    register(def: Record<string, unknown>): boolean {
        try {
            const ns = g()?.api?.upgrades;
            if (typeof ns?.register !== "function") return false;
            ns.register(def);
            return true;
        } catch (e) {
            console.error(`${LOG} upgrades.register failed`, def.id, e);
            return false;
        }
    },
    registerCategory(def: Record<string, unknown>): boolean {
        try {
            const ns = g()?.api?.upgrades;
            if (typeof ns?.registerCategory !== "function") return false;
            ns.registerCategory(def);
            return true;
        } catch (e) {
            console.error(`${LOG} upgrades.registerCategory failed`, def.id, e);
            return false;
        }
    },
    updateDefinition(
        itemId: string,
        upgradeId: string,
        partial: Record<string, unknown>,
    ): void {
        try {
            g()?.api?.upgrades?.updateDefinition?.(itemId, upgradeId, partial);
        } catch (e) {
            console.error(`${LOG} upgrades.updateDefinition failed`, itemId, upgradeId, e);
        }
    },

    setLevelById(itemId: string, upgradeId: string, level: number): void {
        try {
            g()?.api?.upgrades?.setLevelById?.(itemId, upgradeId, level);
        } catch (e) {
            console.warn(`${LOG} upgrades.setLevelById failed`, itemId, upgradeId, e);
        }
    },
};
