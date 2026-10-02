/**
 * Runtime mod settings from configSchema (api.settings) plus the persistent
 * tracking store.
 *
 * ⚠️ `api.settings` is **read-only**. The engine exposes `get`, `getAll` and
 * `onChange` — there is no `set`. This file used to call
 * `api.settings.set?.(key, value)` and `set(… "${MOD_ID}.${key}")`, which were
 * both silent no-ops, and then re-read the engine bag on every `getConfig()`.
 * Because nothing was ever written, "Max data points" and "Display points"
 * reverted the instant the panel redrew: the steppers looked frozen and the mod
 * had no `externalModSettings` entry at all.
 *
 * `timeRange`, `maxCountSave` and `historyMax` therefore persist through
 * `api.storage` via the shared tracking store (see `@sandmd/ui`'s `tracking.ts`),
 * seeded from the engine bag on the first read. `enabled` is engine-owned and
 * stays a read — it can only be toggled from the game's mod-settings screen.
 */
import { api, createTrackingStore, safe } from "@sandmd/ui";
import { LOG, MOD_ID } from "./constants.ts";

export interface ModConfig {
    enabled: boolean;
    /** Minutes between auto scans — one data point per scan. */
    timeRange: number;
    /** Max stored data points (FIFO). */
    maxCountSave: number;
    /** Points rendered on sparklines / charts. */
    historyMax: number;
}

/**
 * Persistent home for the three numbers the engine will not let us write.
 *
 * `autoRefreshMinutes` was the pre-`timeRange` name for the scan interval;
 * it is still honoured so an upgrade does not reset everyone's cadence.
 */
export const tracking = createTrackingStore(MOD_ID, "tracking", {
    timeRange: "autoRefreshMinutes",
});

/**
 * Adopt the cadence the player already chose under the old panel override.
 *
 * The "Every" row used to write two places: the mod setting (a no-op) and its own
 * `panelAutoMinutes` storage key, which `intervalMs()` actually read. Now that
 * `timeRange` persists properly there is one source of truth, so the old key is
 * folded in once — otherwise everyone who tuned the cadence would silently drop
 * back to the default on upgrade.
 *
 * Called from `main.ts` rather than at module load: `uiStore` imports `data`,
 * which imports this module, so importing it here would create a cycle.
 */
export function adoptLegacyAutoMinutes(legacyMinutes: number | null): void {
    if (legacyMinutes == null) return;
    tracking.writeIfAbsent("timeRange", legacyMinutes);
}

function readBool(name: string, fallback: boolean): boolean {
    const bag = safe(
        () => api.settings?.getAll?.() as Record<string, unknown> | undefined,
        undefined,
    );
    const v = bag && typeof bag === "object" ? bag[name] : undefined;
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1) return true;
    if (v === "false" || v === 0) return false;
    return fallback;
}

export function getConfig(): ModConfig {
    const t = tracking.read();
    return {
        enabled: readBool("enabled", true),
        timeRange: t.timeRange,
        maxCountSave: t.maxCountSave,
        historyMax: t.historyMax,
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
    return tracking.read().timeRange * 60 * 1000;
}

export function onConfigChange(cb: (cfg: ModConfig) => void): void {
    configListeners.push(cb);
    safe(() => {
        api.settings.onChange?.((values: Record<string, unknown>) => {
            void values;
            // Re-read both sources: the engine bag for `enabled`, and the
            // tracking store so an external edit is not masked by its cache.
            tracking.refresh();
            cb(getConfig());
        });
    });
    console.log(`${LOG} config`, getConfig());
}

/**
 * Write a setting.
 *
 * The three numbers go through the tracking store, which clamps and persists
 * them to `api.storage`. `enabled` is engine-owned and cannot be written from a
 * mod, so a call for it only refreshes the cache.
 */
export function setSetting<K extends keyof ModConfig>(key: K, value: ModConfig[K]): void {
    if (key === "timeRange" || key === "maxCountSave" || key === "historyMax") {
        tracking.write(key, Number(value));
    }
    const cfg = getConfig();
    for (const cb of configListeners) {
        try {
            cb(cfg);
        } catch (e) {
            console.warn(`${LOG} config listener error`, e);
        }
    }
}

/** Listeners notified by both `onConfigChange` and `setSetting`. */
const configListeners: Array<(cfg: ModConfig) => void> = [];
