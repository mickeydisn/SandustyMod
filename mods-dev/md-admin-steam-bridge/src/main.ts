/**
 * md-admin-steam-bridge — dev-only remote control for a running game.
 *
 * This mod publishes one thing: `globalThis.__sk`, a command surface the CDP
 * tools in `tools/` can call. It registers no content and has no gameplay
 * effect. See `SKILL.md` for how to drive it, and `bridge.ts` for why it has to
 * exist at all.
 *
 * Disabling the mod deletes the global, so a build you actually play has no
 * command surface at all.
 */
import "@sandmd/sandkit";
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "@sandmd/modkit";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";
import { type Bridge, createBridge } from "./bridge.ts";

/** The live bridge, so the disable path can take it back down. */
let bridge: Bridge | undefined;

function install(): void {
    if (bridge) return;
    bridge = createBridge();
    (globalThis as Record<string, unknown>).__sk = bridge;
    // Logged loudly on purpose: if this line is missing from the console, the
    // entry failed to compile — which the host reports as *nothing at all*.
    console.log(`${LOG} v${VERSION} bridge ready — globalThis.__sk.status()`);
}

function uninstall(): void {
    bridge?.uninstall();
    bridge = undefined;
}

/** Run the bridge, or remove every trace of it. */
function applyEnabled(enabled: boolean, reason: string): void {
    if (enabled) {
        install();
        safe(() => sandkit.api.ui.toast(`${MOD_ID} enabled`, {}));
        console.log(`${LOG} v${VERSION} enabled`);
        return;
    }
    uninstall();
    runDisableCleanup(MOD_ID, reason, STORAGE_KEYS);
    console.log(`${LOG} v${VERSION} disabled — __sk removed, storage wiped`);
}

try {
    applyEnabled(readSettings(MOD_ID, SETTINGS).enabled, "boot-disabled");
    onSettingsChange(MOD_ID, SETTINGS, (cfg) => applyEnabled(cfg.enabled, "config-change"));
    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
    runDisableCleanup(MOD_ID, "init-error", STORAGE_KEYS);
}
