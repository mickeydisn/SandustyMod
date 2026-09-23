/**
 * md-admin-clean — static configuration.
 *
 * Everything compile-time lives here: the mod id, version, log prefix, the
 * `api.storage` keys the mod owns and the settings schema that mirrors
 * `configSchema` in `modinfo.json`. Nothing here touches the game at runtime.
 *
 * Copy this file into a new mod and change `MOD_ID` / `VERSION` / `SETTINGS`.
 */
import type { SettingsSchema } from "@sandmd/modkit";

/** Mod id — doubles as the `api.storage` namespace and the id prefix we prune. */
export const MOD_ID = "md-admin-clean";

/** Shown in logs. Keep in sync with `modinfo.json`. */
export const VERSION = "0.1.0";

/** Log prefix so every line is attributable to this mod. */
export const LOG = `[${MOD_ID}]`;

/**
 * Every `api.storage` key this mod writes.
 *
 * Add a key here for each `api.storage.set(MOD_ID, key, …)` call so a disable
 * can remove it again. `wipeModStorage` also enumerates the host's per-mod bag,
 * so this list is mainly a safety net for keys written lazily / conditionally.
 */
export const STORAGE_KEYS: readonly string[] = [];

/**
 * Mirror of the `configSchema` declared in `modinfo.json` — keep the two in
 * sync. `readSettings` / `onSettingsChange` type their results from this, and
 * the defaults here are what the mod falls back to on a first run.
 */
export const SETTINGS = {
    enabled: { type: "boolean", default: true },
} as const satisfies SettingsSchema;
