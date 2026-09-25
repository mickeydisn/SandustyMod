/**
 * Channel Pads — typed handle on the sandkit API plus the shared helpers.
 */
import "@sandmd/sandkit";
import { CHANNELS, padId } from "./constants.ts";
import type { ChannelPadsApi, PadStructure } from "./types.ts";

/** The host `sandkit.api`, widened to everything this mod uses. */
export const api = sandkit.api as unknown as ChannelPadsApi;

/** Toast by i18n key, falling back to the raw key / translated string. */
export function toast(key: string, params: Record<string, unknown> = {}): void {
    try {
        api.ui.toast({ key, params });
    } catch {
        try {
            api.ui.toast(api.i18n.t?.(key, params) ?? key);
        } catch {
            /* toast optional */
        }
    }
}

/** Every placed pad of one channel type (best-effort; empty on failure). */
export function listChannel(ch: number): PadStructure[] {
    const pads: PadStructure[] = [];
    try {
        api.structures.forEachOfType(padId(ch), (structure) => pads.push(structure));
    } catch {
        /* type not placed yet */
    }
    return pads;
}

/**
 * Resolve a channel index from a structure id, accepting either the string id
 * or the numeric type the runtime sometimes reports.
 */
export function channelFromId(id: unknown): number | null {
    if (id == null) return null;
    for (let ch = 0; ch < CHANNELS; ch++) {
        if (id === padId(ch)) return ch;
        try {
            const type = api.structures.getTypeById?.(padId(ch));
            if (type != null && type === id) return ch;
        } catch {
            /* ignore */
        }
    }
    return null;
}

/** Resolve a channel index from a placed structure (data field, then type). */
export function channelFromStructure(structure: PadStructure | null | undefined): number | null {
    if (!structure) return null;
    if (typeof structure.data?.channel === "number") return structure.data.channel;
    for (let ch = 0; ch < CHANNELS; ch++) {
        try {
            if (api.structures.isType?.(structure, padId(ch))) return ch;
        } catch {
            /* ignore */
        }
    }
    return null;
}
