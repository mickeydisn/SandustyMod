
import { actionRefsOf, type HandlerActionRef } from "../../handler/core/process.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";


export const ACTIONS_FORM_KEY = "actionsJson";


export const ACTIONS_STORE_KEY = "actions";


export const ACTIONS_COVERED = [ACTIONS_STORE_KEY];


function oneRef(a: unknown): HandlerActionRef | null {
    
    if (typeof a === "string" && a) return { key: a };
    if (!a || typeof a !== "object") return null;
    const raw = a as Record<string, unknown>;
    if (typeof raw.key !== "string" || !raw.key) return null;
    const ref: HandlerActionRef = { key: raw.key };
    
    
    
    
    if (raw.options && typeof raw.options === "object") {
        ref.options = raw.options as Record<string, unknown>;
    }
    if (typeof raw.as === "string" && raw.as) ref.as = raw.as;
    
    
    if (Array.isArray(raw.then)) {
        const then = parseList(raw.then);
        if (then.length) ref.then = then;
    }
    if (Array.isArray(raw.else)) {
        const otherwise = parseList(raw.else);
        if (otherwise.length) ref.else = otherwise;
    }
    return ref;
}


function parseList(list: unknown): HandlerActionRef[] {
    if (!Array.isArray(list)) return [];
    return list.map(oneRef).filter((a): a is HandlerActionRef => a !== null);
}


export function parseActionRefs(raw: string | undefined): HandlerActionRef[] {
    if (!raw || !raw.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    
    
    
    if (typeof parsed === "string") return [{ key: parsed }];
    return parseList(parsed);
}


function oneToJson(r: HandlerActionRef): Record<string, unknown> {
    const out: Record<string, unknown> = { key: r.key };
    if (r.options) out.options = r.options;
    if (r.as) out.as = r.as;
    if (r.then?.length) out.then = r.then.map(oneToJson);
    if (r.else?.length) out.else = r.else.map(oneToJson);
    return out;
}


export function formatActionRefs(refs: readonly HandlerActionRef[]): string {
    if (!refs.length) return "";
    
    
    
    
    return JSON.stringify(refs.map(oneToJson), null, 2);
}


export function actionRefsToForm(entry: Record<string, unknown> | undefined): string {
    return formatActionRefs(actionRefsOf(entry));
}


export function readActions(
    read: EntryReader,
    entry: Record<string, unknown> | undefined,
): void {
    read.put(ACTIONS_FORM_KEY, actionRefsToForm(entry));
}


export function writeActions(w: EntryWriter, enabled = true): void {
    const refs = enabled ? parseActionRefs(w.opt(ACTIONS_FORM_KEY)) : [];
    if (refs.length > 0) {
        w.setRaw(ACTIONS_STORE_KEY, refs);
    } else {
        w.del(ACTIONS_STORE_KEY);
    }
}


export function actionListField(
    slotLabel: string,
    extra: Partial<FieldSpec> = {},
): FieldSpec {
    return {
        key: ACTIONS_FORM_KEY,
        label: "Process",
        kind: "actionList",
        section: "Timing",
        jsonType: "array",
        wide: true,
        hint: `an ordered list of actions, run in order when the engine calls this. ` +
            `${slotLabel}. Each action may be repeated with different options. ` +
            `An entry of { "key": "if", "options": { "var": "name" }, "then": [...], ` +
            `"else": [...] } branches on whether a bound variable is true.`,
        ...extra,
    };
}
