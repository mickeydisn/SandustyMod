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

export const api = sandkit.api as any;
export const root = sandkit as any;
export const React = (sandkit as { react?: any }).react;
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
