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
 * Some `CellType` values (SlidingBlock, ConveyorLeft/Right, ShakerLeft/Right,
 * …) are a structure's own moving mechanism rendered at the terrain layer
 * rather than ordinary diggable ground. Those are only cleared when the
 * Structure filter is on — see `isStructureTerrain` — so turning Structure
 * off leaves a machine's terrain-embedded part intact along with the machine
 * itself, instead of stripping half of it.
 *
 * `api.authorization` is query-only (no setter to actually lift a zone's
 * restriction), so this engine always respects it, the same as any other
 * tool: cells the zone blocks are skipped rather than force-cleared.
 */
import { api, safe } from "./api.ts";
import {
    FIXED_TERRAIN_HINTS,
    LOG,
    STRUCTURE_FOOTPRINT_SEARCH_RADIUS,
    STRUCTURE_TERRAIN_HINTS,
    STRUCTURE_TERRAIN_TYPES,
} from "./ids.ts";
import type { Cell, ExcavateStats, FilterState, GridWriter, StructureInstance } from "./types.ts";

/** Best-effort: does this terrain type look like a fixed/indestructible one? */
function isFixedTerrain(type: number | string | null): boolean {
    if (type == null) return false;
    if (typeof type === "number" && STRUCTURE_TERRAIN_TYPES.includes(type)) return false;
    const id = safe(() => api.terrains.getIdByType?.(type)) ??
        safe(() => api.terrains.getDefinitionByType?.(type)?.id) ??
        String(type);
    const lower = String(id).toLowerCase();
    return FIXED_TERRAIN_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Best-effort: is this terrain type actually a structure's own mechanism
 * (conveyor belt, shaker, sliding block) rather than diggable ground?
 */
function isStructureTerrain(type: number | string | null): boolean {
    if (type == null) return false;
    if (typeof type === "number" && STRUCTURE_TERRAIN_TYPES.includes(type)) return true;
    const id = safe(() => api.terrains.getIdByType?.(type)) ??
        safe(() => api.terrains.getDefinitionByType?.(type)?.id) ??
        String(type);
    const lower = String(id).toLowerCase();
    return STRUCTURE_TERRAIN_HINTS.some((hint) => lower.includes(hint));
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

/**
 * Remove the whole structure a hit cell belongs to, not just that cell —
 * and sweep the same footprint for embedded mechanism terrain (conveyors,
 * shakers, sliding blocks), since those can extend past the brush radius on
 * a partial-overlap hit and would otherwise survive the structure itself.
 * `alreadyCleared` is shared with the main terrain pass so a mechanism cell
 * inside both the brush and this footprint is only counted once.
 * Returns the number of *newly* cleared mechanism-terrain cells.
 */
function forceClearStructureFootprint(hx: number, hy: number, alreadyCleared: Set<string>): number {
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

    // The structure instance is gone; also clear any mechanism terrain across
    // its full footprint so nothing survives outside the original brush.
    let mechanismCleared = 0;
    for (const c of footprint) {
        const key = `${c.x},${c.y}`;
        if (alreadyCleared.has(key)) continue;
        const tType = safe(() => api.terrains.getTypeAtCell(c.x, c.y));
        if (tType != null && isStructureTerrain(tType)) {
            forceClearTerrain(null, c.x, c.y);
            alreadyCleared.add(key);
            mechanismCleared++;
        }
    }

    return mechanismCleared;
}

/**
 * Run the brush centred at (cx, cy). Mutates the world and returns counts for
 * the toast / panel footer.
 */
export function excavateAt(cx: number, cy: number, radius: number, filters: FilterState): ExcavateStats {
    const stats: ExcavateStats = {
        terrain: 0,
        element: 0,
        structure: 0,
        skippedFixed: 0,
        skippedAuth: 0,
        structureNoTerrain: 0,
        skippedStructureTerrain: 0,
    };
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

    const clearedMechanismCells = new Set<string>();

    const runTerrainAndElements = (writer: GridWriter | null): void => {
        for (const c of targets) {
            if (filters.terrain) {
                const tType = safe(() => api.terrains.getTypeAtCell(c.x, c.y));
                if (tType != null) {
                    if (isStructureTerrain(tType)) {
                        // A machine's own mechanism, not diggable ground —
                        // tie its removal to the Structure filter instead of
                        // Terrain, so it only goes when the machine does.
                        if (filters.structure) {
                            const key = `${c.x},${c.y}`;
                            if (!clearedMechanismCells.has(key)) {
                                clearedMechanismCells.add(key);
                                forceClearTerrain(writer, c.x, c.y);
                                stats.terrain++;
                            }
                        } else {
                            stats.skippedStructureTerrain++;
                        }
                    } else if (isFixedTerrain(tType) && !filters.unremovable) {
                        stats.skippedFixed++;
                    } else {
                        forceClearTerrain(writer, c.x, c.y);
                        stats.terrain++;
                    }
                } else if (!filters.structure) {
                    // No terrain object here — if it's because a structure
                    // sits on this cell, that's expected (structures are
                    // only placed on already-cleared ground), not a failed
                    // removal. Only check when Structure is off, since with
                    // it on the building (and this non-issue) gets cleared.
                    const hasStructure = safe(() => api.structures.getAtCell(c.x, c.y));
                    if (hasStructure) stats.structureNoTerrain++;
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
        stats.structureNoTerrain = 0;
        stats.skippedStructureTerrain = 0;
        clearedMechanismCells.clear();
        runTerrainAndElements(null);
    }

    // Structures: whole-footprint removal (+ embedded mechanism terrain),
    // deduplicated per instance so a brush touching several cells of one
    // building only counts/clears it once. Runs after the batch above, as
    // its own direct calls (the mutate writer above is scoped to that batch
    // and isn't valid to reuse here).
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
            const mechanismCleared = forceClearStructureFootprint(c.x, c.y, clearedMechanismCells);
            stats.structure++;
            stats.terrain += mechanismCleared;
        }
    }

    safe(() => api.grid.redrawAroundCell?.(cx, cy, radius + 2));
    return stats;
}
