import { ALL_SLOTS } from "../../engine/registry/types.ts";
import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { p } from "../../engine/registry/params.ts";
export const randomActions = defineActions({
    randomInt: {
        role: "decide",
        doc: "A random whole number from `min` to `max`, inclusive. Set both.",
        type: "processor",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("min", "Lowest", "number", {
                required: true,
                def: "0",
                int: true,
                hint: "inclusive",
            }),
            p("max", "Highest", "number", {
                required: true,
                def: "0",
                int: true,
                hint: "inclusive. A max below min answers the min.",
            }),
        ],
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
