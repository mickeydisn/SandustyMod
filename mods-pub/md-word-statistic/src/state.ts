/**
 * Panel state: the shared chrome state from `@sandmd/ui` plus the
 * world-statistic fields (snapshot, filters, card list, graph selection).
 */
import { createPanelState } from "@sandmd/ui";
import { hydrateFromStorage, store } from "./uiStore.ts";
import { loadCards } from "./cards.ts";
import type { HomeCardConfig, OriginFilter, ScanSnapshot } from "./types.ts";

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
});

export const state = ctrl.state;

export function bump(): void {
    ctrl.bump();
}

export function setRepaint(fn: ((v: number) => number) | null): void {
    ctrl.setRepaint(fn as unknown as ((n: number) => void) | null);
}

export function bootFromStorage(): void {
    if (state.snapshot) return;
    ctrl.loadChrome();
    state.cards = loadCards();
    try {
        state.snapshot = hydrateFromStorage(state.cards);
    } catch (err) {
        console.warn("[md-word-statistic] hydrate failed", err);
    }
}
