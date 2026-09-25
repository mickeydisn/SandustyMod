/**
 * Host sandkit handle — same pattern as md-word-statistic.
 * The game injects `sandkit` into the mod scope; it is NOT always on globalThis.
 */
declare const sandkit: {
    api: Record<string, any>;
    react?: any;
    state?: any;
    mods?: any;
    enums?: any;
};

/**
 * Minimal structural type for the host React build.
 *
 * The game injects its own React copy; we cannot import the real types, but we
 * DO need the hooks to be generic so `useState<PanelState>(...)` type-checks.
 */
export interface HostReactType {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(initial: S | (() => S)) => [S, (v: S | ((prev: S) => S)) => void];
    useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => void;
    useRef: <T>(initial: T) => { current: T };
    useCallback: <T>(fn: T, deps?: readonly unknown[]) => T;
    useMemo: <T>(fn: () => T, deps?: readonly unknown[]) => T;
}

export const api = sandkit.api as any;
export const root = sandkit as any;
export const React = (sandkit as { react?: HostReactType }).react;
export const h = React?.createElement?.bind(React) as
    | ((...args: unknown[]) => unknown)
    | undefined;

export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

export function toast(msg: string): void {
    safe(() => api.ui.toast(msg, {}));
}

/** Resolve sandkit even if only exposed on globalThis (defensive). */
export function getSandkit(): typeof sandkit | any {
    try {
        if (typeof sandkit !== "undefined" && sandkit) return sandkit;
    } catch { /* */ }
    return (globalThis as any).sandkit ?? (globalThis as any).__sandkit ?? null;
}
