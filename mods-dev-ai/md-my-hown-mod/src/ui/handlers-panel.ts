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
import type { HandlerMeta, HandlerUsage } from "../hooks/handler-registry.ts";
import { ACTION_CLASS_BLURBS } from "../hooks/action-class.ts";
import { actionRefsOf } from "../hooks/process.ts";
import {
    buildHandlerOptions,
    HANDLER_META,
    HANDLER_SCOPE_LABELS,
    HANDLER_SLOT_LABELS,
    unreachableHandlers,
    usageIndex,
    validateHandlerParams,
} from "../hooks/handler-registry.ts";
import { allHandlerDocs } from "../hooks/handlers.ts";
import * as S from "./styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

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

/**
 * The call sites a process can be attached to, and where each one's config lives.
 *
 * One row per slot rather than a `HandlerType` list: the second half of this screen
 * is about **where a process is used**, and a call site is a place, not a kind of
 * action. `behavior` has no config array of its own — a key binding is a function
 * *pair* on one entry, not a list — so it is not here.
 */
const PROCESS_SLOTS: { slot: string; category: string; label: string }[] = [
    { slot: "signal", category: "signals", label: "Signals — structure click" },
    { slot: "trigger", category: "triggers", label: "Triggers — timed tick" },
    { slot: "processing", category: "processing", label: "Processing — process step" },
    { slot: "projectile", category: "projectiles", label: "Projectiles — spawn options" },
    { slot: "upgrade", category: "upgrades", label: "Upgrades — level bought" },
    { slot: "modifier", category: "modifiers", label: "Modifiers — engine hook" },
    { slot: "itemAction", category: "items", label: "Items — used" },
];

const API_SECTION_KEY = "(no api — the action reaches for nothing)";

/**
 * Sections for the action half, built from the real data rather than a fixed list.
 *
 * The `api.*` namespaces come first, because that is the shape the split wants: an
 * action that calls one namespace *is* the rule, and everything after it is measuring
 * how far short of the rule the rest fall. Then the classes that call none, in the
 * ladder's order — `pure` last, because it is nearly half the catalogue and is mostly
 * scaffolding, and leading with it would bury the five that follow the rule.
 */
function actionSections(): { title: string; blurb: string; rows: HandlerMeta[] }[] {
    const byApi = new Map<string, HandlerMeta[]>();
    for (const m of HANDLER_META) {
        const k = m.api ?? API_SECTION_KEY;
        byApi.set(k, [...(byApi.get(k) ?? []), m]);
    }
    const sections: { title: string; blurb: string; rows: HandlerMeta[] }[] = [];
    for (const ns of [...byApi.keys()].sort()) {
        if (ns === API_SECTION_KEY) continue;
        sections.push({
            title: `api.${ns}`,
            blurb: `Calls api.${ns} — the shape the split wants.`,
            rows: byApi.get(ns)!,
        });
    }
    for (const cls of ["context-bound", "self-sufficient", "pure"] as const) {
        const rows = HANDLER_META.filter((m) => m.cls === cls);
        if (!rows.length) continue;
        sections.push({
            title: `no api · ${cls}`,
            blurb: ACTION_CLASS_BLURBS[cls],
            rows,
        });
    }
    return sections;
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

    // ── one collapsible block per section, on the API axis ──────────────────
    //
    // It used to be one block per `type`, and `type` measured **neither** axis:
    // `cell` spanned three call sites, `tech` was an API name sitting on the
    // `upgrade` call site, and `message` put a signal, a trigger and an item action
    // under one label with nothing in common. The section titles are now the axis
    // that means something — the `api.*` an action calls, then the class for the
    // ones that call none.
    const blocks = actionSections().map(({ title, blurb, rows }) => {
        const isOpen = state.expanded.includes(title);
        const usedCount = rows.filter((m) => (used[m.key] ?? []).length > 0).length;
        return h(
            "div",
            { key: title, style: { ...S.card, marginBottom: 8 } },
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
                    onClick: () => toggleType(title),
                },
                h("span", { style: { opacity: 0.7, fontSize: "10px" } }, isOpen ? "▼" : "▶"),
                `${title} (${rows.length})`,
                usedCount > 0 ? h("span", { style: S.tagChip }, `${usedCount} in use`) : null,
            ),
            h("div", { style: S.hint }, blurb),
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

    // The other axis, in full below. Grouped by call site, because that is what a
    // process *is*: an ordered list of actions an object runs.
    const processGroups = processGroupsFor(h, cfg, onGoTo);

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        h("div", { style: S.screenHead }, h("span", { style: S.screenTitle }, "Handlers")),
        h(
            "div",
            { style: S.hint },
            `${HANDLER_META.length} actions, grouped by the api.* each one calls. A process is an `,
            "ordered list of them — the second half of this screen lists yours.",
        ),
        howToUse(h, onGoTo),
        warnings,
        h("div", { style: { ...S.sectionTitle, marginTop: 4 } }, "Actions"),
        ...blocks,
        h("div", { style: { ...S.sectionTitle, marginTop: 12 } }, "Processes in use"),
        processGroups.length ? h("div", null, ...processGroups) : h(
            "div",
            { style: S.hint },
            "None. A process is created on its own object's screen — a trigger, a processor, ",
            "a signal, a projectile, an upgrade, a modifier or an item.",
        ),
    );
}

/**
 * The **other** axis: the processes actually in use, grouped by call site.
 *
 * A process is an ordered list of actions an object runs, so "where" is the honest
 * question about one — and the action half above cannot answer it, being grouped by
 * what an action *does* rather than where it is *used*. An entry with no process is
 * left out: this list is of things that will actually run.
 */
function processGroupsFor(
    h: H,
    cfg: Record<string, unknown>,
    onGoTo: Click,
): unknown[] {
    return PROCESS_SLOTS.map(({ slot, category, label }) => {
        const entries = (cfg[category] as Record<string, unknown>[] | undefined) ?? [];
        const live = entries.filter((e) => actionRefsOf(e).length > 0);
        if (!live.length) return null;
        return h(
            "div",
            { key: `proc:${slot}`, style: { ...S.card, marginBottom: 8 } },
            h("div", { style: S.sectionTitle }, `${label} (${live.length})`),
            h(
                "div",
                { style: S.hint },
                "Ordered actions, run when the engine calls this. Edit one on its own screen.",
            ),
            ...live.map((e) => {
                const refs = actionRefsOf(e);
                const id = String(e.id ?? "?");
                return h(
                    "div",
                    {
                        key: id,
                        style: { ...S.row, borderTop: "1px solid rgba(255,255,255,0.06)" },
                    },
                    h("span", {
                        style: { ...S.chip, cursor: "pointer" },
                        onClick: () => onGoTo(category),
                    }, id),
                    // Numbered, because the order is the point: "log, then convert"
                    // and "convert, then log" are different behaviours.
                    ...refs.map((r, i) =>
                        h("span", { key: `${id}:${i}`, style: S.codeKey }, `${i + 1}. ${r.key}`)
                    ),
                );
            }),
        );
    }).filter((n) => n !== null);
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
    // The snippet is the **process** form, not the pre-split one. It used to emit
    // `{ handlerKey, scope, options }` — a shape none of the seven tabs reads any
    // more, so a snippet that pasted cleanly and then did nothing was worse than no
    // snippet at all. `scope` goes too: it was a field on a *handler*, and a process
    // has no scope of its own.
    const snippet = JSON.stringify(
        { actions: [{ key: m.key, options: buildHandlerOptions(m, values) }] },
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
            h("button", { style: S.chip, onClick: () => onCopy(snippet) }, "Copy as a process"),
            // Spelled out, because a one-action `actions` array is not what a reader
            // expects from a "snippet" and the shape is the whole point of it.
            h("span", { style: S.hint }, "paste into the entry's Process field"),
        ),
        h("pre", { style: S.codeBlock }, snippet),
    );
}
