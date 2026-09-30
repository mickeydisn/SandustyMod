/**
 * Prune tool item / wipe mod storage on disable.
 */
import { api, safe } from "./api.ts";
import { flush } from "./buffer.ts";
import { ITEM_ID, LOG, MOD_ID, STORAGE_KEYS } from "./constants.ts";
import { unbindEvents } from "./events.ts";
import { unregisterTool } from "./tool.ts";

export function runCleanup(reason: string): void {
    flush();
    console.log(`${LOG} cleanup (${reason})`);
}

export function runDisableCleanup(reason: string): void {
    unbindEvents();
    unregisterTool();
    flush();

    // Wipe known storage keys
    for (const key of STORAGE_KEYS) {
        safe(() => api.storage.remove(MOD_ID, key));
    }
    // Also try host per-mod bag wipe if available
    safe(() => {
        const bag = api.storage?.get?.(MOD_ID);
        if (bag && typeof bag === "object") {
            for (const k of Object.keys(bag)) {
                api.storage.remove(MOD_ID, k);
            }
        }
    });

    // Prefix scan player inventory for our item
    safe(() => {
        const inv = api.player?.inventory;
        if (typeof inv?.removeById === "function") inv.removeById(ITEM_ID);
    });

    console.log(`${LOG} disable cleanup complete (${reason})`);
}
