
import { defineActions } from "../../engine/types.ts";


type Data = Record<string, unknown>;


function num(bag: Data | undefined, key: string): number {
    return Number(bag?.[key]) || 0;
}



export const rememberActions = defineActions({
    
    structureWriteData: {
        role: "remember",
        doc: "Writes one key into this instance's saved data. Set `key` / `value` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { key?: string; value?: unknown };
            const s = payload as { data?: Data } | null;
            if (!s || !o.key) return;
            if (!s.data) s.data = {};
            s.data[o.key] = o.value;
        },
    },

    
    triggerTick: {
        role: "remember",
        doc: "Increments this instance's tick counter. Set `key` in options.",
        fn: (payload, _ctx, options) => {
            const key = (options as { key?: string } | null)?.key ?? "ticks";
            const s = payload as { data?: Data } | null;
            if (!s) return;
            if (!s.data) s.data = {};
            s.data[key] = num(s.data, key) + 1;
        },
    },

    
    upgradeCountLevel: {
        role: "remember",
        doc: "Increments a level counter on the upgraded item. Set `key` in options.",
        fn: (payload, _ctx, options) => {
            const key = (options as { key?: string } | null)?.key ?? "mdLevel";
            const s = payload as { data?: Data } | null;
            if (!s) return;
            if (!s.data) s.data = {};
            s.data[key] = num(s.data, key) + 1;
        },
    },

    
    upgradeAdd: {
        role: "remember",
        doc: "Adds `amount` to a numeric field. Set `key` and `amount` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { key?: string; amount?: number };
            if (!o.key) return;
            const s = payload as { data?: Data } | null;
            if (!s) return;
            if (!s.data) s.data = {};
            s.data[o.key] = num(s.data, o.key) + (o.amount ?? 1);
        },
    },
});





export const processingRememberActions = defineActions({
    
    processorCount: {
        role: "remember",
        doc: "Increments a counter on this instance. Set `key` in options.",
        fn: (structure, _context, options) => {
            try {
                const key = (options as { key?: string } | null)?.key ?? "mdTicks";
                const s = structure as { data?: Data } | null;
                if (!s) return;
                if (!s.data) s.data = {};
                s.data[key] = num(s.data, key) + 1;
            } catch (e) {
                console.warn("[md-my-hown-mod:remember] count failed", e);
            }
        },
    },
});
