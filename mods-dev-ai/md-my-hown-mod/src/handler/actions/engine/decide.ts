import { defineActions } from "../../core/types.ts";

function twoSided(options: unknown): { op: string; left: number; right: number } {
    const o = (options ?? {}) as { left?: unknown; op?: unknown; right?: unknown };
    return {
        op: String(o.op ?? ""),
        left: Number(o.left),
        right: Number(o.right),
    };
}

/** Decide actions that need nothing from the host. */
export const engineDecideActions = defineActions({
    
    math: {
        role: "decide",
        doc: "`left op right`, where op is + - * or /. Division rounds to the nearest whole number. Set both values.",
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
        doc: "Compares `left` and `right` with `op`. Answers 1 or 0. Set the options.",
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
        doc: "Always true. Makes an unconditional process explicit.",
        fn: () => undefined,
    },

    
    upgradeScale: {
        role: "decide",
        doc: "Maps a stored value through thresholds. Set `thresholds` in options.",
        fn: (payload, _ctx, options) => {
            const o = options as { thresholds?: number[] } | null;
            const value = (payload as { data?: Record<string, unknown> } | null)?.data
                ?.level;
            const t = o?.thresholds ?? [];
            console.log("[md-my-hown-mod:decide] scale", value, t);
        },
    },
});
