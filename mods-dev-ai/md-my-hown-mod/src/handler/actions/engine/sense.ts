
import { anchorFor } from "../../engine/cell-region.ts";
import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";



import type { ProcessingContext } from "../api/processors.ts";

export const senseActions = defineActions({
    
    structureInspect: {
        role: "sense",
        doc: "Reports what the clicked structure is, without changing anything.",
        fn: (structure) => {
            const s = structure as Record<string, unknown> | null;
            if (!s) return;
            console.log(
                "[md-my-hown-mod:signal] structure",
                JSON.stringify({ type: s.type, x: s.x, y: s.y, data: s.data }, null, 2),
            );
        },
    },

    
    structureReadData: {
        role: "sense",
        doc: "Reads one key out of the instance's own data bag. Set `key` in options.",
        fn: (payload, _ctx, options) => {
            const key = (options as { key?: unknown } | null)?.key;
            const d = (payload as { data?: Record<string, unknown> } | null)?.data;
            console.log("[md-my-hown-mod:signal] data", key, d?.[String(key)]);
        },
    },

    
    triggerScan: {
        role: "sense",
        doc: "Logs a rectangle of cells around this position. Set `width` / `height` in options.",
        fn: (payload) => {
            const s = payload as { x?: number; y?: number } | null;
            if (!s) return;
            console.log("[md-my-hown-mod:trigger] scan", s.x, s.y);
        },
    },

    
    signalLog: {
        role: "sense",
        doc: "Logs the raw payload. Use to see what a call site actually delivers.",
        fn: (payload, _ctx, extra) => {
            console.log("[md-my-hown-mod:signal]", payload, extra);
        },
    },

    
    triggerLog: {
        role: "sense",
        doc: "Logs the raw payload of a timed tick.",
        fn: (payload, _ctx, extra) => {
            console.log("[md-my-hown-mod:trigger]", payload, extra);
        },
    },
});


export const processingSenseActions = defineActions({
    
    isElementAtCell: {
        role: "sense",
        doc: "fn(dx?, dy?) → true when the offset cell holds `element`. Bind the " +
            "answer with the step's As field, then read it as {{name}}.",
        fn: (structure, context, options) => {
            try {
                const anchor = anchorFor(structure);
                
                
                
                
                
                const readType = (context as ProcessingContext | null)?.getResolvedTypeAtCell ??
                    api.elements.getResolvedTypeAtCell;
                if (anchor.source === "none" || typeof readType !== "function") return false;
                const o = (options ?? {}) as {
                    element?: unknown;
                    dx?: unknown;
                    dy?: unknown;
                };
                const name = String(o.element ?? "");
                if (!name) return false;
                
                
                
                const dx = Number(o.dx ?? 0) || 0;
                const dy = Number(o.dy ?? 0) || 0;
                const found = (readType as (x: number, y: number) => unknown)(
                    anchor.x + dx,
                    anchor.y + dy,
                );
                return found === name;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] isElementAtCell failed", e);
                return false;
            }
        },
    },
});
