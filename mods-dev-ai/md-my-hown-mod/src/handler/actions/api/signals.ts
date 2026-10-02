import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
export const signalsActions = defineActions({
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

    

});
