import { ALL_SLOTS } from "../../engine/registry/types.ts";

import { defineActions } from "../../engine/types.ts";
import { ensureBufferReady, resetBuffer, zeroFor } from "../../engine/buffer-store.ts";
import type { BufferEntryConfig, BufferValueType } from "../../../constants.ts";
import { p } from "../../engine/registry/params.ts";


type BufferOptions = { path?: string };


let source: (() => BufferEntryConfig[]) | null = null;


export function setBufferSource(fn: () => BufferEntryConfig[]): void {
    source = fn;
    
    
    resetBuffer();
}


function entries(): BufferEntryConfig[] {
    return source?.() ?? [];
}


function typeAt(path: string): BufferValueType | undefined {
    const type = entries().find((b) => b?.path === path)?.type;
    return type === "number" || type === "bool" || type === "string" ? type : undefined;
}


function buffer() {
    return ensureBufferReady(entries());
}

export const bufferActions = defineActions({
    
    bufferRead: {
        role: "remember",
        doc: "Reads a shared buffer slot. Set `path`. Bind the result with `as`.",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
        p("path", "Buffer path", "text", {
        required: true,
        hint: "a path declared in Content → Buffer",
        }),
        ],
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as BufferOptions;
            if (!o.path) return 0;
            const buf = buffer();
            
            
            
            if (!buf) return 0;
            let value: unknown;
            try {
                value = buf.getPath(o.path);
            } catch {
                
                
                return 0;
            }
            
            
            
            
            
            
            
            
            
            if (value === undefined) {
                return zeroFor(typeAt(o.path) ?? "number");
            }
            return value;
        },
    },

    
    bufferWrite: {
        role: "remember",
        doc: "Writes a value to a shared buffer slot. Set `path` and `value`.",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
        p("path", "Buffer path", "text", {
        required: true,
        hint: "a path declared in Content → Buffer",
        }),
        
        p("value", "Value", "text", {
        hint: "a literal, or {{aVariable}} from an earlier step",
        }),
        ],
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as BufferOptions & { value?: unknown };
            if (!o.path) return;
            const buf = buffer();
            if (!buf) return;
            
            
            
            
            
            
            
            
            
            if (typeAt(o.path) === undefined) return;
            try {
                
                
                
                
                if (buf.isCounter(o.path)) {
                    const n = Math.round(Number(o.value));
                    buf.setPath(o.path, Number.isFinite(n) ? n : 0);
                } else {
                    buf.setPath(o.path, o.value);
                }
                
                
                
                buf.commit();
            } catch {
                
                
            }
        },
    },

    
    bufferIncrement: {
        role: "remember",
        doc: "Adds `delta` to a shared counter, clamped. Set `path` and `delta`.",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
        p("path", "Buffer path", "text", {
        required: true,
        hint:
        "a **number** path from Content → Buffer — a bool or string slot is not a counter",
        }),
        
        p("delta", "Amount", "number", { required: true, def: "1", int: true }),
        ],
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as BufferOptions & { delta?: number };
            if (!o.path) return;
            const buf = buffer();
            
            
            
            if (!buf || !buf.isCounter(o.path)) return;
            
            
            
            
            if (typeAt(o.path) === undefined) return;
            const delta = Number(o.delta);
            if (!Number.isInteger(delta)) return;
            try {
                buf.increment(o.path, delta);
                buf.commit();
            } catch {
                
            }
        },
    },
});
