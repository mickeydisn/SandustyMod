import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
export const upgradesActions = defineActions({
    techSetUpgradeLevel: {
        role: "connect",
        doc: "Sets an upgrade level. Set `itemId`, `upgradeId` and `level` in options.",
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
