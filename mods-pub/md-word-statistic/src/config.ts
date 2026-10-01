/**
 * Runtime mod settings from configSchema (api.settings).
 */
import { api, safe } from "@sandmd/ui";
import { LOG, MOD_ID, SETTINGS } from "./constants.ts";
import { loadPanelAutoMinutes } from "./uiStore.ts";

export interface ModConfig {
    enabled: boolean;
    /** Minutes between auto scans — one data point per scan. */
    timeRange: number;
    /** Max stored data points (FIFO). */
    maxCountSave: number;
    /** Points rendered on sparklines / charts. */
    historyMax: number;
}

function readBool(name: string, fallback: boolean): boolean {
    const v = safe(() => api.settings.get(name));
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1) return true;
    if (v === "false" || v === 0) return false;
    // Namespaced fallbacks some builds use
    const v2 = safe(() => api.settings.get(`${MOD_ID}.${name}`));
    if (typeof v2 === "boolean") return v2;
    return fallback;
}

function readNumber(name: string, fallback: number, min: number, max: number): number {
    let v = safe(() => api.settings.get(name));
    if (typeof v !== "number" || !Number.isFinite(v)) {
        v = safe(() => api.settings.get(`${MOD_ID}.${name}`));
    }
    if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, Math.round(v)));
}

export function getConfig(): ModConfig {
    return {
        enabled: readBool("enabled", true),
        timeRange: readNumber(
            "timeRange",
            // Pre-`timeRange` installs stored the scan interval under this
            // name; honour it so an upgrade does not reset everyone's cadence.
            readNumber("autoRefreshMinutes", SETTINGS.timeRange.default, 1, SETTINGS.timeRange.max),
            SETTINGS.timeRange.min,
            SETTINGS.timeRange.max,
        ),
        maxCountSave: readNumber(
            "maxCountSave",
            SETTINGS.maxCountSave.default,
            SETTINGS.maxCountSave.min,
            SETTINGS.maxCountSave.max,
        ),
        historyMax: readNumber(
            "historyMax",
            SETTINGS.historyMax.default,
            SETTINGS.historyMax.min,
            SETTINGS.historyMax.max,
        ),
    };
}

/**
 * Auto refresh has no switch: it always runs.
 *
 * `autoRefresh` used to be a boolean setting that defaulted to *off*, so a fresh
 * install never scanned on a timer until the player found the toggle. The value
 * is still read from storage by older saves, but nothing consults it — a stored
 * `false` must not keep the interval stopped.
 */
export function autoRefreshAlwaysOn(): true {
    return true;
}

export function intervalMs(): number {
    const panelMin = loadPanelAutoMinutes();
    const mins = panelMin ?? getConfig().timeRange;
    return mins * 60 * 1000;
}

export function onConfigChange(cb: (cfg: ModConfig) => void): void {
    configListeners.push(cb);
    safe(() => {
        api.settings.onChange?.((values: Record<string, unknown>) => {
            void values;
            cb(getConfig());
        });
    });
    console.log(`${LOG} config`, getConfig());
}

/**
 * Write a setting back to the mod's bag.
 *
 * The local cache is not stored here (this mod re-reads on demand), but the
 * host's `onChange` does not reliably fire for a mod-initiated write, so we
 * notify listeners directly — otherwise the panel keeps showing the old value
 * until the next reload.
 */
export function setSetting<K extends keyof ModConfig>(key: K, value: ModConfig[K]): void {
    safe(() => api.settings?.set?.(key as string, value));
    safe(() => api.settings?.set?.(`${MOD_ID}.${key as string}`, value));
    configListeners.forEach((cb) => {
        try {
            cb(getConfig());
        } catch (e) {
            console.warn(`${LOG} config listener error`, e);
        }
    });
}

/** Listeners notified by both `onConfigChange` and `setSetting`. */
const configListeners: Array<(cfg: ModConfig) => void> = [];
