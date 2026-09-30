/**
 * Mutable panel state shared between event buffer and React overlay.
 */
import {
    loadAlpha,
    loadLocked,
    loadMinimized,
    loadPos,
    loadZoom,
} from "./uiStore.ts";
import { loadCards, resolveCards } from "./buffer.ts";
import type { CardStat, HomeCardConfig, PanelPos, TabId } from "./types.ts";

export const state = {
    tab: "home" as TabId,
    locked: false,
    minimized: false,
    pos: { right: 16, top: 80 } as PanelPos,
    zoom: 1,
    alpha: 1,
    dragging: false,
    editingCards: false,
    editFocusId: null as string | null,
    cards: [] as HomeCardConfig[],
    /** Resolved card stats (recomputed on bump). */
    resolvedCards: [] as CardStat[],
    /** Force React re-render. */
    _repaint: null as null | ((n: number) => void),
    _tick: 0,
};

export function bootFromStorage(): void {
    state.pos = loadPos();
    state.zoom = loadZoom();
    state.alpha = loadAlpha();
    state.locked = loadLocked();
    state.minimized = loadMinimized();
    state.cards = loadCards();
    state.resolvedCards = resolveCards(state.cards);
}

export function setRepaint(fn: ((n: number) => void) | null): void {
    state._repaint = fn;
}

/** Bump tick + re-resolve cards so the panel refreshes. */
export function bump(): void {
    state.resolvedCards = resolveCards(state.cards);
    state._tick += 1;
    state._repaint?.(state._tick);
}
