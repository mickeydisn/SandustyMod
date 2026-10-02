import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { p } from "../../engine/registry/params.ts";
export const energyActions = defineActions({
    energyConsumePerRun: {
        role: "connect",
        needs: [],
        doc: "Draws `amount` from the shared power pool. Set `amount` in options.",
        type: "processor",

        slots: ["processing", "signal", "modifier"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
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
        needs: ["pos"],
        doc: "Adds power to the network here. Set `amount` in options.",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
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
});
