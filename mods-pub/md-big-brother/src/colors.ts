/**
 * Big Brother — per-cell colour sampling for the schematic feed.
 *
 * Priority: live world map → element at cell → built structure → terrain →
 * deterministic noise. Everything is best-effort; a missing API never throws.
 */
import { api } from "./api.ts";
import type { MapData } from "./types.ts";

/** Read the live world map off the global sandkit state. */
function liveMap(): MapData | null {
    try {
        const shared = (sandkit.state as unknown as { shared?: { mapData?: MapData } })?.shared;
        return shared?.mapData ?? null;
    } catch {
        return null;
    }
}

/** Colour of one world cell, as a CSS colour string. */
export function colorAtCell(cx: number, cy: number): string {
    let fullCell = false;

    const map = liveMap();
    if (map) {
        const si = 4 * (cy * map.width + cx);
        const r = map.data[si];
        const g = map.data[si + 1];
        const b = map.data[si + 2];
        const a = map.data[si + 3];
        // A clean red pixel is the map's "no colour" marker.
        if (a !== 0) {
            fullCell = true;
            if (!(r === 255 && g === 0 && b === 0)) {
                return `rgba(${r}, ${g}, ${b}, 1)`;
            }
        }
    }

    try {
        // Catches liquids and anything else the map does not paint.
        const type = api.elements.getTypeAtCell(cx, cy);
        if (type != null) {
            // Deterministic hue per element type — the info payload has no colour.
            const hue = (type * 67) % 360;
            return `hsla(${hue}, 35%, 25%, .5)`;
        }
    } catch {
        /* ignore */
    }

    try {
        if (api.structures.hasBuiltAtCell?.(cx, cy)) {
            const jitter = 4 * Math.floor(Math.random() * 6);
            const base = fullCell ? 128 : 64;
            return `rgba(${base + jitter}, ${base + jitter}, ${base + jitter}, .25)`;
        }
    } catch {
        /* ignore */
    }

    try {
        if (api.terrains.isAtCell?.(cx, cy)) return "#49628c";
    } catch {
        /* ignore */
    }

    const jitter = 4 * Math.floor(Math.random() * 8);
    return `rgba(${jitter}, ${jitter}, ${jitter}, .25)`;
}
