/**
 * excavated-all — the actual excavation engine.
 *
 * For every cell in a circular brush this can:
 *  - force-clear terrain, including normally-indestructible "fixed" terrain
 *    (bedrock/blackrock/border-class ids) when the Unremovable filter is on;
 *  - remove the simulated element/matter occupying the cell;
 *  - remove the *entire* structure a hit cell belongs to — not just the
 *    cells inside the brush, so clipping the corner of a 4x4 building
 *    doesn't leave a broken remnant behind.
 *
 * Terrain is force-cleared by zeroing hit points *and* calling `removeAtCell`
 * directly — `removeAtCell` isn't gated by the hp/damage system the way
 * `damageAtCell` is, which is what lets this tool take out terrain the
 * player's normal tools cannot touch.
 *
 * `api.authorization` is query-only (no setter to actually lift a zone's
 * restriction), so this engine always respects it, the same as any other
 * tool: cells the zone blocks are skipped rather than force-cleared.
 */
import { api, safe } from "./api.ts";
import { FIXED_TERRAIN_HINTS, LOG, STRUCTURE_FOOTPRINT_SEARCH_RADIUS } from "./ids.ts";
import type { Cell, ExcavateStats, FilterState, GridWriter, StructureInstance } from "./types.ts";

/** Best-effort: does this terrain type look like a fixed/indestructible one? */
function isFixedTerrain(type: number | string | null): boolean {
    if (type == null) return false;
    const id = safe(() => api.terrains.getIdByType?.(type)) ??
        safe(() => api.terrains.getDefinitionByType?.(type)?.id) ??
        String(type);
    const lower = String(id).toLowerCase();
    return FIXED_TERRAIN_HINTS.some((hint) => lower.includes(hint));
}

/** Every cell within `radius` cells of the centre, closest-first. */
function circleCells(cx: number, cy: number, radius: number): Cell[] {
    const cells: Cell[] = [];
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            cells.push({ x: cx + dx, y: cy + dy });
        }
    }
    return cells;
}

/** Force-clear one cell's terrain, trying every removal path the API exposes. */
function forceClearTerrain(writer: GridWriter | null, x: number, y: number): void {
    safe(() => api.terrains.setHitPointsAtCell?.(x, y, 0));
    safe(() => api.terrains.setHpAtCell?.(x, y, 0));
    safe(() => api.terrains.damageAtCell?.(x, y, Number.MAX_SAFE_INTEGER));
    safe(() => writer?.terrains.removeAtCell?.(x, y));
    safe(() => api.terrains.removeAtCell?.(x, y));
}

function forceClearElement(writer: GridWriter | null, x: number, y: number): void {
    safe(() => writer?.elements.removeAtCell?.(x, y));
    safe(() => api.elements.removeAtCell?.(x, y));
}

/** Two structure-instance reads refer to the same placed building. */
function sameInstance(a: StructureInstance, b: StructureInstance | null): boolean {
    if (!b) return false;
    if (a.type !== b.type) return false;
    // Most instances carry a stable anchor (x, y); fall back to reference
    // equality when the API returns instances without one.
    if (typeof a.x === "number" && typeof a.y === "number") {
        return a.x === b.x && a.y === b.y;
    }
    return a === b;
}

/**
 * Find every cell occupied by the structure instance found at (hx, hy), by
 * scanning outward from it. Structure instances don't expose their shape
 * reliably across engine builds, so rather than trust a `shape`/`size` field
 * this walks a bounded local area and keeps cells whose instance matches
 * (same type + same anchor) — robust to any footprint shape or orientation.
 */
function findStructureFootprint(hx: number, hy: number, instance: StructureInstance): Cell[] {
    const cells: Cell[] = [];
    const r = STRUCTURE_FOOTPRINT_SEARCH_RADIUS;
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const x = hx + dx;
            const y = hy + dy;
            const cand = safe(() => api.structures.getAtCell(x, y));
            if (cand && sameInstance(instance, cand)) cells.push({ x, y });
        }
    }
    if (cells.length === 0) cells.push({ x: hx, y: hy });
    return cells;
}

/** Remove the whole structure a hit cell belongs to, not just that cell. */
function forceClearStructureFootprint(hx: number, hy: number): number {
    const s = safe(() => api.structures.getAtCell(hx, hy));
    if (!s) return 0;

    const footprint = findStructureFootprint(hx, hy, s);
    let minX = hx, maxX = hx, minY = hy, maxY = hy;
    for (const c of footprint) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
    }

    // Prefer one bounding-box call — clears the whole footprint even if the
    // scan above missed a corner cell on an irregular shape.
    const clearedByBox = safe(() => {
        api.structures.removeBetweenCells?.(minX, minY, maxX, maxY);
        return true;
    }, false);

    if (!clearedByBox) {
        for (const c of footprint) safe(() => api.structures.removeAtCell?.(c.x, c.y));
    }

    return footprint.length;
}

/**
 * Run the brush centred at (cx, cy). Mutates the world and returns counts for
 * the toast / panel footer.
 */
export function excavateAt(cx: number, cy: number, radius: number, filters: FilterState): ExcavateStats {
    const stats: ExcavateStats = { terrain: 0, element: 0, structure: 0, skippedFixed: 0, skippedAuth: 0 };
    const all = circleCells(cx, cy, radius);

    // Authorization is query-only in this API — always respected, like any
    // other tool. Cells the zone blocks are skipped, never force-cleared.
    const targets: Cell[] = [];
    for (const c of all) {
        const allowed = safe(() => api.authorization.canUseToolAtCell?.(c.x, c.y), true);
        if (allowed === false) {
            stats.skippedAuth++;
            continue;
        }
        targets.push(c);
    }

    const runTerrainAndElements = (writer: GridWriter | null): void => {
        for (const c of targets) {
            if (filters.terrain) {
                const tType = safe(() => api.terrains.getTypeAtCell(c.x, c.y));
                if (tType != null) {
                    if (isFixedTerrain(tType) && !filters.unremovable) {
                        stats.skippedFixed++;
                    } else {
                        forceClearTerrain(writer, c.x, c.y);
                        stats.terrain++;
                    }
                }
            }
            if (filters.element) {
                const eType = safe(() => api.elements.getTypeAtCell(c.x, c.y));
                if (eType != null) {
                    forceClearElement(writer, c.x, c.y);
                    stats.element++;
                }
            }
            safe(() => writer?.reportActivityAtCell?.(c.x, c.y));
            safe(() => api.grid.reportActivityAtCell?.(c.x, c.y));
        }
    };

    // Prefer a coherent grid.mutate batch (Main-safe read+write); fall back to
    // direct api.terrains/api.elements calls if `mutate` isn't available.
    let batched = false;
    try {
        if (typeof api.grid.mutate === "function") {
            api.grid.mutate((writer) => runTerrainAndElements(writer));
            batched = true;
        }
    } catch (err) {
        console.warn(`${LOG} grid.mutate failed, falling back to direct calls`, err);
    }
    if (!batched) {
        stats.terrain = 0;
        stats.element = 0;
        runTerrainAndElements(null);
    }

    // Structures: whole-footprint removal, deduplicated per instance so a
    // brush touching several cells of one building only counts/clears it once.
    if (filters.structure) {
        const clearedAnchors = new Set<string>();
        for (const c of targets) {
            const s = safe(() => api.structures.getAtCell(c.x, c.y));
            if (!s) continue;
            const anchorKey = typeof s.x === "number" && typeof s.y === "number"
                ? `${String(s.type)}:${s.x},${s.y}`
                : `${String(s.type)}:${c.x},${c.y}`;
            if (clearedAnchors.has(anchorKey)) continue;
            clearedAnchors.add(anchorKey);
            forceClearStructureFootprint(c.x, c.y);
            stats.structure++;
        }
    }

    safe(() => api.grid.redrawAroundCell?.(cx, cy, radius + 2));
    return stats;
}
