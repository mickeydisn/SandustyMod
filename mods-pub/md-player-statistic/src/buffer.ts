/**
 * Live KPI buffer — accumulates counts from player events.
 * Totals are lifetime; session is resettable; history is a rolling window.
 */
import { api, safe, toIntervals } from "@sandmd/ui";
import { KPI_CATEGORIES, LOG, MOD_ID, SETTINGS } from "./constants.ts";
import type { HomeCardConfig, KpiBuffer, KpiMap, KpiSnapshot } from "./types.ts";

const TOTALS_KEY = "kpi_totals";
const SESSION_KEY = "kpi_session";
const HISTORY_KEY = "kpi_history";
const CARDS_KEY = "cards";

function emptyMap(): KpiMap {
    return {};
}

function loadMap(key: string): KpiMap {
    const raw = safe(() => api.storage.get(MOD_ID, key), null);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return { ...(raw as KpiMap) };
    }
    return emptyMap();
}

function saveMap(key: string, map: KpiMap): void {
    safe(() => api.storage.set(MOD_ID, key, map));
}

function loadHistory(): KpiSnapshot[] {
    const raw = safe(() => api.storage.get(MOD_ID, HISTORY_KEY), null);
    if (Array.isArray(raw)) return raw as KpiSnapshot[];
    return [];
}

function saveHistory(hist: KpiSnapshot[]): void {
    safe(() => api.storage.set(MOD_ID, HISTORY_KEY, hist));
}

/** Global mutable buffer — single source of truth while the mod is running. */
export const buffer: KpiBuffer = {
    totals: emptyMap(),
    session: emptyMap(),
    sessionStartedAt: Date.now(),
    history: [],
};

let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 2000;

/** Build composite key "category" or "category::subKey". */
export function kpiKey(category: string, subKey?: string | null): string {
    if (subKey == null || subKey === "") return category;
    return `${category}::${subKey}`;
}

/** Increment a KPI by `amount` (default 1). */
export function bumpKpi(category: string, subKey?: string | null, amount = 1): void {
    if (amount === 0) return;
    const k = kpiKey(category, subKey);
    buffer.totals[k] = (buffer.totals[k] ?? 0) + amount;
    buffer.session[k] = (buffer.session[k] ?? 0) + amount;
    // Also keep category-level total when a sub-key is used
    if (subKey != null && subKey !== "") {
        buffer.totals[category] = (buffer.totals[category] ?? 0) + amount;
        buffer.session[category] = (buffer.session[category] ?? 0) + amount;
    }
    dirty = true;
    scheduleFlush();
}

function scheduleFlush(): void {
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
    }, FLUSH_MS);
}

/** Persist dirty maps immediately (also called on teardown). */
export function flush(): void {
    if (!dirty) return;
    dirty = false;
    saveMap(TOTALS_KEY, buffer.totals);
    saveMap(SESSION_KEY, buffer.session);
}

/**
 * Take one history snapshot of current totals.
 *
 * `maxDataPoints` bounds what is kept: once the history is full the oldest
 * point is dropped (FIFO), so storage stays bounded however long the game
 * runs. Every point holds the totals for *all* KPIs, so this one cap bounds
 * the whole time series.
 */
export function pushHistory(maxDataPoints = SETTINGS.maxCountSave.default as number): void {
    const snap: KpiSnapshot = {
        at: Date.now(),
        totals: { ...buffer.totals },
        // Session counters too, so a category with no sub-keys (distance,
        // collisions) can still be graphed per session rather than lifetime.
        session: { ...buffer.session },
    };
    buffer.history.push(snap);
    const cap = Math.max(1, Math.floor(maxDataPoints));
    while (buffer.history.length > cap) buffer.history.shift();
    saveHistory(buffer.history);
}

/** Load buffer from storage on boot. */
export function bootBuffer(persistSession: boolean): void {
    buffer.totals = loadMap(TOTALS_KEY);
    if (persistSession) {
        buffer.session = loadMap(SESSION_KEY);
    } else {
        buffer.session = emptyMap();
        buffer.sessionStartedAt = Date.now();
        saveMap(SESSION_KEY, buffer.session);
    }
    buffer.history = loadHistory();
    dirty = false;
    console.log(
        `${LOG} buffer loaded — totals keys=${Object.keys(buffer.totals).length}, ` +
            `session keys=${Object.keys(buffer.session).length}, history=${buffer.history.length}`,
    );
}

/** Reset session counters only. */
export function resetSession(): void {
    buffer.session = emptyMap();
    buffer.sessionStartedAt = Date.now();
    saveMap(SESSION_KEY, buffer.session);
    console.log(`${LOG} session KPIs reset`);
}

/** Reset everything (totals + session + history). */
export function resetAll(): void {
    buffer.totals = emptyMap();
    buffer.session = emptyMap();
    buffer.sessionStartedAt = Date.now();
    buffer.history = [];
    dirty = false;
    saveMap(TOTALS_KEY, buffer.totals);
    saveMap(SESSION_KEY, buffer.session);
    saveHistory(buffer.history);
    console.log(`${LOG} all KPIs wiped`);
}

/** Read a single counter (totals or session). */
export function getCount(
    category: string,
    subKey?: string | null,
    source: "totals" | "session" = "totals",
): number {
    const map = source === "session" ? buffer.session : buffer.totals;
    return map[kpiKey(category, subKey)] ?? 0;
}

/** List all sub-keys under a category from totals. */
export function listSubKeys(category: string): { key: string; count: number }[] {
    const prefix = `${category}::`;
    const out: { key: string; count: number }[] = [];
    for (const [k, v] of Object.entries(buffer.totals)) {
        if (k.startsWith(prefix) && v > 0) {
            out.push({ key: k.slice(prefix.length), count: v });
        }
    }
    out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return out;
}

/**
 * Default Home cards when none are configured.
 *
 * `world_items_picked` and `resources_collected` used to share a "Loot" card here.
 * They are still tracked and still have their own default card editor entries —
 * no tab shows them — so a card is the only place they can be seen.
 */
export function defaultCards(): HomeCardConfig[] {
    return [
        {
            id: "card-structures",
            title: "Structures",
            items: [
                { category: "structures_placed", key: "" },
                { category: "structures_removed", key: "" },
                { category: "structures_moved", key: "" },
            ],
        },
        {
            id: "card-dig",
            title: "Digging",
            items: [{ category: "terrain_destroyed", key: "" }],
        },
        {
            id: "card-items",
            title: "Items",
            items: [{ category: "items_used", key: "" }],
        },
        {
            id: "card-activity",
            title: "Activity",
            items: [
                { category: "distance_walked", key: "" },
                { category: "collisions", key: "" },
                { category: "keys_pressed", key: "" },
            ],
        },
    ];
}

/**
 * Saved cards outlive the categories they name.
 *
 * A card is only meaningful while every KPI it lists still exists. The grabber
 * tab and its five categories are gone, but a player who had the default card
 * set has `card-graber` sitting in storage — and `resolveCards` degrades
 * gracefully on an unknown category, so it would render as a permanently-zero
 * grey box labelled `graber_uses` rather than fail loudly. That is worse than
 * the card simply being gone, so it is dropped on read.
 */
function withoutDeadCategories(cards: HomeCardConfig[]): HomeCardConfig[] {
    const known = new Set(KPI_CATEGORIES.map((c) => c.id));
    const out: HomeCardConfig[] = [];
    for (const card of cards) {
        if (!card || !Array.isArray(card.items)) continue;
        const items = card.items.filter((it) => it && known.has(it.category as never));
        // A card left with nothing is an empty box; drop it too.
        if (items.length === 0) continue;
        out.push({ ...card, items });
    }
    return out;
}

export function loadCards(): HomeCardConfig[] {
    const raw = safe(() => api.storage.get(MOD_ID, CARDS_KEY), null);
    if (Array.isArray(raw) && raw.length > 0) {
        const live = withoutDeadCategories(raw as HomeCardConfig[]);
        // Only fall back to the defaults if the user was left with nothing at all —
        // an empty screen is worse than a fresh default layout.
        if (live.length > 0) return live;
    }
    return defaultCards();
}

export function saveCards(cards: HomeCardConfig[]): void {
    safe(() => api.storage.set(MOD_ID, CARDS_KEY, cards));
}

/** Resolve cards against current buffer for the panel. */
export function resolveCards(
    cards: HomeCardConfig[],
    displayPoints = SETTINGS.historyMax.default as number,
): import("./types.ts").CardStat[] {
    const catMeta = new Map(KPI_CATEGORIES.map((c) => [c.id, c]));
    return cards.map((cfg) => {
        const items = cfg.items.map((ref, i) => {
            const meta = catMeta.get(ref.category as any);
            const label = ref.key
                ? `${meta?.label ?? ref.category}: ${ref.key}`
                : (meta?.label ?? ref.category);
            const color = meta?.color ?? "#94a3b8";
            const count = getCount(ref.category, ref.key || null, "totals");
            const sessionCount = getCount(ref.category, ref.key || null, "session");
            // Lifetime accumulators — plot the per-interval change, not the
            // running total, or every sparkline is just a rising ramp.
            const series = toIntervals(
                buffer.history
                    .slice(-(displayPoints + 1))
                    .map((s) => s.totals[kpiKey(ref.category, ref.key || null)] ?? 0),
            );
            return {
                category: ref.category,
                key: ref.key,
                label,
                color,
                count,
                primary: i === 0,
                delta: sessionCount,
                series,
            };
        });
        const total = items.reduce((s, it) => s + it.count, 0);
        const delta = items.reduce((s, it) => s + (it.delta ?? 0), 0);
        return {
            id: cfg.id,
            title: cfg.title,
            color: items[0]?.color ?? "#94a3b8",
            total,
            delta,
            items,
        };
    });
}
