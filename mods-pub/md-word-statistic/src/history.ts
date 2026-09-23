/**
 * Stats history in mod storage.
 *
 * - `statsReference` — first successful scan; never overwritten by normal refreshes.
 * - `statsHistory` — up to HISTORY_LIMIT raw snapshots (FIFO: drop oldest when full).
 *
 * Only raw id→count maps for elements, terrains, structures are stored.
 */
import { api, safe } from "./api.ts";
import { MOD_ID } from "./constants.ts";
import type {
    ElementRow,
    RawStatsSnapshot,
    StructureRow,
    TerrainRow,
} from "./types.ts";

export const STATS_REF_KEY = "statsReference";
export const STATS_HISTORY_KEY = "statsHistory";

/** Max stored refreshes in the history array (reference is separate). */
export const HISTORY_LIMIT = 20;

/** Points shown on home card sparklines. */
/** Card sparklines use the same depth as list charts. */
export const CARD_GRAPH_POINTS = 20;

function isRawMap(v: unknown): v is Record<string, number> {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    for (const k of Object.keys(v as object)) {
        if (typeof (v as Record<string, unknown>)[k] !== "number") return false;
    }
    return true;
}

function isSnapshot(v: unknown): v is RawStatsSnapshot {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o.at === "number" &&
        isRawMap(o.elements) &&
        isRawMap(o.terrains) &&
        isRawMap(o.structures)
    );
}

export function rowsToMap(rows: { id: string; count: number }[]): Record<string, number> {
    const m: Record<string, number> = {};
    for (const r of rows) {
        if (r.count > 0) m[r.id] = r.count;
    }
    return m;
}

export function buildRawSnapshot(
    elements: ElementRow[],
    terrains: TerrainRow[],
    structures: StructureRow[],
    at = Date.now(),
): RawStatsSnapshot {
    return {
        at,
        elements: rowsToMap(elements),
        terrains: rowsToMap(terrains),
        structures: rowsToMap(structures),
    };
}

export function loadReference(): RawStatsSnapshot | null {
    const raw = safe(() => api.storage.get(MOD_ID, STATS_REF_KEY));
    return isSnapshot(raw) ? raw : null;
}

export function saveReference(snap: RawStatsSnapshot): void {
    safe(() => api.storage.set(MOD_ID, STATS_REF_KEY, snap));
}

export function loadHistory(): RawStatsSnapshot[] {
    const raw = safe(() => api.storage.get(MOD_ID, STATS_HISTORY_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter(isSnapshot);
}

export function saveHistory(list: RawStatsSnapshot[]): void {
    safe(() => api.storage.set(MOD_ID, STATS_HISTORY_KEY, list));
}

/**
 * Persist a new refresh:
 * - If no reference exists, store this snapshot as the permanent reference.
 * - Always append to history; if length > HISTORY_LIMIT, drop the oldest entries
 *   (never touches the reference).
 */
export function recordRefresh(snap: RawStatsSnapshot): {
    reference: RawStatsSnapshot;
    history: RawStatsSnapshot[];
    isFirst: boolean;
} {
    let reference = loadReference();
    const isFirst = !reference;
    if (!reference) {
        reference = snap;
        saveReference(reference);
    }

    let history = loadHistory();
    history = [...history, snap];
    while (history.length > HISTORY_LIMIT) {
        history.shift(); // pop oldest
    }
    saveHistory(history);

    return { reference, history, isFirst };
}

/** Count for an id in a raw map (exact + case-insensitive). */
export function mapGet(map: Record<string, number> | undefined, id: string): number {
    if (!map) return 0;
    if (typeof map[id] === "number") return map[id];
    const lower = id.toLowerCase();
    for (const k of Object.keys(map)) {
        if (k.toLowerCase() === lower) return map[k];
    }
    return 0;
}

/** Series of counts over history (and optionally reference as first point). */
export function seriesForId(
    history: RawStatsSnapshot[],
    kind: "elements" | "terrains" | "structures",
    id: string,
    maxPoints?: number,
): number[] {
    let pts = history.map((h) => mapGet(h[kind], id));
    if (typeof maxPoints === "number" && pts.length > maxPoints) {
        pts = pts.slice(pts.length - maxPoints);
    }
    return pts;
}

export function diffFromReference(
    reference: RawStatsSnapshot | null,
    current: number,
    kind: "elements" | "terrains" | "structures",
    id: string,
): number | null {
    if (!reference) return null;
    return current - mapGet(reference[kind], id);
}


/**
 * Dig progress vs reference for terrain (digging game).
 * refCount → baseline; current decreases as player digs.
 * Returns % of reference already removed, or null if no usable ref.
 */
export function digPercent(refCount: number | null | undefined, current: number): number | null {
    if (refCount == null || !Number.isFinite(refCount) || refCount <= 0) return null;
    const removed = refCount - current;
    return (100 * removed) / refCount;
}

export function formatDigPct(pct: number | null): string {
    if (pct === null) return "—";
    if (pct >= 0) return `${pct.toFixed(1)}% dug`;
    // more terrain than reference (placed/restored)
    return `${pct.toFixed(1)}%`;
}
