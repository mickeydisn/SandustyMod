/**
 * Panel state: the shared chrome state from `@sandmd/ui` plus the
 * world-statistic fields (snapshot, filters, card list, graph selection).
 */
import { createPanelState } from "@sandmd/ui";
import { hydrateFromStorage, store } from "./uiStore.ts";
import { listCataloguesForPicker, resolveCards } from "./data.ts";
import { loadCards } from "./cards.ts";
import { loadHistory, loadReference } from "./history.ts";
import type { CardStat, HomeCardConfig, OriginFilter, ScanSnapshot } from "./types.ts";

/** Mod-specific panel fields, merged alongside the shared chrome state. */
export interface WordStatExtras {
    scanning: boolean;
    snapshot: ScanSnapshot | null;
    filter: string;
    sortBy: "count" | "name" | "id";
    origin: OriginFilter;
    cards: HomeCardConfig[];
    graphSelection: {
        elements: string[];
        structures: string[];
        terrains: string[];
    };
}

const ctrl = createPanelState<WordStatExtras>({
    store,
    tab: "home",
    extra: {
        scanning: false,
        snapshot: null,
        filter: "",
        sortBy: "count",
        origin: "all",
        cards: [],
        graphSelection: { elements: [], structures: [], terrains: [] },
    },
    // Card edits do not need a rescan: re-resolve the Home cards whenever the
    // config list changes identity (editor save, discard, reset defaults).
    recompute: (st) => reResolveCards(st),
    loadExtra: () => ensureCardsLoaded(),
});

export const state = ctrl.state;

/**
 * True once the stored card config has been read into `state.cards`.
 *
 * The latch matters. The Home cards are resolved from `state.cards`, and a
 * scan does not wait for the overlay: the boot auto-refresh runs on its own and
 * can finish before the panel has ever mounted. With the config still empty at
 * that point the scan bakes an empty card list into the snapshot and the Home
 * tab renders "No cards configured" for the rest of the session — reopening the
 * tool cannot fix it, because the cards went missing from memory rather than
 * from storage.
 */
let cardsLoaded = false;

/** The config list `state.snapshot.cards` currently reflects. */
let cardsResolvedFrom: HomeCardConfig[] | null = null;

/** Read the stored card config into memory, once per session. */
export function ensureCardsLoaded(): void {
    if (cardsLoaded) return;
    state.cards = loadCards();
    cardsLoaded = true;
}

/**
 * Re-resolve the Home cards when the config changed since the last resolve.
 *
 * A scan already resolves against the config it was handed, so a snapshot whose
 * cards match the current list is left alone. Anything else — the editor
 * saving, discarding, or resetting — gets a fresh resolve against the last
 * snapshot instead of waiting for the next full world scan.
 */
function reResolveCards(st: { cards: HomeCardConfig[]; snapshot: ScanSnapshot | null }): void {
    if (st.snapshot == null) return;
    if (st.cards === cardsResolvedFrom) return;
    try {
        const cards = resolveCardsFor(st.snapshot, st.cards);
        // Latch only on success, so a catalogue hiccup does not pin a stale
        // resolve. The catch matters because this runs from `bump`, which the
        // panel's repaint poll calls — a throw there would stop the panel.
        cardsResolvedFrom = st.cards;
        st.snapshot = { ...st.snapshot, cards };
    } catch (err) {
        console.warn("[md-word-statistic] card resolve failed", err);
    }
}

/**
 * Resolve card stats against a snapshot.
 *
 * The snapshot's rows only hold what the player has right now, so the live
 * catalogue is merged underneath: an item the player does not own yet still
 * needs its label and colour, otherwise its card line shows a raw id and a grey
 * swatch instead of "Gold" and gold.
 */
function resolveCardsFor(snap: ScanSnapshot, configs: HomeCardConfig[]): CardStat[] {
    const cats = listCataloguesForPicker();

    const elements = new Map(cats.elements.map((r) => [r.id, { ...r }]));
    for (const r of snap.elements) elements.set(r.id, { ...r });

    const structures = new Map(cats.structures.map((r) => [r.id, { ...r }]));
    for (const r of snap.structures) structures.set(r.id, { ...r });

    const terrains = new Map(cats.terrains.map((r) => [r.id, { ...r }]));
    for (const r of snap.terrains) terrains.set(r.id, { ...r });

    return resolveCards(
        configs,
        [...elements.values()],
        [...structures.values()],
        [...terrains.values()],
        snap.statsReference ?? loadReference(),
        snap.statsHistory?.length ? snap.statsHistory : loadHistory(),
    );
}

export function bump(): void {
    ctrl.bump();
}

export function setRepaint(fn: ((v: number) => number) | null): void {
    ctrl.setRepaint(fn as unknown as ((n: number) => void) | null);
}

export function bootFromStorage(): void {
    // Always run: the chrome prefs have to be applied even when a scan already
    // produced a snapshot, and `loadChrome` is what pulls the card config in.
    // Both steps are idempotent, so a re-mount is harmless.
    ctrl.loadChrome();
    if (state.snapshot) return;
    try {
        state.snapshot = hydrateFromStorage(state.cards);
    } catch (err) {
        console.warn("[md-word-statistic] hydrate failed", err);
    }
}
