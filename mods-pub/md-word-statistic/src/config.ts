/**
 * Runtime mod settings from configSchema (api.settings).
 */
import { api, safe } from "./api.ts";
import { LOG, MOD_ID } from "./constants.ts";
import { loadPanelAutoMinutes } from "./uiStore.ts";

export interface ModConfig {
    enabled: boolean;
    autoRefresh: boolean;
    /** Minutes between auto scans (1–20). */
    autoRefreshMinutes: number;
}

const DEFAULTS: ModConfig = {
    enabled: true,
    autoRefresh: false,
    autoRefreshMinutes: 10,
};

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
        enabled: readBool("enabled", DEFAULTS.enabled),
        autoRefresh: readBool("autoRefresh", DEFAULTS.autoRefresh),
        autoRefreshMinutes: readNumber(
            "autoRefreshMinutes",
            DEFAULTS.autoRefreshMinutes,
            1,
            20,
        ),
    };
}

/** In-panel override for autoRefresh (mirrors setting when possible). */
let panelAutoOverride: boolean | null = null;

export function getAutoRefreshEnabled(): boolean {
    if (panelAutoOverride !== null) return panelAutoOverride;
    return getConfig().autoRefresh;
}

export function setPanelAutoRefresh(on: boolean): void {
    panelAutoOverride = on;
    // Best-effort write back so next load matches
    safe(() => api.settings.set?.("autoRefresh", on));
    safe(() => api.settings.set?.(`${MOD_ID}.autoRefresh`, on));
}

export function clearPanelAutoOverride(): void {
    panelAutoOverride = null;
}

export function intervalMs(): number {
    const panelMin = loadPanelAutoMinutes();
    const mins = panelMin ?? getConfig().autoRefreshMinutes;
    return mins * 60 * 1000;
}

export function onConfigChange(cb: (cfg: ModConfig) => void): void {
    safe(() => {
        api.settings.onChange?.((values: Record<string, unknown>) => {
            if (
                values &&
                ("enabled" in values ||
                    "autoRefresh" in values ||
                    "autoRefreshMinutes" in values ||
                    `${MOD_ID}.enabled` in values ||
                    `${MOD_ID}.autoRefresh` in values ||
                    `${MOD_ID}.autoRefreshMinutes` in values)
            ) {
                panelAutoOverride = null; // settings win
                cb(getConfig());
            } else {
                cb(getConfig());
            }
        });
    });
    console.log(`${LOG} config`, getConfig());
}
