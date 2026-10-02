
import type { HandlerMeta, HandlerUsage } from "../../handler/index.ts";
import {
    ACTION_DOMAIN_BLURBS,
    ACTION_DOMAIN_LABELS,
    ACTION_EFFECT_BLURBS,
    ACTION_EFFECT_LABELS,
    type ActionDomain,
    type ActionEffect,
    domainOf,
    effectOf,
} from "../../handler/index.ts";
import {
    ALL_CALL_SITES,
    CALL_SITE_SCOPE,
    canRunAtUnknown,
    describeNeeds,
    type MaybeCallSite,
    type MaybeScopeNeed,
    needsOfUnknown,
    SCOPE_NEED_BLURBS,
    SCOPE_NEED_LABELS,
    SCOPE_NEEDS,
} from "../../handler/index.ts";
import { actionRefsOf, CALL_SITE_LABELS } from "../../handler/index.ts";
import {
    PROJECTILE_OPTION_DOCS,
    PROJECTILE_OPTIONS,
    projectileOptionParams,
    resolveProjectileOption,
} from "../../handler/processing/projectile-option/index.ts";
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
} from "../../handler/index.ts";
import { BLOCK_KEY } from "../../handler/index.ts";


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
} from "../../handler/processing/excavation-option/index.ts";
import { ACTION_DOCS } from "../../handler/index.ts";
import * as S from "../styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;


export interface HandlersTabState {
    
    open: string | null;
    
    values: Record<string, Record<string, string>>;
    
    query: string;
    
    domain: string;
    
    effect: string;
    
    need: MaybeScopeNeed;
    callSite: MaybeCallSite;
    
    
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
    
    onGoTo: Click;
    
    onCopy: (text: string) => void;
}


const PROCESS_SLOTS: { slot: string; category: string; label: string }[] = [
    { slot: "signal", category: "signals", label: "Signals — structure click" },
    { slot: "trigger", category: "triggers", label: "Triggers — timed tick" },
    
    
    
    
    
    { slot: "processing", category: "processing", label: "Processing — process step" },
    { slot: "upgrade", category: "upgrades", label: "Upgrades — level bought" },
    { slot: "modifier", category: "modifiers", label: "Modifiers — engine hook" },
    { slot: "itemAction", category: "items", label: "Items — used" },
];

const API_SECTION_KEY = "(no api — the action reaches for nothing)";


export function filterActions(
    metas: readonly HandlerMeta[],
    state: HandlersTabState,
    used: Record<string, HandlerUsage[]>,
    docs: Record<string, string>,
): HandlerMeta[] {
    const q = state.query.trim().toLowerCase();
    
    
    
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
            if (state.need && !needsOfUnknown(m.key).includes(state.need)) return false;
            if (state.callSite && !canRunAtUnknown(m.key, state.callSite)) return false;
            if (!q) return true;
            
            
            
            const hay = `${m.key} ${docs[m.key] ?? ""} ${domainOf(m.key) ?? ""} ${
                effectOf(m.key) ?? ""
            } ${m.slots.join(" ")}`.toLowerCase();
            return hay.includes(q);
        });
}


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
            
            
            
            return `${key} ${PROJECTILE_OPTION_DOCS[key] ?? ""}`.toLowerCase().includes(q);
        })
        .map((key) => ({
            key,
            doc: PROJECTILE_OPTION_DOCS[key] ?? "(no description)",
            params: projectileOptionParams(key),
        }));
}


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
            
            
            return `${key} ${EXCAVATION_OPTION_DOCS[key] ?? ""}`.toLowerCase().includes(q);
        })
        .map((key) => ({
            key,
            doc: EXCAVATION_OPTION_DOCS[key] ?? "(no description)",
            params: excavationOptionParams(key),
        }));
}


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


function filterBar(
    h: H,
    state: HandlersTabState,
    setState: (n: HandlersTabState) => void,
    used: Record<string, HandlerUsage[]>,
    shown: number,
    total: number,
    
    listed: readonly HandlerMeta[],
): unknown {
    const set = (patch: Partial<HandlersTabState>) => setState({ ...state, ...patch });
    const toggleVal = (field: "domain" | "effect" | "need" | "callSite", v: string) =>
        set({ [field]: state[field] === v ? "" : v } as Partial<HandlersTabState>);

    
    
    
    
    
    
    
    
    
    
    
    
    const present = <V extends string>(all: readonly V[], of: (key: string) => V | undefined) =>
        all.filter((v) => listed.some((m) => of(m.key) === v));

    const domains = present(Object.keys(ACTION_DOMAIN_LABELS) as ActionDomain[], domainOf);
    const effects = present(Object.keys(ACTION_EFFECT_LABELS) as ActionEffect[], effectOf);
    const needs = [...SCOPE_NEEDS];
    const sites = ALL_CALL_SITES;

    
    
    
    
    
    
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
                
                
                
                
                
                placeholder: `Search ${total} actions…`,
                onInput: (e: { currentTarget: { value: string } }) =>
                    set({ query: e.currentTarget.value }),
            }),
            chip(
                h,
                state.onlyUsed ? "In use only" : "All",
                state.onlyUsed,
                () => set({ onlyUsed: !state.onlyUsed }),
                
                
                
                state.onlyUsed
                    ? "In use only — showing actions a process uses. Click for all."
                    : "All — showing every action. Click for 'In use only' to hide the ones nothing uses.",
            ),
            h("span", { style: S.hint }, `${shown}/${total}`),
        ),
        
        
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
    
    
    
    
    const docs = { ...ACTION_DOCS, ...BLOCK_DOC };
    const used = usageIndex(cfg);
    const bad = unreachableHandlers(cfg);

    const { toggle, setParam } = paramEditor(state, setState);

    
    
    
    
    
    
    
    
    
    
    
    
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

    
    
    
    const processGroups = processGroupsFor(h, cfg, onGoTo);

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        
        
        
        
        
        
        
        
        
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


export function renderUpgradeActions(props: HandlersTabProps): unknown {
    const { h, cfg, state, setState, onCopy } = props;
    const docs = ACTION_DOCS;
    const used = usageIndex(cfg);
    const { toggle, setParam } = paramEditor(state, setState);

    const listed = handlersOnlyAtSlot("upgrade");
    const shown = filterActions(listed, state, used, docs);

    
    
    
    
    
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


export type FixedCatalogue = "projectileOption" | "excavationOption";


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

    
    
    
    const usage = isProjectile
        ? scanProjectileOptionUsage(ctx.cfg)
        : scanExcavationOptionUsage(ctx.cfg);
    const used: Record<string, number> = {};
    for (const u of usage) if (u.key) used[u.key] = (used[u.key] ?? 0) + 1;
    
    
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


function renderOptionRow(
    o: { key: string; doc: string; params: { key: string; def: number | boolean }[] },
    ctx: { h: H; used: Record<string, number> },
): unknown {
    const { h } = ctx;
    const count = ctx.used[o.key] ?? 0;
    
    
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
                    
                    
                    ...refs.map((r, i) =>
                        h("span", { key: `${id}:${i}`, style: S.codeKey }, `${i + 1}. ${r.key}`)
                    ),
                );
            }),
        );
    }).filter((n) => n !== null);
}



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

    // renderRow also draws the block pseudo-entry, whose key is not an action
    const needs = needsOfUnknown(m.key);
    const effect = effectOf(m.key);
    const domain = domainOf(m.key);
    
    
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

    
    const errs = validateHandlerParams(m, values);
    
    
    
    
    
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
            
            
            h("span", { style: S.hint }, "paste into the entry's Process field"),
        ),
        h("pre", { style: S.codeBlock }, snippet),
    );
}


function renderExcavationOptionRow(
    o: { key: string; doc: string; params: { key: string; def: number | boolean }[] },
    ctx: { h: H; used: Record<string, number> },
): unknown {
    const { h } = ctx;
    const count = ctx.used[o.key] ?? 0;
    
    
    const sample = resolveExcavationOption(o.key)?.({}) ?? {};
    
    
    
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
