/**
 * Big Brother — typed handle on the sandkit API plus the small helpers every
 * other module shares.
 */
import "@sandmd/sandkit";
import { runtime } from "./state.ts";
import type { CamStructure, ViewfinderApi } from "./types.ts";

/** The host `sandkit.api`, widened to everything this mod uses. */
export const api = sandkit.api as unknown as ViewfinderApi;

/** Clip an unknown setting value into an integer range. */
export function clampInt(value: unknown, lo: number, hi: number): number {
    if (typeof value !== "number" || !isFinite(value)) return lo;
    return Math.max(lo, Math.min(hi, Math.floor(value)));
}

/** Every placed structure of one type (best-effort; empty on failure). */
export function listType(id: string): CamStructure[] {
    const out: CamStructure[] = [];
    try {
        api.structures.forEachOfType(id, (structure) => out.push(structure));
    } catch {
        /* type unknown / registry unavailable */
    }
    return out;
}

/**
 * Resolve the channel index for a structure id, accepting either the string id
 * or the numeric type the runtime sometimes reports.
 */
export function channelFromId(id: unknown, ids: readonly string[]): number | null {
    if (id == null) return null;
    for (let ch = 0; ch < runtime.channels; ch++) {
        if (id === ids[ch]) return ch;
        try {
            const type = api.structures.getTypeById?.(ids[ch]);
            if (type != null && type === id) return ch;
        } catch {
            /* ignore */
        }
    }
    return null;
}

/** Toast by i18n key, falling back to the raw key / translated string. */
export function toast(key: string, params: Record<string, unknown> = {}): void {
    try {
        api.ui.toast({ key, params });
    } catch {
        try {
            api.ui.toast(api.i18n.t?.(key, params) ?? key);
        } catch {
            /* optional */
        }
    }
}
