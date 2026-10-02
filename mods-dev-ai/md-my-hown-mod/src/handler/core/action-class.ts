/**
 * The API-dependency probe.
 *
 * The facts this file used to also hold — class, api, effect, domain — now live in
 * `action-facts.ts`, one record per action. What is left here is the part that cannot
 * be a table: the probe that actually *calls* each action with a spy object and
 * reports what it reached for. That is a measurement, so it stays a function.
 *
 * The label and blurbs maps, and the accessors, are re-exported from `action-facts.ts`
 * so existing importers keep working; new code should import from there directly.
 */

import { ALL_ACTIONS } from "../actions/index.ts";
import {
    ACTION_FACTS,
    type ActionFacts,
    type ActionKey,
    type HandlerActionClass,
} from "./action-facts.ts";

export * from "./action-facts.ts";

export interface ActionDeps {
    payload: boolean;
    extra: boolean;
    ctx: boolean;
    api: boolean;
    threw: boolean;
}

/**
 * Options that let the probe call an action without throwing. Derived from the record,
 * so an action's probe options live with its other facts.
 */
export const VALID_OPTIONS: Record<string, Record<string, unknown>> = Object.fromEntries(
    (Object.entries(ACTION_FACTS) as [ActionKey, ActionFacts][])
        .filter(([, f]) => f.options !== undefined)
        .map(([key, f]) => [key, f.options as Record<string, unknown>]),
);
export function measureActionDeps(key: string): ActionDeps | undefined {
    const def = ALL_ACTIONS[key];
    if (!def) return undefined;
    const fn = def.fn as (...a: unknown[]) => unknown;
    
    
    const secondIsCtx = def.signature === "processing" || def.signature === "modifier";

    const seen: Record<keyof Omit<ActionDeps, "threw">, boolean> = {
        payload: false,
        extra: false,
        ctx: false,
        api: false,
    };

    
    const spy = (label: keyof typeof seen, depth = 0): unknown =>
        new Proxy({} as Record<PropertyKey, unknown>, {
            get(_t, prop) {
                if (typeof prop === "string" && !prop.startsWith("__")) seen[label] = true;
                
                if (prop === "valueOf" || prop === "toString") return () => 1;
                
                
                
                
                
                
                if (prop === Symbol.toPrimitive) return undefined;
                
                
                
                
                if (typeof prop === "symbol") return () => undefined;
                return depth > 2 ? 1 : spy(label, depth + 1);
            },
            set(_t, prop) {
                if (typeof prop === "string" && !prop.startsWith("__")) seen[label] = true;
                return true;
            },
            has() {
                seen[label] = true;
                return false;
            },
            apply: () => () => undefined,
        });

    const g = globalThis as { sandkit?: unknown };
    g.sandkit = { api: spy("api") };
    
    
    
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    let threw = false;
    try {
        
        
        
        
        
        
        if (secondIsCtx) fn(spy("payload"), spy("ctx"), spy("extra"));
        else fn(spy("payload"), spy("extra"), spy("extra"));
        
        
        const valid = VALID_OPTIONS[key];
        if (valid) {
            if (secondIsCtx) fn(spy("payload"), spy("ctx"), valid);
            else fn(spy("payload"), spy("extra"), valid);
        }
    } catch {
        threw = true;
    } finally {
        console.log = log;
        console.warn = warn;
        delete (g as { sandkit?: unknown }).sandkit;
    }
    return { ...seen, threw };
}


export function classFromDeps(d: ActionDeps): HandlerActionClass {
    if (d.api) return "api";
    if (d.ctx) return "context-bound";
    if (d.payload || d.extra) return "self-sufficient";
    return "pure";
}
