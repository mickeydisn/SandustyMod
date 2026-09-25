/**
 * md-my-hown-mod — entry (word-statistic pattern).
 *
 * When enabled: register tool item + global overlay.
 * Panel is visible only while the tool is the active hotbar item.
 */
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "./packages/modkit.ts";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";
import { registerTool, unregisterTool } from "./tool.ts";
import "./hooks/index.ts"; // register handler keys for pickers

console.log(`${LOG} SCRIPT START v${VERSION}`);

let started = false;

async function startEnabled(): Promise<void> {
    await registerTool();
    // Apply stored JSON config after tool/overlay are up
    try {
        const { applyConfig } = await import("./register/apply.ts");
        applyConfig();
    } catch (e) {
        console.warn(`${LOG} applyConfig skipped`, e);
    }
}

function applyEnabled(enabled: boolean, reason: string): void {
    console.log(`${LOG} applyEnabled`, enabled, reason);
    if (!enabled) {
        started = false;
        unregisterTool();
        try {
            runDisableCleanup(MOD_ID, reason, STORAGE_KEYS);
        } catch (e) {
            console.warn(`${LOG} cleanup failed`, e);
        }
        console.log(`${LOG} disabled`);
        return;
    }
    if (started) return;
    started = true;
    void startEnabled().then(() => {
        console.log(`${LOG} enabled path done`);
    }).catch((e) => {
        console.error(`${LOG} startEnabled failed`, e);
    });
}

try {
    const cfg = readSettings(MOD_ID, SETTINGS);
    console.log(`${LOG} settings`, cfg);
    applyEnabled(cfg.enabled !== false, "boot");
    onSettingsChange(MOD_ID, SETTINGS, (next) => {
        applyEnabled(next.enabled !== false, "config-change");
    });
    console.log(`${LOG} LOADED v${VERSION}`);
} catch (e) {
    console.error(`${LOG} INIT FAILED`, e);
}
