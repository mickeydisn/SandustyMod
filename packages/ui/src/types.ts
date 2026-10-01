/**
 * Shared overlay/UI types for the statistic mods.
 *
 * The host ships its own React build, so the panel is written against the
 * minimal structural interface below rather than importing React itself.
 */

/** Inline CSS object accepted by the host React. */
export interface StyleObj {
    [key: string]: string | number | boolean | undefined;
}

export type Setter<S> = (value: S | ((prev: S) => void)) => void;

/** The subset of React the overlay actually uses. */
export interface PanelReact {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(init: S) => [S, Setter<S>];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
    useMemo: <T>(fn: () => T, deps?: unknown[]) => T;
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T, deps?: unknown[]) => T;
}

/** Right-anchored position (distance from viewport right / top). */
export interface PanelPos {
    right: number;
    top: number;
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

/**
 * Explicit storage key names, overriding the `${keyPrefix}${suffix}` default.
 * Needed where a mod already persisted its prefs under older names — those
 * installs must not silently lose their panel position on upgrade.
 */
export interface UiStoreKeys {
    pos?: string;
    zoom?: string;
    alpha?: string;
    lock?: string;
    mini?: string;
    auto?: string;
}

/** Options accepted by `createUiStore`. */
export interface UiStoreOptions {
    /** Mod id — storage namespace. */
    modId: string;
    /** Storage key prefix, e.g. `"panel"` -> `panelPosition`. */
    keyPrefix: string;
    /** Clamp for the persisted zoom level. */
    zoomRange?: [number, number];
    /** Clamp for the persisted opacity. */
    alphaRange?: [number, number];
    /** Clamp for the panel auto-refresh override. */
    autoMinutesRange?: [number, number];
    /** Exact storage key names, for backwards compatibility with old saves. */
    keys?: UiStoreKeys;
}
