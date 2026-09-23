/**
 * Word Statistic overlay panel.
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
    runScan,
} from "./data.ts";
import { emptyCard, loadCards, saveCards } from "./cards.ts";
import { bump, setRepaint, state } from "./state.ts";
import { COLORS, styles } from "./styles.ts";
import { isToolSelected } from "./select.ts";

const TABS: { id: TabId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "structures", label: "Structures" },
    { id: "elements", label: "Elements" },
    { id: "terrains", label: "Terrains" },
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
        let alive = true;
        const poll = (): void => {
            if (!alive) return;
            bump();
            setTimeout(poll, 250);
        };
        const id = setTimeout(poll, 250);
        return () => { alive = false; clearTimeout(id); };
    }, []);

    if (!isToolSelected()) return null;

    const snap = state.snapshot;
    const scanning = state.scanning;

    const doRefresh = async (): Promise<void> => {
        if (state.scanning) return;
        state.scanning = true;
        setProgress({ done: 0, total: 0 });
        bump();
        try {
            const next = await runScan((done, total) => {
                setProgress({ done, total });
            }, state.cards);
            state.snapshot = next;
        } catch (err) {
            console.error("[md-word-statistic] scan failed", err);
        } finally {
            state.scanning = false;
            bump();
        }
    };

    const setTab = (id: TabId): void => {
        state.tab = id;
        state.editingCards = false;
        bump();
    };

    const openEditor = (): void => {
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
                state.snapshot = {
                    ...state.snapshot,
                    cards: resolveCards(
                        state.cards,
                        [...elMap.values()],
                        structures.length ? structures : cats.structures,
                        [...trMap.values()],
                    ),
                };
            }
        } else {
            state.cards = loadCards();
        }
        state.editingCards = false;
        bump();
    };

    const header = e(
        "div",
        { style: styles.header },
        e("span", { style: styles.title }, "Word Statistic"),
        state.tab === "home" && !state.editingCards
            ? e(
                "button",
                {
                    style: styles.button,
                    onClick: openEditor,
                    title: "Edit home cards",
                },
                "✎ Cards",
            )
            : null,
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
                    disabled: state.editingCards,
                },
                t.label,
            )
        ),
    );

    const toolbar = state.tab !== "home" && !state.editingCards
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
        body = renderElementList(e, filterAndSort(snap.elements, state.filter, state.sortBy, state.origin));
    } else if (state.tab === "structures") {
        body = renderStructureList(e, filterAndSort(snap.structures, state.filter, state.sortBy, state.origin));
    } else {
        body = renderTerrainList(e, filterAndSort(snap.terrains, state.filter, state.sortBy, state.origin));
    }

    const footer = e(
        "div",
        { style: styles.footer },
        e("span", null,
            snap
                ? `${snap.elements.length} elm · ${snap.structures.length} str · ${snap.terrains.length} terr · auth ${snap.authorizedCells.toLocaleString()}`
                : "idle",
        ),
        e("span", null, `v${VERSION}`),
    );

    return e(
        "div",
        { style: styles.root, className: "md-word-stat-root" },
        header, tabs, toolbar,
        e("div", { style: styles.body }, body),
        footer,
    );
}

function renderHome(e: (...args: unknown[]) => unknown, snap: NonNullable<typeof state.snapshot>): unknown {
    const pctLabel = `${snap.emptyPercent.toFixed(1)}%`;
    const cards = snap.cards ?? [];

    return e(
        "div",
        { style: styles.homeWrap },
        // Resource cards FIRST
        e(
            "div",
            { style: styles.groupSection },
            e("div", { style: styles.groupTitle }, "Resources"),
            cards.length === 0
                ? e("div", { style: styles.empty }, "No cards configured. Click ✎ Cards.")
                : e(
                    "div",
                    { style: styles.groupGrid },
                    ...cards.map((g) => renderResourceCard(e, g)),
                ),
        ),
        e(
            "div",
            { style: styles.homeGrid },
            e("div", { style: styles.card },
                e("div", { style: styles.cardLabel }, "World"),
                e("div", { style: styles.cardValue },
                    snap.worldW > 0 ? `${snap.worldW}×${snap.worldH}` : "—"),
                e("div", { style: styles.cardSub },
                    `${snap.authorizedCells.toLocaleString()} authorized · ${snap.skippedAuthCells.toLocaleString()} skipped · ${snap.durationMs} ms`),
            ),
            e("div", { style: styles.card },
                e("div", { style: styles.cardLabel }, "Empty cells"),
                e("div", { style: styles.cardValue }, pctLabel),
                e("div", { style: styles.cardSub },
                    `${snap.emptyCells.toLocaleString()} of ${snap.authorizedCells.toLocaleString()} authorized`),
            ),
            e("div", { style: styles.card },
                e("div", { style: styles.cardLabel }, "Elements"),
                e("div", { style: styles.cardValue }, snap.totalElements.toLocaleString()),
                e("div", { style: styles.cardSub }, `${snap.elements.length} types with count > 0`),
            ),
            e("div", { style: styles.card },
                e("div", { style: styles.cardLabel }, "Structures"),
                e("div", { style: styles.cardValue }, snap.totalStructures.toLocaleString()),
                e("div", { style: styles.cardSub }, `${snap.structures.length} types with count > 0`),
            ),
            e("div", { style: styles.card },
                e("div", { style: styles.cardLabel }, "Terrains"),
                e("div", { style: styles.cardValue }, snap.totalTerrains.toLocaleString()),
                e("div", { style: styles.cardSub }, `${snap.terrains.length} kinds on map`),
            ),
            e("div", { style: styles.card },
                e("div", { style: styles.cardLabel }, "Last refresh"),
                e("div", { style: styles.cardValue }, formatTime(snap.at)),
                e("div", { style: styles.cardSub }, "Auth-filtered counts"),
            ),
        ),
    );
}

function renderResourceCard(
    e: (...args: unknown[]) => unknown,
    g: { id: string; title: string; color: string; total: number; items: { label: string; count: number; primary: boolean; color: string; id: string; kind: string }[] },
): unknown {
    const primary = g.items.find((i) => i.primary) ?? g.items[0];
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
            (primary ? primary.count : g.total).toLocaleString()),
        e("div", { style: styles.cardSub },
            primary
                ? `${primary.label} · total ${g.total.toLocaleString()}`
                : `total ${g.total.toLocaleString()}`),
        e(
            "div",
            { style: styles.itemList },
            ...g.items.map((it) =>
                e(
                    "div",
                    {
                        key: `${it.kind}:${it.id}`,
                        style: it.primary ? styles.itemRowPrimary : styles.itemRow,
                    },
                    e("span", {
                        style: { ...styles.swatch, background: it.color, width: 8, height: 8 },
                    }),
                    e("span", { style: styles.grow }, it.label),
                    e("span", {
                        style: {
                            color: it.primary ? g.color : COLORS.dim,
                            fontWeight: it.primary ? 700 : 400,
                            fontVariantNumeric: "tabular-nums",
                        },
                    }, it.count.toLocaleString()),
                )
            ),
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
            { style: styles.editorBar },
            e("span", { style: { color: COLORS.accent, fontWeight: 600 } }, "Edit home cards"),
            e("span", { style: { flex: 1 } }),
            e("button", { style: styles.button, onClick: addCard }, "+ New card"),
            e("button", { style: styles.button, onClick: () => {
                // discard handled by closeEditor(false)
                state.editingCards = false;
                state.cards = loadCards();
                bump();
            } }, "Cancel"),
            e("button", {
                style: styles.buttonPrimary,
                onClick: () => {
                    saveCards(state.cards);
                    state.editingCards = false;
                    // refresh card stats if we have a snapshot
                    if (state.snapshot) {
                        const fullEl = listCataloguesForPicker().elements;
                        const countById = new Map(state.snapshot.elements.map((r) => [r.id, r.count]));
                        for (const r of fullEl) r.count = countById.get(r.id) ?? 0;
                        for (const r of state.snapshot.elements) {
                            if (!fullEl.some((x) => x.id === r.id)) fullEl.push(r);
                        }
                        state.snapshot = {
                            ...state.snapshot,
                            cards: resolveCards(
                                state.cards,
                                fullEl,
                                state.snapshot.structures,
                                state.snapshot.terrains,
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

function renderElementList(e: (...args: unknown[]) => unknown, rows: ElementRow[]): unknown {
    if (rows.length === 0) return e("div", { style: styles.empty }, "No elements match (count > 0).");
    const max = maxCount(rows);
    return e("div", { style: styles.list },
        ...rows.map((r) =>
            e("div", { key: r.id, style: styles.row },
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e("span", { style: { color: COLORS.dim, minWidth: "28px" } }, String(r.type)),
                e("span", { style: styles.grow, title: r.id }, r.name),
                e("span", { style: { color: COLORS.dim, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.mod),
                e("div", { style: styles.barTrack },
                    e("div", { style: { ...styles.barFill, width: `${Math.max(2, Math.round((100 * r.count) / max))}%` } })),
                e("span", { style: styles.count }, r.count.toLocaleString()),
            ),
        ),
    );
}

function renderStructureList(e: (...args: unknown[]) => unknown, rows: StructureRow[]): unknown {
    if (rows.length === 0) return e("div", { style: styles.empty }, "No structures match (count > 0).");
    const max = maxCount(rows);
    return e("div", { style: styles.list },
        ...rows.map((r) =>
            e("div", { key: r.id, style: styles.row },
                e("span", { style: styles.grow, title: r.id }, r.name || r.id),
                e("span", { style: { color: COLORS.dim, maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.category || "—"),
                e("span", { style: { color: COLORS.dim, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.mod),
                e("div", { style: styles.barTrack },
                    e("div", { style: { ...styles.barFill, width: `${Math.max(2, Math.round((100 * r.count) / max))}%` } })),
                e("span", { style: styles.count }, r.count.toLocaleString()),
            ),
        ),
    );
}

function renderTerrainList(e: (...args: unknown[]) => unknown, rows: TerrainRow[]): unknown {
    if (rows.length === 0) return e("div", { style: styles.empty }, "No terrains on authorized cells.");
    const max = maxCount(rows);
    return e("div", { style: styles.list },
        ...rows.map((r) =>
            e("div", { key: `${r.type}:${r.id}`, style: styles.row },
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e("span", { style: { color: COLORS.dim, minWidth: "28px" } }, String(r.type)),
                e("span", { style: styles.grow, title: r.id }, r.name),
                e("div", { style: styles.barTrack },
                    e("div", { style: { ...styles.barFill, width: `${Math.max(2, Math.round((100 * r.count) / max))}%` } })),
                e("span", { style: styles.count }, r.count.toLocaleString()),
            ),
        ),
    );
}
