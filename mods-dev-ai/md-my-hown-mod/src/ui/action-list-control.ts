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
import { actionClassOf } from "../hooks/action-class.ts";
import {
    HANDLER_META,
    type HandlerMeta,
    type HandlerParam,
    TAB_TO_CALL_SITE,
} from "../hooks/handler-registry.ts";
import { ACTIONS_FORM_KEY, formatActionRefs, parseActionRefs } from "./definition/actions-field.ts";
import type { FieldContext, Tab } from "./definition/types.ts";
import * as S from "./styles.ts";
import { paramInput, paramText, paramValue } from "./param-controls.ts";

type H = FieldContext["h"];

const metaOf = (key: string): HandlerMeta | undefined => HANDLER_META.find((m) => m.key === key);

/** Actions a call site may run. An unknown tab means "no narrowing". */
function allowedFor(tab: Tab): HandlerMeta[] {
    const slot = TAB_TO_CALL_SITE[tab as string];
    if (!slot) return HANDLER_META;
    const allowed = HANDLER_META.filter((m) => m.slots.includes(slot as never));
    return allowed;
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
    const { h, form, setField, tab } = ctx;
    const refs = parseActionRefs(form[ACTIONS_FORM_KEY]);
    const allowed = allowedFor(tab);
    const write = (next: { key: string; options?: Record<string, unknown> }[]) =>
        setField(ACTIONS_FORM_KEY, formatActionRefs(next));

    /** The label carries the class, so both axes are visible while editing. */
    const label = (key: string) => {
        const cls = actionClassOf(key);
        return cls && cls !== "api" ? `${key} · ${cls}` : key;
    };

    const rows = refs.map((ref, i) => {
        const meta = metaOf(ref.key);
        // An action the slot cannot serve — or one that no longer exists — is kept
        // and outlined red, never dropped: the author chose it, and a row that
        // vanishes on open is how a process loses a step with nobody noticing.
        const usable = !meta || allowed.some((m) => m.key === ref.key);
        const setKey = (k: string) => write(refs.map((r, j) => (j === i ? { ...r, key: k } : r)));
        const setParam = (p: HandlerParam, text: string) => {
            const opts = { ...(ref.options ?? {}) };
            const v = paramValue(p, text);
            if (v === undefined) delete opts[p.key];
            else opts[p.key] = v;
            write(refs.map((r, j) => (j === i ? { ...r, options: opts } : r)));
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
                    allowed.some((m) => m.key === ref.key)
                        ? null
                        : h("option", { value: ref.key }, label(ref.key)),
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
            meta?.params.length
                ? h(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
                    ...meta.params.map((p) =>
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
                            paramInput(h, p, paramText(ref.options, p), (v) => setParam(p, v)),
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
                    disabled: allowed.length === 0,
                    onChange: (e: { target: { value: string } }) => {
                        if (e.target.value) write([...refs, { key: e.target.value }]);
                    },
                },
                h(
                    "option",
                    { value: "" },
                    allowed.length ? "— add an action —" : "no actions for this call site",
                ),
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
