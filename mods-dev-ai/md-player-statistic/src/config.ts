/**
 * Settings reader — mirrors configSchema / SETTINGS without @sandmd/modkit.
 */
import { api, safe } from "./api.ts";
import { LOG, MOD_ID, SETTINGS } from "./constants.ts";

export type ModConfig = {
    enabled: boolean;
    persistSession: boolean;
    historyMax: number;
};

function clampNumber(v: unknown, def: number, min?: number, max?: number): number {
    let n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : def;
    if (!Number.isFinite(n)) n = def;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
}

export function readConfig(): ModConfig {
    const raw = safe(() => api.settings?.get?.(MOD_ID), null) as Record<string, unknown> | null;
    const enabledRaw = raw?.enabled ?? safe(() => api.settings?.get?.(`${MOD_ID}.enabled`), true);
    return {
        enabled: enabledRaw !== false && enabledRaw !== "false" && enabledRaw !== 0,
        persistSession: (raw?.persistSession ?? SETTINGS.persistSession.default) !== false,
        historyMax: clampNumber(
            raw?.historyMax,
            SETTINGS.historyMax.default as number,
            SETTINGS.historyMax.min,
            SETTINGS.historyMax.max,
        ),
    };
}

let lastCfg: ModConfig = readConfig();
const listeners: Array<(cfg: ModConfig) => void> = [];

export function getConfig(): ModConfig {
    return lastCfg;
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
        api.settings?.onChange?.((values: Record<string, unknown>) => {
            // Host may pass global bag or per-mod bag — tolerate both.
            const bag = (values?.[MOD_ID] ?? values) as Record<string, unknown> | undefined;
            const next: ModConfig = {
                enabled: (bag?.enabled ?? lastCfg.enabled) !== false,
                persistSession: (bag?.persistSession ?? lastCfg.persistSession) !== false,
                historyMax: clampNumber(
                    bag?.historyMax,
                    lastCfg.historyMax,
                    SETTINGS.historyMax.min,
                    SETTINGS.historyMax.max,
                ),
            };
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
