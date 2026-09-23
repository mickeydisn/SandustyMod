/**
 * Prune / orphan / storage cleanup for a mod id.
 *
 * Everything a mod creates is expected to be prefixed with its id, so a prefix
 * scan over the live save finds every leftover:
 *
 *  - `player.buildings`  → unlock / build-menu entries (`pruneStaleBuildings`)
 *  - `player.inventory`  → hotbar items                 (`pruneStaleItems`)
 *  - `store.structures`  → placed objects               (`removeOrphanedObjects`)
 *  - `api.storage`       → persisted mod keys           (`wipeModStorage`)
 *
 * `runCleanup` is the light pass (buildings + items); `runDisableCleanup` is the
 * full "mod switched off" path: no unlock, no placed object, no stored key.
 */
import "@sandmd/sandkit";
import { safe } from "./safe.ts";

function log(modId: string): string {
    return `[${modId}]`;
}

/** Remove player buildings whose id starts with `modId`. */
export function pruneStaleBuildings(modId: string): string[] {
    const buildings = sandkit.state?.store?.player?.buildings;
    if (!Array.isArray(buildings)) return [];
    const stale = buildings.filter(
        (entry: unknown) => typeof entry === "string" && entry.startsWith(modId),
    ) as string[];
    if (stale.length === 0) return [];
    for (const id of stale) {
        const index = buildings.indexOf(id);
        if (index >= 0) buildings.splice(index, 1);
    }
    return stale;
}

/** Remove player inventory entries whose id starts with `modId`. */
export function pruneStaleItems(modId: string): unknown[] {
    const inventory = sandkit.state?.store?.player?.inventory;
    if (!Array.isArray(inventory)) return [];
    const stale = inventory.filter((entry: unknown) => {
        const id = (entry as { id?: string } | null)?.id;
        return typeof id === "string" && id.startsWith(modId);
    });
    if (stale.length === 0) return [];
    for (const item of stale) {
        const index = inventory.indexOf(item);
        if (index >= 0) inventory.splice(index, 1);
    }
    return stale;
}

/** Count placed structures whose type starts with `modId`, grouped by type. */
export function findOrphanedObjects(modId: string): Map<string, number> {
    const counts = new Map<string, number>();
    const structures = sandkit.state?.store?.structures;
    if (!Array.isArray(structures)) return counts;
    for (const structure of structures) {
        const type = structure?.type;
        if (typeof type !== "string" || !type.startsWith(modId)) continue;
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
}

/**
 * Delete every placed structure whose type starts with `modId`.
 *
 * Prefers the host's bulk "when idle" removal (the safe way to mutate the grid)
 * and falls back to a per-cell `removeAtCell` on builds that lack it. Returns
 * the number of positions handed to the engine.
 */
export function removeOrphanedObjects(modId: string): number {
    const structures = sandkit.state?.store?.structures;
    if (!Array.isArray(structures)) return 0;

    const positions: Array<{ x: number; y: number }> = [];
    for (const structure of structures) {
        const type = structure?.type;
        if (typeof type !== "string" || !type.startsWith(modId)) continue;
        if (typeof structure.x === "number" && typeof structure.y === "number") {
            positions.push({ x: structure.x, y: structure.y });
        }
    }
    if (positions.length === 0) return 0;

    const bulk = safe(() => {
        sandkit.api.structures.removeAtCellsWhenIdle?.(positions, { removeCells: false });
        return true;
    }, false);
    if (!bulk) {
        for (const p of positions) {
            safe(() => sandkit.api.structures.removeAtCell?.(p.x, p.y, { removeCells: false }));
        }
    }
    return positions.length;
}

/**
 * Drop every key this mod wrote into `api.storage`.
 *
 * Starts from the declared `keys`, then merges the host's per-mod bag (read via
 * `storage.ensure`) so lazily-written keys are removed too. Falls back to
 * `set(key, null)` when the host build has no `remove`.
 */
export function wipeModStorage(modId: string, keys: readonly string[] = []): void {
    const all = new Set<string>(keys);
    const bag = safe(() => sandkit.api.storage.ensure(modId));
    if (bag && typeof bag === "object") {
        for (const key of Object.keys(bag)) all.add(key);
    }

    let removed = 0;
    for (const key of all) {
        const had = safe(() => sandkit.api.storage.get(modId, key));
        if (had !== undefined && had !== null) removed++;
        safe(() => sandkit.api.storage.remove(modId, key));
        const left = safe(() => sandkit.api.storage.get(modId, key));
        if (left !== undefined && left !== null) {
            safe(() => sandkit.api.storage.set(modId, key, null));
        }
    }
    console.log(`${log(modId)} storage wiped (${all.size} key(s), ${removed} present)`);
}

/** Light leftover pass — buildings + inventory only. */
export function runCleanup(modId: string, reason: string): void {
    const buildings = pruneStaleBuildings(modId);
    const items = pruneStaleItems(modId);
    if (buildings.length > 0 || items.length > 0) {
        console.log(
            `${log(modId)} cleanup (${reason}): prunedBuildings=${buildings.length} prunedItems=${items.length}`,
            buildings,
        );
    }
}

/**
 * Full "mod switched off" wipe: leftovers, placed objects and stored keys.
 *
 * Pass the `STORAGE_KEYS` the mod declares so keys that were never written
 * through `storage.ensure` are removed as well.
 */
export function runDisableCleanup(
    modId: string,
    reason: string,
    keys: readonly string[] = [],
): void {
    runCleanup(modId, reason);

    const orphans = findOrphanedObjects(modId);
    const objects = removeOrphanedObjects(modId);
    if (objects > 0) {
        console.log(
            `${log(modId)} cleanup (${reason}): removed ${objects} placed object(s)`,
            Object.fromEntries(orphans),
        );
    }

    wipeModStorage(modId, keys);
}
