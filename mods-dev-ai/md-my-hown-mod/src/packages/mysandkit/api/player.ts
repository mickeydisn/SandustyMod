import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const player = {
    inventory: {
        addById(
            itemId: string,
            amount = 1,
        ): boolean {
            try {
                const ns = g()?.api?.player?.inventory;
                if (typeof ns?.addById !== "function") return false;
                ns.addById(itemId, amount);
                return true;
            } catch (e) {
                console.warn(`${LOG} player.inventory.addById failed`, itemId, e);
                return false;
            }
        },
    },
    buildings: {
        unlockById(structureId: string): boolean {
            try {
                const fn = g()?.api?.player?.buildings?.unlockById;
                if (typeof fn !== "function") return false;
                fn(structureId);
                return true;
            } catch (e) {
                console.error(`${LOG} player.buildings.unlockById failed`, structureId, e);
                return false;
            }
        },

        removeById(structureId: string): boolean {
            try {
                const fn = g()?.api?.player?.buildings?.removeById;
                if (typeof fn !== "function") return false;
                fn(structureId);
                return true;
            } catch (e) {
                console.error(`${LOG} player.buildings.removeById failed`, structureId, e);
                return false;
            }
        },
    },
};
