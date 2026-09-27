/**
 * The parameter widgets, shared by the two things that let an author type one.
 *
 * Extracted from `action-list-control.ts` because there are now **two** callers:
 * a process row's parameters, and a projectile option's parameters. A number box
 * that behaved slightly differently depending on which screen it was on would be a
 * small, permanent surprise — and the obvious risk with a copy is the two drifting.
 *
 * So there is one definition of each piece, and the kind of control is decided by
 * the declared `HandlerParam.kind` rather than by the caller. Note that
 * `HandlerParam` is used even for projectile options, which have no `HandlerMeta`:
 * a parameter is a key, a label, a kind and a default, and inventing a second shape
 * for it would be the very conflation this module's siblings were split to remove.
 */
import type { HandlerParam } from "../hooks/handler-registry.ts";
import * as S from "./styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;

/** A parameter's current text, from the stored options bag. */
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

/** A parameter's text back into the stored value's type. */
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

/** One parameter input. The same four kinds the Handlers tab's picker uses. */
export function paramInput(
    h: H,
    p: HandlerParam,
    value: string,
    onChange: (v: string) => void,
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
    if (p.kind === "select" && p.options?.length) {
        return h(
            "select",
            { key: p.key, style: { ...S.input, width: 170 }, value, onChange: on },
            h("option", { value: "" }, "— none —"),
            ...p.options.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
        );
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
