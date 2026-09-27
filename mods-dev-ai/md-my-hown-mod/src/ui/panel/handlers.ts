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
import type { HandlerMeta, HandlerUsage } from "../../hooks/handler-registry.ts";
import {
    ACTION_DOMAIN_BLURBS,
    ACTION_DOMAIN_LABELS,
    ACTION_EFFECT_BLURBS,
    ACTION_EFFECT_LABELS,
    type ActionDomain,
    type ActionEffect,
    domainOf,
    effectOf,
} from "../../hooks/action-class.ts";
import {
    CALL_SITE_SCOPE,
    canRunAt,
    describeNeeds,
    needsOf,
    SCOPE_NEED_BLURBS,
    SCOPE_NEED_LABELS,
    SCOPE_NEEDS,
    type ScopeNeed,
} from "../../hooks/scope.ts";
import { actionRefsOf, CALL_SITE_LABELS } from "../../hooks/process.ts";
import {
    buildHandlerOptions,
    HANDLER_META,
    HANDLER_SCOPE_LABELS,
    HANDLER_SLOT_LABELS,
    unreachableHandlers,
    usageIndex,
    validateHandlerParams,
} from "../../hooks/handler-registry.ts";
import { allHandlerDocs } from "../../hooks/handlers.ts";
import * as S from "../styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

export interface HandlersTabState {
    /** Handler key whose parameter form is open, or null. */
    open: string | null;
    /** Live parameter values for the open handler. */
    values: Record<string, Record<string, string>>;
    /**
     * Free-text filter over key, description and domain. Empty means "no filter".
     *
     * Kept as the raw string rather than a debounced copy because the list is 46
     * rows: filtering it is cheaper than re-rendering the input on a timer, and a
     * debounce that lags behind the caret is worse than a little work per keystroke.
     */
    query: string;
    /** Domain filter. Empty means "every domain". */
    domain: string;
    /** Effect filter. Empty means "every effect". */
    effect: string;
    /** Scope filter — show only actions that need this. Empty means "any". */
    need: string;
    /** Call-site filter — show only actions that can run here. Empty means "any". */
    callSite: string;
    /** When true, hide actions no process currently uses. */
    onlyUsed: boolean;
}

export function initialHandlersState(): HandlersTabState {
    return {
        open: null,
        values: {},
        query: "",
        domain: "",
        effect: "",
        need: "",
        callSite: "",
        onlyUsed: false,
    };
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
 * The list, filtered.
 *
 * Split out as a pure function because it is the only interesting logic on this
 * screen and it is the part worth testing: the axes are *independent*, so the
 * failure mode is a filter that silently does nothing, and that is much easier to
 * catch in a unit test than by clicking through chips.
 *
 * The axes answer three genuinely different questions, which is why they are all
 * here rather than one "category" that pretends to be a taxonomy:
 *
 *   - **scope** — what the engine must hand it. The only axis that decides whether
 *     a process *can* use it, so it is also the filter that answers "what can I put
 *     in this trigger".
 *   - **effect** — what it does. Measured; the difference between `returns` and
 *     `commits` is the one that matters.
 *   - **domain** — what it is about. Declared, because a domain is a naming
 *     decision no probe can read.
 */
export function filterActions(
    metas: readonly HandlerMeta[],
    state: HandlersTabState,
    used: Record<string, HandlerUsage[]>,
    docs: Record<string, string>,
): HandlerMeta[] {
    const q = state.query.trim().toLowerCase();
    return [...metas]
        .sort((a, b) => a.key.localeCompare(b.key))
        .filter((m) => {
            if (state.onlyUsed && !(used[m.key] ?? []).length) return false;
            if (state.domain && domainOf(m.key) !== state.domain) return false;
            if (state.effect && effectOf(m.key) !== state.effect) return false;
            if (state.need && !needsOf(m.key).includes(state.need as ScopeNeed)) return false;
            if (state.callSite && !canRunAt(m.key, state.callSite)) return false;
            if (!q) return true;
            // Search the things a reader would actually type. The description is in
            // here because "convert" should find `processorConvert` even if they never
            // learned the key, and the domain because "energy" should find all seven.
            const hay = `${m.key} ${docs[m.key] ?? ""} ${domainOf(m.key) ?? ""} ${
                effectOf(m.key) ?? ""
            } ${m.slots.join(" ")}`.toLowerCase();
            return hay.includes(q);
        });
}

/** One clickable chip. `active` is the selected state. */
function chip(
    h: H,
    label: string,
    active: boolean,
    onClick: () => void,
    title?: string,
    count?: number,
): unknown {
    return h(
        "button",
        {
            style: active ? S.chipActive : S.chip,
            onClick,
            title: title ?? label,
        },
        label,
        count === undefined ? null : ` ${count}`,
    );
}

/** The filter bar: a search box, then one row of chips per axis. */
function filterBar(
    h: H,
    state: HandlersTabState,
    setState: (n: HandlersTabState) => void,
    used: Record<string, HandlerUsage[]>,
    shown: number,
    total: number,
): unknown {
    const set = (patch: Partial<HandlersTabState>) => setState({ ...state, ...patch });
    const toggleVal = (field: "domain" | "effect" | "need" | "callSite", v: string) =>
        set({ [field]: state[field] === v ? "" : v } as Partial<HandlersTabState>);

    const domains = Object.keys(ACTION_DOMAIN_LABELS) as ActionDomain[];
    const effects = Object.keys(ACTION_EFFECT_LABELS) as ActionEffect[];
    const needs = [...SCOPE_NEEDS];
    const sites = Object.keys(CALL_SITE_SCOPE);

    return h(
        "div",
        { style: { ...S.card, marginBottom: 8 } },
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", {
                style: { ...S.input, flex: 1 },
                value: state.query,
                placeholder: "Search 46 actions…",
                onInput: (e: { currentTarget: { value: string } }) =>
                    set({ query: e.currentTarget.value }),
            }),
            chip(
                h,
                state.onlyUsed ? "In use only" : "All",
                state.onlyUsed,
                () => set({ onlyUsed: !state.onlyUsed }),
                // Both states named in the title, so the control explains itself
                // without having to be clicked into its other state first — and so
                // the screen can be read without hover.
                state.onlyUsed
                    ? "In use only — showing actions a process uses. Click for all."
                    : "All — showing every action. Click for 'In use only' to hide the ones nothing uses.",
            ),
            h("span", { style: S.hint }, `${shown}/${total}`),
        ),
        // Each axis is a labelled row, so it is obvious that a *combination* of
        // filters is running rather than one mystery category.
        ...([
            [
                "Needs",
                needs.map((n) =>
                    chip(
                        h,
                        SCOPE_NEED_LABELS[n],
                        state.need === n,
                        () => toggleVal("need", n),
                        SCOPE_NEED_BLURBS[n],
                    )
                ),
                state.need,
                "need",
            ],
            [
                "Effect",
                effects.map((e) =>
                    chip(
                        h,
                        ACTION_EFFECT_LABELS[e],
                        state.effect === e,
                        () => toggleVal("effect", e),
                        ACTION_EFFECT_BLURBS[e],
                    )
                ),
                state.effect,
                "effect",
            ],
            [
                "Domain",
                domains.map((d) =>
                    chip(
                        h,
                        ACTION_DOMAIN_LABELS[d],
                        state.domain === d,
                        () => toggleVal("domain", d),
                        ACTION_DOMAIN_BLURBS[d],
                    )
                ),
                state.domain,
                "domain",
            ],
            [
                "Runs on",
                sites.map((s) =>
                    chip(
                        h,
                        CALL_SITE_LABELS[s as keyof typeof CALL_SITE_LABELS] ?? s,
                        state.callSite === s,
                        () => toggleVal("callSite", s),
                        `Only actions a ${s} process can actually run`,
                    )
                ),
                state.callSite,
                "callSite",
            ],
        ] as const).map(([label, chipsFor, active]) =>
            h(
                "div",
                {
                    key: label,
                    style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 4,
                        flexWrap: "wrap",
                    },
                },
                h("span", { style: { ...S.label, minWidth: 58, opacity: 0.6 } }, label),
                ...chipsFor,
                active
                    ? h(
                        "button",
                        {
                            style: { ...S.chip, opacity: 0.7 },
                            onClick: () =>
                                set({
                                    [label === "Runs on" ? "callSite" : label.toLowerCase()]: "",
                                } as Partial<HandlersTabState>),
                        },
                        "clear",
                    )
                    : null,
            )
        ),
    );
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

    // ── the list, filtered on three independent axes ─────────────────────────
    //
    // It used to be collapsible blocks, grouped by `api.*` then by `cls`. That
    // grouping is gone for a measured reason: `api` is ambient (it lives on
    // `globalThis`, so every call site has it) and 33 of 46 actions call none, so
    // it put four fifths of the catalogue under one heading. A flat alphabetical
    // list with real filters is more honest than a hierarchy built on a fiction.
    const shown = filterActions(HANDLER_META, state, used, docs);
    const bar = filterBar(h, state, setState, used, shown.length, HANDLER_META.length);

    const rows = shown.map((m) =>
        renderRow(m, { h, state, used, docs, toggle, setParam, onCopy, onGoTo })
    );

    const list = shown.length === 0
        ? h(
            "div",
            { style: S.card },
            h("div", { style: S.hint }, "No action matches those filters."),
            h(
                "div",
                { style: S.hint },
                "That is often the answer rather than a dead end — a trigger really cannot ",
                "run anything that needs a position, because the engine calls it with no arguments.",
            ),
        )
        : h("div", { style: { ...S.card, paddingTop: 2, paddingBottom: 2 } }, ...rows);

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
            `${HANDLER_META.length} actions, listed alphabetically. Filter by what an action `,
            "needs from the engine, what it does, or what it is about. A process is an ordered ",
            "list of them — the second half of this screen lists yours.",
        ),
        warnings,
        bar,
        h(
            "div",
            { style: { ...S.sectionTitle, marginTop: 8 } },
            `Actions${shown.length === HANDLER_META.length ? "" : ` (${shown.length})`}`,
        ),
        list,
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

    const needs = needsOf(m.key);
    const effect = effectOf(m.key);
    const domain = domainOf(m.key);
    // Only worth flagging when a value is returned and *no* slot this action can
    // run in reads one. On `projectile` it is read, so the flag would be noise.
    const vacuous = m.slots.every((s) => CALL_SITE_SCOPE[s] && !CALL_SITE_SCOPE[s].ret) &&
        effect === "returns";

    const axisChips = [
        domain
            ? h(
                "span",
                { key: "d", style: S.tagChip, title: ACTION_DOMAIN_BLURBS[domain] },
                ACTION_DOMAIN_LABELS[domain],
            )
            : null,
        effect
            ? h(
                "span",
                { key: "e", style: S.tagChip, title: ACTION_EFFECT_BLURBS[effect] },
                ACTION_EFFECT_LABELS[effect],
            )
            : null,
        h(
            "span",
            {
                key: "n",
                style: S.tagChip,
                title: needs.length
                    ? needs.map((n) => SCOPE_NEED_BLURBS[n]).join("\n")
                    : "Needs nothing from the engine, so it runs anywhere.",
            },
            `needs: ${describeNeeds(needs)}`,
        ),
        vacuous
            ? h(
                "span",
                {
                    key: "v",
                    style: { ...S.tagChip, borderColor: "#c0392b" },
                    title: "This action returns a value, but no slot it can run in reads one — " +
                        "the value is computed and discarded. Open decision in PLAN.md.",
                },
                "return discarded",
            )
            : null,
    ];

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
        h("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, ...axisChips),
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
