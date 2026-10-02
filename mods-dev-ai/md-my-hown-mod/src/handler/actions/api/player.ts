import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
export const playerActions = defineActions({
    techGrantItem: {
        role: "connect",
        doc: "Gives the player an item. Set `itemId` and `count` in options.",
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as { itemId?: string; count?: number };
            if (!o.itemId) return;
            try {
                
                
                
                for (let i = 0; i < Math.max(1, o.count ?? 1); i++) {
                    api.player.inventory.addById(o.itemId);
                }
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] grant item failed", e);
            }
        },
    },

    

});
