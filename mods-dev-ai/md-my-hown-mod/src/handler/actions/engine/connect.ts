import { defineActions, defineModifiers } from "../../core/types.ts";

/**
 * Connect actions that do not call the host: storage/item descriptors that just return
 * an object, plus the engine-hook modifiers.
 */
export const engineConnectActions = defineActions({
    
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
