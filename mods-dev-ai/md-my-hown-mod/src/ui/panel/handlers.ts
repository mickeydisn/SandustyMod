/**
 * The two handler screens: the **Actions** catalogue and the **Projectile options**
 * catalogue.
 *
 * Both live here because they are one feature with two halves, and each is its own
 * tab in the Handlers menu group. The sub-nav is the switcher.
 *
 * Handlers live in code, not JSON, so this is not a CRUD list of stored entries.
 * The action screen answers the four questions an author actually has:
 *
 *   1. What can this mod run, and what kind of thing is it?   (domain + effect)
 *   2. What must the engine hand it, and where is that available?  (scope + slots)
 *   3. How wide is it, and what does it read?                 (scope + params)
 *   4. Am I already using it, and is that use even legal?     (usage + reach)
 *
 * The last one is the valuable bit: a config can reference a handler from a
 * slot that handler cannot serve (hand-edited JSON, or a handler whose type
 * changed since). Those are listed at the top in red rather than failing
 * silently in-game.
 */
import type { HandlerMeta, HandlerUsage } from "../../handler/core/handler-registry.ts";
import {
    ACTION_DOMAIN_BLURBS,
    ACTION_DOMAIN_LABELS,
    ACTION_EFFECT_BLURBS,
    ACTION_EFFECT_LABELS,
    type ActionDomain,
    type ActionEffect,
    domainOf,
    effectOf,
} from "../../handler/core/action-class.ts";
import {
    CALL_SITE_SCOPE,
    canRunAt,
    describeNeeds,
    needsOf,
    SCOPE_NEED_BLURBS,
    SCOPE_NEED_LABELS,
    SCOPE_NEEDS,
    type ScopeNeed,
} from "../../handler/core/scope.ts";
import { actionRefsOf, CALL_SITE_LABELS } from "../../handler/core/process.ts";
import {
    PROJECTILE_OPTION_DOCS,
    PROJECTILE_OPTIONS,
    projectileOptionParams,
    resolveProjectileOption,
} from "../../handler/projectile-option/index.ts";
import {
    BLOCK_META,
    buildHandlerOptions,
    HANDLER_META,
    HANDLER_SCOPE_LABELS,
    HANDLER_SLOT_LABELS,
    handlersOnlyAtSlot,
    isOnlyAtSlot,
    scanExcavationOptionUsage,
    scanProjectileOptionUsage,
    unreachableHandlers,
    usageIndex,
    validateHandlerParams,
} from "../../handler/core/handler-registry.ts";
import { BLOCK_KEY } from "../../handler/core/types.ts";

/**
 * What the `if` row says in this list.
 *
 * A block has no domain, no effect and no needs, so the axis chips would all exclude
 * it — and an entry that vanishes the moment you touch any filter reads as "there is
 * nothing here", which is the same misleading silence the projectile options avoid by
 * not offering those filters at all. The block is therefore listed, and drops out as
 * soon as an axis filter is set, which is *correct*: "show me actions needing a
 * position" has no answer that includes a conditional.
 */
const BLOCK_DOC: Record<string, string> = {
    [BLOCK_KEY]: "if(when a bound variable is truthy) run one list of steps, otherwise run " +
        "another. Both branches are compiled; only the chosen one runs. Branches may " +
        "contain further blocks, up to 8 deep. Not an action — it makes no api call.",
};
import {
    EXCAVATION_OPTION_DOCS,
    EXCAVATION_OPTIONS,
    excavationOptionParams,
    resolveExcavationOption,
} from "../../handler/excavation-option/index.ts";
import { ACTION_DOCS } from "../../handler/actions/index.ts";
import * as S from "../styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

/**
 * State for **both** handler screens.
 *
 * One object, two tabs. `action` and `projectileOption` are two tabs in the
 * same menu group, so the sub-nav is the switcher and this state has no notion of
 * which one is showing.
 *
 * The fields are still shared because the two screens genuinely share two of them:
 * `query` and `onlyUsed` mean the same thing in both. The axis filters are action-only
 * and are inert on the options tab, which has no needs, effects or call sites.
 */
export interface HandlersTabState {
    /** Handler key whose parameter form is open, or null. */
    open: string | null;
    /** Live parameter values for the open handler. */
    values: Record<string, Record<string, string>>;
    /**
     * Free-text filter over key, description and domain. Empty means "no filter".
     *
     * Kept as the raw string rather than a debounced copy because the list is 39
     * rows: filtering it is cheaper than re-rendering the input on a timer, and a
     * debounce that lags behind the caret is worse than a little work per keystroke.
     */
    query: string;
    /** Domain filter. Empty means "every domain". Action tab only. */
    domain: string;
    /** Effect filter. Empty means "every effect". Action tab only. */
    effect: string;
    /** Scope filter — show only actions that need this. Empty means "any". */
    need: string;
    /** Call-site filter — show only actions that can run here. Empty means "any". */
    callSite: string;
    /** When true, hide entries nothing currently uses. */
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
    // **No `projectile` row**, and its absence is the point. This table feeds
    // "Processes in use", which reads `actionRefsOf` — and a projectile stores a
    // single `option`, so it has no process and this row could only ever have
    // rendered an empty list. It survived the projectile-option split as a heading
    // promising a section that did not exist.
    { slot: "processing", category: "processing", label: "Processing — process step" },
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
    // A block is not an action, so it is present in the list but answers none of the
    // four axes. See `BLOCK_DOC` above: an entry that disappears the instant a filter
    // is set looks like an empty catalogue rather than a correct exclusion.
    const axisFilterSet = !!(state.domain || state.effect || state.need || state.callSite);
    return [...metas]
        .sort((a, b) => a.key.localeCompare(b.key))
        .filter((m) => {
            if (m.type === "block") {
                if (axisFilterSet) return false;
                return !q || `${m.key} ${docs[m.key] ?? ""}`.toLowerCase().includes(q);
            }
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

/**
 * The projectile options, filtered by the shared search box.
 *
 * A separate, much smaller function than `filterActions`, and that asymmetry is the
 * design: the four axis chips (needs / effect / domain / runs-on) are questions
 * about an **action**, and an option answers none of them. It has no needs — it is
 * called with nothing — no effect — it does nothing — and no call site. Applying
 * those filters here would produce a list that is always empty, which reads as "no
 * options available" rather than "these filters do not apply to options".
 *
 * So only `query` and `onlyUsed` carry over, and both mean what they meant before.
 * Kept pure and separate so the rule is testable without rendering anything.
 */
export function filterProjectileOptions(
    query: string,
    onlyUsed: boolean,
    used: Record<string, number>,
): { key: string; doc: string; params: { key: string; def: number | boolean }[] }[] {
    const q = query.trim().toLowerCase();
    return Object.keys(PROJECTILE_OPTIONS)
        .sort()
        .filter((key) => {
            if (onlyUsed && !(used[key] ?? 0)) return false;
            if (!q) return true;
            // The doc is searched as well as the key, so "homing" and "digging" both
            // find something. The field names are in the doc's own text, so adding
            // them here would be redundant.
            return `${key} ${PROJECTILE_OPTION_DOCS[key] ?? ""}`.toLowerCase().includes(q);
        })
        .map((key) => ({
            key,
            doc: PROJECTILE_OPTION_DOCS[key] ?? "(no description)",
            params: projectileOptionParams(key),
        }));
}

/**
 * The excavation options, filtered by the shared search box.
 *
 * A third copy of the rule `filterProjectileOptions` already states, deliberately
 * kept parallel rather than merged. The asymmetry that function's comment defends —
 * axis filters are questions about an *action*, and an option answers none of them —
 * applies identically here, and a shared generic would need a filter interface the
 * two catalogues do not otherwise share.
 */
export function filterExcavationOptions(
    query: string,
    onlyUsed: boolean,
    used: Record<string, number>,
): { key: string; doc: string; params: { key: string; def: number | boolean }[] }[] {
    const q = query.trim().toLowerCase();
    return Object.keys(EXCAVATION_OPTIONS)
        .sort()
        .filter((key) => {
            if (onlyUsed && !(used[key] ?? 0)) return false;
            if (!q) return true;
            // The doc is searched as well as the key, so "drill" and "blast" both find
            // something.
            return `${key} ${EXCAVATION_OPTION_DOCS[key] ?? ""}`.toLowerCase().includes(q);
        })
        .map((key) => ({
            key,
            doc: EXCAVATION_OPTION_DOCS[key] ?? "(no description)",
            params: excavationOptionParams(key),
        }));
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
    /** The actions this screen actually lists — the chips are derived from these. */
    listed: readonly HandlerMeta[],
): unknown {
    const set = (patch: Partial<HandlersTabState>) => setState({ ...state, ...patch });
    const toggleVal = (field: "domain" | "effect" | "need" | "callSite", v: string) =>
        set({ [field]: state[field] === v ? "" : v } as Partial<HandlersTabState>);

    // **Derived from `listed`, not from the global vocabularies.**
    //
    // A chip must only appear if it can select something. Offering one that no row
    // carries produces a control that looks real, takes a click, and returns an
    // empty list — which reads as "no actions match" and sends the reader off
    // debugging their own search. Two chips were in exactly that state: `projectiles`
    // (dead since the options became their own type) and `tech` (dead the moment
    // the upgrade-only actions moved to their own tab, which took 6 of its 7 rows).
    // Neither was a deliberate choice; both were a list of *possible* values being
    // mistaken for a list of *present* ones.
    // `domainOf`/`effectOf` take a **key**, so the predicate is lifted off the meta
    // rather than passed straight in.
    const present = <V extends string>(all: readonly V[], of: (key: string) => V | undefined) =>
        all.filter((v) => listed.some((m) => of(m.key) === v));

    const domains = present(Object.keys(ACTION_DOMAIN_LABELS) as ActionDomain[], domainOf);
    const effects = present(Object.keys(ACTION_EFFECT_LABELS) as ActionEffect[], effectOf);
    const needs = [...SCOPE_NEEDS];
    const sites = Object.keys(CALL_SITE_SCOPE);

    // A value that was selected and is no longer offered — the upgrade actions
    // leaving the list took `tech` with them, and the filters are shared state —
    // is **kept as a chip** rather than dropped. Dropping it would leave the list
    // filtered by a value with no visible control to clear, which is a dead end.
    // It renders as a selected chip whose label is the raw value, because it is
    // not in the label table any more and showing "undefined" would be worse.
    const effDomain = state.domain;
    const effEffect = state.effect;

    return h(
        "div",
        { style: { ...S.card, marginBottom: 8 } },
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", {
                style: { ...S.input, flex: 1 },
                value: state.query,
                // `total`, not a literal. This said "46" for months after the
                // catalogue was 39, and then after the projectile presets left it
                // entirely — a number in a placeholder that nothing recomputes is a
                // number that is wrong, and it is the one number a reader uses to
                // decide whether their search lost something.
                placeholder: `Search ${total} actions…`,
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
                // The selected value is appended if the row above no longer offers
                // it, so a filter that outlived its options is still clearable.
                [
                    ...effects,
                    ...(effEffect && !effects.includes(effEffect as ActionEffect)
                        ? [effEffect as ActionEffect]
                        : []),
                ].map((e) =>
                    chip(
                        h,
                        ACTION_EFFECT_LABELS[e] ?? e,
                        effEffect === e,
                        () => toggleVal("effect", e),
                        ACTION_EFFECT_BLURBS[e],
                    )
                ),
                effEffect,
                "effect",
            ],
            [
                "Domain",
                [
                    ...domains,
                    ...(effDomain && !domains.includes(effDomain as ActionDomain)
                        ? [effDomain as ActionDomain]
                        : []),
                ].map((d) =>
                    chip(
                        h,
                        ACTION_DOMAIN_LABELS[d] ?? d,
                        effDomain === d,
                        () => toggleVal("domain", d),
                        ACTION_DOMAIN_BLURBS[d],
                    )
                ),
                effDomain,
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

/**
 * Open/close handlers for a handler's parameter form, and a setter for one field.
 *
 * Extracted because the Actions and Upgrade-actions screens both need them and
 * they are pure functions of the shared state — duplicating them would mean two
 * copies of the "seed defaults on first open" rule, and a row that behaves
 * differently on one screen than the other.
 */
function paramEditor(
    state: HandlersTabState,
    setState: (n: HandlersTabState) => void,
): { toggle: (meta: HandlerMeta) => void; setParam: (k: string, f: string, v: string) => void } {
    return {
        toggle: (meta: HandlerMeta) => {
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
        },
        setParam: (key: string, field: string, v: string) => {
            setState({
                ...state,
                values: { ...state.values, [key]: { ...(state.values[key] ?? {}), [field]: v } },
            });
        },
    };
}

export function renderActions(props: HandlersTabProps): unknown {
    const { h, cfg, state, setState, onGoTo, onCopy } = props;
    // The block is merged in here, not in `HANDLER_META`. This tab is a *reference*,
    // and a reference that omits something a process can contain makes the whole block
    // feature look absent — which is exactly how it read when the only place it existed
    // was a dropdown inside one editor.
    const docs = { ...ACTION_DOCS, ...BLOCK_DOC };
    const used = usageIndex(cfg);
    const bad = unreachableHandlers(cfg);

    const { toggle, setParam } = paramEditor(state, setState);

    // ── the list, filtered on three independent axes ─────────────────────────
    //
    // A flat alphabetical list with real filters, not a hierarchy. Grouping by
    // `api.*` then by `cls` is a fiction: `api` is ambient (it lives on
    // `globalThis`, so every call site has it) and most actions call none, which put
    // four fifths of the catalogue under one heading.
    //
    // **The upgrade-only actions are excluded here.** They have their own tab, and
    // an action that can run in exactly one place does not belong in a list about
    // actions that run in many — listing the same 7 in both meant neither screen was
    // a clean answer to anything. The filter is `isOnlyAtSlot`, so this cannot
    // disagree with what the other tab shows.
    const listed = [
        ...HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade")),
        BLOCK_META,
    ];
    const shown = filterActions(listed, state, used, docs);
    const bar = filterBar(h, state, setState, used, shown.length, listed.length, listed);

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
        // No screen title and no intro paragraph.
        //
        // The sub-nav chip above already says "Actions", so a "Handlers" heading
        // directly beneath it named the *group* while the chip named the *screen* —
        // two labels for one thing, on top of each other. And the paragraph below it
        // explained a list the reader can already see: the chips name the axes
        // ("Needs", "Effect", "Domain", "Runs on") and the rows answer them. The one
        // fact worth keeping is not a fact about this screen, it is a fact about the
        // other one, so it lives there: a process is an ordered list of these.
        warnings,
        bar,
        h(
            "div",
            { style: { ...S.sectionTitle, marginTop: 8 } },
            `Actions${shown.length === listed.length ? "" : ` (${shown.length})`}`,
        ),
        list,
        h("div", { style: { ...S.sectionTitle, marginTop: 12 } }, "Processes in use"),
        processGroups.length ? h("div", null, ...processGroups) : h(
            "div",
            { style: S.hint },
            "None. A process is created on its own object's screen — a trigger, a processor, ",
            "a signal, an upgrade, a modifier or an item.",
        ),
    );
}

/**
 * The **Upgrade actions** screen: the actions an upgrade can run, and nothing else.
 *
 * A third tab, for the same reason the other two are separate. The question this
 * screen answers is "what can this upgrade do?", and it has exactly one answer — a
 * fixed set of 7 — so a filter on the general Actions list would make the reader
 * assemble that answer from a 32-row list while the same 7 sat in it too.
 *
 * ## What these are, and what they are not
 *
 * **Still ordinary `HandlerAction`s.** This is the one place the upgrade split
 * differs from the projectile one. A projectile holds a *single option* whose
 * return value is its configuration, so extracting those presets needed a new
 * function type (`ProjectileOptionFn`), a new stored shape, and a compiler. An
 * upgrade holds an ordered **list** of actions and the engine runs them in sequence,
 * so there is nothing to extract: these stay in `HANDLER_META`, keep their
 * parameters, and are dispatched by the same `compileProcess`. This is a view
 * split, not a model split.
 *
 * **Membership is derived, not listed.** `handlersOnlyAtSlot("upgrade")` asks the
 * `slots` array, so a new upgrade-only action appears here by construction. A
 * hand-kept list of the 7 would be a second table to drift.
 *
 * `noop` is deliberately absent. It *can* run at an upgrade, but it runs at all six
 * call sites — it is a wiring test, not an upgrade behaviour, and listing it here
 * would invite someone to use it as one.
 */
export function renderUpgradeActions(props: HandlersTabProps): unknown {
    const { h, cfg, state, setState, onCopy } = props;
    const docs = ACTION_DOCS;
    const used = usageIndex(cfg);
    const { toggle, setParam } = paramEditor(state, setState);

    const listed = handlersOnlyAtSlot("upgrade");
    const shown = filterActions(listed, state, used, docs);

    // Search and the in-use toggle, but **not** the four axis chips. Needs,
    // effect and domain are questions about an action in general, and "Runs on:
    // upgrade" is true of every row on this screen by definition — a chip that
    // filters to everything is a control that does nothing, which is worse than
    // no control. So the bar is deliberately shorter than the Actions one.
    const set = (patch: Partial<HandlersTabState>) => setState({ ...state, ...patch });
    const bar = h(
        "div",
        { style: { ...S.card, marginBottom: 8 } },
        h("input", {
            style: S.input,
            placeholder: "search upgrade actions…",
            value: state.query,
            onInput: (e: unknown) => set({ query: (e as { value: string }).value }),
        }),
        h(
            "div",
            { style: { display: "flex", gap: 6, alignItems: "center", marginTop: 6 } },
            chip(
                h,
                "in use only",
                state.onlyUsed,
                () => set({ onlyUsed: !state.onlyUsed }),
                "Hide actions no upgrade currently runs.",
            ),
            h("span", { style: S.chipCount }, `${shown.length} / ${listed.length}`),
        ),
    );

    const rows = shown.map((m) =>
        renderRow(m, { h, state, used, docs, toggle, setParam, onCopy, onGoTo: props.onGoTo })
    );

    const list = shown.length === 0
        ? h(
            "div",
            { style: S.card },
            h("div", { style: S.hint }, "No upgrade action matches that search."),
        )
        : h("div", { style: { ...S.card, paddingTop: 2, paddingBottom: 2 } }, ...rows);

    // Where they are actually used. An upgrade's process is an ordered list, so
    // the same action can appear several times with different options — showing
    // the stored refs, in order, is the only way to see "scale then add" versus
    // "add then scale".
    const ups = ((cfg.upgrades as Record<string, unknown>[] | undefined) ?? [])
        .map((e) => ({ id: String(e.id ?? "?"), refs: actionRefsOf(e) }))
        .filter((u) => u.refs.length > 0);

    const inUse = ups.length
        ? h(
            "div",
            null,
            ...ups.map((u) =>
                h(
                    "div",
                    { key: u.id, style: { ...S.card, marginBottom: 8, padding: 8 } },
                    h(
                        "div",
                        {
                            style: { ...S.chip, cursor: "pointer", display: "inline-block" },
                            onClick: () => props.onGoTo("upgrades"),
                        },
                        u.id,
                    ),
                    h(
                        "div",
                        { style: { ...S.hint, marginTop: 4 } },
                        u.refs.map((r, i) => `${i + 1}. ${r.key}`).join("  →  "),
                    ),
                )
            ),
        )
        : h(
            "div",
            { style: S.hint },
            "None. An upgrade's process is set on the Upgrades screen — this list is the ",
            "vocabulary, not the processes themselves.",
        );

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        // No title and no intro, for the same reason as the other two screens: the
        // sub-nav chip already says "Upgrade actions". The one thing worth saying —
        // that an upgrade runs these *in order*, and may repeat one — is shown by
        // the "In use" list rather than asserted in a paragraph.
        bar,
        h(
            "div",
            { style: { ...S.sectionTitle, marginTop: 8 } },
            `Upgrade actions${shown.length === listed.length ? "" : ` (${shown.length})`}`,
        ),
        list,
        h("div", { style: { ...S.sectionTitle, marginTop: 12 } }, "In use"),
        inUse,
    );
}

/**
 * The two "builds a value" catalogues, drawn **inline** under the entries they
 * qualify.
 *
 * These hold presets written in code — `PROJECTILE_OPTIONS` and
 * `EXCAVATION_OPTIONS` — compiled once and reused. There is no entry to create,
 * so there is no list to add one to, and no screen to add it on. The presets
 * themselves are the content, and they are drawn here rather than behind a
 * `+ New` button that navigated away from the list the author was reading.
 *
 * Kept as one function with a `kind` rather than two near-identical screens
 * because the *only* thing that differs is which registry is read and which noun
 * a broken reference is reported in. Two copies of the disclosure, the search
 * row and the row loop is two places for the three to drift.
 */
export type FixedCatalogue = "projectileOption" | "excavationOption";

/**
 * What a fixed catalogue needs to draw itself, wherever it is being drawn.
 *
 * Query and filter are passed as values with setters rather than as the shared
 * `HandlersTabState`, because the panel holds the state per *placement*: the
 * standalone screens keyed it by tab, and the inline sections key it by the
 * parent they sit under. Passing the two values is what lets one renderer serve
 * both without either knowing how the other stores it.
 */
export interface FixedCatalogueProps {
    h: H;
    cfg: Record<string, unknown>;
    query: string;
    onlyUsed: boolean;
    setQuery: (next: string) => void;
    setOnlyUsed: (next: boolean) => void;
}

export function renderFixedCatalogue(
    kind: FixedCatalogue,
    ctx: FixedCatalogueProps,
): unknown {
    const { h } = ctx;
    const isProjectile = kind === "projectileOption";

    // Both scanners return the same shape — the two option systems were split
    // apart but were not given different vocabularies — so one union handles
    // both and the loop below is written once.
    const usage = isProjectile
        ? scanProjectileOptionUsage(ctx.cfg)
        : scanExcavationOptionUsage(ctx.cfg);
    const used: Record<string, number> = {};
    for (const u of usage) if (u.key) used[u.key] = (used[u.key] ?? 0) + 1;
    // An entry naming a preset that no longer exists is a real state, so it is
    // reported rather than quietly falling back to the entry's own value.
    const bad = usage.filter((u) => u.problem);
    const shown = isProjectile
        ? filterProjectileOptions(ctx.query, ctx.onlyUsed, used)
        : filterExcavationOptions(ctx.query, ctx.onlyUsed, used);
    const total = isProjectile
        ? Object.keys(PROJECTILE_OPTIONS).length
        : Object.keys(EXCAVATION_OPTIONS).length;

    return h(
        "div",
        null,
        // **Outside** the disclosure. A config naming an option that no longer
        // exists is a broken reference, and hiding it behind a summary would
        // trade a visible error for an invisible one.
        ...bad.map((u) =>
            h(
                "div",
                {
                    key: `bad:${u.id}`,
                    style: { ...S.noteBox, borderColor: "#c0392b", marginBottom: 8 },
                },
                h(
                    "div",
                    { style: S.errorText },
                    `${isProjectile ? "Projectile" : "Profile"} ${u.id}: ${u.problem}`,
                ),
            )
        ),
        readOnlyCatalogue({
            h,
            title: isProjectile ? "Projectile options" : "Excavation options",
            shown: shown.length,
            total,
            body: [
                searchRow(ctx, shown.length, total),
                shown.length === 0 ? h("div", { style: S.hint }, "No option matches that.") : h(
                    "div",
                    { style: { ...S.card, paddingTop: 2, paddingBottom: 2 } },
                    ...shown.map((o) =>
                        isProjectile
                            ? renderOptionRow(o, { h, used })
                            : renderExcavationOptionRow(o, { h, used })
                    ),
                ),
            ],
        }),
    );
}

/**
 * The disclosure shell shared by both "builds a value" catalogues.
 *
 * These lists are **fixed**. The presets are written in code, compiled once and
 * reused, so there is no entry to create, add, remove, edit or delete — offering
 * a `+ New` or an `Edit` button on a row would promise a change the screen cannot
 * make. What the screen *is* is the list of the options this mod ships, so that
 * list is the whole content, inside one `summary` that names it.
 *
 * **Open by default.** A disclosure that starts closed hides the only thing the
 * screen has to show, and the reader has to click to learn how many options
 * exist. The summary is there to get the section *out* of the way once the reader
 * has what they came for, not to hold the list until asked.
 *
 * The count sits in the summary rather than under it, because the summary stays
 * visible when the section is open and the count does not.
 */
function readOnlyCatalogue(
    ctx: {
        h: H;
        title: string;
        shown: number;
        total: number;
        body: unknown[];
    },
): unknown {
    const { h } = ctx;
    const all = ctx.shown === ctx.total;
    return h(
        "details",
        // `open` is uncontrolled here: the browser owns the toggle, so the section
        // keeps its own state and does not need one threaded through the panel.
        { style: S.rowDetails, open: true },
        h(
            "summary",
            { style: S.rowSummary, title: "Hide these options" },
            h("span", { style: S.sectionTitle }, ctx.title),
            h(
                "span",
                { style: { ...S.hint, marginLeft: 8 } },
                all ? `${ctx.total} available` : `${ctx.shown} of ${ctx.total}`,
            ),
        ),
        ...ctx.body,
    );
}

/**
 * The search box and the `In use only` chip, shared by both catalogues.
 *
 * Neither writes to the config. The box narrows what is shown, and the chip picks
 * between "everything" and "the ones something actually names" — which is why
 * they can sit on a list with no `New` and no `Edit` and still be worth having.
 */
function searchRow(
    ctx: FixedCatalogueProps,
    shown: number,
    total: number,
): unknown {
    const { h } = ctx;
    return h(
        "div",
        { style: { ...S.card, display: "flex", gap: 8, alignItems: "center" } },
        h("input", {
            style: { ...S.input, flex: 1 },
            value: ctx.query,
            placeholder: "Search options…",
            onInput: (e: { currentTarget: { value: string } }) =>
                ctx.setQuery(e.currentTarget.value),
        }),
        chip(
            h,
            ctx.onlyUsed ? "In use only" : "All",
            ctx.onlyUsed,
            () => ctx.setOnlyUsed(!ctx.onlyUsed),
            ctx.onlyUsed
                ? "In use only — options something names. Click for all."
                : "All — every option. Click for 'In use only'.",
        ),
        h("span", { style: S.hint }, `${shown}/${total}`),
    );
}

/** One projectile option: its key, what it is for, and what it returns. */
function renderOptionRow(
    o: { key: string; doc: string; params: { key: string; def: number | boolean }[] },
    ctx: { h: H; used: Record<string, number> },
): unknown {
    const { h } = ctx;
    const count = ctx.used[o.key] ?? 0;
    // The real return value, so the row shows what the engine will get rather than
    // a claim about what it will get.
    const sample = resolveProjectileOption(o.key)?.({}) ?? {};
    return h(
        "div",
        { key: o.key, style: { ...S.row, flexDirection: "column", alignItems: "stretch", gap: 4 } },
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", { style: S.codeKey }, o.key),
            count > 0
                ? h(
                    "span",
                    { style: { ...S.tagChip, borderColor: "#4caf50" } },
                    `used ×${count}`,
                )
                : h("span", { style: { ...S.hint, opacity: 0.6 } }, "unused"),
            // Says what it *is*, which is the distinction the panel exists for: an
            // option's whole output is its return value.
            h("span", { style: { ...S.tagChip, borderColor: "#8e44ad" } }, "builds a value"),
        ),
        h("div", { style: S.hint }, o.doc),
        h(
            "div",
            { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
            ...Object.entries(sample).map(([k, v]) =>
                h(
                    "span",
                    { key: k, style: S.tagChip, title: `default ${String(v)}` },
                    `${k}: ${String(v)}`,
                )
            ),
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
    // The snippet is the **process** form, not the pre-split one. It must not emit
    // `{ handlerKey, scope, options }` — a shape none of the seven tabs reads, so a
    // snippet that pasted cleanly and then did nothing is worse than no
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

/**
 * One excavation option: its key, what it is for, and the value it builds.
 *
 * The same three facts as a projectile option, because it is the same kind of
 * thing. The one difference worth stating is *what* the value covers — an
 * excavation option sets only a profile's `power` and `options`; the `pattern`
 * and `terrainRules` stay with the author. Each row therefore carries a second
 * chip saying so, because without it the row reads as if the preset described
 * the whole dig.
 */
function renderExcavationOptionRow(
    o: { key: string; doc: string; params: { key: string; def: number | boolean }[] },
    ctx: { h: H; used: Record<string, number> },
): unknown {
    const { h } = ctx;
    const count = ctx.used[o.key] ?? 0;
    // The real return value, so the row shows what the engine will get rather than a
    // claim about what it will get.
    const sample = resolveExcavationOption(o.key)?.({}) ?? {};
    // Flattened for display: the `{ power, options: { … } }` nesting is the one
    // non-obvious thing about the return, and a row of flat chips says the same
    // thing without asking the reader to unfold a JSON object.
    const fields: [string, unknown][] = typeof sample.power === "number"
        ? [["power", sample.power], ...Object.entries(sample.options ?? {})]
        : Object.entries(sample.options ?? {});
    return h(
        "div",
        { key: o.key, style: { ...S.row, flexDirection: "column", alignItems: "stretch", gap: 4 } },
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", { style: S.codeKey }, o.key),
            count > 0
                ? h(
                    "span",
                    { style: { ...S.tagChip, borderColor: "#4caf50" } },
                    `used ×${count}`,
                )
                : h("span", { style: { ...S.hint, opacity: 0.6 } }, "unused"),
            // Says what it *is*, which is the distinction this screen exists for.
            h("span", { style: { ...S.tagChip, borderColor: "#8e44ad" } }, "builds a value"),
            h("span", { style: S.tagChip }, "power + flags only"),
        ),
        h("div", { style: S.hint }, o.doc),
        h(
            "div",
            { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
            ...fields.map(([k, v]) =>
                h(
                    "span",
                    { key: k, style: S.tagChip, title: `default ${String(v)}` },
                    `${k}: ${String(v)}`,
                )
            ),
        ),
    );
}
