
import { api, defineActions, defineModifiers } from "../../core/types.ts";



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
                api?.signals?.setOutputAtCell?.(x, y, Boolean(value));
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
                
                
                api?.energy?.consume?.(amount, { allOrNothing: false });
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
                api?.energy?.addAtCell?.(p.x, p.y, amount);
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
                
                
                
                const add = api?.player?.inventory?.addById;
                if (typeof add !== "function") return;
                for (let i = 0; i < Math.max(1, o.count ?? 1); i++) add(o.itemId);
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
                api?.upgrades?.setLevelById?.(o.itemId, o.upgradeId, o.level ?? 1);
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] set upgrade level failed", e);
            }
        },
    },

    
    energyDefault: {
        role: "connect",
        doc: "Storage node descriptor: capacity 1000. Override `capacity` in options.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
            return {
                capacity: o.capacity ?? 1000,
                ...(o.energyType ? { energyType: o.energyType } : {}),
            };
        },
    },

    
    energyBank: {
        role: "connect",
        doc: "Storage node descriptor: capacity 100000 — a large buffer.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
            return {
                capacity: o.capacity ?? 100000,
                ...(o.energyType ? { energyType: o.energyType } : {}),
            };
        },
    },

    
    energyWire: {
        role: "connect",
        doc: "Storage node descriptor: capacity 200 — a small buffer between machines.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
            return {
                capacity: o.capacity ?? 200,
                ...(o.energyType ? { energyType: o.energyType } : {}),
            };
        },
    },

    
    energyConductor: {
        role: "connect",
        doc: "Conductor descriptor: capacity 0. Forwards energy without holding any.",
        fn: () => ({ capacity: 0 }),
    },

    
    energyNetwork: {
        role: "connect",
        doc: "Joins the network named by `energyType` in options.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { energyType?: string } | null) ?? {};
            return { capacity: 0, ...(o.energyType ? { energyType: o.energyType } : {}) };
        },
    },

    
    itemDefault: {
        role: "connect",
        doc: "Baseline item options (power 5). Use as a base for a tool or weapon.",
        fn: () => ({ power: 5 }),
    },
});










export const connectModifierActions = defineModifiers({
    
    logArgs: {
        role: "connect",
        kind: "intercept",
        doc: "Modifier: prints whatever the hook passed in. Use to discover hook names.",
        fn: (args, ctx) => {
            console.log("[md-my-hown-mod:modifier] intercept", args, ctx);
        },
    },

    
    identity: {
        role: "connect",
        kind: "modify",
        doc: "Modifier: returns the args untouched. Proves a modify hook is wired.",
        fn: (args) => args,
    },

    
    logBuildingPayload: {
        role: "connect",
        kind: "intercept",
        doc: "Modifier: prints a building-placement-shaped payload. Useful while wiring.",
        fn: (args) => {
            try {
                console.log(
                    "[md-my-hown-mod:modifier] building-ish",
                    JSON.parse(JSON.stringify(args ?? null)),
                );
            } catch {
                console.log("[md-my-hown-mod:modifier] building-ish (raw)", args);
            }
        },
    },
});
