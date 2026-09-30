/**
 * excavated-all — the typed handles every other module shares.
 *
 * The full `sandkit.api` surface used by this mod (terrains/elements/structures
 * removal, authorization queries, grid batching, items/input/ui) is wider than
 * the ambient `@sandmd/sandkit` types, so we widen with a single cast here —
 * same approach as `md-admin-element` / `md-admin-structure`.
 */
import "@sandmd/sandkit";
import type { PanelReact, RawApi } from "./types.ts";

/** Raw sandkit api — full surface, not the ambient typed subset. */
export const api = sandkit.api as unknown as RawApi;

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
    safe(() => api.ui.toast(msg, {}));
}
