import { defineActions, defineModifiers } from "../../engine/types.ts";
import { p } from "../../engine/registry/params.ts";

export const engineConnectActions = defineActions({
    energyDefault: {
        role: "connect",
        needs: [],
        doc: "Storage node descriptor: capacity 1000. Override `capacity` in options.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "1000", min: 0, int: true })],
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
        needs: [],
        doc: "Storage node descriptor: capacity 100000 — a large buffer.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "100000", min: 0, int: true })],
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
        needs: [],
        doc: "Storage node descriptor: capacity 200 — a small buffer between machines.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "200", min: 0, int: true })],
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
        needs: [],
        doc: "Conductor descriptor: capacity 0. Forwards energy without holding any.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "0", min: 0, int: true })],
        fn: () => ({ capacity: 0 }),
    },

    energyNetwork: {
        role: "connect",
        needs: [],
        doc: "Joins the network named by `energyType` in options.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", {
                required: true,
                hint: "network name to join",
            }),
        ],
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { energyType?: string } | null) ?? {};
            return { capacity: 0, ...(o.energyType ? { energyType: o.energyType } : {}) };
        },
    },

    itemDefault: {
        role: "connect",
        needs: [],
        doc: "Baseline item options (power 5). Use as a base for a tool or weapon.",
        type: "global",
        slots: ["itemAction"],
        scope: "item",
        itemTypes: ["Mod"],
        params: [p("power", "Power", "number", { def: "5", min: 0 })],
        fn: () => ({ power: 5 }),
    },
});

export const connectModifierActions = defineModifiers({
    logArgs: {
        role: "connect",
        needs: [],
        kind: "intercept",
        doc: "Modifier: prints whatever the hook passed in. Use to discover hook names.",
        type: "modifier",
        slots: ["modifier"],
        scope: "global",
        params: [],
        fn: (args, ctx) => {
            console.log("[md-my-hown-mod:modifier] intercept", args, ctx);
        },
    },

    identity: {
        role: "connect",
        needs: [],
        kind: "modify",
        doc: "Modifier: returns the args untouched. Proves a modify hook is wired.",
        type: "modifier",
        slots: ["modifier"],
        scope: "global",
        params: [],
        fn: (args) => args,
    },

    logBuildingPayload: {
        role: "connect",
        needs: [],
        kind: "intercept",
        doc: "Modifier: prints a building-placement-shaped payload. Useful while wiring.",
        type: "modifier",
        slots: ["modifier"],
        scope: "global",
        params: [],
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
