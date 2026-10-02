
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";



export const connectActions = defineActions({
    
    signalOutput: {
        role: "connect",
        doc: "Publishes this structure's signal output. Set `value` in options.",
        fn: (payload, _ctx, options) => {
            const s = payload as { x?: number; y?: number } | null;
            const x = Number(s?.x);
            const y = Number(s?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const value = (options as { value?: unknown } | null)?.value;
            try {
                api.signals.setOutputAtCell(x, y, Boolean(value));
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] signal output failed", e);
            }
        },
    },

    
    energyConsumePerRun: {
        role: "connect",
        doc: "Draws `amount` from the shared power pool. Set `amount` in options.",
        fn: (_payload, _ctx, options) => {
            const amount = Number((options as { amount?: number } | null)?.amount ?? 0);
            if (!amount) return;
            try {
                
                
                api.energy.consume(amount, { allOrNothing: false });
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] energy consume failed", e);
            }
        },
    },

    
    energyGenerateWhileHeld: {
        role: "connect",
        doc: "Adds power to the network here. Set `amount` in options.",
        fn: (payload, _ctx, options) => {
            const amount = Number((options as { amount?: number } | null)?.amount ?? 0);
            const p = payload as { x?: number; y?: number } | null;
            if (!p || !amount || p.x === undefined || p.y === undefined) return;
            try {
                api.energy.addAtCell(p.x, p.y, amount);
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] energy generate failed", e);
            }
        },
    },

    
    techAppendUnlock: {
        role: "connect",
        doc: "Adds structures to a tech node. Set `techId` and `structures` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as {
                techId?: unknown;
                structures?: string[];
                items?: string[];
            };
            const self = (payload as { id?: string } | null)?.id;
            const structures = o.structures ?? (self ? [self] : []);
            
            
            
            const techId = typeof o.techId === "string" ? o.techId : "";
            if (!techId || structures.length === 0) return;
            
            
            const unlocks: Record<string, unknown> = { structures };
            if (o.items) unlocks.items = o.items;
            
            
            
            
            if (!api.tech.conservatory.appendUnlock(techId, unlocks)) {
                console.warn(
                    "[md-my-hown-mod:connect] tech.conservatory.appendUnlock refused " +
                        `${techId} — no unlock was added`,
                );
            }
        },
    },

    
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
