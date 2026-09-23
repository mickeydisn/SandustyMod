import type { HomeCardConfig, OriginFilter, ScanSnapshot, TabId } from "./types.ts";
import { loadCards } from "./cards.ts";
import {
    hydrateFromStorage,
    loadAlpha,
    loadLocked,
    loadMinimized,
    loadPanelAutoMinutes,
    loadPanelPos,
    loadZoom,
    type PanelPos,
} from "./uiStore.ts";

export const state = {
    tab: "home" as TabId,
    scanning: false,
    snapshot: null as ScanSnapshot | null,
    filter: "",
    sortBy: "count" as "count" | "name" | "id",
    origin: "all" as OriginFilter,
    editingCards: false,
    cards: loadCards() as HomeCardConfig[],
    editFocusId: null as string | null,
    graphSelection: {
        elements: [] as string[],
        structures: [] as string[],
        terrains: [] as string[],
    },
    minimized: loadMinimized(),
    locked: loadLocked(),
    /** Right-anchored position. */
    pos: loadPanelPos() as PanelPos,
    dragging: false,
    zoom: loadZoom(),
    alpha: loadAlpha(),
    /** Override auto interval minutes (null → mod config). */
    autoMinutes: loadPanelAutoMinutes() as number | null,
};

export function bootFromStorage(): void {
    if (state.snapshot) return;
    try {
        state.snapshot = hydrateFromStorage(state.cards);
    } catch (err) {
        console.warn("[md-word-statistic] hydrate failed", err);
    }
}

let repaint: ((fn: (v: number) => number) => void) | null = null;

export function setRepaint(fn: ((v: number) => number) | null): void {
    repaint = fn as any;
}

export function bump(): void {
    repaint?.((v) => v + 1);
}
