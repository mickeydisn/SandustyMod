/**
 * Mutable panel state shared between the event buffer and the React overlay.
 *
 * The chrome fields come from the shared `@sandmd/ui` state factory; the
 * resolved Home cards are the only mod-specific addition.
 */
import { createPanelState } from "@sandmd/ui";
import { store } from "./uiStore.ts";
import { getConfig } from "./config.ts";
import { loadCards, resolveCards } from "./buffer.ts";
import type { CardStat, HomeCardConfig } from "./types.ts";

/** Mod-specific panel fields, merged alongside the shared chrome state. */
export interface PlayerStatExtras {
    cards: HomeCardConfig[];
    /** Resolved card stats (recomputed on bump). */
    resolvedCards: CardStat[];
    /** Ids plotted per KPI category on that tab's history graph. */
    graphSelection: Record<string, string[]>;
}

const ctrl = createPanelState<PlayerStatExtras>({
    store,
    tab: "home",
    extra: { cards: [], resolvedCards: [], graphSelection: {} },
    recompute: (st) => {
        st.resolvedCards = resolveCards(st.cards, getConfig().historyMax);
    },
    loadExtra: (st) => {
        st.cards = loadCards();
    },
});

export const state = ctrl.state;

export function bootFromStorage(): void {
    ctrl.loadChrome();
}

/** Bump tick + re-resolve cards so the panel refreshes. */
export function bump(): void {
    ctrl.bump();
}

export function setRepaint(fn: ((n: number) => void) | null): void {
    ctrl.setRepaint(fn);
}
