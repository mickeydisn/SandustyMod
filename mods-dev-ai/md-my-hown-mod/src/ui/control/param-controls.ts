
import type { HandlerParam } from "../../handler/index.ts";
import type { SelectorHandle } from "../definition/types.ts";
import * as S from "../styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;


export function paramText(
    options: Record<string, unknown> | undefined,
    p: Pick<HandlerParam, "key">,
): string {
    const v = options?.[p.key];
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "boolean") return v ? "true" : "false";
    return String(v);
}


export function paramValue(
    p: Pick<HandlerParam, "key" | "kind" | "int">,
    text: string,
): unknown {
    const t = text.trim();
    if (t === "") return undefined;
    if (p.kind === "number") {
        const n = Number(t);
        return Number.isFinite(n) ? (p.int ? Math.trunc(n) : n) : undefined;
    }
    if (p.kind === "bool") return t === "true";
    return t;
}


export function paramInput(
    h: H,
    p: HandlerParam,
    value: string,
    onChange: (v: string) => void,
    
    selector?: SelectorHandle,
): unknown {
    const on = (e: { target: { value: string } }) => onChange(e.target.value);
    if (p.kind === "number") {
        return h("input", {
            key: p.key,
            type: "number",
            style: { ...S.input, width: 120 },
            value,
            min: p.min,
            max: p.max,
            step: 1,
            placeholder: p.def ?? "",
            title: p.hint ?? "number",
            onChange: on,
        });
    }
    if (p.kind === "bool") {
        return h(
            "select",
            { key: p.key, style: { ...S.input, width: 90 }, value, onChange: on },
            h("option", { value: "true" }, "Yes"),
            h("option", { value: "false" }, "No"),
        );
    }
    if (p.kind === "select" && (p.content || p.options)) {
        
        
        
        
        
        const rendered = selector?.renderParam?.({
            
            
            
            
            
            
            h: h as unknown as (...args: unknown[]) => unknown,
            content: p.content,
            options: p.options ?? [],
            value,
            onChange,
            placeholder: p.required ? "— select —" : "— none —",
            state: selector.read(p.key),
            
            
            onState: (patch) => selector?.write(p.key, patch),
        });
        if (rendered !== null && rendered !== undefined) return rendered;

        
        
        const fixed = p.options ?? [];
        if (fixed.length) {
            return h(
                "select",
                { key: p.key, style: { ...S.input, width: 170 }, value, onChange: on },
                h("option", { value: "" }, "— none —"),
                ...fixed.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
            );
        }
    }
    return h("input", {
        key: p.key,
        style: { ...S.input, width: 140 },
        value,
        placeholder: p.def ?? "",
        title: p.hint ?? p.kind,
        onChange: on,
    });
}
