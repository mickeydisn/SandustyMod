
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";

/** Decide actions that reach the host through `api.*`. */
export const decideActions = defineActions({
    
    randomInt: {
        role: "decide",
        doc: "A random whole number from `min` to `max`, inclusive. Set both.",
        fn: (_payload, _ctx, options) => {
            const o = options as { min?: unknown; max?: unknown } | null;
            const lo = Number(o?.min);
            const hi = Number(o?.max);
            if (!Number.isFinite(lo)) return 0;
            if (!Number.isFinite(hi) || hi < lo) return Math.trunc(lo);
            try {
                return api.random.int(Math.trunc(lo), Math.trunc(hi)) ??
                    Math.trunc(lo);
            } catch {
                return Math.trunc(lo);
            }
        },
    },
});
