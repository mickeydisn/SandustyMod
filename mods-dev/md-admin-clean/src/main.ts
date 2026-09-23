/**
 * md-admin-clean — clean mod template entry point.
 *
 * A mod is three things:
 *
 *   1. `modinfo.json` — the manifest, including the `configSchema` that gives
 *      the player an enable/disable toggle.
 *   2. `constants.ts` — mod id, version, owned storage keys, settings schema.
 *   3. this file — `main()`, the enabled path.
 *
 * When the mod is **disabled** it is fully uninstalled from the save: stale
 * buildings/items are pruned, orphaned placed objects are removed and the mod's
 * own storage is wiped (`runDisableCleanup` from `@sandmd/modkit`).
 *
 * Copy the folder, rename `MOD_ID` in `constants.ts` + `modinfo.json`, then
 * fill in `main()` / `teardown()`.
 */
import "@sandmd/sandkit";
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "@sandmd/modkit";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";

/** Guard so a config toggle cannot register the same content twice. */
let started = false;

/** The enabled path. Register items, structures, overlays and events here. */
function main(): void {
    if (started) return;
    started = true;

    // ── TODO: register this mod's content ───────────────────────────────────
    // sandkit.api.items.register({ id: `${MOD_ID}:tool`, … });
    // sandkit.api.structures.register({ … });
    // sandkit.api.ui.overlays.register("global", `${MOD_ID}:overlay`, …);
    // sandkit.api.events.on("game:ready", …);
    // ────────────────────────────────────────────────────────────────────────

    safe(() => sandkit.api.ui.toast(`${MOD_ID} enabled`, {}));
    console.log(`${LOG} v${VERSION} enabled`);
}

/** The disabled path. Undo everything `main()` registered. */
function teardown(): void {
    if (!started) return;
    started = false;

    // ── TODO: unregister items / overlays / event handlers ──────────────────
    // sandkit.api.items.unregister?.(`${MOD_ID}:tool`);
    // ────────────────────────────────────────────────────────────────────────
}

/** Run the mod, or wipe every trace of it. */
function applyEnabled(enabled: boolean, reason: string): void {
    if (enabled) {
        main();
        return;
    }
    teardown();
    runDisableCleanup(MOD_ID, reason, STORAGE_KEYS);
    console.log(`${LOG} v${VERSION} disabled — content removed, storage wiped`);
}

try {
    applyEnabled(readSettings(MOD_ID, SETTINGS).enabled, "boot-disabled");

    onSettingsChange(MOD_ID, SETTINGS, (cfg) => applyEnabled(cfg.enabled, "config-change"));

    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
    runDisableCleanup(MOD_ID, "init-error", STORAGE_KEYS);
}
