/**
 * md-admin-structure — the typed handles every other module shares.
 *
 * One cast widens `sandkit.api` to the admin surface (see `types.ts`); the React
 * handle is captured once here so `panel.ts` can build elements with `h(...)`.
 */
import "@sandmd/sandkit";
import type { PanelReact, SandkitRoot, WidenedApi } from "./types.ts";

/** The host `sandkit.api`, widened to everything this mod uses. */
export const api = sandkit.api as unknown as WidenedApi;

/** `sandkit`, restricted to the containers this mod reads. */
export const root = sandkit as unknown as SandkitRoot;

/** The host React copy, or undefined when the HUD bundle is unavailable. */
export const React = (sandkit as { react?: unknown }).react as PanelReact | undefined;

/** `React.createElement`, pre-bound; undefined without a React handle. */
export const h = React?.createElement.bind(React) as
    | ((...args: unknown[]) => unknown)
    | undefined;

/** Run `fn`, returning `fallback` when it throws (engine calls may be absent). */
export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

/** Best-effort toast; the HUD may not be mounted yet. */
export function toast(msg: string): void {
    safe(() => api.ui.toast(msg));
}
