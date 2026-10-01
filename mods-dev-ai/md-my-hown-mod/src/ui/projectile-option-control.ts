
import {
    PROJECTILE_OPTION_DOCS,
    PROJECTILE_OPTIONS,
    projectileOptionKeys,
    projectileOptionParams,
    resolveProjectileOption,
} from "../handler/projectile-option/index.ts";
import type { HandlerParam } from "../handler/core/handler-registry.ts";
import { paramInput, paramText, paramValue } from "./param-controls.ts";
import { OPTIONS_FORM_KEY, PARAMS_FORM_KEY } from "./definition/projectile-option-field.ts";
import * as S from "./styles.ts";
import type { FieldContext } from "./definition/types.ts";
import type { SelectorHandle } from "./definition/types.ts";

type H = FieldContext["h"];


function paramSpecs(key: string): HandlerParam[] {
    return projectileOptionParams(key).map((p) => ({
        key: p.key,
        label: p.key,
        kind: typeof p.def === "boolean" ? "bool" : "number",
        def: String(p.def),
    }));
}


function readParams(text: string | undefined): Record<string, unknown> {
    if (!text?.trim()) return {};
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
        
        
        return {};
    }
}

export function renderProjectileOption(ctx: FieldContext): unknown {
    const { h, form, setField, selector } = ctx;
    const key = form[OPTIONS_FORM_KEY] ?? "";
    const known = !key || PROJECTILE_OPTIONS[key] !== undefined;
    const specs = key && known ? paramSpecs(key) : [];
    const stored = readParams(form[PARAMS_FORM_KEY]);
    
    const preview = key && known ? resolveProjectileOption(key)!(stored) : undefined;

    const setParam = (spec: HandlerParam, text: string) => {
        const next = { ...stored };
        const v = paramValue(spec, text);
        if (v === undefined) delete next[spec.key];
        else next[spec.key] = v;
        setField(PARAMS_FORM_KEY, JSON.stringify(next, null, 2));
    };

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 4 } },
            h(
                "select",
                {
                    key: "opt",
                    style: { ...S.input, cursor: "pointer" },
                    value: key,
                    onChange: (e: { target: { value: string } }) => {
                        
                        
                        
                        
                        
                        setField(OPTIONS_FORM_KEY, e.target.value);
                        setField(PARAMS_FORM_KEY, "");
                    },
                },
                h("option", { value: "" }, "— static options only —"),
                
                
                !known ? h("option", { value: key }, `${key} (unknown)`) : null,
                ...projectileOptionKeys().map((k) => h("option", { key: k, value: k }, k)),
            ),
            h(
                "div",
                { style: S.hint },
                PROJECTILE_OPTION_DOCS[key] ??
                    "A projectile's options come from exactly one function, not a list. " +
                        "Leave this empty to use the static options below.",
            ),
        ),
        
        
        key && known && specs.length === 0
            ? h("div", { style: S.hint }, "This option takes no parameters.")
            : null,
        ...(specs.length > 0 ? [paramRows(h, specs, stored, setParam, selector)] : []),
        preview
            ? h(
                "div",
                { style: S.noteBox },
                h("div", { style: S.label }, "Result"),
                h("div", { style: S.hint }, "What getOptions() will return:"),
                h("pre", { style: S.codeBlock }, JSON.stringify(preview, null, 2)),
            )
            : null,
    );
}


function paramRows(
    h: H,
    specs: HandlerParam[],
    stored: Record<string, unknown>,
    setParam: (spec: HandlerParam, text: string) => void,
    
    selector?: SelectorHandle,
): unknown {
    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 4 } },
        h("span", { style: S.label }, "Parameters"),
        ...specs.map((spec) =>
            h(
                "div",
                { key: spec.key, style: { display: "flex", alignItems: "center", gap: 6 } },
                h("span", { style: { ...S.label, minWidth: 120, fontSize: 11 } }, spec.key),
                paramInput(h, spec, paramText(stored, spec), (v) => setParam(spec, v), selector),
            )
        ),
        h(
            "div",
            { style: S.hint },
            `Defaults: ${JSON.stringify(Object.fromEntries(specs.map((s) => [s.key, s.def])))}`,
        ),
    );
}
