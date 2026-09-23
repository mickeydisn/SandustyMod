/**
 * Orphan / inventory / storage cleanup — always available; full wipe when disabled.
 */
import { api, root, safe } from "./api.ts";
import { allCardStorageKeys } from "./cards.ts";
import { ITEM_ID, LOG, MOD_ID, OVERLAY_ID } from "./constants.ts";
import {
    STATS_HISTORY_KEY,
    STATS_REF_KEY,
} from "./history.ts";
import {
    UI_ALPHA_KEY,
    UI_AUTO_MIN_KEY,
    UI_LOCK_KEY,
    UI_MINI_KEY,
    UI_POS_KEY,
    UI_ZOOM_KEY,
} from "./uiStore.ts";

export function pruneStaleBuildings(modId: string = MOD_ID): string[] {
    const buildings = root.state?.store?.player?.buildings;
    if (!Array.isArray(buildings)) return [];
    const stale = buildings.filter(
        (entry: unknown) => typeof entry === "string" && entry.startsWith(modId),
    ) as string[];
    if (stale.length === 0) return [];
    for (const id of stale) {
        const index = buildings.indexOf(id);
        if (index >= 0) buildings.splice(index, 1);
        safe(() => api.player?.buildings?.removeById?.(id));
    }
    return stale;
}

export function findOrphanedObjects(modId: string = MOD_ID): Map<string, number> {
    const counts = new Map<string, number>();
    const structures = root.state?.store?.structures;
    if (!Array.isArray(structures)) return counts;
    for (const structure of structures) {
        const type = structure?.type;
        if (typeof type !== "string" || !type.startsWith(modId)) continue;
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
}

/**
 * Remove inventory entries whose id starts with this mod id (player.store inventory).
 */
export function pruneStaleItems(modId: string = MOD_ID): unknown[] {
    const inventory = root.state?.store?.player?.inventory;
    if (!Array.isArray(inventory)) return [];
    const keep = new Set<string>();
    const stale = inventory.filter(
        (entry: unknown) => {
            const id = (entry as { id?: string } | null)?.id;
            return typeof id === "string" && id.startsWith(modId) && !keep.has(id);
        },
    );
    if (stale.length === 0) return [];
    for (const item of stale) {
        const index = inventory.indexOf(item);
        if (index >= 0) inventory.splice(index, 1);
    }
    return stale;
}

export function removeToolItem(): void {
    const pruned = pruneStaleItems(MOD_ID);
    if (pruned.length > 0) {
        console.log(`${LOG} pruneStaleItems removed ${pruned.length}`, pruned);
    }
    safe(() => {
        if (typeof api.player?.inventory?.removeById === "function") {
            api.player.inventory.removeById(ITEM_ID);
            return;
        }
        if (typeof api.player?.inventory?.remove === "function") {
            api.player.inventory.remove(ITEM_ID);
        }
    });
    safe(() => api.items?.unregister?.(ITEM_ID));
    safe(() => api.ui?.overlays?.unregister?.("global", OVERLAY_ID));
}

/** All known mod storage keys. */
export function knownStorageKeys(): string[] {
    return [
        ...allCardStorageKeys(),
        STATS_REF_KEY,
        STATS_HISTORY_KEY,
        UI_POS_KEY,
        UI_MINI_KEY,
        UI_LOCK_KEY,
        UI_ZOOM_KEY,
        UI_ALPHA_KEY,
        UI_AUTO_MIN_KEY,
    ];
}

/**
 * Remove every known key this mod wrote into api.storage.
 * Best-effort: also tries storage.clear / delete if available.
 */
export function wipeModStorage(reason: string): void {
    const keys = knownStorageKeys();
    let removed = 0;
    for (const key of keys) {
        const had = safe(() => api.storage.get(MOD_ID, key));
        if (had !== undefined && had !== null) {
            safe(() => api.storage.set(MOD_ID, key, null));
            safe(() => (api.storage as { remove?: (m: string, k: string) => void }).remove?.(MOD_ID, key));
            safe(() => (api.storage as { delete?: (m: string, k: string) => void }).delete?.(MOD_ID, key));
            removed++;
        }
    }
    // Namespace clear if the host exposes it
    safe(() => (api.storage as { clear?: (m: string) => void }).clear?.(MOD_ID));
    console.log(`${LOG} wipeModStorage (${reason}): touched ${removed}/${keys.length} keys`);
}

export function runCleanup(reason: string): void {
    const orphans = findOrphanedObjects(MOD_ID);
    const pruned = pruneStaleBuildings(MOD_ID);
    if (orphans.size > 0 || pruned.length > 0) {
        console.log(
            `${LOG} cleanup (${reason}): orphans=${orphans.size} prunedBuildings=${pruned.length}`,
            orphans.size ? Object.fromEntries(orphans) : "",
            pruned,
        );
    }
}

/** Full disable path: tool, overlay, orphans, and all mod storage. */
export function runDisableCleanup(reason: string): void {
    runCleanup(reason);
    removeToolItem();
    wipeModStorage(reason);
}
