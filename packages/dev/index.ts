export function pruneStaleBuildings(PRUNE_MOD_ID: string) {
    // const PRUNE_MOD_ID = "solaryum";
    const keep = new Set();
    const buildings = sandkit.state?.store?.player?.buildings;
    if (!Array.isArray(buildings)) return [];
    const stale = buildings.filter(
        (entry) =>
            typeof entry === "string" && entry.startsWith(PRUNE_MOD_ID) &&
            !keep.has(entry),
    );
    if (stale.length === 0) return [];
    for (const id of stale) {
        const index = buildings.indexOf(id);
        if (index >= 0) buildings.splice(index, 1);
    }
    return stale;
}
export function pruneStaleItems(PRUNE_MOD_ID: string) {
    // const PRUNE_MOD_ID = "solaryum";
    const keep = new Set();
    const inventory = sandkit.state?.store?.player?.inventory;
    if (!Array.isArray(inventory)) return [];
    const stale = inventory.filter(
        (entry) =>
            typeof entry?.id === "string" && entry.id.startsWith(PRUNE_MOD_ID) &&
            !keep.has(entry.id),
    );
    if (stale.length === 0) return [];
    for (const item of stale) {
        const index = inventory.indexOf(item);
        if (index >= 0) inventory.splice(index, 1);
    }
    return stale;
}
export function findOrphanedObjects(PRUNE_MOD_ID: string) {
    const keep = new Set();
    const counts = /* @__PURE__ */ new Map();
    const structures = sandkit.state?.store?.structures;
    if (!Array.isArray(structures)) return counts;
    for (const structure of structures) {
        const type = structure?.type;
        if (
            typeof type !== "string" || !type.startsWith(PRUNE_MOD_ID) ||
            keep.has(type)
        ) continue;
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
}
