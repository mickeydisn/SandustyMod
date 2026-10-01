
import type { ContextSeed } from "./scope-context.ts";

export type { ContextSeed };


export type ContextSeeds = Readonly<Record<string, unknown>>;


export type ProcessVars = Record<string, unknown>;


export interface ProcessContext {
    
    readonly seeds: ContextSeeds;
    
    readonly vars: ProcessVars;
    
    readonly result: { value?: unknown };
}


export const RESULT_VAR = "result";


export type WriteResult =
    | { ok: true }
    | { ok: false; reason: "reserved" | "invalid" };


export function canBind(name: string, ctx: ProcessContext): WriteResult {
    
    
    
    
    if (name in ctx.seeds) return { ok: false, reason: "reserved" };
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return { ok: false, reason: "invalid" };
    }
    return { ok: true };
}


export function varsWrite(ctx: ProcessContext, name: string, value: unknown): WriteResult {
    
    
    
    
    
    if (name === RESULT_VAR) {
        ctx.result.value = value;
        return { ok: true };
    }
    const verdict = canBind(name, ctx);
    if (!verdict.ok) return verdict;
    ctx.vars[name] = value;
    return { ok: true };
}


export function varsRead(ctx: ProcessContext, name: string): unknown {
    if (name === RESULT_VAR) return ctx.result.value;
    if (name in ctx.vars) return ctx.vars[name];
    return Object.hasOwn(ctx.seeds, name) ? ctx.seeds[name] : undefined;
}


export function hasVar(ctx: ProcessContext, name: string): boolean {
    if (name === RESULT_VAR) return true;
    return name in ctx.vars || Object.hasOwn(ctx.seeds, name);
}


export function createContext(seeds: ContextSeeds = {}): ProcessContext {
    return Object.freeze({
        seeds: Object.freeze({ ...seeds }),
        vars: {},
        
        
        
        result: {},
    });
}
