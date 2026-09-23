/**
 * World Statistic overlay panel.
 *
 * Home cards come first (resource groups with per-item counts). Cards are
 * editable and persisted via mod storage. Zero-count rows stay hidden in lists.
 */
import { h, React } from "./api.ts";
import { VERSION } from "./constants.ts";
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
import {
    listCataloguesForPicker,
    listPickerOptions,
    resolveCards,
} from "./data.ts";
import { MultiLineChart, formatDelta, seriesColor } from "./graph.ts";
import { digPercent, formatDigPct, mapGet, seriesForId, loadHistory, loadReference } from "./history.ts";
import { emptyCard, loadCards, saveCards } from "./cards.ts";
import { bootFromStorage, bump, setRepaint, state } from "./state.ts";
import { runRefresh, reconfigureAutoRefresh } from "./refresh.ts";
import { getAutoRefreshEnabled, setPanelAutoRefresh } from "./config.ts";
import {
    saveAlpha,
    saveLocked,
    saveMinimized,
    savePanelAutoMinutes,
    savePanelPos,
    saveZoom,
} from "./uiStore.ts";
import { getConfig } from "./config.ts";
import { COLORS, styles } from "./styles.ts";
import { isToolSelected } from "./select.ts";

const TABS: { id: TabId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "structures", label: "Structures" },
    { id: "elements", label: "Elements" },
    { id: "terrains", label: "Terrains" },
    { id: "config", label: "⚙️" },
];

function formatTime(ts: number): string {
    try { return new Date(ts).toLocaleTimeString(); } catch { return "—"; }
}

function filterAndSort<T extends { id: string; name: string; count: number; builtin?: boolean; mod?: string }>(
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

function maxCount(rows: { count: number }[]): number {
    let m = 1;
    for (const r of rows) if (r.count > m) m = r.count;
    return m;
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
        return () => { alive = false; clearTimeout(id); };
    }, []);

    if (!isToolSelected() && !state.locked) return null;

    const snap = state.snapshot;
    const scanning = state.scanning;

    const doRefresh = async (): Promise<void> => {
        await runRefresh("manual");
    };

    const toggleAuto = (): void => {
        const next = !getAutoRefreshEnabled();
        setPanelAutoRefresh(next);
        reconfigureAutoRefresh();
        bump();
    };

    const setTab = (id: TabId): void => {
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
            // Re-resolve card stats against last scan without full rescan
            if (state.snapshot) {
                const { elements, structures, terrains } = state.snapshot;
                // elements in snapshot are present-only; re-list for labels
                const cats = listCataloguesForPicker();
                const elMap = new Map(cats.elements.map((r) => [r.id, r]));
                for (const r of elements) {
                    const base = elMap.get(r.id);
                    if (base) base.count = r.count;
                    else elMap.set(r.id, r);
                }
                const trMap = new Map(terrains.map((r) => [r.id, r]));
                for (const r of cats.terrains) {
                    if (!trMap.has(r.id)) trMap.set(r.id, r);
                }
                const ref = state.snapshot.statsReference ?? loadReference();
                const hist = state.snapshot.statsHistory?.length
                    ? state.snapshot.statsHistory
                    : loadHistory();
                state.snapshot = {
                    ...state.snapshot,
                    cards: resolveCards(
                        state.cards,
                        [...elMap.values()],
                        structures.length ? structures : cats.structures,
                        [...trMap.values()],
                        ref,
                        hist,
                    ),
                };
            }
        } else {
            state.cards = loadCards();
        }
        state.editingCards = false;
        bump();
    };


    const startDrag = (ev: any): void => {
        if (ev.button != null && ev.button !== 0) return;
        const target = ev.target as { closest?: (s: string) => unknown } | null;
        if (target?.closest?.("button, input, select, textarea, a")) return;

        const rootEl = (ev.currentTarget as { closest?: (s: string) => HTMLElement | null })
            ?.closest?.(".md-word-stat-root");
        const rect = rootEl?.getBoundingClientRect?.();
        const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
        const startX = ev.clientX as number;
        const startY = ev.clientY as number;
        const origRight = rect
            ? Math.max(0, vw - rect.right)
            : state.pos.right;
        const origTop = rect ? rect.top : state.pos.top;

        state.dragging = true;
        bump();

        const onMove = (e2: any): void => {
            const dx = (e2.clientX as number) - startX;
            const dy = (e2.clientY as number) - startY;
            // Move: right decreases when dragging right
            state.pos = {
                right: Math.max(0, origRight - dx),
                top: Math.max(0, origTop + dy),
            };
            bump();
        };
        const onUp = (): void => {
            state.dragging = false;
            savePanelPos(state.pos);
            bump();
            globalThis.removeEventListener?.("pointermove", onMove);
            globalThis.removeEventListener?.("pointerup", onUp);
            globalThis.removeEventListener?.("pointercancel", onUp);
        };
        globalThis.addEventListener?.("pointermove", onMove);
        globalThis.addEventListener?.("pointerup", onUp);
        globalThis.addEventListener?.("pointercancel", onUp);
        try { ev.preventDefault?.(); } catch { /* */ }
    };

    // Always right-anchored so mini/max keeps the right edge fixed
    const posStyle: Record<string, string | number> = {
        right: `${state.pos.right}px`,
        top: `${state.pos.top}px`,
        left: "auto",
        transformOrigin: "top right",
        transform: state.zoom !== 1 ? `scale(${state.zoom})` : undefined as unknown as string,
        opacity: state.alpha,
    };
    if (state.zoom === 1) delete posStyle.transform;


    // —— Mini widget (right-anchored, no title) ——
    if (state.minimized) {
        const cards = snap?.cards ?? [];
        return e(
            "div",
            {
                className: "md-word-stat-root",
                style: {
                    ...styles.rootMini,
                    ...posStyle,
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
                    onPointerDown: startDrag,
                },
                e(
                    "button",
                    {
                        style: scanning ? styles.buttonDisabled : styles.buttonPrimary,
                        disabled: scanning,
                        onClick: () => { void doRefresh(); },
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
                            saveMinimized(false);
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
                    ? e("div", { style: { color: COLORS.dim, fontSize: 11 } },
                        snap ? "No cards" : "No saved stats — refresh")
                    : cards.map((g) => {
                        const trend = miniCardTrend(g);
                        const trendColor = trend == null || trend === 0
                            ? COLORS.dim
                            : trend > 0 ? COLORS.good : COLORS.danger;
                        const trendLabel = trend == null
                            ? "—"
                            : trend > 0 ? `+${trend.toLocaleString()}`
                            : trend.toLocaleString();
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
                            }, g.total.toLocaleString()),
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


    const header = e(
        "div",
        {
            style: { ...styles.header, cursor: "grab" },
            onPointerDown: startDrag,
        },
        e("span", { style: styles.dragHandle },
            e("span", { style: styles.title }, "World Statistic"),
        ),
        e(
            "button",
            {
                style: scanning ? styles.buttonDisabled : styles.buttonPrimary,
                disabled: scanning || state.editingCards,
                onClick: () => { void doRefresh(); },
                title: "Re-count authorized cells only",
            },
            scanning
                ? progress.total > 0
                    ? `Scanning ${Math.round((100 * progress.done) / progress.total)}%`
                    : "Scanning…"
                : "↻ Refresh",
        ),
        e(
            "button",
            {
                style: styles.button,
                title: "Minimize",
                onClick: () => {
                    // Right edge stays fixed (pos uses right/top)
                    state.minimized = true;
                    saveMinimized(true);
                    bump();
                },
            },
            "—",
        ),
    );

    const tabs = state.editingCards
        ? null
        : e(
            "div",
            { style: styles.tabs },
            ...TABS.map((tab) =>
                e(
                    "button",
                    {
                        key: tab.id,
                        style: state.tab === tab.id ? styles.tabActive : styles.tab,
                        onClick: () => setTab(tab.id),
                    },
                    tab.label,
                )
            ),
            e(
                "button",
                {
                    key: "edit-cards",
                    style: styles.tab,
                    onClick: () => openEditor(),
                    title: "Edit home cards",
                },
                "✎ Cards",
            ),
        );

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
                        state.sortBy = (ev.target as HTMLSelectElement).value as "count" | "name" | "id";
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
        body = renderCardEditor(e);
    } else if (state.tab === "config") {
        body = renderConfigPanel(e, openEditor);
    } else if (scanning && !snap) {
        body = e(
            "div",
            { style: styles.empty },
            e("div", { style: styles.spinner }, "Scanning world grid…"),
            progress.total > 0
                ? e("div", { style: { marginTop: "8px", color: COLORS.dim } },
                    `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} cells`)
                : null,
        );
    } else if (!snap) {
        body = e(
            "div",
            { style: styles.empty },
            e("div", null, "No data yet."),
            e("div", { style: { marginTop: "10px", color: COLORS.dim } },
                "Press ↻ Refresh to count authorized cells."),
        );
    } else if (state.tab === "home") {
        body = renderHome(e, snap);
    } else if (state.tab === "elements") {
        const rows = filterAndSort(snap.elements, state.filter, state.sortBy, state.origin);
        body = e("div", null,
            renderListGraph(e, "elements", rows),
            renderElementList(e, rows),
        );
    } else if (state.tab === "structures") {
        const rows = filterAndSort(snap.structures, state.filter, state.sortBy, state.origin);
        body = e("div", null,
            renderListGraph(e, "structures", rows.map((r) => ({ ...r, color: colorFromId(r.id) }))),
            renderStructureList(e, rows),
        );
    } else {
        const rows = filterAndSort(snap.terrains, state.filter, state.sortBy, state.origin);
        body = e("div", null,
            renderListGraph(e, "terrains", rows),
            renderTerrainList(e, rows),
        );
    }


    return e(
        "div",
        {
            className: "md-word-stat-root",
            style: {
                ...styles.root,
                ...posStyle,
                cursor: state.dragging ? "grabbing" : undefined,
            },
        },
        header, tabs, toolbar,
        e("div", { style: styles.body }, body),
    );
}




/** Sum of card items in a raw snapshot (last vs N-1 trend). */
function cardTotalInSnapshot(
    snap: import("./types.ts").RawStatsSnapshot | null | undefined,
    items: { kind: string; id: string }[],
): number {
    if (!snap) return 0;
    let s = 0;
    for (const it of items) {
        const key = it.kind === "element" ? "elements"
            : it.kind === "terrain" ? "terrains" : "structures";
        s += mapGet(snap[key as "elements" | "terrains" | "structures"], it.id);
    }
    return s;
}

/** Δ between latest history sample and the one before (N vs N-1). */
function miniCardTrend(g: { items: { kind: string; id: string }[] }): number | null {
    const hist = state.snapshot?.statsHistory ?? loadHistory();
    if (hist.length < 2) return null;
    const last = hist[hist.length - 1]!;
    const prev = hist[hist.length - 2]!;
    return cardTotalInSnapshot(last, g.items) - cardTotalInSnapshot(prev, g.items);
}

function renderConfigPanel(
    e: (...args: unknown[]) => unknown,
    openEditor: () => void,
): unknown {
    const autoOn = getAutoRefreshEnabled();
    const modMins = getConfig().autoRefreshMinutes;
    const mins = state.autoMinutes ?? modMins;

    const row = (label: string, control: unknown) =>
        e("div", { style: styles.cfgRow },
            e("span", { style: styles.cfgLabel }, label),
            e("div", { style: styles.cfgControl }, control),
        );

    return e(
        "div",
        { style: styles.cfgWrap },
        e("div", { style: styles.groupTitle }, "Panel"),
        row("Lock panel",
            e("button", {
                style: state.locked ? styles.buttonPrimary : styles.button,
                onClick: () => {
                    state.locked = !state.locked;
                    saveLocked(state.locked);
                    bump();
                },
            }, state.locked ? "🔒 Locked" : "🔓 Unlocked"),
        ),
        row("Zoom",
            e("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        state.zoom = Math.max(0.6, Math.round((state.zoom - 0.1) * 10) / 10);
                        saveZoom(state.zoom);
                        bump();
                    },
                }, "−"),
                e("span", { style: { minWidth: 40, textAlign: "center" } },
                    `${Math.round(state.zoom * 100)}%`),
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        state.zoom = Math.min(1.4, Math.round((state.zoom + 0.1) * 10) / 10);
                        saveZoom(state.zoom);
                        bump();
                    },
                }, "+"),
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        state.zoom = 1;
                        saveZoom(1);
                        bump();
                    },
                }, "Reset"),
            ),
        ),
        row("Opacity",
            e("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        state.alpha = Math.max(0.35, Math.round((state.alpha - 0.05) * 100) / 100);
                        saveAlpha(state.alpha);
                        bump();
                    },
                }, "−"),
                e("span", { style: { minWidth: 40, textAlign: "center" } },
                    `${Math.round(state.alpha * 100)}%`),
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        state.alpha = Math.min(1, Math.round((state.alpha + 0.05) * 100) / 100);
                        saveAlpha(state.alpha);
                        bump();
                    },
                }, "+"),
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        state.alpha = 1;
                        saveAlpha(1);
                        bump();
                    },
                }, "Reset"),
            ),
        ),

        e("div", { style: { ...styles.groupTitle, marginTop: 14 } }, "Auto refresh"),
        row("Auto Refresh Enabled",
            e("button", {
                style: autoOn ? styles.buttonPrimary : styles.button,
                onClick: () => {
                    const next = !getAutoRefreshEnabled();
                    setPanelAutoRefresh(next);
                    reconfigureAutoRefresh();
                    bump();
                },
            }, autoOn ? "ON" : "OFF"),
        ),
        row("Interval (min)",
            e("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        const cur = state.autoMinutes ?? modMins;
                        state.autoMinutes = Math.max(1, cur - 1);
                        savePanelAutoMinutes(state.autoMinutes);
                        reconfigureAutoRefresh();
                        bump();
                    },
                }, "−"),
                e("span", { style: { minWidth: 36, textAlign: "center", fontWeight: 700 } },
                    String(mins)),
                e("button", {
                    style: styles.button,
                    onClick: () => {
                        const cur = state.autoMinutes ?? modMins;
                        state.autoMinutes = Math.min(20, cur + 1);
                        savePanelAutoMinutes(state.autoMinutes);
                        reconfigureAutoRefresh();
                        bump();
                    },
                }, "+"),
                e("span", { style: { color: COLORS.dim, fontSize: 10 } }, "1–20"),
            ),
        ),

    );
}


function renderHome(e: (...args: unknown[]) => unknown, snap: NonNullable<typeof state.snapshot>): unknown {
    const cards = snap.cards ?? [];
    return e(
        "div",
        { style: styles.homeWrap },
        cards.length === 0
            ? e("div", { style: styles.empty }, "No cards configured. Click ✎ Cards.")
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
 */
function seriesFromHistory(
    history: import("./types.ts").RawStatsSnapshot[],
    kind: "elements" | "structures" | "terrains",
    id: string,
    label: string,
    color: string,
): { id: string; label: string; color: string; values: number[] } {
    return {
        id,
        label,
        color,
        values: seriesForId(history, kind, id, 20),
    };
}

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
    // Live history — same source as list graphs
    const history = state.snapshot?.statsHistory ?? loadHistory();

    return e(
        "div",
        {
            key: g.id,
            style: {
                ...styles.groupCard,
                borderColor: g.color,
                boxShadow: `inset 3px 0 0 ${g.color}`,
            },
        },
        e("div", { style: { ...styles.cardLabel, color: g.color } }, g.title),
        e("div", { style: { ...styles.cardValue, color: g.color } },
            g.total.toLocaleString()),
        e(
            "div",
            { style: styles.itemList },
            ...g.items.map((it, i) => {
                // ONE series only → same Y domain as list with this item alone selected
                const series = [
                    seriesFromHistory(
                        history,
                        kindKeyOfItem(it.kind),
                        it.id,
                        it.label,
                        it.color || g.color || seriesColor(i),
                    ),
                ];
                return e(
                    "div",
                    {
                        key: `${it.kind}:${it.id}`,
                        style: styles.itemBlockTight,
                    },
                    e(
                        "div",
                        { style: it.primary ? styles.itemRowPrimary : styles.itemRow },
                        e("span", {
                            style: { ...styles.swatch, background: it.color, width: 8, height: 8 },
                        }),
                        e("span", { style: styles.grow }, it.label),
                        e("span", {
                            style: {
                                color: it.primary ? g.color : COLORS.text,
                                fontWeight: it.primary ? 700 : 500,
                                fontVariantNumeric: "tabular-nums",
                            },
                        }, it.count.toLocaleString()),
                    ),
                    // Same MultiLineChart as list (single series = same axis as list with that item checked)
                    e("div", { style: styles.sparkWrap },
                        MultiLineChart(series, { width: 520, height: 100, compact: true }),
                    ),
                );
            }),
        ),
    );
}

function renderCardEditor(e: (...args: unknown[]) => unknown): unknown {
    const cats = listCataloguesForPicker();
    // Merge terrains from last snapshot so ids found on map appear
    const snapTerrains = state.snapshot?.terrains ?? [];
    const trMap = new Map(cats.terrains.map((t) => [t.id, t]));
    for (const t of snapTerrains) trMap.set(t.id, t);
    const options = listPickerOptions(cats.elements, cats.structures, [...trMap.values()]);

    const elementOpts = options.filter((o) => o.kind === "element");
    const terrainOpts = options.filter((o) => o.kind === "terrain");
    const structureOpts = options.filter((o) => o.kind === "structure");

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
            e("div", { style: { color: COLORS.accent, fontWeight: 700, fontSize: 14 } },
                "Edit home cards"),
            e("div", { style: { color: COLORS.dim, fontSize: 11, marginTop: 4, lineHeight: 1.45 } },
                "Choose which resources appear on the Home tab. The first item on a card is primary "
                + "(larger weight for the card color). Pick elements, terrains, or structures from the lists."),
        ),
        e(
            "div",
            { style: styles.editorBar },
            e("span", { style: { flex: 1 } }),
            e("button", { style: styles.button, onClick: addCard }, "+ New card"),
            e("button", { style: styles.button, onClick: () => {
                state.editingCards = false;
                state.cards = loadCards();
                bump();
            } }, "Cancel"),
            e("button", {
                style: styles.buttonPrimary,
                onClick: () => {
                    saveCards(state.cards);
                    state.editingCards = false;
                    if (state.snapshot) {
                        const fullEl = listCataloguesForPicker().elements;
                        const countById = new Map(state.snapshot.elements.map((r) => [r.id, r.count]));
                        for (const r of fullEl) r.count = countById.get(r.id) ?? 0;
                        for (const r of state.snapshot.elements) {
                            if (!fullEl.some((x) => x.id === r.id)) fullEl.push(r);
                        }
                        const ref = state.snapshot.statsReference ?? loadReference();
                        const hist = state.snapshot.statsHistory?.length
                            ? state.snapshot.statsHistory
                            : loadHistory();
                        state.snapshot = {
                            ...state.snapshot,
                            cards: resolveCards(
                                state.cards,
                                fullEl,
                                state.snapshot.structures,
                                state.snapshot.terrains,
                                ref,
                                hist,
                            ),
                        };
                    }
                    bump();
                },
            }, "Save"),
        ),
        e(
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
                        e("span", { style: { color: COLORS.dim } },
                            `${card.items.length} item${card.items.length === 1 ? "" : "s"}`),
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
                            e("div", { style: { ...styles.fieldLabel, marginTop: 10 } },
                                "Items (first = primary size & color)"),
                            e(
                                "div",
                                { style: styles.itemList },
                                ...card.items.map((it, idx) =>
                                    e(
                                        "div",
                                        {
                                            key: `${it.kind}:${it.id}:${idx}`,
                                            style: idx === 0 ? styles.itemRowPrimary : styles.itemRow,
                                        },
                                        e("span", {
                                            style: {
                                                color: idx === 0 ? COLORS.accent : COLORS.dim,
                                                minWidth: 14,
                                            },
                                        }, idx === 0 ? "★" : String(idx + 1)),
                                        e("span", { style: { color: COLORS.dim, minWidth: 64 } }, it.kind),
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
                            e("div", { style: styles.addRow },
                                e("select", {
                                    style: styles.select,
                                    id: `add-kind-${card.id}`,
                                    defaultValue: "element",
                                },
                                    e("option", { value: "element" }, "Element"),
                                    e("option", { value: "terrain" }, "Terrain"),
                                    e("option", { value: "structure" }, "Structure"),
                                ),
                                e("select", {
                                    style: { ...styles.select, flex: 1 },
                                    id: `add-id-${card.id}`,
                                    defaultValue: "",
                                },
                                    e("option", { value: "" }, "— pick item —"),
                                    ...elementOpts.map((o) =>
                                        e("option", { key: `e:${o.id}`, value: `element::${o.id}` }, `E · ${o.label}`)),
                                    ...terrainOpts.map((o) =>
                                        e("option", { key: `t:${o.id}`, value: `terrain::${o.id}` }, `T · ${o.label}`)),
                                    ...structureOpts.map((o) =>
                                        e("option", { key: `s:${o.id}`, value: `structure::${o.id}` }, `S · ${o.label}`)),
                                ),
                                e("button", {
                                    style: styles.buttonPrimary,
                                    onClick: () => {
                                        const sel = (globalThis as any).document
                                            ?.getElementById?.(`add-id-${card.id}`) as HTMLSelectElement | null;
                                        const val = sel?.value ?? "";
                                        if (!val) return;
                                        const [kind, id] = val.split("::") as [CardItemKind, string];
                                        if (kind && id) addItem(card.id, kind, id);
                                        if (sel) sel.value = "";
                                    },
                                }, "Add"),
                            ),
                            e("div", { style: { color: COLORS.dim, fontSize: 10, marginTop: 6 } },
                                "Primary item (★) sets the big number and the card border/text color."),
                        )
                        : null,
                );
            }),
        ),
    );
}


function defaultTopIds(rows: { id: string; count: number }[], n = 3): string[] {
    return rows.slice().sort((a, b) => b.count - a.count).slice(0, n).map((r) => r.id);
}

/** Stable pseudo-random color from id (for structures without metaColor). */
function colorFromId(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const sat = 55 + (h % 25);
    const light = 55 + (h % 15);
    return `hsl(${hue} ${sat}% ${light}%)`;
}

function ensureGraphDefaults(
    tab: "elements" | "structures" | "terrains",
    rows: { id: string; count: number }[],
): string[] {
    const cur = state.graphSelection[tab];
    if (cur.length > 0) return cur;
    // Auto top-3 until user ticks something
    return defaultTopIds(rows, 3);
}

function toggleGraphId(tab: "elements" | "structures" | "terrains", id: string, rows: { id: string; count: number }[]): void {
    let cur = state.graphSelection[tab];
    // First explicit toggle: seed from current defaults so we don't clear top-3 unexpectedly
    if (cur.length === 0) {
        cur = defaultTopIds(rows, 3);
    }
    if (cur.includes(id)) {
        state.graphSelection[tab] = cur.filter((x) => x !== id);
    } else {
        state.graphSelection[tab] = [...cur, id];
    }
    bump();
}

function renderListGraph(
    e: (...args: unknown[]) => unknown,
    tab: "elements" | "structures" | "terrains",
    rows: { id: string; name: string; count: number; color?: string }[],
): unknown {
    const history = state.snapshot?.statsHistory ?? loadHistory();
    const ids = ensureGraphDefaults(tab, rows);

    const series = ids.map((id, i) => {
        const row = rows.find((r) => r.id === id);
        const color = row?.color || (tab === "structures" ? colorFromId(id) : seriesColor(i));
        return seriesFromHistory(history, tab, id, row?.name ?? id, color);
    });

    return e(
        "div",
        { style: styles.graphBlock },
        e("div", { style: styles.groupTitle },
            "History (last 20) · tick rows below to choose series"),
        MultiLineChart(series, 520, 130),
    );
}

function renderElementList(e: (...args: unknown[]) => unknown, rows: ElementRow[]): unknown {
    if (rows.length === 0) return e("div", { style: styles.empty }, "No elements match (count > 0).");
    const max = maxCount(rows);
    const selected = ensureGraphDefaults("elements", rows);
    return e("div", { style: styles.list },
        ...rows.map((r) => {
            const on = selected.includes(r.id);
            return e("div", { key: r.id, style: styles.row },
                e("input", {
                    type: "checkbox",
                    checked: on,
                    style: styles.rowCheck,
                    title: "Show on graph",
                    onChange: () => toggleGraphId("elements", r.id, rows),
                }),
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e("span", {
                    style: { color: COLORS.dim, minWidth: "28px" },
                    title: r.id,
                }, r.type >= 0 ? String(r.type) : "—"),
                e("span", { style: styles.grow, title: `${r.id} (type ${r.type})` }, r.name),
                e("span", { style: { color: COLORS.dim, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.mod),
                e("div", { style: styles.barTrack },
                    e("div", { style: { ...styles.barFill, width: `${Math.max(2, Math.round((100 * r.count) / max))}%` } })),
                e("span", { style: styles.count }, r.count.toLocaleString()),
            );
        }),
    );
}

function renderStructureList(e: (...args: unknown[]) => unknown, rows: StructureRow[]): unknown {
    if (rows.length === 0) return e("div", { style: styles.empty }, "No structures match (count > 0).");
    const max = maxCount(rows);
    const selected = ensureGraphDefaults("structures", rows);
    return e("div", { style: styles.list },
        ...rows.map((r) => {
            const on = selected.includes(r.id);
            const color = colorFromId(r.id);
            return e("div", { key: r.id, style: styles.row },
                e("input", {
                    type: "checkbox",
                    checked: on,
                    style: styles.rowCheck,
                    title: "Show on graph",
                    onChange: () => toggleGraphId("structures", r.id, rows),
                }),
                e("div", { style: { ...styles.swatch, background: color } }),
                e("span", { style: styles.grow, title: r.id }, r.name || r.id),
                e("span", { style: { color: COLORS.dim, maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.category || "—"),
                e("span", { style: { color: COLORS.dim, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.mod),
                e("div", { style: styles.barTrack },
                    e("div", { style: { ...styles.barFill, background: color, width: `${Math.max(2, Math.round((100 * r.count) / max))}%` } })),
                e("span", { style: styles.count }, r.count.toLocaleString()),
            );
        }),
    );
}

function renderTerrainList(e: (...args: unknown[]) => unknown, rows: TerrainRow[]): unknown {
    if (rows.length === 0) return e("div", { style: styles.empty }, "No terrains on authorized cells.");
    const max = maxCount(rows);
    const selected = ensureGraphDefaults("terrains", rows);
    const reference = state.snapshot?.statsReference ?? loadReference();
    return e("div", { style: styles.list },
        e("div", { style: { ...styles.row, color: COLORS.dim, fontSize: 10, borderBottom: `1px solid ${COLORS.border}` } },
            e("span", { style: { width: 14 } }),
            e("span", { style: { width: 12 } }),
            e("span", { style: { minWidth: 28 } }, "#"),
            e("span", { style: styles.grow }, "Terrain"),
            e("span", { style: { minWidth: 72, textAlign: "right" } }, "count"),
            e("span", { style: { minWidth: 88, textAlign: "right" } }, "% dug vs ref"),
        ),
        ...rows.map((r) => {
            const on = selected.includes(r.id);
            const refN = reference ? mapGet(reference.terrains, r.id) : 0;
            const pct = reference ? digPercent(refN || null, r.count) : null;
            const dugColor = pct == null ? COLORS.dim
                : pct >= 50 ? COLORS.good
                : pct >= 10 ? COLORS.warn
                : COLORS.dim;
            return e("div", { key: `${r.type}:${r.id}`, style: styles.row },
                e("input", {
                    type: "checkbox",
                    checked: on,
                    style: styles.rowCheck,
                    title: "Show on graph",
                    onChange: () => toggleGraphId("terrains", r.id, rows),
                }),
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e("span", { style: { color: COLORS.dim, minWidth: "28px" } }, String(r.type)),
                e("span", { style: styles.grow, title: r.id }, r.name),
                e("div", { style: styles.barTrack },
                    e("div", { style: { ...styles.barFill, width: `${Math.max(2, Math.round((100 * r.count) / max))}%` } })),
                e("span", { style: styles.count }, r.count.toLocaleString()),
                e("span", {
                    style: {
                        minWidth: 88,
                        textAlign: "right",
                        color: dugColor,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: 11,
                    },
                    title: reference
                        ? `ref ${refN.toLocaleString()} → now ${r.count.toLocaleString()}`
                        : "No reference yet — refresh once to set baseline",
                }, formatDigPct(pct)),
            );
        }),
    );
}

