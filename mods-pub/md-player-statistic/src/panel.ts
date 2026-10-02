/**
 * Player Statistic overlay panel.
 *
 * Home cards show configurable KPI groups. Other tabs list per-category
 * breakdowns from the live event buffer (no world scan).
 */
import {
    applyGraphMode,
    CfgSection,
    ChromeRows,
    colorFromId,
    COLORS,
    formatCount,
    GraphBlock,
    h,
    Header,
    Hint,
    isToolSelected,
    KpiCard,
    MiniHeader,
    posStyle,
    rawPointsFor,
    React,
    renderTrackingSection,
    resolveSelection,
    ROOT_CLASS,
    SelectableList,
    startDrag,
    styles,
    Tabs,
    toggleSelection,
} from "@sandmd/ui";
import type { ListRow } from "@sandmd/ui";
import {
    buffer,
    defaultCards,
    getCount,
    listSubKeys,
    loadCards,
    resetAll,
    resetSession,
    saveCards,
} from "./buffer.ts";
import { ITEM_ID, KPI_CATEGORIES, KPI_UNITS } from "./constants.ts";
import type { KpiCategory } from "./constants.ts";
import { getConfig, setSetting } from "./config.ts";
import { displayNameFor } from "./events.ts";
import { bootFromStorage, bump, setRepaint, state } from "./state.ts";
import type { HomeCardConfig, TabId } from "./types.ts";
import { store } from "./uiStore.ts";

const TABS: { id: TabId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "actions", label: "Structures" },
    { id: "items", label: "Items" },
    { id: "shoot", label: "Shoot" },
    { id: "terrain", label: "Dig" },
    { id: "move", label: "Move" },
    { id: "keys", label: "Keys" },
    { id: "config", label: "⚙️" },
];

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return "—";
    }
}

// —— Selectable list + graph (shared with md-word-statistic via @sandmd/ui) ——

/** Rows for one KPI category: its sub-keys as selectable list rows. */
function kpiRows(cat: string): ListRow[] {
    // One stable colour per sub-key, so the swatch and its graph line agree.
    // `id` stays the raw key: it is the selection key and indexes the series, so
    // renaming the label must not disturb either. Only `name` is resolved.
    return listSubKeys(cat).map((r) => ({
        id: r.key,
        name: displayNameFor(cat, r.key),
        count: r.count,
        color: colorFromId(r.key),
    }));
}

/**
 * History series for one sub-key, oldest → newest, in the current graph view.
 *
 * `diff` plots how much happened in each sampling interval; `total` plots the
 * running total. The raw history is always lifetime accumulators, so `total` is
 * just the history as stored — `applyGraphMode` picks which one comes out.
 *
 * `rawPointsFor` reads one extra sample in `diff` mode, because a diff series
 * loses its first value to the subtraction and would otherwise plot one point
 * short of the requested width.
 */
function kpiSeries(cat: string, subKey: string, session = false): number[] {
    const key = subKey ? `${cat}::${subKey}` : cat;
    const points = getConfig().historyMax;
    const mode = state.graphMode;
    return applyGraphMode(
        buffer.history
            .slice(-rawPointsFor(points, mode))
            .map((s) => {
                if (session) {
                    // Snapshots written before session capture have no
                    // `session` map, so fall back to the lifetime totals.
                    const src = s.session ?? s.totals;
                    return src[key] ?? 0;
                }
                return s.totals[key] ?? 0;
            }),
        mode,
    );
}

/** Flip the graph between accumulated totals and per-interval change. */
function toggleGraphMode(): void {
    state.graphMode = state.graphMode === "total" ? "diff" : "total";
    bump();
}

function selectionOf(cat: string, rows: ListRow[]): string[] {
    return resolveSelection(state.graphSelection[cat] ?? [], rows, 3);
}

function toggleOf(cat: string, id: string, rows: ListRow[]): void {
    state.graphSelection[cat] = toggleSelection(
        state.graphSelection[cat] ?? [],
        id,
        rows,
        3,
    );
    bump();
}

/**
 * Plot one row and nothing else.
 *
 * The checkbox is additive, so narrowing a busy category to a single metric
 * meant unticking the rest by hand. Solo replaces the whole selection with the
 * one id. Because the result is non-empty it survives `resolveSelection`, which
 * would otherwise snap an empty selection back to the top-3 default — and
 * ticking another row afterwards still adds to it, so solo is a starting point
 * rather than a mode you have to leave.
 */
function soloOf(cat: string, id: string): void {
    state.graphSelection[cat] = [id];
    bump();
}

/**
 * One KPI category rendered the way World Statistic renders its list tabs: a
 * heading with the running total, a history graph, and a checkbox list whose
 * ticks pick the plotted series.
 *
 * `session` switches the graph to the **session** counters instead of the
 * lifetime totals. Categories with no sub-keys — distance walked, collisions —
 * have nothing to break down, so plotting lifetime totals would show the whole
 * career on one axis; `session` is what makes those graphable per sampling
 * interval and is what the Move tab asks for.
 */
function KpiSection(
    cat: string,
    opts: { marginTop?: number; session?: boolean } = {},
): unknown {
    const e = h;
    if (!e) return null;
    const { marginTop = 0, session = false } = opts;
    const meta = KPI_CATEGORIES.find((c) => c.id === cat);
    const color = meta?.color ?? COLORS.dim;
    const total = getCount(cat);
    const rows = kpiRows(cat);

    // Single-value category: synthesise one row so the graph still renders.
    const single: ListRow[] = rows.length > 0 ? rows : [{
        id: cat,
        name: session ? "This session" : "Total",
        count: session ? getCount(cat, null, "session") : total,
        color,
    }];

    const tickable = rows.length > 0;
    const selected = selectionOf(cat, single);
    const perInterval = getConfig().timeRange;

    return e(
        "div",
        { style: { marginBottom: 16 } },
        e(
            "div",
            { style: { ...styles.groupTitle, marginTop } },
            `${meta?.label ?? cat} · ${
                formatKpi(cat, session ? getCount(cat, null, "session") : total)
            }`,
        ),
        e(
            "div",
            null,
            GraphBlock({
                title: `${session ? "This session" : "Lifetime"} · per ${perInterval} min · ` +
                    `last ${getConfig().historyMax}` +
                    (tickable ? " · tick rows to choose series" : ""),
                emptyText: tickable
                    ? undefined
                    : `No data points yet — one is recorded every ${perInterval} min. ` +
                        "Play a little and the graph fills in.",
                mode: state.graphMode,
                onModeToggle: toggleGraphMode,
                series: selected.map((id) => ({
                    id,
                    label: id,
                    color: colorFromId(id),
                    values: kpiSeries(cat, id === cat ? "" : id, session),
                })),
            }),
            tickable
                ? SelectableList({
                    rows: single,
                    selected,
                    onToggle: (id) => toggleOf(cat, id, single),
                    emptyText: "None yet",
                    // ◉ plots just this row. Filled while it is the only series,
                    // hollow otherwise — the count column already shows how
                    // many rows are on the graph.
                    trailing: (r) =>
                        e(
                            "button",
                            {
                                style: {
                                    ...styles.button,
                                    color: selected.length === 1 && selected[0] === r.id
                                        ? COLORS.accent
                                        : COLORS.dim,
                                },
                                title: "Plot only this metric",
                                onClick: () => soloOf(cat, r.id),
                            },
                            "◉",
                        ),
                })
                : null,
        ),
    );
}

/**
 * Card editor — replaces the whole panel body while open.
 *
 * Modelled on `md-word-statistic`'s editor so both mods are managed the same
 * way: the config tab's "Edit cards" button swaps the body for this, and the
 * bar at the top is the only way out (Cancel discards, Save persists).
 *
 * The item picker lists every KPI category rather than one hardcoded category,
 * so a card can hold any mix — `world_items_picked` and `resources_collected`
 * were previously reachable from no UI at all.
 */
function renderCardEditor(
    e: (...args: unknown[]) => unknown,
    closeEditor: (save: boolean) => void,
): unknown {
    const updateCard = (id: string, patch: Partial<HomeCardConfig>): void => {
        state.cards = state.cards.map((c) => c.id === id ? { ...c, ...patch } : c);
        bump();
    };

    const removeCard = (id: string): void => {
        state.cards = state.cards.filter((c) => c.id !== id);
        if (state.editFocusId === id) state.editFocusId = state.cards[0]?.id ?? null;
        bump();
    };

    const addCard = (): void => {
        // Starts empty rather than pre-seeded, so the picker drives the first
        // item and the ★ primary is chosen rather than assumed.
        const c: HomeCardConfig = { id: `card-${Date.now()}`, title: "New card", items: [] };
        state.cards = [...state.cards, c];
        state.editFocusId = c.id;
        bump();
    };

    const moveItem = (cardId: string, index: number, dir: -1 | 1): void => {
        const card = state.cards.find((c) => c.id === cardId);
        if (!card) return;
        const j = index + dir;
        if (j < 0 || j >= card.items.length) return;
        const items = card.items.slice();
        const tmp = items[index]!;
        items[index] = items[j]!;
        items[j] = tmp;
        updateCard(cardId, { items });
    };

    const removeItem = (cardId: string, index: number): void => {
        const card = state.cards.find((c) => c.id === cardId);
        if (!card) return;
        updateCard(cardId, { items: card.items.filter((_, i) => i !== index) });
    };

    const addItem = (cardId: string, category: string): void => {
        if (!category) return;
        const card = state.cards.find((c) => c.id === cardId);
        if (!card) return;
        // One line per category: a card shows a category total, so a repeat
        // would render the same number twice.
        if (card.items.some((it) => it.category === category && !it.key)) return;
        updateCard(cardId, { items: [...card.items, { category, key: "" }] });
    };

    /** Category id → human label, falling back to the id itself. */
    const labelOf = (cat: string): string => KPI_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;

    const head = e(
        "div",
        { style: styles.editorHeader },
        e(
            "div",
            { style: { color: COLORS.accent, fontWeight: 700, fontSize: 14 } },
            "Edit home cards",
        ),
        e(
            "div",
            { style: { color: COLORS.dim, fontSize: 11, marginTop: 4, lineHeight: 1.45 } },
            "Choose which KPIs appear on the Home tab. The first item on a card is primary " +
                "(larger weight for the card colour). Pick any category from the list.",
        ),
    );

    const bar = e(
        "div",
        { style: styles.editorBar },
        e("span", { style: { flex: 1 } }),
        e("button", { style: styles.button, onClick: addCard }, "+ New card"),
        e(
            "button",
            {
                style: styles.button,
                title: "Restore the default home cards",
                onClick: () => {
                    // Memory only — Save is the sole writer, so Cancel still
                    // discards this and Cancel after Save would not be
                    // reachable anyway.
                    state.cards = defaultCards();
                    bump();
                },
            },
            "Reset defaults",
        ),
        e("button", { style: styles.button, onClick: () => closeEditor(false) }, "Cancel"),
        e("button", { style: styles.buttonPrimary, onClick: () => closeEditor(true) }, "Save"),
    );

    const itemRow = (cardId: string, idx: number): unknown => {
        const it = state.cards.find((c) => c.id === cardId)!.items[idx]!;
        return e(
            "div",
            {
                key: `${it.category}:${it.key}:${idx}`,
                style: idx === 0 ? styles.itemRowPrimary : styles.itemRow,
            },
            e(
                "span",
                {
                    style: {
                        color: idx === 0 ? COLORS.accent : COLORS.dim,
                        minWidth: 14,
                    },
                },
                idx === 0 ? "★" : String(idx + 1),
            ),
            e(
                "span",
                { style: { color: COLORS.dim, minWidth: 140 } },
                labelOf(it.category),
            ),
            e(
                "span",
                {
                    style: {
                        color: COLORS.dim,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    },
                },
                it.key ? displayNameFor(it.category, it.key) : "total",
            ),
            e(
                "button",
                {
                    style: styles.button,
                    disabled: idx === 0,
                    onClick: () => moveItem(cardId, idx, -1),
                },
                "↑",
            ),
            e(
                "button",
                {
                    style: styles.button,
                    disabled: idx === state.cards.find((c) => c.id === cardId)!.items.length - 1,
                    onClick: () => moveItem(cardId, idx, 1),
                },
                "↓",
            ),
            e(
                "button",
                { style: styles.dangerBtn, onClick: () => removeItem(cardId, idx) },
                "×",
            ),
        );
    };

    const cardBody = (card: HomeCardConfig): unknown =>
        e(
            "div",
            { style: styles.editorCardBody },
            e("label", { style: styles.fieldLabel }, "Title"),
            e("input", {
                style: styles.input,
                type: "text",
                value: card.title,
                onChange: (ev: Event) => {
                    updateCard(card.id, {
                        title: (ev.target as HTMLInputElement).value,
                    });
                },
            }),
            e(
                "div",
                { style: { ...styles.fieldLabel, marginTop: 10 } },
                "Items (first = primary size & colour)",
            ),
            e(
                "div",
                { style: styles.itemList },
                ...card.items.map((_, idx) => itemRow(card.id, idx)),
            ),
            addRow(card),
            e(
                "div",
                { style: { color: COLORS.dim, fontSize: 10, marginTop: 6 } },
                "Primary item (★) sets the big number and the card border/text colour.",
            ),
        );

    /** Picker row: choose a KPI category, then add it to this card. */
    const addRow = (card: HomeCardConfig): unknown =>
        e(
            "div",
            { style: styles.addRow },
            e(
                "select",
                {
                    style: { ...styles.select, flex: 1 },
                    id: `add-cat-${card.id}`,
                    defaultValue: "",
                },
                e("option", { value: "" }, "— pick a KPI —"),
                ...KPI_CATEGORIES.map((c) => e("option", { key: c.id, value: c.id }, c.label)),
            ),
            e(
                "button",
                {
                    style: styles.buttonPrimary,
                    onClick: () => {
                        // The <select> is uncontrolled, so the chosen value is
                        // read back from the DOM on click rather than held in
                        // state — same trick the world-statistic editor uses.
                        const sel = globalThis.document
                            ?.getElementById?.(`add-cat-${card.id}`) as
                                | HTMLSelectElement
                                | null;
                        const val = sel?.value ?? "";
                        if (!val) return;
                        addItem(card.id, val);
                        if (sel) sel.value = "";
                    },
                },
                "Add",
            ),
        );

    const list = e(
        "div",
        { style: styles.editorList },
        ...state.cards.map((card) => {
            const open = state.editFocusId === card.id;
            return e(
                "div",
                { key: card.id, style: styles.editorCard },
                e(
                    "div",
                    {
                        style: styles.editorCardHead,
                        onClick: () => {
                            state.editFocusId = open ? null : card.id;
                            bump();
                        },
                    },
                    e("span", { style: { color: COLORS.accent } }, open ? "▾" : "▸"),
                    e("span", { style: styles.grow }, card.title || "(untitled)"),
                    e(
                        "span",
                        { style: { color: COLORS.dim } },
                        `${card.items.length} item${card.items.length === 1 ? "" : "s"}`,
                    ),
                    e(
                        "button",
                        {
                            style: styles.dangerBtn,
                            onClick: (ev: Event) => {
                                ev.stopPropagation();
                                removeCard(card.id);
                            },
                        },
                        "Delete",
                    ),
                ),
                open ? cardBody(card) : null,
            );
        }),
    );

    return e("div", { style: styles.editor }, head, bar, list);
}

/** A list tab: one `KpiSection` per category, stacked. */
function KpiTabBody(cats: string[]): unknown {
    const e = h;
    if (!e) return null;
    return e("div", null, ...cats.map((c, i) => KpiSection(c, { marginTop: i === 0 ? 0 : 8 })));
}

/** Format a KPI for display, rounding and appending its unit when it has one. */
function formatKpi(cat: string, n: number): string {
    const unit = KPI_UNITS[cat as KpiCategory];
    return unit ? `${formatCount(n)} ${unit}` : formatCount(n);
}

export function StatisticPanel(): unknown {
    const react = React;
    const e = h;
    if (!react || !e) return null;

    const [, setTick] = react.useState(0);

    react.useEffect(() => {
        setRepaint(setTick as any);
        return () => setRepaint(null);
    }, []);

    react.useEffect(() => {
        bootFromStorage();
        bump();
    }, []);

    // Light poll so live bumps from events show up without waiting for user input
    react.useEffect(() => {
        let alive = true;
        const poll = (): void => {
            if (!alive) return;
            bump();
            setTimeout(poll, 500);
        };
        const id = setTimeout(poll, 500);
        return () => {
            alive = false;
            clearTimeout(id);
        };
    }, []);

    if (!isToolSelected(ITEM_ID) && !state.locked) return null;

    const setTab = (id: string): void => {
        state.tab = id;
        if (id !== "config") state.editingCards = false;
        bump();
    };

    /**
     * Card editing replaces the whole body, so the entry point always parks on
     * the config tab first — that is where the editor returns to on Cancel or
     * Save. Cards are re-read from storage on entry so an abandoned edit never
     * becomes the thing you reopen onto.
     */
    const openEditor = (): void => {
        state.tab = "config";
        state.cards = loadCards();
        state.editingCards = true;
        state.editFocusId = state.cards[0]?.id ?? null;
        bump();
    };

    const closeEditor = (save: boolean): void => {
        // Discard reverts to the stored list, so Save is the only path that
        // writes. Cards are recomputed on bump, so no extra resolve is needed.
        if (save) saveCards(state.cards);
        else state.cards = loadCards();
        state.editingCards = false;
        bump();
    };

    // Always right-anchored so mini/max keeps the right edge fixed.
    const chrome = { state, store, bump };
    const onDrag = (ev: any): void => startDrag(ev, chrome);
    const place = posStyle(state);

    // —— Mini widget ——
    if (state.minimized) {
        const cards = state.resolvedCards;
        return e(
            "div",
            {
                className: ROOT_CLASS,
                style: {
                    ...styles.rootMini,
                    ...place,
                    cursor: state.dragging ? "grabbing" : undefined,
                },
            },
            MiniHeader(chrome),
            e(
                "div",
                { style: styles.miniBody },
                cards.length === 0
                    ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "No cards")
                    : cards.map((g) => {
                        const trend = g.delta;
                        const trendColor = trend == null || trend === 0
                            ? COLORS.dim
                            : trend > 0
                            ? COLORS.good
                            : COLORS.danger;
                        const trendLabel = trend == null
                            ? "—"
                            : trend > 0
                            ? `+${formatCount(trend)}`
                            : formatCount(trend);
                        return e(
                            "div",
                            {
                                key: g.id,
                                style: {
                                    ...styles.miniCard,
                                    borderLeftColor: g.color,
                                },
                            },
                            e("span", { style: styles.miniCardTitle }, g.title),
                            e(
                                "span",
                                { style: { ...styles.miniCardSum, color: g.color } },
                                formatCount(g.total),
                            ),
                            e(
                                "span",
                                {
                                    style: {
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: trendColor,
                                        fontVariantNumeric: "tabular-nums",
                                        minWidth: 36,
                                        textAlign: "right",
                                    },
                                    title: "Session Δ",
                                },
                                trendLabel,
                            ),
                        );
                    }),
            ),
        );
    }

    // —— Full panel ——
    const header = Header(chrome, { title: "Player Statistic" });

    const tabs = Tabs({
        tabs: TABS,
        active: state.tab,
        onSelect: setTab,
        hidden: state.editingCards,
    });

    let body: unknown = null;

    if (state.editingCards) {
        body = renderCardEditor(e, closeEditor);
    } else if (state.tab === "home") {
        const cards = state.resolvedCards;
        body = e(
            "div",
            null,
            cards.length === 0
                ? e(
                    "div",
                    { style: { color: COLORS.dim, fontSize: 12 } },
                    "No KPI cards — open ⚙️ to configure.",
                )
                : cards.map((g) => KpiCard(g)),
            e(
                "div",
                { style: { color: COLORS.dim, fontSize: 11, marginTop: 8 } },
                `Session since ${formatTime(buffer.sessionStartedAt)} · totals are lifetime`,
            ),
        );
    } else if (state.tab === "actions") {
        body = KpiTabBody([
            "structures_placed",
            "structures_removed",
            "structures_moved",
        ]);
    } else if (state.tab === "items") {
        body = e(
            "div",
            null,
            KpiSection("items_used"),
            Hint(
                "One count per use, from the engine's `action:intercept` action hook " +
                    "— which fires on the click that starts an action, so it covers " +
                    "built-in weapons and tools as well as modded ones. Structure " +
                    "placement rides the same hook but is excluded here; it is counted " +
                    "on the Structures tab instead. A built-in is labelled with its " +
                    "in-game name; an id the game does not know is shown as itself.",
            ),
        );
    } else if (state.tab === "shoot") {
        body = e(
            "div",
            null,
            KpiSection("projectiles_hit"),
            KpiSection("projectile_fire_structure", { marginTop: 8 }),
            Hint(
                "Counted from the `projectile:hit` and " +
                    "`projectile:fire:overStructure` hooks, broken down by " +
                    "`projectile.type` (bullet, rocket, grappling hook, fire, " +
                    "digger). Hits are every projectile that resolves an impact; " +
                    "fire over structure is the flamethrower's spread onto a " +
                    "structure cell. Both hooks can cancel the engine's own " +
                    "handling — this mod only observes, so nothing is suppressed.",
            ),
        );
    } else if (state.tab === "terrain") {
        body = KpiTabBody(["terrain_destroyed"]);
    } else if (state.tab === "move") {
        body = e(
            "div",
            null,
            KpiSection("distance_walked", { session: true }),
            KpiSection("collisions", { marginTop: 8, session: true }),
            Hint(
                "Distance is accumulated from player:moved and scaled down by 4 " +
                    "beyond cell size — it is a relative figure, not a cell count. " +
                    "Teleports and zone changes are excluded. Collisions count " +
                    "distinct bumps into terrain or structures, not collision sub-steps.",
            ),
        );
    } else if (state.tab === "keys") {
        body = e(
            "div",
            null,
            KpiSection("keys_pressed"),
            Hint(
                "Key presses only — held-key auto-repeat is not counted, and " +
                    "typing into this panel's own inputs is ignored.",
            ),
        );
    } else if (state.tab === "config") {
        body = e(
            "div",
            { style: styles.cfgWrap },
            ChromeRows({
                state,
                store,
                bump,
                zoomRange: [0.4, 2.5],
                alphaRange: [0.3, 1],
            }),
            renderTrackingSection(getConfig(), (key, v) => {
                setSetting(key, v);
                bump();
            }),
            CfgSection("KPI cards", 14),
            e(
                "div",
                { style: { display: "flex", gap: 6, marginBottom: 8 } },
                e(
                    "button",
                    {
                        style: styles.buttonPrimary,
                        onClick: () => openEditor(),
                    },
                    "Edit cards",
                ),
                e(
                    "button",
                    {
                        style: styles.button,
                        onClick: () => {
                            state.cards = defaultCards();
                            saveCards(state.cards);
                            bump();
                        },
                    },
                    "Reset defaults",
                ),
            ),
            e("div", { style: styles.sectionTitle }, "Data"),
            e(
                "div",
                { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                e(
                    "button",
                    {
                        style: styles.button,
                        onClick: () => {
                            resetSession();
                            bump();
                        },
                    },
                    "Reset session",
                ),
                e(
                    "button",
                    {
                        style: { ...styles.button, color: COLORS.danger },
                        onClick: () => {
                            resetAll();
                            bump();
                        },
                    },
                    "Wipe all KPIs",
                ),
            ),
        );
    }

    return e(
        "div",
        {
            className: ROOT_CLASS,
            style: {
                ...styles.root,
                ...place,
                cursor: state.dragging ? "grabbing" : undefined,
            },
        },
        header,
        tabs,
        e("div", { style: styles.body }, body),
    );
}
