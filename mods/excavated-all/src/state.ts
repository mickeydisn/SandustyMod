/**
 * excavated-all — mod state.
 *
 * `toolState` holds the live radius/filters/last-run stats; `repaint` is the
 * bump function the mounted hotbar overlay registers so non-React code (the
 * click/hold handler, the keybind) can force a re-render — same pattern as
 * `md-admin-structure/state.ts`.
 */
import { api, safe } from "./api.ts";
import {
    DEFAULT_FILTERS,
    MOD_ID,
    RADIUS_DEFAULT,
    RADIUS_MAX,
    RADIUS_MIN,
    STORE_KEY_FILTERS,
    STORE_KEY_RADIUS,
} from "./ids.ts";
import type { ExcavateStats, FilterState, Setter } from "./types.ts";

export const toolState: {
    radius: number;
    filters: FilterState;
    lastStats: ExcavateStats | null;
} = {
    radius: RADIUS_DEFAULT,
    filters: { ...DEFAULT_FILTERS },
    lastStats: null,
};

let repaint: Setter<number> | null = null;

/** Called by the panel's effect on mount / unmount. */
export function setRepaint(fn: Setter<number> | null): void {
    repaint = fn;
}

/** Force a panel re-render when a panel is mounted. */
export function repaintPanel(): void {
    if (repaint) repaint((v) => v + 1);
}

/** Load remembered radius/filters from mod storage (best-effort). */
export function loadPersisted(): void {
    const r = safe(() => api.storage.get?.(MOD_ID, STORE_KEY_RADIUS));
    if (typeof r === "number" && isFinite(r)) {
        toolState.radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(r)));
    }
    const f = safe(() => api.storage.get?.(MOD_ID, STORE_KEY_FILTERS));
    if (f && typeof f === "object") {
        toolState.filters = { ...DEFAULT_FILTERS, ...(f as Partial<FilterState>) };
    }
}

/** Persist the current radius. */
export function persistRadius(): void {
    safe(() => api.storage.set?.(MOD_ID, STORE_KEY_RADIUS, toolState.radius));
}

/** Persist the current filter set. */
export function persistFilters(): void {
    safe(() => api.storage.set?.(MOD_ID, STORE_KEY_FILTERS, toolState.filters));
}

/** Clamp + set the brush radius, persist, and repaint. */
export function setRadius(n: number): void {
    const v = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(n) || RADIUS_MIN));
    toolState.radius = v;
    persistRadius();
    repaintPanel();
}

/** Flip one filter, persist, and repaint. */
export function toggleFilter(key: keyof FilterState): void {
    toolState.filters = { ...toolState.filters, [key]: !toolState.filters[key] };
    persistFilters();
    repaintPanel();
}
