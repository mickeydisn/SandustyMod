/**
 * Player Statistic overlay panel.
 *
 * Home cards show configurable KPI groups. Other tabs list per-category
 * breakdowns from the live event buffer (no world scan).
 */
import {
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
    NumberRow,
    posStyle,
    React,
    resolveSelection,
    ROOT_CLASS,
    SelectableList,
    startDrag,
    styles,
    Tabs,
    toggleSelection,
    toIntervals,
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
import { ITEM_ID, KPI_CATEGORIES, KPI_UNITS, SETTINGS, VERSION } from "./constants.ts";
import type { KpiCategory } from "./constants.ts";
import { getConfig, setSetting } from "./config.ts";
import { bootFromStorage, bump, setRepaint, state } from "./state.ts";
import type { HomeCardConfig, TabId } from "./types.ts";
import { store } from "./uiStore.ts";

const TABS: { id: TabId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "actions", label: "Structures" },
    { id: "terrain", label: "Dig" },
    { id: "move", label: "Move" },
    { id: "keys", label: "Keys" },
    { id: "graber", label: "Graber" },
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
    return listSubKeys(cat).map((r) => ({
        id: r.key,
        name: r.key,
        count: r.count,
        color: colorFromId(r.key),
    }));
}

/**
 * Per-interval activity for one sub-key, oldest → newest.
 *
 * These are lifetime accumulators, so plotting the raw totals would just be a
 * rising ramp. Graphs and sparklines plot how much happened in each sampling
 * interval instead — see `toIntervals` in `@sandmd/ui`.
 *
 * One extra point is read beyond `displayPoints` so the first displayed
 * interval still has a predecessor to subtract.
 */
function kpiSeries(cat: string, subKey: string, session = false): number[] {
    const key = subKey ? `${cat}::${subKey}` : cat;
    const points = getConfig().historyMax;
    return toIntervals(
        buffer.history
            .slice(-(points + 1))
            .map((s) => {
                if (session) {
                    // Snapshots written before session capture have no
                    // `session` map, so fall back to the lifetime totals.
                    const src = s.session ?? s.totals;
                    return src[key] ?? 0;
                }
                return s.totals[key] ?? 0;
            }),
    );
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
 * One KPI category rendered the way World Statistic renders its list tabs: a
 * heading with the running total, a history graph, and a checkbox list whose
 * ticks pick the plotted series.
 *
 * `session` switches the graph to the **session** counters instead of the
 * lifetime totals. Categories with no sub-keys — distance walked, collisions,
 * graber uses — have nothing to break down, so plotting lifetime totals would
 * show the whole career on one axis; `session` is what makes those graphable
 * per sampling interval and is what the Move tab asks for.
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
                })
                : null,
        ),
    );
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

    const tabs = Tabs({ tabs: TABS, active: state.tab, onSelect: setTab });

    let body: unknown = null;

    if (state.tab === "home") {
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
    } else if (state.tab === "graber") {
        body = e(
            "div",
            null,
            KpiSection("graber_uses", { session: true }),
            KpiSection("graber_elements", { marginTop: 8 }),
            KpiSection("graber_resources", { marginTop: 8 }),
            CfgSection("Vacuum", 14),
            KpiSection("vacuum_uses"),
            KpiSection("vacuum_cells", { marginTop: 8 }),
            Hint(
                "Elements grabbed is read from the cell at the moment of collection, " +
                    "so it is what was physically picked up; Grabber collected is the " +
                    "resource the engine credited. Vacuum head is the size of the " +
                    "vacuum pattern at the moment it fired. A grab that collects " +
                    "nothing is not a use.",
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
            CfgSection("Tracking", 14),
            NumberRow("Every", getConfig().timeRange, {
                min: SETTINGS.timeRange.min,
                max: SETTINGS.timeRange.max,
                step: SETTINGS.timeRange.step,
                def: SETTINGS.timeRange.default,
                suffix: " min",
                onChange: (v) => {
                    setSetting("timeRange", v);
                    bump();
                },
            }),
            NumberRow("Max data points", getConfig().maxCountSave, {
                min: SETTINGS.maxCountSave.min,
                max: SETTINGS.maxCountSave.max,
                step: SETTINGS.maxCountSave.step,
                def: SETTINGS.maxCountSave.default,
                onChange: (v) => {
                    setSetting("maxCountSave", v);
                    bump();
                },
            }),
            NumberRow("Display points", getConfig().historyMax, {
                min: SETTINGS.historyMax.min,
                max: SETTINGS.historyMax.max,
                step: SETTINGS.historyMax.step,
                def: SETTINGS.historyMax.default,
                onChange: (v) => {
                    setSetting("historyMax", v);
                    bump();
                },
            }),
            CfgSection("KPI cards", 14),
            e(
                "div",
                { style: { display: "flex", gap: 6, marginBottom: 8 } },
                e(
                    "button",
                    {
                        style: styles.buttonPrimary,
                        onClick: () => {
                            state.editingCards = !state.editingCards;
                            if (state.editingCards) state.cards = loadCards();
                            bump();
                        },
                    },
                    state.editingCards ? "Done editing" : "Edit cards",
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
            state.editingCards
                ? e(
                    "div",
                    null,
                    ...state.cards.map((card, ci) =>
                        e(
                            "div",
                            {
                                key: card.id,
                                style: {
                                    ...styles.card,
                                    borderLeftColor: COLORS.accent,
                                    marginBottom: 8,
                                },
                            },
                            e("input", {
                                style: styles.input,
                                value: card.title,
                                onChange: (ev: any) => {
                                    state.cards[ci] = {
                                        ...card,
                                        title: String(ev.target.value),
                                    };
                                    bump();
                                },
                            }),
                            e(
                                "div",
                                { style: { color: COLORS.dim, fontSize: 11, marginTop: 4 } },
                                card.items
                                    .map((it) => it.key ? `${it.category}::${it.key}` : it.category)
                                    .join(" · ") || "(empty)",
                            ),
                            e(
                                "div",
                                { style: { display: "flex", gap: 4, marginTop: 6 } },
                                e(
                                    "button",
                                    {
                                        style: styles.button,
                                        onClick: () => {
                                            const next: HomeCardConfig = {
                                                ...card,
                                                items: [
                                                    ...card.items,
                                                    {
                                                        category: "items_used",
                                                        key: "",
                                                    },
                                                ],
                                            };
                                            state.cards[ci] = next;
                                            bump();
                                        },
                                    },
                                    "+ item",
                                ),
                                e(
                                    "button",
                                    {
                                        style: styles.button,
                                        onClick: () => {
                                            state.cards = state.cards.filter(
                                                (_, i) => i !== ci,
                                            );
                                            bump();
                                        },
                                    },
                                    "Delete",
                                ),
                            ),
                        )
                    ),
                    e(
                        "button",
                        {
                            style: { ...styles.buttonPrimary, marginTop: 4 },
                            onClick: () => {
                                state.cards = [
                                    ...state.cards,
                                    {
                                        id: `card-${Date.now()}`,
                                        title: "New card",
                                        items: [{ category: "items_used", key: "" }],
                                    },
                                ];
                                bump();
                            },
                        },
                        "+ Add card",
                    ),
                    e(
                        "button",
                        {
                            style: { ...styles.buttonPrimary, marginTop: 6, marginLeft: 6 },
                            onClick: () => {
                                saveCards(state.cards);
                                state.editingCards = false;
                                bump();
                            },
                        },
                        "Save cards",
                    ),
                )
                : null,
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

    const footer = e(
        "div",
        { style: styles.footer },
        e("span", null, `v${VERSION}`),
        e(
            "span",
            null,
            `${Object.keys(buffer.totals).length} keys · hist ${buffer.history.length}`,
        ),
    );

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
        footer,
    );
}
