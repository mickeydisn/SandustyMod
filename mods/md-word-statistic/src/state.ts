import type { HomeCardConfig, OriginFilter, ScanSnapshot, TabId } from "./types.ts";
import { loadCards } from "./cards.ts";

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
};

let repaint: ((fn: (v: number) => number) => void) | null = null;

export function setRepaint(fn: ((v: number) => number) | null): void {
    repaint = fn as any;
}

export function bump(): void {
    repaint?.((v) => v + 1);
}
