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
    HANDLER_META,
    type HandlerMeta,
    type HandlerParam,
    type HandlerSlot,
} from "../handler/core/handler-registry.ts";
import { scopeSeedNames } from "../handler/core/scope-context.ts";
import { refsIn } from "../handler/core/refs.ts";
import { canBind, createContext } from "../handler/core/context.ts";
import { ACTION_ROLES, ROLE_LABELS } from "../handler/core/types.ts";
import { ACTION_DOCS, ALL_ACTIONS } from "../handler/actions/index.ts";
import { currentProcessRegistry, type ProcessStep } from "../handler/custom-process/index.ts";
import { paramInput } from "./param-controls.ts";
import * as S from "./styles.ts";
import type { FieldContext } from "./definition/types.ts";

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

    steps.forEach((step, i) => {
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
    });
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
    return ACTION_ROLES.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        // The role comes from `ALL_ACTIONS`, not from `HandlerMeta`: the registry row
        // carries the *slot* axis and deliberately carries no role, so grouping by it
        // here would mean every `HandlerMeta` needed a field it has no other use for.
        // `HANDLER_META` answers "can this run here", `ALL_ACTIONS` answers "what is it
        // for", and the key is the join.
        keys: HANDLER_META
            .filter((m) => ALL_ACTIONS[m.key]?.role === role && canRunHere(m, scope))
            .map((m) => m.key)
            .sort(),
    })).filter((g) => g.keys.length > 0);
}

/** The declared params of one step, for the row's inputs. */
function paramsOf(key: string): HandlerParam[] {
    return HANDLER_META.find((m) => m.key === key)?.params ?? [];
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
function stepRow(
    h: H,
    args: {
        step: ProcessStep;
        index: number;
        total: number;
        /** Unused by the row itself, kept so the signature says what it is. */
        scope: string;
        choices: { role: string; label: string; keys: string[] }[];
        nestable: string[];
        known: string[];
        locked: boolean;
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
            key: `step:${index}`,
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
            h("button", {
                style: S.chip,
                disabled: locked || index === 0,
                onClick: () => args.move(-1),
            }, "↑"),
            h(
                "button",
                {
                    style: S.chip,
                    disabled: locked || index === total - 1,
                    onClick: () => args.move(1),
                },
                "↓",
            ),
            h("button", {
                style: { ...S.chip, color: "#c0392b" },
                disabled: locked,
                onClick: args.remove,
            }, "×"),
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
                }),
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
                        const name = e.currentTarget.value.trim();
                        args.replace({
                            ...withOptions(step, step.options ?? {}),
                            ...(name ? { as: name } : {}),
                        });
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

/** A step with new options, keeping its `as` and dropping an emptied bag. */
function withOptions(step: ProcessStep, options: Record<string, unknown>): ProcessStep {
    const next: ProcessStep = { key: step.key };
    if (step.as) next.as = step.as;
    if (Object.keys(options).length) next.options = options;
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

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10 } },
        contextList(ctx, scope, steps),
        scope
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6 } },
                h("div", { style: S.label }, "Steps"),
                ...steps.map((step, i) =>
                    stepRow(h, {
                        step,
                        index: i,
                        total: steps.length,
                        scope,
                        choices,
                        nestable,
                        known,
                        locked,
                        replace: (s) => replace(i, s),
                        move: (by) => move(i, by),
                        remove: () => commit(steps.filter((_, n) => n !== i)),
                    })
                ),
                h(
                    "button",
                    {
                        style: S.chip,
                        disabled: locked,
                        onClick: () => {
                            // Seeded with something this scope can actually run, so the
                            // row that appears is always a *legal* one. A blank row
                            // would have to be filled before the program meant anything,
                            // and an empty `key` compiles to a step that does nothing.
                            commit([...steps, {
                                key: nestable[0] ?? choices[0]?.keys[0] ?? "noop",
                            }]);
                        },
                    },
                    "+ Add step",
                ),
                steps.length === 0
                    ? h(
                        "div",
                        { style: S.hint },
                        "No steps. A process with none still registers — it is a machine " +
                            "that does nothing.",
                    )
                    : null,
            )
            : h(
                "div",
                { style: S.hint },
                "Pick a scope first — it decides which steps you can add.",
            ),
        error ? h("div", { style: S.errorText }, error) : null,
    );
}
