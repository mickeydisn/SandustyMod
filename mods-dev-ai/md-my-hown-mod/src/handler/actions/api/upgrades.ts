import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { p } from "../../engine/registry/params.ts";
export const upgradesActions = defineActions({
    techSetUpgradeLevel: {
        role: "connect",
        doc: "Sets an upgrade level. Set `itemId`, `upgradeId` and `level` in options.",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
        p("itemId", "Item", "text", { required: true }),
        p("level", "Level", "number", { def: "1", min: 0, int: true }),
        ],
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as {
                itemId?: string;
                upgradeId?: string;
                level?: number;
            };
            if (!o.itemId || !o.upgradeId) return;
            try {
                api.upgrades.setLevelById(o.itemId, o.upgradeId, o.level ?? 1);
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] set upgrade level failed", e);
            }
        },
    },

});
