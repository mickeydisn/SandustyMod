import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { p } from "../../engine/registry/params.ts";
export const playerActions = defineActions({
    techGrantItem: {
        role: "connect",
        needs: [],
        doc: "Gives the player an item. Set `itemId` and `count` in options.",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
        p("itemId", "Item", "text", { required: true }),
        p("count", "Count", "number", { def: "1", min: 0, int: true }),
        ],
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
