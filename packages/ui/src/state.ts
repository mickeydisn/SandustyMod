/**
 * Panel chrome state shared between the data layer and the React overlay.
 *
 * `createPanelState` owns only the presentation state both statistic mods have
 * in common (tab, drag, zoom, opacity, lock, minimize, position). Anything
 * specific to a mod's data model lives in `state.extra`, and `recompute`
 * runs on every `bump()` so derived fields stay fresh.
 */
import type { PanelPos } from "./types.ts";
import type { UiStore } from "./uiStore.ts";

/** Panel chrome state shared by every statistic mod. */
export interface ChromeState {
    tab: string;
    locked: boolean;
    minimized: boolean;
    pos: PanelPos;
    dragging: boolean;
    zoom: number;
    alpha: number;
    editingCards: boolean;
    editFocusId: string | null;
    /** Auto-refresh override in minutes; null = use mod config. */
    autoMinutes: number | null;
    _repaint: null | ((n: number) => void);
    _tick: number;
}

/**
 * A mod's panel state: the shared chrome fields plus whatever the mod adds.
 * The mod's own fields sit at the **top level**, so `state.snapshot` works
 * without a nested `state.extra.snapshot` at every call site.
 */
export type PanelState<T> = ChromeState & T;

export interface PanelController<T> {
    state: PanelState<T>;
    /** Force a repaint; calls `recompute` first so derived fields stay fresh. */
    bump(): void;
    setRepaint(fn: null | ((n: number) => void)): void;
    /** Read persisted chrome prefs into `state`. */
    loadChrome(): void;
}

export interface PanelStateOptions<T> {
    store: UiStore;
    /** Initial tab id. */
    tab?: string;
    /** Mod-specific fields, merged at the top level of `state`. */
    extra?: T;
    /** Recompute derived state on every `bump()`. */
    recompute?: (state: PanelState<T>) => void;
    /** Extra load step run after the chrome prefs are read. */
    loadExtra?: (state: PanelState<T>) => void;
}

export function createPanelState<T extends object = Record<string, never>>(
    opts: PanelStateOptions<T>,
): PanelController<T> {
    const { store } = opts;
    const state: PanelState<T> = {
        tab: opts.tab ?? "home",
        locked: false,
        minimized: false,
        pos: { right: 16, top: 80 },
        dragging: false,
        zoom: 1,
        alpha: 1,
        editingCards: false,
        editFocusId: null,
        autoMinutes: store.loadAutoMinutes(),
        _repaint: null,
        _tick: 0,
        ...(opts.extra ?? ({} as T)),
    };

    const bump = (): void => {
        opts.recompute?.(state);
        state._tick += 1;
        state._repaint?.(state._tick);
    };

    return {
        state,
        bump,
        setRepaint(fn): void {
            state._repaint = fn;
        },
        loadChrome(): void {
            state.pos = store.loadPanelPos();
            state.zoom = store.loadZoom();
            state.alpha = store.loadAlpha();
            state.locked = store.loadLocked();
            state.minimized = store.loadMinimized();
            state.autoMinutes = store.loadAutoMinutes();
            opts.loadExtra?.(state);
        },
    };
}

/** A tab in the panel's tab bar. `id` stays open so mods can extend it. */
export interface TabDef {
    id: string;
    label: string;
}

/** One row of a `category :: sub-key` breakdown. */
export interface BreakdownRow {
    key: string;
    count: number;
}

/** Options accepted by {@link createUiStore}. */
export interface UiStoreOptions {
    /** Mod id — storage namespace. */
    modId: string;
    /** Storage key prefix, e.g. `"panel"` → `panelPosition`. */
    keyPrefix: string;
    /** Clamp for the persisted zoom level. */
    zoomRange?: [number, number];
    /** Clamp for the persisted opacity. */
    alphaRange?: [number, number];
    /** Clamp for the panel auto-refresh override; omit to disable. */
    autoMinutesRange?: [number, number];
}
