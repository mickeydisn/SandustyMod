/**
 * Settings reader — mirrors configSchema / SETTINGS without @sandmd/modkit.
 *
 * ⚠️ `api.settings` is **read-only**: the engine exposes `get`, `getAll` and
 * `onChange`, and nothing else. There is no `set`, so `api.settings.set?.(...)`
 * is a silent no-op and a mod can never write its own `configSchema` values.
 *
 * `get()` takes a **configSchema field name** ("enabled"), NOT a mod id and NOT
 * "modId.field" — an unknown key returns `undefined`. `getAll()` returns this
 * mod's whole bag (`{enabled, persistSession, historyMax, …}`) and is the only
 * reliable read.
 *
 * That split is why the three numeric tracking settings (`timeRange`,
 * `maxCountSave`, `historyMax`) are **not** read from here. They live in
 * `api.storage` via the shared tracking store, which actually persists; the
 * engine bag only seeds them on the first read. See `@sandmd/ui`'s `tracking.ts`
 * for the full story — briefly: these three used to be "written" through the
 * no-op `api.settings.set`, so `setSetting` updated an in-memory cache, the panel
 * looked correct for the session, and the value silently reverted on reload.
 */
import { api, createTrackingStore, safe } from "@sandmd/ui";
import { LOG, MOD_ID, SETTINGS } from "./constants.ts";

export type ModConfig = {
    enabled: boolean;
    persistSession: boolean;
    historyMax: number;
    /** Rolling history window in minutes; 0 = keep everything. */
    timeRange: number;
    /** Max distinct sub-keys persisted per category. */
    maxCountSave: number;
};

/** Persistent home for the three numbers the engine will not let us write. */
export const tracking = createTrackingStore(MOD_ID);

function readBool(raw: Record<string, unknown> | null, key: string, def: boolean): boolean {
    const v = raw?.[key];
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1) return true;
    if (v === "false" || v === 0) return false;
    return def;
}

let lastCfg: ModConfig = readConfig();

export function getConfig(): ModConfig {
    return lastCfg;
}

function readConfig(): ModConfig {
    const bag = safe(
        () => api.settings?.getAll?.() as Record<string, unknown> | undefined,
        undefined,
    );
    const raw = bag && typeof bag === "object" ? bag : null;
    const t = tracking.read();
    return {
        enabled: readBool(raw, "enabled", SETTINGS.enabled.default),
        persistSession: readBool(raw, "persistSession", SETTINGS.persistSession.default),
        historyMax: t.historyMax,
        timeRange: t.timeRange,
        maxCountSave: t.maxCountSave,
    };
}

function notify(): void {
    for (const cb of listeners) {
        try {
            cb(lastCfg);
        } catch (e) {
            console.warn(`${LOG} config listener error`, e);
        }
    }
}

/**
 * Write a setting.
 *
 * The three numbers go through the tracking store, which clamps and persists
 * them to `api.storage`. The booleans are engine-owned: there is no `set`, so
 * they can only be changed from the game's own mod-settings screen — this
 * refreshes the cached bag so the panel reflects such a change immediately.
 */
export function setSetting<K extends keyof ModConfig>(key: K, value: ModConfig[K]): void {
    if (key === "historyMax" || key === "timeRange" || key === "maxCountSave") {
        tracking.write(key, Number(value));
    }
    lastCfg = readConfig();
    notify();
}

export function onConfigChange(cb: (cfg: ModConfig) => void): () => void {
    listeners.push(cb);
    return () => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
    };
}

/** Wire settings.onChange once. */
export function bindSettings(): void {
    safe(() => {
        // The host passes THIS mod's bag directly (not a global map keyed by
        // mod id), so `values` is already `{enabled, persistSession, …}`.
        api.settings?.onChange?.(() => {
            // Re-read both sources: the engine bag for the booleans, and the
            // tracking store so an external edit is not masked by its cache.
            tracking.refresh();
            lastCfg = readConfig();
            notify();
        });
    });
    lastCfg = readConfig();
}

/** Listeners notified by both `onConfigChange` and `setSetting`. */
const listeners: Array<(cfg: ModConfig) => void> = [];
