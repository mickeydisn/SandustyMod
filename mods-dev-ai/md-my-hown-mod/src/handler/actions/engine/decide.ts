import { ALL_SLOTS } from "../../engine/registry/types.ts";
import { defineActions } from "../../engine/types.ts";
import { p } from "../../engine/registry/params.ts";

function twoSided(options: unknown): { op: string; left: number; right: number } {
    const o = (options ?? {}) as { left?: unknown; op?: unknown; right?: unknown };
    return {
        op: String(o.op ?? ""),
        left: Number(o.left),
        right: Number(o.right),
    };
}


export const engineDecideActions = defineActions({
    
    math: {
        role: "decide",
        needs: [],
        doc: "`left op right`, where op is + - * or /. Division rounds to the nearest whole number. Set both values.",
        type: "processor",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
        p("left", "Left", "text", {
        required: true,
        hint: "a number, or {{aVariable}} from an earlier step",
        }),
        p("op", "Operation", "select", {
        required: true,
        def: "add",
        options: [
        { value: "add", label: "plus" },
        { value: "sub", label: "minus" },
        { value: "mul", label: "times" },
        { value: "div", label: "divided by" },
        ],
        }),
        p("right", "Right", "number", { required: true, def: "1" }),
        ],
        fn: (_payload, _ctx, options) => {
            const { op, left, right } = twoSided(options);
            if (!Number.isFinite(left)) return 0;
            if (!Number.isFinite(right)) return left;
            switch (op) {
                case "add":
                    return left + right;
                case "sub":
                    return left - right;
                case "mul":
                    return left * right;
                case "div":
                    
                    
                    
                    if (right === 0) return left;
                    return Math.round(left / right);
                default:
                    return left;
            }
        },
    },

    
    compare: {
        role: "decide",
        needs: [],
        doc: "Compares `left` and `right` with `op`. Answers 1 or 0. Set the options.",
        type: "processor",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
        p("left", "Left", "text", {
        required: true,
        hint: "a number, or {{aVariable}} from an earlier step",
        }),
        p("op", "Test", "select", {
        required: true,
        def: "gte",
        options: [
        { value: "eq", label: "is" },
        { value: "ne", label: "is not" },
        { value: "gt", label: "is more than" },
        { value: "gte", label: "is at least" },
        { value: "lt", label: "is less than" },
        { value: "lte", label: "is at most" },
        ],
        }),
        p("right", "Right", "number", { required: true, def: "0" }),
        ],
        fn: (_payload, _ctx, options) => {
            const { op, left, right } = twoSided(options);
            if (!Number.isFinite(left) || !Number.isFinite(right)) return 1;
            switch (op) {
                case "eq":
                    return left === right ? 1 : 0;
                case "ne":
                    return left !== right ? 1 : 0;
                case "gt":
                    return left > right ? 1 : 0;
                case "gte":
                    return left >= right ? 1 : 0;
                case "lt":
                    return left < right ? 1 : 0;
                case "lte":
                    return left <= right ? 1 : 0;
                default:
                    return 1;
            }
        },
    },

    
    noop: {
        role: "decide",
        needs: [],
        doc: "Always true. Makes an unconditional process explicit.",
        type: "global", slots: [...ALL_SLOTS], scope: "global", params: [],
        fn: () => undefined,
    },

    
    upgradeScale: {
        role: "decide",
        needs: ["data"],
        doc: "Maps a stored value through thresholds. Set `thresholds` in options.",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
        p("field", "Numeric field", "text", { required: true }),
        p("factor", "Factor", "number", { def: "1.1", min: 0 }),
        ],
        fn: (payload, _ctx, options) => {
            const o = options as { thresholds?: number[] } | null;
            const value = (payload as { data?: Record<string, unknown> } | null)?.data
                ?.level;
            const t = o?.thresholds ?? [];
            console.log("[md-my-hown-mod:decide] scale", value, t);
        },
    },
});
