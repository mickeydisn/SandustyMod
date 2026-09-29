/**
 * The `actionList` control: a HandlerProcess, as an ordered editor.
 *
 * One widget for all seven tabs, because `actionList` is a **shared** field kind
 * like `json` and `multiselect` — not something each of the seven definitions
 * should own. It sits in the generic chain rather than in a per-definition
 * `renderField`, so giving any object a process is one line, not seven widgets.
 *
 * ## What it shows
 *
 * One row per action, in order, each with a dropdown of the actions **this call
 * site** allows, that action's own parameters (built from the same `HandlerMeta`
 * the Handlers tab uses), and move up / move down / remove.
 *
 * Order is the point: "log then convert" and "convert then log" are different
 * behaviours, so nothing here sorts or deduplicates, and the same action may appear
 * twice with different options.
 *
 * ## What it writes
 *
 * The same JSON text the schema and the round trip already use, so this control is
 * a *view* of `actionsJson` and nothing downstream knows it exists. That is why the
 * schema, the migration and the compiler could all land before the widget: a plain
 * text box was a correct — if unpleasant — fallback the whole time.
 */
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

/**
 * The `if` block, as a row.
 *
 * A block is not a `HandlerMeta` — it has no class, no namespace and no place in the
 * scope tables, because the compiler reads it rather than calling it. It is offered in
 * the same lists as an action anyway, because from the author's side it *is* something
 * you can add to a process, and a conditional reachable only by hand-editing JSON is a
 * conditional most people will never write.
 */
/** How the block reads in a dropdown, where the raw key `if` would be cryptic. */
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

/** Actions a call site may run, plus the block. An unknown tab means "no narrowing". */
function allowedFor(tab: Tab): HandlerMeta[] {
    const slot = TAB_TO_CALL_SITE[tab as string];
    if (!slot) return HANDLER_META;
    return HANDLER_META.filter((m) => m.slots.includes(slot as never));
}

/** Swap a row with its neighbour. Out of range is a no-op, not a hole. */
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

    /** The label carries the class, so both axes are visible while editing. */
    const label = (key: string) => {
        const cls = actionClassOf(key);
        return cls && cls !== "api" ? `${key} · ${cls}` : key;
    };

    /**
     * One of a block's two branches: an ordered list of steps with its own add-list.
     *
     * A branch is a full process, so it gets the same vocabulary as the parent — which
     * is what lets an `if` hold another `if`. Nesting is bounded by `MAX_BLOCK_DEPTH`
     * in the compiler, and by this control only in the sense that a branch cannot
     * *contain* a branch row directly: adding one here writes a nested `if` ref, which
     * the compiler counts against the same limit.
     *
     * Steps are stored as the ref's own `then` / `else` field, so the JSON round-trips
     * without this control knowing anything about how a block is compiled.
     */
    const branchEditor = (
        branch: "then" | "else",
        steps: HandlerActionRef[],
        setBranch: (branch: "then" | "else", steps: HandlerActionRef[]) => void,
    ) =>
        h(
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
        // A block is a row too. It has no `HandlerMeta`, so it is recognised by key —
        // which is also how the compiler recognises it, and keeping the two in step is
        // the point of `isBlock`.
        const isBlockRow = ref.key === BLOCK_KEY;
        const meta = metaOf(ref.key);
        // A block runs wherever it appears, so it is never "unusable" for slot reasons.
        // An action the slot cannot serve — or one that no longer exists — is kept
        // and outlined red, never dropped: the author chose it, and a row that
        // vanishes on open is how a process loses a step with nobody noticing.
        const usable = isBlockRow || !meta || allowed.some((m) => m.key === ref.key);
        const params = isBlockRow ? BLOCK_PARAMS : (meta?.params ?? []);
        // Switching a row between an action and a block has to drop the fields that
        // no longer belong. Without this, turning a block into `readElement` would
        // leave a `then` list on a plain action — which the compiler reports as
        // malformed, so the author would be told their own edit was invalid.
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
        // The branches are stored as `then` / `else` on the same ref, not as nested
        // rows — the editor is flat, and the JSON keeps them nested. Switching a row to
        // or from a block therefore has to drop the fields that no longer belong, or a
        // plain action would carry a dead `then` list the compiler reports.
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
                    // A key with no matching option still has to be *shown*, or the
                    // dropdown would display the first action and save a lie.
                    allowed.some((m) => m.key === ref.key) && !isBlockRow
                        ? null
                        : h(
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
            // A block's two branches, as two small add-lists. The editor stays flat
            // — nesting the rows inside the parent row would mean a recursive `h`, and
            // the JSON is the thing that has to stay nested either way, so the branch
            // is edited as its own list that writes back into `options`.
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
        ...rows,        h(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            // A **select**, not a button that appends the first action. With a
            // button, an empty process offers no way to see what is available —
            // the per-row dropdowns only exist when there are rows — so the author
            // would have to add one to find out what they may add, then delete the
            // wrong one. Choosing from the list also makes availability *visible*,
            // which is the whole of "is there an action for what I want here".
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
                    // The block is always addable, so a slot with no actions still has
                    // something to offer — a conditional needs no call-site capability.
                    disabled: allowed.length === 0,
                    onChange: (e: { target: { value: string } }) => {
                        if (!e.target.value) return;
                        write([
                            ...refs,
                            e.target.value === BLOCK_KEY
                                // A new block starts with both branches present and empty
                                // rather than absent, so the editor shows the shape and
                                // the JSON says `if` even before a step is added.
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
                // The block sits with the actions, not in a separate control. It is
                // something you add to a process, and a second "add" button next to
                // this one would be a control whose only job is to be discovered.
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
