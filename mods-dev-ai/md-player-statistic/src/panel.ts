/**
 * Player Statistic overlay panel.
 *
 * Home cards show configurable KPI groups. Other tabs list per-category
 * breakdowns from the live event buffer (no world scan).
 */
import { h, React } from "./api.ts";
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
import { KPI_CATEGORIES, VERSION } from "./constants.ts";
import { isToolSelected } from "./select.ts";
import { bootFromStorage, bump, setRepaint, state } from "./state.ts";
import { COLORS, styles } from "./styles.ts";
import type { HomeCardConfig, TabId } from "./types.ts";
import {
    saveAlpha,
    saveLocked,
    saveMinimized,
    savePanelPos,
    saveZoom,
} from "./uiStore.ts";

const TABS: { id: TabId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "actions", label: "Actions" },
    { id: "items", label: "Items" },
    { id: "terrain", label: "Terrain" },
    { id: "config", label: "⚙️" },
];

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return "—";
    }
}

function maxCount(rows: { count: number }[]): number {
    let m = 1;
    for (const r of rows) if (r.count > m) m = r.count;
    return m;
}

function sparkline(series: number[], color: string): unknown {
    if (!series.length || !h) return null;
    const w = 64;
    const ht = 18;
    const mx = Math.max(1, ...series);
    const pts = series
        .map((v, i) => {
            const x = (i / Math.max(1, series.length - 1)) * w;
            const y = ht - (v / mx) * (ht - 2) - 1;
            return `${x},${y}`;
        })
        .join(" ");
    return h(
        "svg",
        { width: w, height: ht, style: { display: "block", flexShrink: 0 } },
        h("polyline", {
            points: pts,
            fill: "none",
            stroke: color,
            strokeWidth: 1.5,
            strokeLinejoin: "round",
            strokeLinecap: "round",
        }),
    );
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

    if (!isToolSelected() && !state.locked) return null;

    const setTab = (id: TabId): void => {
        state.tab = id;
        if (id !== "config") state.editingCards = false;
        bump();
    };

    const startDrag = (ev: any): void => {
        if (ev.button != null && ev.button !== 0) return;
        const target = ev.target as { closest?: (s: string) => unknown } | null;
        if (target?.closest?.("button, input, select, textarea, a")) return;

        const rootEl = (ev.currentTarget as { closest?: (s: string) => HTMLElement | null })
            ?.closest?.(".md-player-stat-root");
        const rect = rootEl?.getBoundingClientRect?.();
        const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
        const startX = ev.clientX as number;
        const startY = ev.clientY as number;
        const origRight = rect ? Math.max(0, vw - rect.right) : state.pos.right;
        const origTop = rect ? rect.top : state.pos.top;

        state.dragging = true;
        bump();

        const onMove = (e2: any): void => {
            const dx = (e2.clientX as number) - startX;
            const dy = (e2.clientY as number) - startY;
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
        try {
            ev.preventDefault?.();
        } catch { /* */ }
    };

    const posStyle: Record<string, string | number> = {
        right: `${state.pos.right}px`,
        top: `${state.pos.top}px`,
        left: "auto",
        transformOrigin: "top right",
        opacity: state.alpha,
    };
    if (state.zoom !== 1) {
        posStyle.transform = `scale(${state.zoom})`;
    }

    // —— Mini widget ——
    if (state.minimized) {
        const cards = state.resolvedCards;
        return e(
            "div",
            {
                className: "md-player-stat-root",
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
                cards.length === 0
                    ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "No cards")
                    : cards.map((g) => {
                        const trend = g.delta;
                        const trendColor =
                            trend == null || trend === 0
                                ? COLORS.dim
                                : trend > 0
                                ? COLORS.good
                                : COLORS.danger;
                        const trendLabel =
                            trend == null
                                ? "—"
                                : trend > 0
                                ? `+${trend.toLocaleString()}`
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
                            e(
                                "span",
                                { style: { ...styles.miniCardSum, color: g.color } },
                                g.total.toLocaleString(),
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
    const header = e(
        "div",
        {
            style: { ...styles.header, cursor: "grab" },
            onPointerDown: startDrag,
        },
        e(
            "span",
            { style: styles.dragHandle },
            e("span", { style: styles.title }, "Player Statistic"),
        ),
        e(
            "button",
            {
                style: styles.button,
                title: state.locked ? "Unlock panel" : "Lock panel open",
                onClick: () => {
                    state.locked = !state.locked;
                    saveLocked(state.locked);
                    bump();
                },
            },
            state.locked ? "🔒" : "🔓",
        ),
        e(
            "button",
            {
                style: styles.button,
                title: "Minimize",
                onClick: () => {
                    state.minimized = true;
                    saveMinimized(true);
                    bump();
                },
            },
            "—",
        ),
    );

    const tabs = e(
        "div",
        { style: styles.tabs },
        ...TABS.map((t) =>
            e(
                "button",
                {
                    key: t.id,
                    style: state.tab === t.id ? styles.tabActive : styles.tab,
                    onClick: () => setTab(t.id),
                },
                t.label,
            ),
        ),
    );

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
                : cards.map((g) =>
                    e(
                        "div",
                        {
                            key: g.id,
                            style: { ...styles.card, borderLeftColor: g.color },
                        },
                        e("div", { style: styles.cardTitle }, g.title),
                        e(
                            "div",
                            { style: { display: "flex", alignItems: "baseline", gap: 4 } },
                            e(
                                "span",
                                { style: { ...styles.cardTotal, color: g.color } },
                                g.total.toLocaleString(),
                            ),
                            g.delta != null && g.delta !== 0
                                ? e(
                                    "span",
                                    {
                                        style: {
                                            ...styles.cardDelta,
                                            color: g.delta > 0 ? COLORS.good : COLORS.danger,
                                        },
                                    },
                                    g.delta > 0
                                        ? `+${g.delta.toLocaleString()} session`
                                        : `${g.delta.toLocaleString()} session`,
                                )
                                : null,
                        ),
                        e(
                            "div",
                            { style: { marginTop: 6 } },
                            ...g.items.map((it) =>
                                e(
                                    "div",
                                    {
                                        key: `${it.category}:${it.key}`,
                                        style: styles.row,
                                    },
                                    e("span", { style: styles.rowLabel }, it.label),
                                    sparkline(it.series, it.color),
                                    e(
                                        "span",
                                        { style: { ...styles.rowCount, color: it.color } },
                                        it.count.toLocaleString(),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            e(
                "div",
                { style: { color: COLORS.dim, fontSize: 11, marginTop: 8 } },
                `Session since ${formatTime(buffer.sessionStartedAt)} · totals are lifetime`,
            ),
        );
    } else if (state.tab === "actions") {
        const cats = [
            "structures_placed",
            "structures_removed",
            "structures_moved",
        ] as const;
        body = e(
            "div",
            null,
            ...cats.map((cat) => {
                const meta = KPI_CATEGORIES.find((c) => c.id === cat)!;
                const total = getCount(cat);
                const subs = listSubKeys(cat);
                const mx = maxCount(subs);
                return e(
                    "div",
                    { key: cat },
                    e(
                        "div",
                        { style: styles.sectionTitle },
                        `${meta.label} · ${total.toLocaleString()}`,
                    ),
                    subs.length === 0
                        ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "None yet")
                        : subs.map((s) =>
                            e(
                                "div",
                                { key: s.key, style: styles.row },
                                e("span", { style: styles.rowLabel }, s.key),
                                e(
                                    "div",
                                    { style: styles.barTrack },
                                    e("div", {
                                        style: {
                                            ...styles.barFill,
                                            width: `${Math.round((100 * s.count) / mx)}%`,
                                            background: meta.color,
                                        },
                                    }),
                                ),
                                e(
                                    "span",
                                    { style: { ...styles.rowCount, color: meta.color } },
                                    s.count.toLocaleString(),
                                ),
                            ),
                        ),
                );
            }),
        );
    } else if (state.tab === "items") {
        const total = getCount("items_used");
        const subs = listSubKeys("items_used");
        const mx = maxCount(subs);
        const color = KPI_CATEGORIES.find((c) => c.id === "items_used")!.color;
        body = e(
            "div",
            null,
            e(
                "div",
                { style: styles.sectionTitle },
                `Items used · ${total.toLocaleString()}`,
            ),
            subs.length === 0
                ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "None yet")
                : subs.map((s) =>
                    e(
                        "div",
                        { key: s.key, style: styles.row },
                        e("span", { style: styles.rowLabel }, s.key),
                        e(
                            "div",
                            { style: styles.barTrack },
                            e("div", {
                                style: {
                                    ...styles.barFill,
                                    width: `${Math.round((100 * s.count) / mx)}%`,
                                    background: color,
                                },
                            }),
                        ),
                        e(
                            "span",
                            { style: { ...styles.rowCount, color } },
                            s.count.toLocaleString(),
                        ),
                    ),
                ),
            e(
                "div",
                { style: { ...styles.sectionTitle, marginTop: 12 } },
                `World items picked · ${getCount("world_items_picked").toLocaleString()}`,
            ),
            ...listSubKeys("world_items_picked").map((s) =>
                e(
                    "div",
                    { key: `wip-${s.key}`, style: styles.row },
                    e("span", { style: styles.rowLabel }, s.key),
                    e(
                        "span",
                        { style: styles.rowCount },
                        s.count.toLocaleString(),
                    ),
                ),
            ),
            e(
                "div",
                { style: { ...styles.sectionTitle, marginTop: 12 } },
                `Resources collected · ${getCount("resources_collected").toLocaleString()}`,
            ),
            ...listSubKeys("resources_collected").map((s) =>
                e(
                    "div",
                    { key: `rc-${s.key}`, style: styles.row },
                    e("span", { style: styles.rowLabel }, s.key),
                    e(
                        "span",
                        { style: styles.rowCount },
                        s.count.toLocaleString(),
                    ),
                ),
            ),
        );
    } else if (state.tab === "terrain") {
        const total = getCount("terrain_destroyed");
        const subs = listSubKeys("terrain_destroyed");
        const mx = maxCount(subs);
        const color = KPI_CATEGORIES.find((c) => c.id === "terrain_destroyed")!.color;
        body = e(
            "div",
            null,
            e(
                "div",
                { style: styles.sectionTitle },
                `Terrain dug · ${total.toLocaleString()}`,
            ),
            subs.length === 0
                ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "None yet")
                : subs.map((s) =>
                    e(
                        "div",
                        { key: s.key, style: styles.row },
                        e("span", { style: styles.rowLabel }, s.key),
                        e(
                            "div",
                            { style: styles.barTrack },
                            e("div", {
                                style: {
                                    ...styles.barFill,
                                    width: `${Math.round((100 * s.count) / mx)}%`,
                                    background: color,
                                },
                            }),
                        ),
                        e(
                            "span",
                            { style: { ...styles.rowCount, color } },
                            s.count.toLocaleString(),
                        ),
                    ),
                ),
        );
    } else if (state.tab === "config") {
        body = e(
            "div",
            null,
            e("div", { style: styles.sectionTitle }, "Panel"),
            e(
                "div",
                { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 } },
                e(
                    "label",
                    { style: { display: "flex", alignItems: "center", gap: 4, fontSize: 12 } },
                    "Zoom",
                    e("input", {
                        type: "range",
                        min: 0.6,
                        max: 1.4,
                        step: 0.05,
                        value: state.zoom,
                        onChange: (ev: any) => {
                            state.zoom = Number(ev.target.value);
                            saveZoom(state.zoom);
                            bump();
                        },
                        style: { width: 80 },
                    }),
                ),
                e(
                    "label",
                    { style: { display: "flex", alignItems: "center", gap: 4, fontSize: 12 } },
                    "Opacity",
                    e("input", {
                        type: "range",
                        min: 0.4,
                        max: 1,
                        step: 0.05,
                        value: state.alpha,
                        onChange: (ev: any) => {
                            state.alpha = Number(ev.target.value);
                            saveAlpha(state.alpha);
                            bump();
                        },
                        style: { width: 80 },
                    }),
                ),
            ),
            e("div", { style: styles.sectionTitle }, "KPI cards"),
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
                                    .map((it) =>
                                        it.key
                                            ? `${it.category}::${it.key}`
                                            : it.category,
                                    )
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
                        ),
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
            className: "md-player-stat-root",
            style: {
                ...styles.root,
                ...posStyle,
                cursor: state.dragging ? "grabbing" : undefined,
            },
        },
        header,
        tabs,
        e("div", { style: styles.body }, body),
        footer,
    );
}
