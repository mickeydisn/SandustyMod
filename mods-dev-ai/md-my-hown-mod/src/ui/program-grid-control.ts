/**
 * The `program` control: a process's **context list** and its **step grid**.
 *
 * Two halves, drawn together, because they are computed from each other. The context
 * list is not a field the author maintains — it is *derived*, on every render, from
 * the selected scope and the current steps:
 *
 * - the **seeds** come from `SCOPE_CONTEXT[scope]`, so they are exactly what the
 *   engine really hands this call site (and `trigger` honestly shows nothing);
 * - the **variables** come from each step's `as`, plus every `{{name}}` any step's
 *   params refer to.
 *
 * Deriving rather than storing is the whole reason the list cannot go stale. A
 * stored context would survive an edit that removed its only writer, and the author
 * would wire a parameter to a variable nothing produces — the exact bug the
 * `resolveRefs` error path exists to catch, shown to them *before* they save.
 *
 * ## The grid
 *
 * Each row is one step: an action picker, that action's declared params, and the `as`
 * binding. Reordering is by two buttons rather than drag-and-drop, because the row is
 * already a form and a drag handle inside one is a second, conflicting interaction.
 */
import {
    BLOCK_META,
    HANDLER_META,
    type HandlerMeta,
    type HandlerParam,
    type HandlerSlot,
} from "../handler/core/handler-registry.ts";
import { scopeSeedNames } from "../handler/core/scope-context.ts";
import { refsIn } from "../handler/core/refs.ts";
import { canBind, createContext } from "../handler/core/context.ts";
import { ACTION_ROLES, isBlock, ROLE_LABELS } from "../handler/core/types.ts";
import { ACTION_DOCS, ALL_ACTIONS } from "../handler/actions/index.ts";
import { currentProcessRegistry, type ProcessStep } from "../handler/custom-process/index.ts";
import { paramInput } from "./param-controls.ts";
import * as S from "./styles.ts";
import type { FieldContext } from "./definition/types.ts";
import type { SelectorHandle } from "./definition/types.ts";

/** The form key the grid owns. The steps also live in a hidden json field. */
export const STEPS_FORM_KEY = "program";

/** The hidden json field that actually stores the steps. */
export const STEPS_JSON_KEY = `${STEPS_FORM_KEY}__json`;

type H = FieldContext["h"];

/** One name in the derived context list. */
export interface ContextRow {
    name: string;
    /** Where it comes from, in one line. */
    from: string;
    /** A seed cannot be rebound; a variable can. */
    seed: boolean;
    /** The step index that writes it, for a variable. */
    writtenBy?: number;
    /** The step indices that read it. */
    readBy: number[];
}

/**
 * The context, derived from a scope and a step list.
 *
 * **Pure**, and exported for the test that says a stale context is impossible. The
 * ordering is deliberate: seeds in the table's own order, then variables in the order
 * they are first written, so a reader can follow the program top to bottom.
 */
export function deriveContext(scope: string, steps: readonly ProcessStep[]): ContextRow[] {
    const rows = new Map<string, ContextRow>();
    // The seeds, with a real context so `canBind` answers the truth about which names
    // are reserved. A fake seed list would let a variable shadow `structure.x`.
    const seeds = createContext(
        Object.fromEntries(scopeSeedNames(scope as never).map((n) => [n, undefined])),
    );
    for (const name of scopeSeedNames(scope as never)) {
        rows.set(name, { name, from: SCOPE_FROM[name] ?? "the engine", seed: true, readBy: [] });
    }

    // Walks **into** blocks. It used to iterate the top level only, so every
    // variable a branch bound — `eaten` in a threshold rule, `result` in a
    // guarded walk — was reported as "referenced, never bound", and the very steps
    // that write it appeared in the same list as steps that do not. A program whose
    // whole body is in branches therefore showed an entirely unbound context, which
    // is the most misleading thing this table can say.
    //
    // Depth-first in program order, so a reader still follows the program top to
    // bottom — the branches are simply part of the program rather than after it.
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
                    // Referenced but never written: the thing the derived list exists to
                    // make visible. A `sense` action that binds nothing still has this.
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

/** Where each seed is read from, for the list's second column. */
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

/** The steps as the grid sees them, tolerating text the json field will report. */
function readSteps(text: string | undefined): ProcessStep[] {
    if (!text?.trim()) return [];
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((s) => s && typeof s.key === "string") as ProcessStep[];
    } catch {
        // Left alone: rewriting it would destroy what the author was typing, and the
        // hidden json field's own error blocks Save.
        return [];
    }
}

/** The steps as JSON, for the hidden field. */
function writeSteps(steps: readonly ProcessStep[]): string {
    return steps.length ? JSON.stringify(steps, null, 2) : "";
}

/** Whether an action can run in this scope, from the registry rather than a guess. */
function canRunHere(meta: HandlerMeta, scope: string): boolean {
    return meta.slots.includes(scope as HandlerSlot);
}

/**
 * The steps a picker should offer, grouped by role.
 *
 * Filtered by **slot** first, so a picker cannot produce a step the compiler refuses.
 * Filtered by role second only for grouping — a `sense` action has no claim to be
 * nicer than a `connect` one, and the order is `ACTION_ROLES` so the grid reads in the
 * same order as the Handlers catalogue.
 *
 * Exported for the test that says the grid offers nothing it cannot run.
 */
export function stepChoices(scope: string): { role: string; label: string; keys: string[] }[] {
    // The block is offered in **every** scope, as its own group at the top. It is
    // not in `HANDLER_META` — that array is the action catalogue, and a block is
    // not an action — so without this a program grid had no way to insert a
    // conditional at all, however the block was edited once it existed.
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
                // The role comes from `ALL_ACTIONS`, not from `HandlerMeta`: the registry
                // row carries the *slot* axis and deliberately carries no role, so
                // grouping by it here would mean every `HandlerMeta` needed a field it
                // has no other use for. `HANDLER_META` answers "can this run here",
                // `ALL_ACTIONS` answers "what is it for", and the key is the join.
                keys: HANDLER_META
                    .filter((m) => ALL_ACTIONS[m.key]?.role === role && canRunHere(m, scope))
                    .map((m) => m.key)
                    .sort(),
            };
        }).filter((g) => g.keys.length > 0),
    ];
}

/**
 * The declared params of one step, for the row's inputs.
 *
 * Falls back to `BLOCK_META` for the `if` block. It used to search
 * `HANDLER_META` alone — and a block is deliberately not in there, because that
 * array is the action catalogue and counting a block as an action would make every
 * "how many actions can I use" figure lie by one. The consequence was that the
 * block's one param, `var`, was **never rendered**: an `if` appeared in a program
 * with no way to say what it tests. Correct as a catalogue, wrong as a form.
 */
function paramsOf(key: string): HandlerParam[] {
    if (isBlockKey(key)) return BLOCK_META.params;
    return HANDLER_META.find((m) => m.key === key)?.params ?? [];
}

/**
 * `true` for the one key that is a block rather than an action.
 *
 * Delegates to `isBlock` from the core types rather than repeating
 * `key === "if"` here. This file carried two spellings — this one and
 * `isBlock({ key })` — which is the shape a bug takes when the block key is ever
 * changed in one place and not the other. The core version is the one the compiler
 * branches on, so a UI that disagreed with it would offer a block the compiler
 * would not run.
 */
function isBlockKey(key: string): boolean {
    return isBlock({ key });
}

// ── Summary mode ─────────────────────────────────────────────────────────────

/**
 * One line that says everything the row is, in text rather than inputs.
 *
 * The reason this exists: a program is a *program*. Shown as a grid of input boxes
 * it is not one — it is a wall of form fields, and reading it top to bottom (the
 * only way to check that a generator does what you think) means reading input
 * boxes. Every parameter on every row was a control where a word would do.
 *
 * The rules it follows, each of which exists because breaking it hides something:
 *
 *   - **An unset param is shown, not omitted.** `structure: —` is information;
 *     silence is not. An omitted field and a defaulted one look identical if you
 *     only print what is there.
 *   - **A `false` boolean is omitted** but a `true` one is shown, because a
 *     boolean param is normally written down to be *turned off*; printing
 *     `flag: false` on every row buries the one that matters.
 *   - **Options the action does not declare are still printed.** A row that has
 *     drifted from its schema is exactly the thing you are looking for here, so it
 *     is never quietly dropped.
 *   - **`as` goes last**, as `→ name`, because it is the step's output and reads as
 *     the arrow that causes it.
 */
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

/**
 * Which rows are open for editing, per process.
 *
 * **Outside React**, like the selector: the grid is a plain render function with no
 * hook of its own, and it already re-derives itself from the JSON on every
 * keystroke. Row identity is a **path** (`"3"`, `"3/1/then/0"`) rather than an object
 * or a flat index, because a flat index would make row 4 of a renamed block the
 * wrong row. A path changes when a row moves, which is the behaviour you want: you
 * just reordered the program, so you want to read it, not have a stale open form.
 *
 * Keyed by process id so one process's open rows do not open another's.
 */
const EXPANDED: Map<string, Set<string>> = new Map();

/** The open-row set for a process, created on first use. */
function expandedFor(processId: string): Set<string> {
    const id = processId || "(new)";
    let set = EXPANDED.get(id);
    if (!set) {
        set = new Set();
        EXPANDED.set(id, set);
    }
    return set;
}

/** The `key` prefix for a branch of row `path`. */
function branchPath(path: string, which: "then" | "else"): string {
    return `${path}/${which}/`;
}

/**
 * Every row path in a program, in the same order and shape `stepList` builds them.
 *
 * Shared with Expand-all so the two cannot disagree about what a path is. Written
 * once as a separate walk rather than collected during render, because render order
 * is not a contract — a walk that happened to match would break the first time a
 * row returned `null` instead of a node.
 */
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

/** The muted style every summary piece shares. */
const SUMMARY = { fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace" } as const;

/**
 * The four row controls: move up, move down, delete — and, in summary mode, Edit.
 *
 * Shared because both modes must offer the **same** order and delete. Written once
 * for a reason, not tidiness: two copies drift, and the drift here is silent — a
 * collapsed row without a delete button still looks complete, and the program can
 * only be reordered by expanding every row first.
 */
function rowControls(
    h: H,
    args: {
        index: number;
        total: number;
        locked: boolean;
        move: (by: number) => void;
        remove: () => void;
        /** The Edit/Done button, or `null` in the expanded form, which is open. */
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
        // Only the collapsed form offers Edit: the expanded form *is* the edit.
        args.toggle ? chip("Edit", "Edit this step", args.locked, args.toggle) : null,
        chip("×", "Delete this step", args.locked, args.remove, true),
    ];
}

/**
 * The collapsed row: the action's name, everything it is set to, and an Edit button.
 *
 * A `<span>`, not an `<input>` — a read-only input is still a control, and a
 * program made of controls cannot be scanned. This is the view you read the
 * generator in, so it is built to be read: the action name in bold, the values
 * after it, and the `as` arrow at the end.
 *
 * A nested process shows its id and no options, because a nested process *is* its
 * id — it has no parameters of its own, and printing an empty row of em-dashes for
 * one would suggest it did.
 */
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
                // The action's own doc, as a tooltip — it was a permanent line of text
                // under every row, which was roughly a third of the screen.
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
                    // Wrap rather than clip: a long value must not be the one thing you
                    // cannot see, and an ellipsis here would hide a truncated path —
                    // the commonest cause of a step that does nothing.
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                },
            },
            summarize(step),
        ),
        // Order and delete stay in both modes. A program you could only reorder by
        // expanding every row would be a program you reorder reluctantly.
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

/**
 * One grid row: an action picker, its params, the `as` box, and the move buttons.
 *
 * Reordering is two buttons rather than drag-and-drop, because the row is already a
 * form and a drag handle inside one is a second, conflicting interaction.
 *
 * Every edit goes through `replace`/`remove`, which rewrite the whole json field — so
 * there is no per-row state that could drift from the form. The cost is a re-parse per
 * keystroke; the benefit is that what the author sees and what would be saved are the
 * same value by construction.
 */
/**
 * One grid row, in whichever of the two modes it is in.
 *
 * The split lives **here** rather than inside the form, so the two modes cannot
 * drift: same move buttons, same delete, same branches, same identity. Only the
 * middle differs — a line of text, or the parameters as inputs.
 */
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
    /** `true` to render the full parameter form, `false` for the one-line summary. */
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
        // The branches render in **both** modes. Collapsing a block must not hide the
        // program inside it — the block's own line is the least interesting part of
        // a block, and a collapsed tree that hid them would be the same bug as never
        // rendering them at all.
        args.branches ? args.branches(args.step) : null,
    );
}

/** The expanded row: the action picker, its params, and the `as` box. */
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
                        // Changing the action drops its params and its binding: they
                        // belonged to the old action's schema, and a `charge` left on a
                        // row that now runs `toast` is a value nothing reads.
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
                // A nested process is a different kind of row: no params, binds nothing.
                nestable.length
                    ? h(
                        "optgroup",
                        { key: "__nest", label: "Another process" },
                        ...nestable.map((id) => h("option", { key: id, value: id }, id)),
                    )
                    : null,
                // A key that no longer exists must still be shown, or the select would
                // display the first option and quietly rewrite the program.
                !all.includes(step.key)
                    ? h("option", { value: step.key }, `${step.key} (unknown)`)
                    : null,
            ),
            // The same three controls as the collapsed row, in the same order. No
            // Edit button: this row *is* the edit, so offering one would be a
            // button whose only action is to make itself disappear.
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
        // The `as` box. Shown whenever the program already shares something, or this
        // step already binds — so a program that shares nothing does not show a box
        // that does nothing, and one that does is a click from sharing more.
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
                        // `withAs`, not a literal: the literal dropped the branches of a
                        // block, so binding a name on an `if` emptied it.
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

/** The label and border for a branch, so a nested list reads as belonging to it. */
const BRANCH_STYLE = {
    then: { borderLeft: "2px solid #27ae60", paddingLeft: 8, color: "#27ae60" },
    else: { borderLeft: "2px solid #7f8c8d", paddingLeft: 8, color: "#7f8c8d" },
} as const;

/**
 * A step with new options.
 *
 * **Must carry `then`/`else` across.** It used to build a fresh object from `key`,
 * `as` and `options` only — so typing one character into a *block's* `var` field
 * silently deleted every step inside both of its branches. For a program that
 * keeps its whole body in branches — which is what a threshold rule necessarily
 * looks like — that is the entire program, gone on Save, with no error and no
 * visible cause.
 *
 * Spreading the original and then overwriting `options` is the fix, and it is also
 * why this is not written as an explicit field list: every field added to
 * `HandlerActionRef` from now on is carried by default rather than by someone
 * remembering to add it here.
 */
function withOptions(step: ProcessStep, options: Record<string, unknown>): ProcessStep {
    const next: ProcessStep = { ...step, options };
    if (Object.keys(options).length) next.options = options;
    else delete next.options;
    return next;
}

/**
 * A step with a new `as` binding, or with it removed.
 *
 * Same reason as `withOptions`, and it is a separate call site because it was
 * written separately: the `as` box would have kept dropping the branches even
 * after the parameter inputs were fixed.
 */
function withAs(step: ProcessStep, as: string): ProcessStep {
    const next: ProcessStep = { ...step };
    if (as) next.as = as;
    else delete next.as;
    return next;
}

/**
 * A block with a new branch list.
 *
 * The branches are *replaced* rather than merged, so the grid's "rewrite the whole
 * json field" discipline holds: a nested edit re-renders from the JSON, and there
 * is no per-branch state that could drift from what would be saved.
 */
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

/**
 * The `program` control: the derived context list above, the step grid below.
 *
 * **All the editing state is the form's own json field.** There is no module-level
 * scratch state and no closure copy: every edit rewrites `STEPS_JSON_KEY` through
 * `setField`, and the grid is re-derived from it. That is what makes a step's params
 * survive a re-render, and it means there is exactly one place the program exists
 * while the author is editing it.
 */
export function renderProgramGrid(ctx: FieldContext): unknown {
    const { h, form, setField, error, locked } = ctx;
    const scope = form.scope ?? "";
    const steps = readSteps(form[STEPS_JSON_KEY]);
    const choices = scope ? stepChoices(scope) : [];
    const registry = currentProcessRegistry();
    // Everything a step could refer to, for the `as` box's own hint.
    const known = deriveContext(scope, steps).map((r) => r.name);
    // A nested process is a different kind of row: no params of its own, binds
    // nothing, so it is offered in its own group and is not a context name.
    const nestable = scope
        ? registry.forSlot(scope as HandlerSlot)
            .filter((p) => p.id !== form.id)
            .map((p) => p.id)
        : [];

    // Which rows are open, for this process only. Read here so the set is shared by
    // every list in the tree — the top level and every branch.
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

    /**
     * Renders one list of steps, and hands `write` the new list so the caller can
     * put it back where it came from.
     *
     * `write` is what makes nesting work without a second code path: the top level
     * commits to the form field, and a block commits by replacing its own `then` or
     * `else`. Everything in between — the rows, the move buttons, the picker — is
     * the same, so a branch is a program rather than a special list.
     */
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
                    // One indent level per branch, so nesting is visible without
                    // counting colours. Blocks nest at most 8 deep (MAX_BLOCK_DEPTH).
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
                        // Re-render without touching the program: rewriting the same
                        // JSON is the only way to ask the panel to draw again, and it
                        // changes nothing a save would see.
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

    /** Both branches of a block, each labelled and each holding a nested list. */
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

    /**
     * Replaces one branch of one block, wherever in the tree that block is.
     *
     * Found by **identity** rather than by path: the branches are rebuilt from the
     * JSON on every render, so a path captured at render time is stale the moment
     * anything else changes, and the edit would land on a different block.
     */
    const replaceAt = (
        target: ProcessStep,
        which: "then" | "else",
        branch: ProcessStep[],
    ): void => {
        const rewrite = (list: ProcessStep[]): ProcessStep[] =>
            list.map((s) => {
                if (s === target) return withBranch(s, which, branch);
                if (!isBlockKey(s.key)) return s;
                // Both branches, one `withBranch` each. It copies, so the two calls
                // cannot clobber each other — which a mutate-in-place variant here
                // could, and did: the second branch was written onto the object the
                // first had just returned.
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
                    // Expand-all / collapse-all, because per-row buttons alone make a
                    // thirty-row program a thirty-click wall. Reading is the default
                    // state and collapsing back to it is one click.
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
        // The field's own validation error, at the bottom. This is the only place a
        // broken program shows itself before Save refuses it, so it stays in the
        // collapsed view: making a program disappear in order to read the error is no
        // way to fix a program.
        error ? h("div", { style: S.errorText }, error) : null,
    );
}

/**
 * A legal first action for a scope, or `noop`.
 *
 * The same rule the top-level add button used, now shared by the branch buttons so
 * a branch cannot be seeded with an action the compiler would refuse.
 */
function seedKey(
    choices: { keys: string[] }[],
    nestable: string[],
): string {
    return choices[0]?.keys[0] ?? nestable[0] ?? "noop";
}
