/**
 * Settings reader — mirrors configSchema / SETTINGS without @sandmd/modkit.
 *
 * ⚠️ `api.settings` is already scoped to the calling mod. `get()` takes a
 * **configSchema field name** ("enabled"), NOT a mod id and NOT "modId.field" —
 * an unknown key returns `undefined`. `getAll()` returns this mod's whole bag
 * (`{enabled, persistSession, historyMax}`) and is the only reliable read.
 */
import { api, safe } from "@sandmd/ui";
import { LOG, SETTINGS } from "./constants.ts";

export type ModConfig = {
    enabled: boolean;
    persistSession: boolean;
    historyMax: number;
    /** Rolling history window in minutes; 0 = keep everything. */
    timeRange: number;
    /** Max distinct sub-keys persisted per category. */
    maxCountSave: number;
};

function clampNumber(v: unknown, def: number, min?: number, max?: number): number {
    let n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : def;
    if (!Number.isFinite(n)) n = def;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
}

/** The mod's own settings bag, normalised. Never throws. */
function normalise(raw: Record<string, unknown> | null, prev?: ModConfig): ModConfig {
    const enabledRaw = raw?.enabled ?? prev?.enabled ?? SETTINGS.enabled.default;
    return {
        enabled: enabledRaw !== false && enabledRaw !== "false" && enabledRaw !== 0,
        persistSession: (raw?.persistSession ?? prev?.persistSession ??
            SETTINGS.persistSession.default) !== false,
        historyMax: clampNumber(
            raw?.historyMax,
            prev?.historyMax ?? (SETTINGS.historyMax.default as number),
            SETTINGS.historyMax.min,
            SETTINGS.historyMax.max,
        ),
        timeRange: Math.round(
            clampNumber(
                raw?.timeRange,
                prev?.timeRange ?? (SETTINGS.timeRange.default as number),
                SETTINGS.timeRange.min,
                SETTINGS.timeRange.max,
            ),
        ),
        maxCountSave: Math.round(
            clampNumber(
                raw?.maxCountSave,
                prev?.maxCountSave ?? (SETTINGS.maxCountSave.default as number),
                SETTINGS.maxCountSave.min,
                SETTINGS.maxCountSave.max,
            ),
        ),
    };
}

export function readConfig(): ModConfig {
    const bag = safe(
        () => api.settings?.getAll?.() as Record<string, unknown> | undefined,
        undefined,
    );
    return normalise(bag && typeof bag === "object" ? bag : null);
}

let lastCfg: ModConfig = readConfig();
const listeners: Array<(cfg: ModConfig) => void> = [];

export function getConfig(): ModConfig {
    return lastCfg;
}

/**
 * Write a setting back to the mod's bag.
 *
 * `api.settings` is mod-scoped, so the key is the bare configSchema field
 * name. The local cache is updated too, because the host's `onChange` does
 * not reliably fire for a mod-initiated write — otherwise the panel would keep
 * showing the old value until the next reload.
 */
export function setSetting<K extends keyof ModConfig>(key: K, value: ModConfig[K]): void {
    lastCfg = normalise({ [key]: value }, lastCfg);
    safe(() => api.settings?.set?.(key as string, value));
    for (const cb of listeners) {
        try {
            cb(lastCfg);
        } catch (e) {
            console.warn(`${LOG} config listener error`, e);
        }
    }
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
        api.settings?.onChange?.((values: Record<string, unknown>) => {
            const bag = values && typeof values === "object" ? values : null;
            const next = normalise(bag, lastCfg);
            lastCfg = next;
            for (const cb of listeners) {
                try {
                    cb(next);
                } catch (e) {
                    console.warn(`${LOG} config listener error`, e);
                }
            }
        });
    });
    lastCfg = readConfig();
}
