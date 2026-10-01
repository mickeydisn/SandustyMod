
import { actionClassOf } from "../handler/core/action-class.ts";
import {
    HANDLER_META,
    type HandlerMeta,
    type HandlerParam,
    TAB_TO_CALL_SITE,
} from "../handler/core/handler-registry.ts";
import { ACTIONS_FORM_KEY, formatActionRefs, parseActionRefs } from "./definition/actions-field.ts";
import { BLOCK_KEY, type HandlerActionRef } from "../handler/core/types.ts";
import type { FieldContext, Tab } from "./definition/types.ts";
import * as S from "./styles.ts";
import { paramInput, paramText, paramValue } from "./param-controls.ts";

type H = FieldContext["h"];

const metaOf = (key: string): HandlerMeta | undefined => HANDLER_META.find((m) => m.key === key);



const BLOCK_LABEL = "if … then … else";

const BLOCK_PARAMS: HandlerParam[] = [
    {
        key: "var",
        label: "When variable is true",
        kind: "text",
        required: true,
        hint: "the name a step bound with As. Falsy — including unbound — runs the else branch.",
    },
];


function allowedFor(tab: Tab): HandlerMeta[] {
    const slot = TAB_TO_CALL_SITE[tab as string];
    if (!slot) return HANDLER_META;
    return HANDLER_META.filter((m) => m.slots.includes(slot as never));
}


function moved(
    refs: { key: string; options?: Record<string, unknown> }[],
    from: number,
    to: number,
): { key: string; options?: Record<string, unknown> }[] {
    if (to < 0 || to >= refs.length) return refs;
    const next = [...refs];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    return next;
}

export function renderActionList(ctx: FieldContext): unknown {
    const { h, form, setField, tab, selector } = ctx;
    const refs = parseActionRefs(form[ACTIONS_FORM_KEY]);
    const allowed = allowedFor(tab);
    const write = (next: { key: string; options?: Record<string, unknown> }[]) =>
        setField(ACTIONS_FORM_KEY, formatActionRefs(next));

    
    const label = (key: string) => {
        const cls = actionClassOf(key);
        return cls && cls !== "api" ? `${key} · ${cls}` : key;
    };

    
    const branchEditor = (
        branch: "then" | "else",
        steps: HandlerActionRef[],
        setBranch: (branch: "then" | "else", steps: HandlerActionRef[]) => void,
    ) => h(
        "div",
        {
            key: branch,
            style: { display: "flex", alignItems: "center", gap: 6 },
        },
        h(
            "span",
            { style: { ...S.label, minWidth: 48, fontSize: 11 } },
            branch,
        ),
        h(
            "select",
            {
                key: `add:${branch}`,
                style: { ...S.input, flex: 1, minWidth: 120, cursor: "pointer" },
                value: "",
                disabled: allowed.length === 0,
                onChange: (e: { target: { value: string } }) => {
                    if (e.target.value) {
                        setBranch(branch, [
                            ...steps,
                            { key: e.target.value } as HandlerActionRef,
                        ]);
                    }
                },
            },
            h(
                "option",
                { value: "" },
                allowed.length ? "— add a step —" : "no actions for this call site",
            ),
            ...allowed.map((m) =>
                h("option", { key: `${branch}:${m.key}`, value: m.key }, label(m.key))
            ),
        ),
        h(
            "span",
            { style: S.hint },
            steps.length ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : "empty",
        ),
    );

    const rows = refs.map((ref, i) => {
        
        
        
        const isBlockRow = ref.key === BLOCK_KEY;
        const meta = metaOf(ref.key);
        
        
        
        
        const usable = isBlockRow || !meta || allowed.some((m) => m.key === ref.key);
        const params = isBlockRow ? BLOCK_PARAMS : (meta?.params ?? []);
        
        
        
        
        const setKey = (k: string) =>
            write(
                refs.map((r, j) => {
                    if (j !== i) return r;
                    const becoming = k === BLOCK_KEY;
                    const was = r.key === BLOCK_KEY;
                    if (becoming === was) return { ...r, key: k };
                    const opts = { ...(r.options ?? {}) };
                    if (becoming) {
                        delete opts.var;
                        opts.then = [];
                        opts.else = [];
                    } else {
                        delete opts.then;
                        delete opts.else;
                        delete opts.var;
                    }
                    return { ...r, key: k, options: opts };
                }),
            );
        const setParam = (p: HandlerParam, text: string) => {
            const opts = { ...(ref.options ?? {}) };
            const v = paramValue(p, text);
            if (v === undefined) delete opts[p.key];
            else opts[p.key] = v;
            write(refs.map((r, j) => (j === i ? { ...r, options: opts } : r)));
        };
        
        
        
        
        const setBranch = (branch: "then" | "else", steps: HandlerActionRef[]) => {
            const next = refs.map((r, j) => {
                if (j !== i) return r;
                const opts = { ...(r.options ?? {}) };
                if (steps.length) opts[branch] = steps;
                else delete opts[branch];
                return { ...r, options: opts };
            });
            write(next);
        };

        return h(
            "div",
            {
                key: `row:${i}`,
                style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: 6,
                    marginBottom: 6,
                    border: `1px solid ${usable ? "#3a3f4b" : "#7a3030"}`,
                    borderRadius: 4,
                },
            },
            h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 6 } },
                h(
                    "select",
                    {
                        key: "key",
                        style: { ...S.input, flex: 1, minWidth: 150, cursor: "pointer" },
                        value: ref.key,
                        onChange: (e: { target: { value: string } }) => setKey(e.target.value),
                    },
                    
                    
                    allowed.some((m) => m.key === ref.key) && !isBlockRow ? null : h(
                        "option",
                        { value: ref.key },
                        isBlockRow ? BLOCK_LABEL : label(ref.key),
                    ),
                    h(
                        "option",
                        { key: BLOCK_KEY, value: BLOCK_KEY },
                        BLOCK_LABEL,
                    ),
                    ...allowed.map((m) => h("option", { key: m.key, value: m.key }, label(m.key))),
                ),
                h("button", {
                    key: "up",
                    style: S.chip,
                    disabled: i === 0,
                    onClick: () => write(moved(refs, i, i - 1)),
                }, "↑"),
                h("button", {
                    key: "down",
                    style: S.chip,
                    disabled: i === refs.length - 1,
                    onClick: () => write(moved(refs, i, i + 1)),
                }, "↓"),
                h("button", {
                    key: "del",
                    style: S.chip,
                    onClick: () => write(refs.filter((_, j) => j !== i)),
                }, "✕"),
            ),
            params.length
                ? h(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
                    ...params.map((p) =>
                        h(
                            "div",
                            {
                                key: p.key,
                                style: { display: "flex", alignItems: "center", gap: 4 },
                            },
                            h(
                                "span",
                                { style: { ...S.label, minWidth: 96, fontSize: 11 } },
                                p.label + (p.required ? " *" : ""),
                            ),
                            paramInput(
                                h,
                                p,
                                paramText(ref.options, p),
                                (v) => setParam(p, v),
                                selector,
                            ),
                        )
                    ),
                )
                : null,
            
            
            
            
            isBlockRow
                ? h(
                    "div",
                    {
                        style: {
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: 6,
                            borderLeft: "2px solid #3a3f4b",
                            marginLeft: 4,
                        },
                    },
                    ...(["then", "else"] as const).map((branch) =>
                        branchEditor(
                            branch,
                            ((ref.options ?? {})[branch] as HandlerActionRef[]) ?? [],
                            setBranch,
                        )
                    ),
                )
                : null,
        );
    });

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        ...rows,
        h(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            
            
            
            
            
            
            h(
                "select",
                {
                    key: "add",
                    style: {
                        ...S.input,
                        width: 220,
                        cursor: allowed.length ? "pointer" : "default",
                    },
                    value: "",
                    
                    
                    disabled: allowed.length === 0,
                    onChange: (e: { target: { value: string } }) => {
                        if (!e.target.value) return;
                        write([
                            ...refs,
                            e.target.value === BLOCK_KEY
                                
                                
                                
                                ? { key: BLOCK_KEY, options: { then: [], else: [] } }
                                : { key: e.target.value },
                        ]);
                    },
                },
                h(
                    "option",
                    { value: "" },
                    allowed.length ? "— add an action —" : "no actions for this call site",
                ),
                
                
                
                h("option", { key: BLOCK_KEY, value: BLOCK_KEY }, BLOCK_LABEL),
                ...allowed.map((m) => h("option", { key: m.key, value: m.key }, label(m.key))),
            ),
            h(
                "span",
                { key: "count", style: S.hint },
                `${refs.length} action${refs.length === 1 ? "" : "s"}, run in order`,
            ),
        ),
    );
}
