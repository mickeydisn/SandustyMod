/**
 * Typed sandkit handle + small helpers.
 *
 * The mod bundles this module in, so `sandkit` is resolved at load time from
 * the host's global scope.
 */
import type { PanelReact } from "./types.ts";

declare const sandkit: {
    api: Record<string, any>;
    react?: PanelReact;
    state?: any;
    mods?: any;
    enums?: any;
};

export const api = sandkit.api as any;

/** Live game root (mods registry, state, …). */
export const root = sandkit as any;

export const React = (sandkit as { react?: PanelReact }).react;

export const h = React?.createElement.bind(React) as
    | ((...args: unknown[]) => unknown)
    | undefined;

/** Run `fn`, returning `fallback` when it throws. */
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
