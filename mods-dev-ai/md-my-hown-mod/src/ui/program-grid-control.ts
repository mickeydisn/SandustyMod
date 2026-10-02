
import {
    BLOCK_META,
    HANDLER_META,
    type HandlerMeta,
    type HandlerParam,
    type HandlerSlot,
} from "../handler/index.ts";
import { scopeSeedNames } from "../handler/index.ts";
import { refsIn } from "../handler/index.ts";
import { canBind, createContext } from "../handler/index.ts";
import { ACTION_ROLES, isBlock, ROLE_LABELS } from "../handler/index.ts";
import { ACTION_DOCS, ALL_ACTIONS } from "../handler/index.ts";
import { currentProcessRegistry, type ProcessStep } from "../handler/processing/custom-process/index.ts";
import { paramInput } from "./param-controls.ts";
import * as S from "./styles.ts";
import type { FieldContext } from "./definition/types.ts";
import type { SelectorHandle } from "./definition/types.ts";


export const STEPS_FORM_KEY = "program";


export const STEPS_JSON_KEY = `${STEPS_FORM_KEY}__json`;

type H = FieldContext["h"];


export interface ContextRow {
    name: string;
    
    from: string;
    
    seed: boolean;
    
    writtenBy?: number;
    
    readBy: number[];
}


export function deriveContext(scope: string, steps: readonly ProcessStep[]): ContextRow[] {
    const rows = new Map<string, ContextRow>();
    
    
    const seeds = createContext(
        Object.fromEntries(scopeSeedNames(scope as never).map((n) => [n, undefined])),
    );
    for (const name of scopeSeedNames(scope as never)) {
        rows.set(name, { name, from: SCOPE_FROM[name] ?? "the engine", seed: true, readBy: [] });
    }

    
    
    
    
    
    
    
    
    
    let position = 0;
    const walk = (list: readonly ProcessStep[]): void => {
        for (const step of list) {
            const i = position++;
            if (step.as) {
                const allowed = canBind(step.as, seeds);
                rows.set(step.as, {
                    name: step.as,
                    from: allowed.ok ? `step ${i + 1} binds it` : allowed.reason,
                    seed: false,
                    writtenBy: i,
                    readBy: [],
                });
            }
            for (const ref of refsIn(step.options)) {
                const existing = rows.get(ref);
                if (existing) {
                    if (!existing.readBy.includes(i)) existing.readBy.push(i);
                } else {
                    
                    
                    rows.set(ref, {
                        name: ref,
                        from: "referenced, never bound",
                        seed: false,
                        readBy: [i],
                    });
                }
            }
            walk(step.then ?? []);
            walk(step.else ?? []);
        }
    };
    walk(steps);
    return [...rows.values()];
}


const SCOPE_FROM: Record<string, string> = {
    "structure.x": "the structure's cell X",
    "structure.y": "the structure's cell Y",
    "structure.type": "the structure's type",
    "structure.data": "the structure's data bag",
    "context.getResolvedTypeAtCell": "fn(x, y) → type at a cell",
    "context.isCellEmptyAtCell": "fn(x, y) → is the cell empty",
    "context.commit": "fn(changes) → write to the grid",
    "state.x": "the item's cell X",
    "state.y": "the item's cell Y",
    "action.type": "the action being used",
    args: "the intercepted arguments",
    ctx: "the hook's context",
    "item.type": "the upgraded item's type",
    key: "the key pressed",
};


function readSteps(text: string | undefined): ProcessStep[] {
    if (!text?.trim()) return [];
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((s) => s && typeof s.key === "string") as ProcessStep[];
    } catch {
        
        
        return [];
    }
}


function writeSteps(steps: readonly ProcessStep[]): string {
    return steps.length ? JSON.stringify(steps, null, 2) : "";
}


function canRunHere(meta: HandlerMeta, scope: string): boolean {
    return meta.slots.includes(scope as HandlerSlot);
}


export function stepChoices(scope: string): { role: string; label: string; keys: string[] }[] {
    
    
    
    
    const blockGroup = {
        role: "decide",
        label: "Decisions",
        keys: [BLOCK_META.key],
    };
    return [
        blockGroup,
        ...ACTION_ROLES.map((role) => {
            return {
                role,
                label: ROLE_LABELS[role],
                
                
                
                
                
                keys: HANDLER_META
                    .filter((m) => ALL_ACTIONS[m.key]?.role === role && canRunHere(m, scope))
                    .map((m) => m.key)
                    .sort(),
            };
        }).filter((g) => g.keys.length > 0),
    ];
}


function paramsOf(key: string): HandlerParam[] {
    if (isBlockKey(key)) return BLOCK_META.params;
    return HANDLER_META.find((m) => m.key === key)?.params ?? [];
}


function isBlockKey(key: string): boolean {
    return isBlock({ key });
}




function summarize(step: ProcessStep): string {
    const options = (step.options ?? {}) as Record<string, unknown>;
    const specs = paramsOf(step.key);
    const declared = new Set(specs.map((s) => s.key));
    const parts: string[] = [];
    for (const spec of specs) {
        const raw = options[spec.key];
        if (raw === undefined) {
            parts.push(`${spec.key} —`);
        } else if (typeof raw === "boolean") {
            if (raw) parts.push(spec.key);
        } else {
            parts.push(`${spec.key}: ${String(raw)}`);
        }
    }
    for (const [k, v] of Object.entries(options)) {
        if (declared.has(k)) continue;
        parts.push(`${k}: ${String(v)}`);
    }
    if (step.as) parts.push(`→ ${step.as}`);
    return parts.join("   ");
}


const EXPANDED: Map<string, Set<string>> = new Map();


function expandedFor(processId: string): Set<string> {
    const id = processId || "(new)";
    let set = EXPANDED.get(id);
    if (!set) {
        set = new Set();
        EXPANDED.set(id, set);
    }
    return set;
}


function branchPath(path: string, which: "then" | "else"): string {
    return `${path}/${which}/`;
}


function allPaths(list: readonly ProcessStep[], prefix: string): string[] {
    const out: string[] = [];
    list.forEach((step, i) => {
        const at = `${prefix}${i}`;
        out.push(at);
        out.push(...allPaths(step.then ?? [], branchPath(at, "then")));
        out.push(...allPaths(step.else ?? [], branchPath(at, "else")));
    });
    return out;
}


const SUMMARY = { fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace" } as const;


function rowControls(
    h: H,
    args: {
        index: number;
        total: number;
        locked: boolean;
        move: (by: number) => void;
        remove: () => void;
        
        toggle?: (() => void) | null;
    },
): unknown[] {
    const chip = (
        label: string,
        title: string,
        disabled: boolean,
        onClick: () => void,
        red = false,
    ) => h(
        "button",
        {
            style: { ...S.chip, padding: "0 5px", ...(red ? { color: "#c0392b" } : {}) },
            disabled,
            onClick,
            title,
        },
        label,
    );
    return [
        chip("↑", "Move up", args.locked || args.index === 0, () => args.move(-1)),
        chip(
            "↓",
            "Move down",
            args.locked || args.index === args.total - 1,
            () => args.move(1),
        ),
        
        args.toggle ? chip("Edit", "Edit this step", args.locked, args.toggle) : null,
        chip("×", "Delete this step", args.locked, args.remove, true),
    ];
}


function summaryRow(h: H, step: ProcessStep, index: number, args: {
    locked: boolean;
    toggle: () => void;
    move: (by: number) => void;
    remove: () => void;
    total: number;
}): unknown {
    const known = HANDLER_META.some((m) => m.key === step.key) || isBlockKey(step.key);
    const label = isBlockKey(step.key) ? "if" : step.key;
    return h(
        "div",
        {
            style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "1px 2px",
                borderRadius: 3,
            },
        },
        h("span", { style: { ...S.label, minWidth: 18, fontSize: 10 } }, `${index + 1}`),
        h(
            "span",
            {
                style: {
                    ...SUMMARY,
                    color: isBlockKey(step.key) ? "#27ae60" : known ? "#e6e6e6" : "#e0a458",
                    fontWeight: 600,
                    minWidth: 88,
                },
                
                
                title: ACTION_DOCS[step.key] ?? "",
            },
            label,
        ),
        h(
            "span",
            {
                style: {
                    ...SUMMARY,
                    color: "#9aa0a6",
                    flex: 1,
                    
                    
                    
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                },
            },
            summarize(step),
        ),
        
        
        ...rowControls(h, {
            index,
            total: args.total,
            locked: args.locked,
            move: args.move,
            remove: args.remove,
            toggle: args.toggle,
        }),
    );
}



function stepRow(h: H, args: {
    step: ProcessStep;
    index: number;
    total: number;
    scope: string;
    choices: { role: string; label: string; keys: string[] }[];
    nestable: string[];
    known: string[];
    locked: boolean;
    selector?: SelectorHandle;
    replace: (step: ProcessStep) => void;
    move: (by: number) => void;
    remove: () => void;
    branches?: (step: ProcessStep) => unknown;
    
    open: boolean;
    toggle: () => void;
}): unknown {
    const body = args.open ? editRow(h, args) : summaryRow(h, args.step, args.index, {
        locked: args.locked,
        toggle: args.toggle,
        move: args.move,
        remove: args.remove,
        total: args.total,
    });
    return h(
        "div",
        { key: `step:${args.index}`, style: { display: "flex", flexDirection: "column", gap: 3 } },
        body,
        
        
        
        
        args.branches ? args.branches(args.step) : null,
    );
}


function editRow(
    h: H,
    args: {
        step: ProcessStep;
        index: number;
        total: number;
        choices: { role: string; label: string; keys: string[] }[];
        nestable: string[];
        known: string[];
        locked: boolean;
        selector?: SelectorHandle;
        replace: (step: ProcessStep) => void;
        move: (by: number) => void;
        remove: () => void;
    },
): unknown {
    const { step, index, total, choices, nestable, known, locked } = args;
    const specs = paramsOf(step.key);
    const all = [...choices.flatMap((g) => g.keys), ...nestable];
    const options = (step.options ?? {}) as Record<string, unknown>;

    return h(
        "div",
        {
            style: { ...S.card, display: "flex", flexDirection: "column", gap: 6, padding: 8 },
        },
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("span", { style: S.label }, `${index + 1}`),
            h(
                "select",
                {
                    style: { ...S.input, flex: 1, cursor: locked ? "default" : "pointer" },
                    value: step.key,
                    disabled: locked,
                    onChange: (e: { target: { value: string } }) => {
                        
                        
                        
                        args.replace({ key: e.target.value });
                    },
                },
                ...choices.map((g) =>
                    h(
                        "optgroup",
                        { key: g.role, label: g.label },
                        ...g.keys.map((k) => h("option", { key: k, value: k }, k)),
                    )
                ),
                
                nestable.length
                    ? h(
                        "optgroup",
                        { key: "__nest", label: "Another process" },
                        ...nestable.map((id) => h("option", { key: id, value: id }, id)),
                    )
                    : null,
                
                
                !all.includes(step.key)
                    ? h("option", { value: step.key }, `${step.key} (unknown)`)
                    : null,
            ),
            
            
            
            ...rowControls(h, {
                index,
                total,
                locked,
                move: args.move,
                remove: args.remove,
            }),
        ),
        h("div", { style: S.hint }, ACTION_DOCS[step.key] ?? ""),
        ...specs.map((spec) =>
            h(
                "div",
                { key: spec.key, style: { display: "flex", alignItems: "center", gap: 6 } },
                h("span", { style: { ...S.label, minWidth: 110, fontSize: 11 } }, spec.label),
                paramInput(h, spec, String(options[spec.key] ?? ""), (v) => {
                    const next = { ...options };
                    if (v === undefined) delete next[spec.key];
                    else next[spec.key] = v;
                    args.replace(withOptions(step, next));
                }, args.selector),
            )
        ),
        
        
        
        known.length || step.as
            ? h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 6 } },
                h("span", { style: { ...S.label, minWidth: 110, fontSize: 11 } }, "As"),
                h("input", {
                    style: { ...S.input, flex: 1 },
                    value: step.as ?? "",
                    disabled: locked,
                    placeholder: "bind this step's result to a name",
                    onInput: (e: { currentTarget: { value: string } }) => {
                        
                        
                        args.replace(withAs(step, e.currentTarget.value.trim()));
                    },
                }),
                h(
                    "span",
                    { style: S.hint },
                    step.as ? `read it anywhere as {{${step.as}}}` : "then read it as {{name}}",
                ),
            )
            : null,
    );
}


const BRANCH_STYLE = {
    then: { borderLeft: "2px solid #27ae60", paddingLeft: 8, color: "#27ae60" },
    else: { borderLeft: "2px solid #7f8c8d", paddingLeft: 8, color: "#7f8c8d" },
} as const;


function withOptions(step: ProcessStep, options: Record<string, unknown>): ProcessStep {
    const next: ProcessStep = { ...step, options };
    if (Object.keys(options).length) next.options = options;
    else delete next.options;
    return next;
}


function withAs(step: ProcessStep, as: string): ProcessStep {
    const next: ProcessStep = { ...step };
    if (as) next.as = as;
    else delete next.as;
    return next;
}


function withBranch(
    step: ProcessStep,
    which: "then" | "else",
    branch: ProcessStep[],
): ProcessStep {
    const next: ProcessStep = { ...step };
    next[which] = branch;
    return next;
}

function contextList(ctx: FieldContext, scope: string, steps: ProcessStep[]): unknown {
    const { h } = ctx;
    const rows = deriveContext(scope, steps);
    const seeds = rows.filter((r) => r.seed);
    const vars = rows.filter((r) => !r.seed);
    if (rows.length === 0) {
        return h(
            "div",
            { style: S.hint },
            scope === "trigger"
                ? "A trigger is called with no arguments, so it has nothing to name. Its " +
                    "steps share values through the variables below instead."
                : "Pick a scope to see what this process can name.",
        );
    }
    const line = (r: ContextRow): unknown =>
        h(
            "div",
            {
                key: r.name,
                style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    padding: "2px 0",
                },
            },
            h("code", { style: S.codeKey }, `{{${r.name}}}`),
            h("span", { style: { ...S.hint, flex: 1 } }, r.from),
            r.seed ? h("span", { style: S.tagChip }, "read-only") : h(
                "span",
                { style: { ...S.tagChip, borderColor: "#4caf50" } },
                r.from.startsWith("referenced") ? "never bound" : `step ${(r.writtenBy ?? 0) + 1}`,
            ),
            r.readBy.length
                ? h("span", { style: S.hint }, `read by ${r.readBy.map((n) => n + 1).join(", ")}`)
                : null,
        );

    return h(
        "div",
        { style: { ...S.card, display: "flex", flexDirection: "column", gap: 2 } },
        h("div", { style: S.label }, "Context"),
        h(
            "div",
            { style: S.hint },
            "Derived from the scope and the steps below — not stored, so it cannot go " +
                "stale. Anything a step reads is listed even if nothing writes it.",
        ),
        ...seeds.map(line),
        seeds.length && vars.length
            ? h("div", { style: { ...S.sectionTitle, marginTop: 6 } }, "Variables")
            : null,
        ...vars.map(line),
        vars.length === 0 && seeds.length
            ? h(
                "div",
                { style: S.hint },
                "No variables yet — a step's As box writes one, and any other step can " +
                    "then read it.",
            )
            : null,
    );
}


export function renderProgramGrid(ctx: FieldContext): unknown {
    const { h, form, setField, error, locked } = ctx;
    const scope = form.scope ?? "";
    const steps = readSteps(form[STEPS_JSON_KEY]);
    const choices = scope ? stepChoices(scope) : [];
    const registry = currentProcessRegistry();
    
    const known = deriveContext(scope, steps).map((r) => r.name);
    
    
    const nestable = scope
        ? registry.forSlot(scope as HandlerSlot)
            .filter((p) => p.id !== form.id)
            .map((p) => p.id)
        : [];

    
    
    const openRows = expandedFor(form.id ?? "");

    const commit = (next: ProcessStep[]): void => setField(STEPS_JSON_KEY, writeSteps(next));
    const replace = (index: number, step: ProcessStep): void => {
        const next = [...steps];
        next[index] = step;
        commit(next);
    };
    const move = (index: number, by: number): void => {
        const to = index + by;
        if (to < 0 || to >= steps.length) return;
        const next = [...steps];
        const [row] = next.splice(index, 1);
        next.splice(to, 0, row);
        commit(next);
    };

    
    const stepList = (
        list: readonly ProcessStep[],
        depth: number,
        path: string,
        write: (next: ProcessStep[]) => void,
    ): unknown =>
        h(
            "div",
            {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    
                    
                    marginLeft: depth ? 12 : 0,
                },
            },
            ...list.map((step, i) => {
                const at = `${path}${i}`;
                return stepRow(h, {
                    step,
                    index: i,
                    total: list.length,
                    scope,
                    choices,
                    nestable,
                    known,
                    locked,
                    selector: ctx.selector,
                    open: openRows.has(at),
                    toggle: () => {
                        if (openRows.has(at)) openRows.delete(at);
                        else openRows.add(at);
                        
                        
                        
                        commit([...steps]);
                    },
                    replace: (s) => {
                        const next = [...list];
                        next[i] = s;
                        write(next);
                    },
                    move: (by) => {
                        const to = i + by;
                        if (to < 0 || to >= list.length) return;
                        const next = [...list];
                        const [row] = next.splice(i, 1);
                        next.splice(to, 0, row);
                        write(next);
                    },
                    remove: () => write(list.filter((_, n) => n !== i)),
                    branches: isBlockKey(step.key)
                        ? (s) => renderBranches(s, depth, at)
                        : undefined,
                });
            }),
            h(
                "button",
                {
                    style: { ...S.chip, alignSelf: "flex-start" },
                    disabled: locked,
                    onClick: () => write([...list, { key: seedKey(choices, nestable) }]),
                },
                "+ step",
            ),
        );

    
    const renderBranches = (
        step: ProcessStep,
        depth: number,
        at: string,
    ): unknown =>
        h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 2 } },
            ...(["then", "else"] as const).map((which) =>
                h(
                    "div",
                    { key: which, style: { display: "flex", flexDirection: "column", gap: 2 } },
                    h(
                        "div",
                        { style: { ...S.hint, ...BRANCH_STYLE[which] } },
                        which === "then" ? "when true" : "when false",
                    ),
                    stepList(
                        step[which] ?? [],
                        depth + 1,
                        branchPath(at, which),
                        (next) => replaceAt(step, which, next),
                    ),
                )
            ),
        );

    
    const replaceAt = (
        target: ProcessStep,
        which: "then" | "else",
        branch: ProcessStep[],
    ): void => {
        const rewrite = (list: ProcessStep[]): ProcessStep[] =>
            list.map((s) => {
                if (s === target) return withBranch(s, which, branch);
                if (!isBlockKey(s.key)) return s;
                
                
                
                
                let next = withBranch(s, "then", rewrite(s.then ?? []));
                if (s.else) next = withBranch(next, "else", rewrite(s.else));
                return next;
            });
        commit(rewrite(steps));
    };

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        contextList(ctx, scope, steps),
        scope
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 4 } },
                h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 6 } },
                    h("div", { style: S.label }, "Steps"),
                    
                    
                    
                    h(
                        "button",
                        {
                            style: { ...S.chip, marginLeft: "auto" },
                            disabled: locked,
                            onClick: () => {
                                openRows.clear();
                                allPaths(steps, "").forEach((p) => openRows.add(p));
                                commit([...steps]);
                            },
                        },
                        "Expand all",
                    ),
                    h(
                        "button",
                        {
                            style: S.chip,
                            disabled: locked,
                            onClick: () => {
                                openRows.clear();
                                commit([...steps]);
                            },
                        },
                        "Collapse all",
                    ),
                ),
                stepList(steps, 0, "", commit),
            )
            : h(
                "div",
                { style: S.hint },
                "Pick a scope first — it decides which steps you can add.",
            ),
        
        
        
        
        error ? h("div", { style: S.errorText }, error) : null,
    );
}


function seedKey(
    choices: { keys: string[] }[],
    nestable: string[],
): string {
    return choices[0]?.keys[0] ?? nestable[0] ?? "noop";
}
