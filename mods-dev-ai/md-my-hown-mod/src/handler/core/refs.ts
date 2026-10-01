
import { hasVar, type ProcessContext, varsRead } from "./context.ts";


export interface RefFailure {
    
    step: string;
    
    name: string;
}


export interface ResolvedRefs<T> {
    
    value: T;
    
    problems: RefFailure[];
}


const REF = /\{\{\s*([^{}]+?)\s*\}\}/g;


function wholeRef(text: string): string | null {
    const m = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(text);
    return m ? m[1].trim() : null;
}


function resolveText(
    ctx: ProcessContext,
    text: string,
    step: string,
    problems: RefFailure[],
): unknown {
    const alone = wholeRef(text);
    if (alone !== null) {
        if (!hasVar(ctx, alone)) {
            problems.push({ step, name: alone });
            return undefined;
        }
        return varsRead(ctx, alone);
    }

    
    
    
    if (!text.includes("{{")) return text;

    return text.replace(REF, (whole, raw: string) => {
        const name = raw.trim();
        if (!hasVar(ctx, name)) {
            problems.push({ step, name });
            
            
            return whole;
        }
        const v = varsRead(ctx, name);
        return v === undefined || v === null ? "" : String(v);
    });
}


function resolveAny(
    ctx: ProcessContext,
    value: unknown,
    step: string,
    problems: RefFailure[],
): unknown {
    if (typeof value === "string") return resolveText(ctx, value, step, problems);
    if (Array.isArray(value)) return value.map((v) => resolveAny(ctx, v, step, problems));
    
    
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = resolveAny(ctx, v, step, problems);
        }
        return out;
    }
    return value;
}


export function resolveRefs(
    options: Record<string, unknown> | undefined,
    ctx: ProcessContext,
    step: string,
): ResolvedRefs<Record<string, unknown>> {
    const problems: RefFailure[] = [];
    if (!options) return { value: {}, problems };

    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(options)) {
        const resolved = resolveAny(ctx, raw, step, problems);
        
        
        if (resolved === undefined) continue;
        out[key] = resolved;
    }
    return { value: out, problems };
}


export function refsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
    if (typeof value === "string") {
        for (const m of value.matchAll(REF)) into.add(m[1].trim());
    } else if (Array.isArray(value)) {
        for (const v of value) refsIn(v, into);
    } else if (value !== null && typeof value === "object") {
        
        
        for (const v of Object.values(value as Record<string, unknown>)) refsIn(v, into);
    }
    return into;
}
