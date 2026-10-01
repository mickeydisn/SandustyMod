/**
 * Prune tool item / wipe mod storage on disable.
 */
import { api, safe } from "@sandmd/ui";
import { flush } from "./buffer.ts";
import { LOG, MOD_ID, STORAGE_KEYS } from "./constants.ts";
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
        const bag = api.storage?.getAll?.(MOD_ID);
        if (bag && typeof bag === "object") {
            for (const k of Object.keys(bag)) {
                api.storage.remove(MOD_ID, k);
            }
        }
    });

    // ⚠️ The runtime `player.inventory` facade exposes only `hasById` /
    // `addById` / `addFromId` — there is no `removeById`, so the hotbar entry
    // cannot be pruned from a mod. The item definition likewise has no
    // `items.unregister`. Both survive a disable; only the overlay is removed.

    console.log(`${LOG} disable cleanup complete (${reason})`);
}
