/**
 * The "Handlers" tab: a registry browser for every callable this mod can run.
 *
 * Handlers live in code, not JSON, so this is not a CRUD list of stored
 * entries. Instead it answers the four questions an author actually has:
 *
 *   1. What can this mod run, and what kind of thing is it?   (grouped by type)
 *   2. Where am I allowed to use it?                          (slots)
 *   3. How wide is it, and what does it read?                 (scope + params)
 *   4. Am I already using it, and is that use even legal?     (usage + reach)
 *
 * The last one is the valuable bit: a config can reference a handler from a
 * slot that handler cannot serve (hand-edited JSON, or a handler whose type
 * changed since). Those are listed at the top in red rather than failing
 * silently in-game.
 */
import type { HandlerMeta, HandlerType, HandlerUsage } from "../hooks/handler-registry.ts";
import {
    buildHandlerOptions,
    HANDLER_META,
    HANDLER_SCOPE_LABELS,
    HANDLER_SLOT_LABELS,
    HANDLER_TYPE_BLURBS,
    HANDLER_TYPE_LABELS,
    unreachableHandlers,
    usageIndex,
    validateHandlerParams,
} from "../hooks/handler-registry.ts";
import { allHandlerDocs } from "../hooks/handlers.ts";
import * as S from "./styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

const TYPE_ORDER: HandlerType[] = [
    "global",
    "cell",
    "message",
    "tech",
    "processor",
    "projectile",
    "modifier",
];

export interface HandlersTabState {
    /** Handler key whose parameter form is open, or null. */
    open: string | null;
    /** Live parameter values for the open handler. */
    values: Record<string, Record<string, string>>;
    /**
     * Which handler-type sections are unfolded.
     *
     * A set rather than a single `open`, because a user comparing two types
     * should not have to collapse the first to see the second. All closed by
     * default: the screen is a wall of ~40 rows otherwise, and the point of
     * this screen is to find one thing and then leave.
     */
    expanded: string[];
}

export function initialHandlersState(): HandlersTabState {
    return { open: null, values: {}, expanded: [] };
}

/** Default parameter bag for a handler, taken from its declared defaults. */
export function defaultParams(meta: HandlerMeta): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of meta.params) if (p.def !== undefined) out[p.key] = p.def;
    return out;
}

export interface HandlersTabProps {
    h: H;
    cfg: Record<string, unknown>;
    state: HandlersTabState;
    setState: (next: HandlersTabState) => void;
    /** Jump to the category that owns an entry (e.g. go to Signals). */
    onGoTo: Click;
    /** Copy a ready-to-paste JSON snippet to the clipboard. */
    onCopy: (text: string) => void;
}

export function renderHandlersTab(props: HandlersTabProps): unknown {
    const { h, cfg, state, setState, onGoTo, onCopy } = props;
    const docs = allHandlerDocs();
    const used = usageIndex(cfg);
    const bad = unreachableHandlers(cfg);

    const toggle = (meta: HandlerMeta) => {
        if (state.open === meta.key) {
            setState({ ...state, open: null });
            return;
        }
        setState({
            ...state,
            open: meta.key,
            values: {
                ...state.values,
                [meta.key]: { ...defaultParams(meta), ...(state.values[meta.key] ?? {}) },
            },
        });
    };

    const setParam = (key: string, field: string, v: string) => {
        setState({
            ...state,
            values: { ...state.values, [key]: { ...(state.values[key] ?? {}), [field]: v } },
        });
    };

    const toggleType = (type: string) => {
        const open = state.expanded.includes(type);
        setState({
            ...state,
            expanded: open ? state.expanded.filter((t) => t !== type) : [...state.expanded, type],
        });
    };

    // ── unreachable references, surfaced first ──────────────────────────────
    const warnings = bad.length === 0 ? null : h(
        "div",
        { style: { ...S.card, borderColor: "#c0392b", marginBottom: 8 } },
        h("div", { style: S.sectionTitle }, `⚠ ${bad.length} unusable handler reference(s)`),
        h(
            "div",
            { style: S.hint },
            "These are stored in your config but cannot run in the slot they were put in.",
        ),
        ...bad.map((b) =>
            h(
                "div",
                {
                    key: `${b.key}:${b.usage.id}`,
                    style: { ...S.row, borderTop: "1px solid rgba(255,255,255,0.06)" },
                },
                h("span", {
                    style: { ...S.chip, cursor: "pointer" },
                    onClick: () => onGoTo(b.usage.category),
                }, b.key),
                h(
                    "span",
                    { style: S.hint },
                    ` in ${b.usage.category} → ${b.usage.id}: ${b.reason}`,
                ),
            )
        ),
    );

    // ── one collapsible block per handler type ─────────────────────────────
    const blocks = TYPE_ORDER.map((type) => {
        const rows = HANDLER_META.filter((m) => m.type === type);
        if (rows.length === 0) return null;
        const isOpen = state.expanded.includes(type);
        // how many of this type are actually referenced right now
        const usedCount = rows.filter((m) => (used[m.key] ?? []).length > 0)
            .length;
        return h(
            "div",
            { key: type, style: { ...S.card, marginBottom: 8 } },
            h(
                "div",
                {
                    style: {
                        ...S.sectionTitle,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        userSelect: "none",
                    },
                    onClick: () => toggleType(type),
                },
                h("span", { style: { opacity: 0.7, fontSize: "10px" } }, isOpen ? "▼" : "▶"),
                `${HANDLER_TYPE_LABELS[type]} (${rows.length})`,
                usedCount > 0 ? h("span", { style: S.tagChip }, `${usedCount} in use`) : null,
            ),
            h("div", { style: S.hint }, HANDLER_TYPE_BLURBS[type]),
            isOpen
                ? h(
                    "div",
                    { style: { marginTop: 6 } },
                    ...rows.map((m) =>
                        renderRow(m, { h, state, used, docs, toggle, setParam, onCopy, onGoTo })
                    ),
                )
                : null,
        );
    });

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        h("div", { style: S.screenHead }, h("span", { style: S.screenTitle }, "Handlers")),
        h(
            "div",
            { style: S.hint },
            `${HANDLER_META.length} callables. A handler is code, so config entries reference it by name — `,
            "pick one from the slot you are editing.",
        ),
        howToUse(h, onGoTo),
        warnings,
        ...blocks,
    );
}

/**
 * The one thing this screen was missing: how to actually use a handler.
 *
 * Everything else here is a reference. A user arriving at this screen has a
 * concrete goal — "make this trigger do something" — and the reference answers
 * none of the four questions on the way there. The chain is short and is stated
 * as steps rather than prose.
 */
function howToUse(h: H, onGoTo: Click): unknown {
    const steps: [string, string][] = [
        [
            "Pick the object that runs your code",
            "A trigger, a processor, a projectile, a modifier, or a signal. Open that screen and create or edit the entry.",
        ],
        [
            "Find the slot field",
            "Each object has one or more fields ending in “Key” — that is where a handler is attached. Triggers have “onFireKey”, processors have “processKey”, and so on.",
        ],
        [
            "Choose the handler",
            "The dropdown only offers handlers that are legal for that slot, because it filters by the type the slot accepts. If nothing is listed, no handler serves that slot.",
        ],
        [
            "Set the parameters",
            "Open the handler here to see the parameters it takes and what they default to. Parameters are stored on the object, not on the handler.",
        ],
    ];
    return h(
        "div",
        { style: { ...S.card, marginBottom: 8, borderColor: "rgba(120,180,255,0.35)" } },
        h("div", { style: S.sectionTitle }, "How to configure a handler"),
        h(
            "div",
            { style: S.hint },
            "Four steps. The chain is: object → slot field → handler key → parameters.",
        ),
        ...steps.map(([title, body], i) =>
            h(
                "div",
                {
                    key: `step-${i}`,
                    style: {
                        display: "flex",
                        gap: 8,
                        marginTop: 6,
                        alignItems: "flex-start",
                    },
                },
                h(
                    "span",
                    {
                        style: {
                            ...S.tagChip,
                            cursor: "pointer",
                            minWidth: 16,
                            textAlign: "center",
                        },
                        title: "Go to the first screen",
                        onClick: () => onGoTo("triggers"),
                    },
                    String(i + 1),
                ),
                h(
                    "div",
                    null,
                    h("div", null, title),
                    h("div", { style: S.hint }, body),
                ),
            )
        ),
    );
}

// ── one handler row ─────────────────────────────────────────────────────────

interface RowCtx {
    h: H;
    state: HandlersTabState;
    used: Record<string, HandlerUsage[]>;
    docs: Record<string, string>;
    toggle: (m: HandlerMeta) => void;
    setParam: (key: string, field: string, v: string) => void;
    onCopy: (t: string) => void;
    onGoTo: Click;
}

function renderRow(m: HandlerMeta, ctx: RowCtx): unknown {
    const { h, state, used, docs, toggle, setParam, onCopy, onGoTo } = ctx;
    const open = state.open === m.key;
    const refs = used[m.key] ?? [];
    const values = state.values[m.key] ?? defaultParams(m);

    const slotChips = m.slots.map((s) =>
        h(
            "span",
            { key: s, style: S.tagChip, title: HANDLER_SLOT_LABELS[s] },
            HANDLER_SLOT_LABELS[s],
        )
    );

    const usageChips = refs.length === 0
        ? [h("span", { key: "none", style: { ...S.tagChip, opacity: 0.5 } }, "unused")]
        : refs.map((r, i) =>
            h(
                "span",
                {
                    key: `${r.id}:${i}`,
                    style: { ...S.tagChip, cursor: "pointer", borderColor: "#4caf50" },
                    title: `Go to ${r.category}`,
                    onClick: () => onGoTo(r.category),
                },
                `${r.category} → ${r.id}`,
            )
        );

    return h(
        "div",
        { key: m.key, style: { ...S.row, flexDirection: "column", alignItems: "stretch", gap: 4 } },
        // header: key, scope, count
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", { style: S.codeKey }, m.key),
            h(
                "span",
                { style: S.tagChip, title: "Default scope" },
                `scope: ${HANDLER_SCOPE_LABELS[m.scope]}`,
            ),
            refs.length > 0
                ? h(
                    "span",
                    { style: { ...S.tagChip, borderColor: "#4caf50" } },
                    `used ×${refs.length}`,
                )
                : null,
            h("span", { style: { flex: 1 } }),
            // configure / collapse
            h(
                "button",
                { style: open ? S.chipActive : S.chip, onClick: () => toggle(m) },
                open ? "Close" : m.params.length > 0 ? "Configure" : "Details",
            ),
        ),
        h("div", { style: S.hint }, docs[m.key] ?? "(no description)"),
        h("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, ...slotChips),
        h("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, ...usageChips),
        open ? renderExpanded(m, values, { h, setParam, onCopy }) : null,
    );
}

function renderExpanded(
    m: HandlerMeta,
    values: Record<string, string>,
    ctx: {
        h: H;
        setParam: (key: string, field: string, v: string) => void;
        onCopy: (t: string) => void;
    },
): unknown {
    const { h, setParam, onCopy } = ctx;

    if (m.params.length === 0) {
        return h(
            "div",
            { style: S.noteBox },
            h("div", { style: S.hint }, "Takes no parameters."),
            h(
                "div",
                { style: S.hint },
                "Reference it from ",
                ...m.slots.map((s, i) =>
                    h(
                        "span",
                        { key: s, style: S.codeKey },
                        i ? `, ${HANDLER_SLOT_LABELS[s]}` : HANDLER_SLOT_LABELS[s],
                    )
                ),
                ".",
            ),
        );
    }

    const fields = m.params.map((p) => {
        const v = values[p.key] ?? "";
        return h(
            "div",
            { key: p.key, style: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 } },
            h("span", { style: { ...S.label, minWidth: 130 } }, p.label + (p.required ? " *" : "")),
            h("input", {
                style: S.input,
                value: v,
                placeholder: p.def ?? "",
                title: p.hint ?? (p.kind === "number" ? "number" : p.kind),
                onInput: (e: { currentTarget: { value: string } }) =>
                    setParam(m.key, p.key, e.currentTarget.value),
            }),
        );
    });

    // Validate as the user types so bad params are caught before they reach config.
    const errs = validateHandlerParams(m, values);
    const snippet = JSON.stringify(
        { handlerKey: m.key, scope: m.scope, options: buildHandlerOptions(m, values) },
        null,
        2,
    );

    return h(
        "div",
        { style: { ...S.noteBox, marginTop: 6 } },
        ...fields,
        errs.length > 0
            ? h("div", { style: S.errorText }, errs.join(" · "))
            : h("div", { style: S.hint }, "✓ parameters valid"),
        h(
            "div",
            { style: { marginTop: 6 } },
            h("button", { style: S.chip, onClick: () => onCopy(snippet) }, "Copy snippet"),
        ),
        h("pre", { style: S.codeBlock }, snippet),
    );
}
