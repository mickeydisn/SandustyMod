/**
 * World Statistic overlay panel.
 *
 * Home cards come first (resource groups with per-item counts). Cards are
 * editable and persisted via mod storage. Zero-count rows stay hidden in lists.
 */
import {
    applyGraphMode,
    CfgSection,
    ChromeRows,
    colorFromId,
    COLORS,
    formatCount,
    formatDelta,
    GraphBlock,
    h,
    Header,
    isToolSelected,
    KpiCard,
    maxCount,
    posStyle,
    rawPointsFor,
    React,
    renderTrackingSection,
    resolveSelection,
    ROOT_CLASS,
    SelectableList,
    seriesColor,
    startDrag,
    styles,
    Tabs,
    toggleSelection,
} from "@sandmd/ui";
import type { KpiCardModel, StyleObj } from "@sandmd/ui";
import { ITEM_ID } from "./constants.ts";
import type {
    CardItemKind,
    CardItemRef,
    ElementRow,
    HomeCardConfig,
    OriginFilter,
    StructureRow,
    TabId,
    TerrainRow,
} from "./types.ts";
import { listCataloguesForPicker, listPickerOptions } from "./data.ts";
import {
    digPercent,
    formatDigPct,
    loadHistory,
    loadReference,
    mapGet,
    resetAll,
    resetSession,
    seriesForId,
} from "./history.ts";
import { buildValidatedDefaultCards, emptyCard, loadCards, saveCards } from "./cards.ts";
import { bootFromStorage, bump, setRepaint, state } from "./state.ts";
import { reconfigureAutoRefresh, runRefresh } from "./refresh.ts";
import { setSetting } from "./config.ts";
import { store } from "./uiStore.ts";
import { getConfig } from "./config.ts";

const TABS: { id: TabId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "structures", label: "Structures" },
    { id: "elements", label: "Elements" },
    { id: "terrains", label: "Terrains" },
    { id: "config", label: "⚙️" },
];

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return "—";
    }
}

function filterAndSort<
    T extends { id: string; name: string; count: number; builtin?: boolean; mod?: string },
>(
    rows: T[],
    text: string,
    sortBy: "count" | "name" | "id",
    origin: OriginFilter,
): T[] {
    let out = rows.filter((r) => r.count > 0);
    if (origin === "builtin") out = out.filter((r) => r.builtin === true);
    if (origin === "mod") out = out.filter((r) => r.builtin === false);
    const q = text.trim().toLowerCase();
    if (q) {
        out = out.filter(
            (r) =>
                r.id.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                (typeof r.mod === "string" && r.mod.toLowerCase().includes(q)),
        );
    }
    out.sort((a, b) => {
        if (sortBy === "count") return b.count - a.count || a.name.localeCompare(b.name);
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return a.id.localeCompare(b.id);
    });
    return out;
}

export function StatisticPanel(): unknown {
    const react = React;
    const e = h;
    if (!react || !e) return null;

    const [, setTick] = react.useState(0);
    const [progress, setProgress] = react.useState({ done: 0, total: 0 });

    react.useEffect(() => {
        setRepaint(setTick as any);
        return () => setRepaint(null);
    }, []);

    react.useEffect(() => {
        bootFromStorage();
        bump();
    }, []);

    react.useEffect(() => {
        let alive = true;
        const poll = (): void => {
            if (!alive) return;
            bump();
            setTimeout(poll, 250);
        };
        const id = setTimeout(poll, 250);
        return () => {
            alive = false;
            clearTimeout(id);
        };
    }, []);

    if (!isToolSelected(ITEM_ID) && !state.locked) return null;

    const snap = state.snapshot;
    const scanning = state.scanning;

    const doRefresh = async (): Promise<void> => {
        await runRefresh("manual");
    };

    const setTab = (id: string): void => {
        state.tab = id;
        if (id !== "config") state.editingCards = false;
        bump();
    };

    const openEditor = (): void => {
        state.tab = "config";
        state.cards = loadCards();
        state.editingCards = true;
        state.editFocusId = state.cards[0]?.id ?? null;
        bump();
    };

    const closeEditor = (save: boolean): void => {
        if (save) {
            saveCards(state.cards);
        } else {
            // Discard reverts to the stored list, so Save is the only path that
            // writes. Cards are recomputed on bump, so no extra resolve is needed.
            state.cards = loadCards();
        }
        state.editingCards = false;
        bump();
    };

    // Always right-anchored so mini/max keeps the right edge fixed.
    const chrome = { state, store, bump };
    const onDrag = (ev: any): void => startDrag(ev, chrome);
    const place = posStyle(state);

    // —— Mini widget (right-anchored, no title) ——
    if (state.minimized) {
        const cards = snap?.cards ?? [];
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
            e(
                "div",
                {
                    style: {
                        ...styles.header,
                        padding: "6px 8px",
                        cursor: "grab",
                        justifyContent: "flex-end",
                        gap: "6px",
                    },
                    onPointerDown: onDrag,
                },
                e(
                    "button",
                    {
                        style: scanning ? styles.buttonDisabled : styles.buttonPrimary,
                        disabled: scanning,
                        onClick: () => {
                            void doRefresh();
                        },
                    },
                    scanning ? "…" : "↻",
                ),
                e(
                    "button",
                    {
                        style: styles.button,
                        title: "Expand",
                        onClick: () => {
                            state.minimized = false;
                            store.saveMinimized(false);
                            bump();
                        },
                    },
                    "□",
                ),
            ),
            e(
                "div",
                { style: styles.miniBody },
                scanning
                    ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "Scanning…")
                    : null,
                cards.length === 0
                    ? e(
                        "div",
                        { style: { color: COLORS.dim, fontSize: 11 } },
                        snap ? "No cards" : "No saved stats — refresh",
                    )
                    : cards.map((g) => {
                        const trend = miniCardTrend(g);
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
                            e("span", {
                                style: { ...styles.miniCardSum, color: g.color },
                            }, formatCount(g.total)),
                            e("span", {
                                style: {
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: trendColor,
                                    fontVariantNumeric: "tabular-nums",
                                    minWidth: 36,
                                    textAlign: "right",
                                },
                                title: "Δ last refresh vs previous",
                            }, trendLabel),
                        );
                    }),
            ),
        );
    }

    const header = Header(chrome, {
        title: "World Statistic",
        actions: e(
            "button",
            {
                style: scanning ? styles.buttonDisabled : styles.buttonPrimary,
                disabled: scanning || state.editingCards,
                onClick: () => {
                    void doRefresh();
                },
                title: "Re-count authorized cells only",
            },
            scanning
                ? progress.total > 0
                    ? `Scanning ${Math.round((100 * progress.done) / progress.total)}%`
                    : "Scanning…"
                : "↻ Refresh",
        ),
    });

    const tabs = Tabs({
        tabs: TABS,
        active: state.tab,
        onSelect: setTab,
        hidden: state.editingCards,
    });

    const toolbar = state.tab !== "home" && state.tab !== "config" && !state.editingCards
        ? e(
            "div",
            { style: styles.toolbar },
            e("input", {
                style: styles.input,
                type: "text",
                placeholder: "Filter by name / id / mod…",
                value: state.filter,
                onChange: (ev: Event) => {
                    state.filter = (ev.target as HTMLInputElement).value;
                    bump();
                },
            }),
            e(
                "select",
                {
                    style: styles.select,
                    value: state.origin,
                    onChange: (ev: Event) => {
                        state.origin = (ev.target as HTMLSelectElement).value as OriginFilter;
                        bump();
                    },
                },
                e("option", { value: "all" }, "All sources"),
                e("option", { value: "builtin" }, "Built-in only"),
                e("option", { value: "mod" }, "Mods only"),
            ),
            e(
                "select",
                {
                    style: styles.select,
                    value: state.sortBy,
                    onChange: (ev: Event) => {
                        state.sortBy = (ev.target as HTMLSelectElement).value as
                            | "count"
                            | "name"
                            | "id";
                        bump();
                    },
                },
                e("option", { value: "count" }, "Sort: count"),
                e("option", { value: "name" }, "Sort: name"),
                e("option", { value: "id" }, "Sort: id"),
            ),
        )
        : null;

    let body: unknown;

    if (state.editingCards) {
        body = renderCardEditor(e, closeEditor);
    } else if (state.tab === "config") {
        body = renderConfigPanel(e, openEditor);
    } else if (scanning && !snap) {
        body = e(
            "div",
            { style: styles.empty },
            e("div", { style: styles.spinner }, "Scanning world grid…"),
            progress.total > 0
                ? e(
                    "div",
                    { style: { marginTop: "8px", color: COLORS.dim } },
                    `${formatCount(progress.done)} / ${formatCount(progress.total)} cells`,
                )
                : null,
        );
    } else if (!snap) {
        body = e(
            "div",
            { style: styles.empty },
            e("div", null, "No data yet."),
            e(
                "div",
                { style: { marginTop: "10px", color: COLORS.dim } },
                "Press ↻ Refresh to count authorized cells.",
            ),
        );
    } else if (state.tab === "home") {
        body = renderHome(e, snap);
    } else if (state.tab === "elements") {
        const rows = filterAndSort(snap.elements, state.filter, state.sortBy, state.origin);
        body = e("div", null, renderListGraph(e, "elements", rows), renderElementList(e, rows));
    } else if (state.tab === "structures") {
        const rows = filterAndSort(snap.structures, state.filter, state.sortBy, state.origin);
        body = e(
            "div",
            null,
            renderListGraph(e, "structures", rows.map((r) => ({ ...r, color: colorFromId(r.id) }))),
            renderStructureList(e, rows),
        );
    } else {
        const rows = filterAndSort(snap.terrains, state.filter, state.sortBy, state.origin);
        body = e("div", null, renderListGraph(e, "terrains", rows), renderTerrainList(e, rows));
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
        toolbar,
        e("div", { style: styles.body }, body),
    );
}

/**
 * Δ shown on the minimised card strip.
 *
 * This used to recompute the last-two-samples difference here, from the live
 * history, while `resolveCards` computed a different number (against the stored
 * reference) for the same card — so the strip and the full card could disagree.
 * Both now read the card's own delta, which is the last two points.
 */
function miniCardTrend(g: { delta: number | null }): number | null {
    return g.delta;
}

function renderConfigPanel(
    e: (...args: unknown[]) => unknown,
    openEditor: () => void,
): unknown {
    return e(
        "div",
        { style: styles.cfgWrap },
        ChromeRows({
            state,
            store,
            bump,
            zoomRange: [0.6, 1.4],
            alphaRange: [0.35, 1],
        }),
        // `timeRange` doubles as the scan interval, so changing it has to
        // restart the timer; the other two only affect how history is stored
        // and drawn. There is no separate panel override any more — the value
        // below is persistent, so a second copy could only drift.
        renderTrackingSection(getConfig(), (key, v) => {
            setSetting(key, v);
            if (key === "timeRange") reconfigureAutoRefresh();
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
                        state.cards = buildValidatedDefaultCards();
                        saveCards(state.cards);
                        bump();
                    },
                },
                "Reset defaults",
            ),
        ),
        e("div", { style: { ...styles.groupTitle, marginTop: 14 } }, "Data"),
        e(
            "div",
            { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            e(
                "button",
                {
                    style: styles.button,
                    title: "Drop the stored trend, keep the reference baseline",
                    onClick: () => {
                        resetSession();
                        state.snapshot = { ...state.snapshot, statsHistory: [] } as never;
                        bump();
                    },
                },
                "Reset session",
            ),
            e(
                "button",
                {
                    style: { ...styles.button, color: COLORS.danger },
                    title: "Drop the trend and the reference baseline",
                    onClick: () => {
                        resetAll();
                        state.snapshot = null;
                        bump();
                    },
                },
                "Wipe all data",
            ),
        ),
    );
}

function renderHome(
    e: (...args: unknown[]) => unknown,
    snap: NonNullable<typeof state.snapshot>,
): unknown {
    const cards = snap.cards ?? [];
    return e(
        "div",
        { style: styles.homeWrap },
        cards.length === 0
            ? e(
                "div",
                { style: styles.empty },
                "No cards configured. Use Edit cards in the Config tab.",
            )
            : e(
                "div",
                { style: styles.groupGrid },
                ...cards.map((g) => renderResourceCard(e, g)),
            ),
    );
}

function kindKeyOfItem(kind: string): "elements" | "structures" | "terrains" {
    if (kind === "structure") return "structures";
    if (kind === "terrain") return "terrains";
    return "elements";
}

/**
 * Same series builder as the Elements / Structures / Terrains list graphs.
 * Always reads live history + seriesForId — never a pre-baked / mutated array.
 *
 * `seriesForId` hands back the raw accumulated counts; `applyGraphMode` then
 * decides whether the plot shows those totals or the change between scans. The
 * extra sample `rawPointsFor` asks for in `diff` mode is what keeps the plot at
 * full width — a diff series loses its first value to the subtraction.
 */
function seriesFromHistory(
    history: import("./types.ts").RawStatsSnapshot[],
    kind: "elements" | "structures" | "terrains",
    id: string,
    label: string,
    color: string,
): { id: string; label: string; color: string; values: number[] } {
    const mode = state.graphMode;
    const raw = seriesForId(
        history,
        kind,
        id,
        rawPointsFor(getConfig().historyMax, mode),
    );
    return { id, label, color, values: applyGraphMode(raw, mode) };
}

/** Flip the graph between accumulated totals and change per scan. */
function toggleGraphMode(): void {
    state.graphMode = state.graphMode === "total" ? "diff" : "total";
    bump();
}

/**
 * Home-tab card. Maps this mod's card model onto the shared `KpiCard`, so it
 * renders exactly like `md-player-statistic`'s cards.
 *
 * Each item gets a compact inline sparkline built from the live history —
 * the same source the list tabs graph from, so the two always agree.
 */
function renderResourceCard(
    e: (...args: unknown[]) => unknown,
    g: {
        id: string;
        title: string;
        color: string;
        total: number;
        delta: number | null;
        items: {
            label: string;
            count: number;
            primary: boolean;
            color: string;
            id: string;
            kind: string;
            delta: number | null;
            series: number[];
        }[];
    },
): unknown {
    void e;
    const history = state.snapshot?.statsHistory ?? loadHistory();
    const displayPoints = getConfig().historyMax;

    const model: KpiCardModel = {
        id: g.id,
        title: g.title,
        color: g.color,
        total: g.total,
        delta: g.delta,
        // Explicit rather than relying on the default, so the word mod's badge
        // says what its numbers mean: change between two scans.
        deltaLabel: "scan",
        items: g.items.map((it, i) => ({
            label: it.label,
            count: it.count,
            color: it.color || g.color || seriesColor(i),
            series: seriesForId(history, kindKeyOfItem(it.kind), it.id, displayPoints),
        })),
    };
    return KpiCard(model);
}

/**
 * Picker kind per card id.
 *
 * The kind dropdown used to be inert: it rendered, but the item dropdown always
 * listed every element, terrain and structure at once with `E · / T · / S ·`
 * prefixes, so choosing "Terrain" still offered elements. This remembers the
 * pick per card so the list can be filtered instead. Module-level like
 * `lastRows` — it is render scratch state, not something worth persisting.
 */
const pickerKind: Record<string, CardItemKind> = {};

function renderCardEditor(
    e: (...args: unknown[]) => unknown,
    closeEditor: (save: boolean) => void,
): unknown {
    const cats = listCataloguesForPicker();
    // Merge terrains from last snapshot so ids found on map appear
    const snapTerrains = state.snapshot?.terrains ?? [];
    const trMap = new Map(cats.terrains.map((t) => [t.id, t]));
    for (const t of snapTerrains) trMap.set(t.id, t);
    const options = listPickerOptions(cats.elements, cats.structures, [...trMap.values()]);

    const elementOpts = options.filter((o) => o.kind === "element");
    const terrainOpts = options.filter((o) => o.kind === "terrain");
    const structureOpts = options.filter((o) => o.kind === "structure");

    const optsForKind = (kind: CardItemKind) =>
        kind === "element" ? elementOpts : kind === "terrain" ? terrainOpts : structureOpts;

    const kindOf = (cardId: string): CardItemKind => pickerKind[cardId] ?? "element";

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
        const c = emptyCard();
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
        const tmp = items[index];
        items[index] = items[j];
        items[j] = tmp;
        updateCard(cardId, { items });
    };

    const removeItem = (cardId: string, index: number): void => {
        const card = state.cards.find((c) => c.id === cardId);
        if (!card) return;
        updateCard(cardId, { items: card.items.filter((_, i) => i !== index) });
    };

    const addItem = (cardId: string, kind: CardItemKind, id: string): void => {
        if (!id) return;
        const card = state.cards.find((c) => c.id === cardId);
        if (!card) return;
        if (card.items.some((it) => it.kind === kind && it.id === id)) return;
        updateCard(cardId, { items: [...card.items, { kind, id }] });
    };

    return e(
        "div",
        { style: styles.editor },
        e(
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
                "Choose which resources appear on the Home tab. The first item on a card is primary " +
                    "(larger weight for the card color). Pick elements, terrains, or structures from the lists.",
            ),
        ),
        e(
            "div",
            { style: styles.editorBar },
            e("span", { style: { flex: 1 } }),
            e("button", { style: styles.button, onClick: addCard }, "+ New card"),
            e("button", {
                style: styles.button,
                title: "Restore the default home cards",
                onClick: () => {
                    state.cards = buildValidatedDefaultCards();
                    saveCards(state.cards);
                    bump();
                },
            }, "Reset defaults"),
            e("button", {
                style: styles.button,
                onClick: () => closeEditor(false),
            }, "Cancel"),
            e("button", {
                style: styles.buttonPrimary,
                onClick: () => closeEditor(true),
            }, "Save"),
        ),
        e(
            "div",
            { style: styles.editorList },
            ...state.cards.map((card) => {
                const open = state.editFocusId === card.id;
                // Read once per render so the two dropdowns and the Add handler
                // all agree on which group is showing.
                const kind = kindOf(card.id);
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
                        e("button", {
                            style: styles.dangerBtn,
                            onClick: (ev: Event) => {
                                ev.stopPropagation();
                                removeCard(card.id);
                            },
                        }, "Delete"),
                    ),
                    open
                        ? e(
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
                                "Items (first = primary size & color)",
                            ),
                            e(
                                "div",
                                { style: styles.itemList },
                                ...card.items.map((it, idx) =>
                                    e(
                                        "div",
                                        {
                                            key: `${it.kind}:${it.id}:${idx}`,
                                            style: idx === 0
                                                ? styles.itemRowPrimary
                                                : styles.itemRow,
                                        },
                                        e("span", {
                                            style: {
                                                color: idx === 0 ? COLORS.accent : COLORS.dim,
                                                minWidth: 14,
                                            },
                                        }, idx === 0 ? "★" : String(idx + 1)),
                                        e(
                                            "span",
                                            { style: { color: COLORS.dim, minWidth: 64 } },
                                            it.kind,
                                        ),
                                        e("span", { style: styles.grow }, it.id),
                                        e("button", {
                                            style: styles.button,
                                            disabled: idx === 0,
                                            onClick: () => moveItem(card.id, idx, -1),
                                        }, "↑"),
                                        e("button", {
                                            style: styles.button,
                                            disabled: idx === card.items.length - 1,
                                            onClick: () => moveItem(card.id, idx, 1),
                                        }, "↓"),
                                        e("button", {
                                            style: styles.dangerBtn,
                                            onClick: () => removeItem(card.id, idx),
                                        }, "×"),
                                    )
                                ),
                            ),
                            e(
                                "div",
                                { style: styles.addRow },
                                e(
                                    "select",
                                    {
                                        style: styles.select,
                                        id: `add-kind-${card.id}`,
                                        value: kind,
                                        onChange: (ev: Event) => {
                                            pickerKind[card.id] = (ev.target as HTMLSelectElement)
                                                .value as CardItemKind;
                                            bump();
                                        },
                                    },
                                    e("option", { value: "element" }, "Element"),
                                    e("option", { value: "terrain" }, "Terrain"),
                                    e("option", { value: "structure" }, "Structure"),
                                ),
                                e(
                                    "select",
                                    {
                                        // Keyed by kind so switching group remounts
                                        // the list; otherwise the old pick stays
                                        // selected in a dropdown that no longer
                                        // contains it, and Add would use a stale id.
                                        key: `add-id-${card.id}:${kind}`,
                                        style: { ...styles.select, flex: 1 },
                                        id: `add-id-${card.id}`,
                                        defaultValue: "",
                                    },
                                    e("option", { value: "" }, "— pick item —"),
                                    ...optsForKind(kind).map((o) =>
                                        e(
                                            "option",
                                            { key: o.id, value: `${kind}::${o.id}` },
                                            o.label,
                                        )
                                    ),
                                ),
                                e("button", {
                                    style: styles.buttonPrimary,
                                    onClick: () => {
                                        const sel = (globalThis as any).document
                                            ?.getElementById?.(`add-id-${card.id}`) as
                                                | HTMLSelectElement
                                                | null;
                                        const val = sel?.value ?? "";
                                        if (!val) return;
                                        const [picked, id] = val.split("::") as [
                                            CardItemKind,
                                            string,
                                        ];
                                        if (picked && id) addItem(card.id, picked, id);
                                        if (sel) sel.value = "";
                                    },
                                }, "Add"),
                            ),
                            e(
                                "div",
                                { style: { color: COLORS.dim, fontSize: 10, marginTop: 6 } },
                                "Primary item (★) sets the big number and the card border/text color.",
                            ),
                        )
                        : null,
                );
            }),
        ),
    );
}

// —— Selectable list + graph (shared with md-player-statistic via @sandmd/ui) ——

type ListTab = "elements" | "structures" | "terrains";

/**
 * Rows last handed to each list tab. The graph's top-N default needs them at
 * toggle time, which happens in a different render pass than the list itself.
 */
const lastRows: Record<ListTab, { id: string; count: number }[]> = {
    elements: [],
    structures: [],
    terrains: [],
};

function selectionOf(tab: ListTab): string[] {
    return resolveSelection(state.graphSelection[tab], lastRows[tab], 3);
}

function toggleOf(tab: ListTab, id: string): void {
    state.graphSelection[tab] = toggleSelection(state.graphSelection[tab], id, lastRows[tab], 3);
    bump();
}

function renderListGraph(
    e: (...args: unknown[]) => unknown,
    tab: ListTab,
    rows: { id: string; name: string; count: number; color?: string }[],
): unknown {
    lastRows[tab] = rows;
    const history = state.snapshot?.statsHistory ?? loadHistory();
    const series = selectionOf(tab).map((id, i) => {
        const row = rows.find((r) => r.id === id);
        const color = row?.color || (tab === "structures" ? colorFromId(id) : seriesColor(i));
        return seriesFromHistory(history, tab, id, row?.name ?? id, color);
    });
    return GraphBlock({
        title: `History (last ${getConfig().historyMax}) · tick rows below to choose series`,
        mode: state.graphMode,
        onModeToggle: toggleGraphMode,
        series,
    });
}

const META_COL: StyleObj = {
    color: COLORS.dim,
    maxWidth: "110px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

function renderElementList(e: (...args: unknown[]) => unknown, rows: ElementRow[]): unknown {
    lastRows.elements = rows;
    const max = maxCount(rows);
    return SelectableList({
        rows: rows.map((r) => ({
            id: r.id,
            name: r.name,
            count: r.count,
            color: r.color,
            meta: r.mod,
        })),
        selected: selectionOf("elements"),
        onToggle: (id) => toggleOf("elements", id),
        emptyText: "No elements match (count > 0).",
        // Keeps the numeric element-type column the generic row layout lacks.
        renderRow: (r, checkbox) => {
            const el = rows.find((x) => x.id === r.id);
            return e(
                "div",
                { key: r.id, style: styles.row },
                checkbox,
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e(
                    "span",
                    { style: { color: COLORS.dim, minWidth: "28px" }, title: r.id },
                    el && el.type >= 0 ? String(el.type) : "—",
                ),
                e("span", { style: styles.grow, title: `${r.id} (type ${el?.type})` }, r.name),
                e("span", { style: META_COL }, r.meta),
                e(
                    "div",
                    { style: styles.barTrack },
                    e("div", {
                        style: {
                            ...styles.barFill,
                            width: `${Math.max(2, Math.round((100 * r.count) / max))}%`,
                        },
                    }),
                ),
                e("span", { style: styles.count }, formatCount(r.count)),
            );
        },
    });
}

function renderStructureList(
    e: (...args: unknown[]) => unknown,
    rows: StructureRow[],
): unknown {
    lastRows.structures = rows;
    return SelectableList({
        rows: rows.map((r) => ({
            id: r.id,
            name: r.name || r.id,
            count: r.count,
            color: colorFromId(r.id),
            meta: r.mod,
        })),
        selected: selectionOf("structures"),
        onToggle: (id) => toggleOf("structures", id),
        emptyText: "No structures match (count > 0).",
    });
}

function renderTerrainList(e: (...args: unknown[]) => unknown, rows: TerrainRow[]): unknown {
    lastRows.terrains = rows;
    const reference = state.snapshot?.statsReference ?? loadReference();
    const max = maxCount(rows);
    return SelectableList({
        rows: rows.map((r) => ({ id: r.id, name: r.name, count: r.count, color: r.color })),
        selected: selectionOf("terrains"),
        onToggle: (id) => toggleOf("terrains", id),
        emptyText: "No terrains on authorized cells.",
        // Keeps the "% dug vs reference" trailing column.
        renderRow: (r, checkbox) => {
            const tr = rows.find((x) => x.id === r.id);
            const refN = reference ? mapGet(reference.terrains, r.id) : 0;
            const pct = reference ? digPercent(refN || null, r.count) : null;
            const dugColor = pct == null
                ? COLORS.dim
                : pct >= 50
                ? COLORS.good
                : pct >= 10
                ? COLORS.warn
                : COLORS.dim;
            return e(
                "div",
                { key: `${tr?.type ?? 0}:${r.id}`, style: styles.row },
                checkbox,
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e(
                    "span",
                    { style: { color: COLORS.dim, minWidth: "28px" } },
                    String(tr?.type ?? "—"),
                ),
                e("span", { style: styles.grow, title: r.id }, r.name),
                e(
                    "div",
                    { style: styles.barTrack },
                    e("div", {
                        style: {
                            ...styles.barFill,
                            width: `${Math.max(2, Math.round((100 * r.count) / max))}%`,
                        },
                    }),
                ),
                e("span", { style: styles.count }, formatCount(r.count)),
                e(
                    "span",
                    {
                        style: {
                            minWidth: 88,
                            textAlign: "right",
                            color: dugColor,
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            fontSize: 11,
                        },
                        title: reference
                            ? `ref ${formatCount(refN)} → now ${formatCount(r.count)}`
                            : "No reference yet — refresh once to set baseline",
                    },
                    formatDigPct(pct),
                ),
            );
        },
    });
}
