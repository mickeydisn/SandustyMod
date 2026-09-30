/**
 * Random artefact placement within SPAWN_MAX_DISTANCE of the generator.
 *
 * Coordinates are **cell** coordinates (same as structure.x / structure.y).
 * Placement uses api.structures.buildAtCell — the supported API for
 * programmatically creating structures.
 */
import "@sandmd/sandkit";
import {
    ARTEFACT_COUNT_MAX,
    ARTEFACT_COUNT_MIN,
    ARTEFACT_ID,
    CLEAR_RADIUS,
    GENERATOR_SIZE,
    LOG,
    PRODUCEABLE_ELEMENTS,
    RESPECT_AUTHORIZATION,
    SPAWN_ATTEMPTS,
    SPAWN_MAX_DISTANCE,
} from "../constants.ts";
import { clearCircle, isCellEmpty } from "./elements.ts";
import { setPendingArtefact } from "./pendingArtefacts.ts";

export interface SpawnOrigin {
    /** Generator structure.x — cell coordinate of footprint origin. */
    originX: number;
    /** Generator structure.y — cell coordinate of footprint origin. */
    originY: number;
    /** Only true when the player clicked the generator (not signal auto-spawn). */
    focusCamera?: boolean;
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickElementType(): string {
    const list = PRODUCEABLE_ELEMENTS;
    return list[Math.floor(Math.random() * list.length)]!;
}

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** True if (x,y) is inside the generator 4×4 footprint. */
function onGeneratorFootprint(
    x: number,
    y: number,
    origin: SpawnOrigin,
): boolean {
    return (
        x >= origin.originX &&
        x < origin.originX + GENERATOR_SIZE &&
        y >= origin.originY &&
        y < origin.originY + GENERATOR_SIZE
    );
}

/**
 * True if any structure exists within CLEAR_RADIUS (euclidean) of (cx, cy).
 * The clean zone must not overlap existing buildings.
 */
function hasStructureInClearZone(cx: number, cy: number, radius: number): boolean {
    const api = sandkit.api;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx;
            const y = cy + dy;
            try {
                if (api.structures.getAtCell?.(x, y)) return true;
                if (api.structures.hasBuiltAtCell?.(x, y)) return true;
            } catch { /* best-effort */ }
        }
    }
    return false;
}

/**
 * True if any cell in the clear zone is blocked by authorization
 * (player may not build there).
 */
function hasAuthBlockInClearZone(cx: number, cy: number, radius: number): boolean {
    if (!RESPECT_AUTHORIZATION) return false;
    const api = sandkit.api;
    if (typeof api.authorization?.canBuildAtCell !== "function") return false;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            try {
                if (!api.authorization.canBuildAtCell(cx + dx, cy + dy)) return true;
            } catch { /* best-effort */ }
        }
    }
    return false;
}

/**
 * Candidate cell is valid when:
 *  - the cell itself is free of structures / blocks
 *  - no authorization forbids building on the cell or anywhere in the clean zone
 *  - no existing structure sits inside the clean zone (CLEAR_RADIUS)
 */
function canSpawnAt(x: number, y: number): boolean {
    const api = sandkit.api;

    // Target cell occupied?
    try {
        if (api.structures.getAtCell?.(x, y)) return false;
        if (api.structures.hasBuiltAtCell?.(x, y)) return false;
    } catch { /* best-effort */ }

    try {
        if (api.building?.isBlockedAtCell?.(x, y)) return false;
    } catch { /* best-effort */ }

    // Authorization: cannot place on (or clear through) restricted tiles
    if (RESPECT_AUTHORIZATION) {
        try {
            if (typeof api.authorization?.canBuildAtCell === "function") {
                if (!api.authorization.canBuildAtCell(x, y)) return false;
            }
        } catch { /* best-effort */ }
        if (hasAuthBlockInClearZone(x, y, CLEAR_RADIUS)) return false;
    }

    // Clean zone must not contain any existing structure
    if (hasStructureInClearZone(x, y, CLEAR_RADIUS)) return false;

    return true;
}

/**
 * Place one artefact within SPAWN_MAX_DISTANCE (Chebyshev) of the generator
 * center, in **cell** coordinates.
 */
export function spawnRandomArtefact(origin: SpawnOrigin): {
    x: number;
    y: number;
    elementType: string;
    remaining: number;
} | null {
    const api = sandkit.api;

    // Generator center in cell coords
    const cx0 = origin.originX;
    const cy0 = origin.originY;
    const maxD = Math.max(1, SPAWN_MAX_DISTANCE);

    console.log(
        `${LOG} spawn search: generator origin cell=(${origin.originX},${origin.originY}) center=(${cx0},${cy0}) maxD=${maxD}`,
    );

    let x = 0;
    let y = 0;
    let found = false;

    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
        const dx = randInt(-maxD, maxD) * 4;
        const dy = randInt(-maxD, maxD) * 4;
        if (chebyshev(0, 0, dx, dy) < 1) continue; // not on center
        if (chebyshev(0, 0, dx, dy) > maxD * 4) continue;
        const tx = cx0 + dx;
        const ty = cy0 + dy;
        if (onGeneratorFootprint(tx, ty, origin)) continue;
        if (!canSpawnAt(tx, ty)) continue;
        x = tx;
        y = ty;
        found = true;
        break;
    }

    if (!found) {
        console.warn(
            `${LOG} spawn: no free cell within ${maxD} of (${cx0},${cy0}) after ${SPAWN_ATTEMPTS} tries`,
        );
        return null;
    }

    // Clear elements in a circle so the build site is free
    const cleared = clearCircle(x, y, CLEAR_RADIUS);
    console.log(`${LOG} spawn: cleared ${cleared} element cells around cell (${x},${y})`);

    const elementType = pickElementType();
    const remaining = randInt(ARTEFACT_COUNT_MIN, ARTEFACT_COUNT_MAX);

    const data = {
        elementType,
        remaining,
        total: remaining,
        progress: 0,
        max: remaining,
        status: `producing ${elementType}`,
        ready: 1,
        protected: true,
    };

    // Always stash pending so the processor can bootstrap even if updateData is late
    setPendingArtefact(x, y, data);
    console.log(`${LOG} spawn: pending set for cell (${x},${y})`, data);

    // Not unlocked for the player (hideFromBuildMenu). Programmatic buildAtCell only.
    let placed = false;
    try {
        if (typeof api.structures.buildAtCell === "function") {
            try {
                api.structures.buildAtCell(x, y, ARTEFACT_ID, { data });
            } catch {
                api.structures.buildAtCell(x, y, ARTEFACT_ID);
            }
            placed = true;
            console.log(`${LOG} spawn: buildAtCell(${x}, ${y}, ${ARTEFACT_ID})`);
        } else if (typeof api.structures.buildAtCellWhenIdle === "function") {
            try {
                api.structures.buildAtCellWhenIdle(x, y, ARTEFACT_ID, { data });
            } catch {
                api.structures.buildAtCellWhenIdle(x, y, ARTEFACT_ID);
            }
            placed = true;
            console.log(`${LOG} spawn: buildAtCellWhenIdle(${x}, ${y}, ${ARTEFACT_ID})`);
        }
    } catch (err) {
        console.error(`${LOG} spawn buildAtCell failed`, err);
    }

    if (!placed) {
        console.error(`${LOG} spawn: no build API available — artefact not created`);
        return null;
    }

    // Write custom data on the live structure (retry a few times)
    const writeData = () => {
        try {
            const s = api.structures.getAtCell?.(x, y);
            if (!s) return false;
            api.structures.updateData?.(
                s,
                { ...(s.data ?? {}), ...data },
                { propagateToWorkers: true },
            );
            console.log(`${LOG} spawn: data written on structure at cell (${x},${y})`);
            return true;
        } catch (err) {
            console.warn(`${LOG} spawn: updateData failed`, err);
            return false;
        }
    };
    if (!writeData()) {
        setTimeout(() => writeData(), 50);
        setTimeout(() => writeData(), 150);
        setTimeout(() => writeData(), 400);
    }

    // Light always; camera only when the player clicked the generator
    try {
        const metrics = api.rendering?.getGridMetrics?.() ?? api.config?.getLegacy?.() ?? {};
        const cellSize = Number(metrics.cellSize ?? metrics.tileSize ?? 16) || 16;
        const wx = x * cellSize + cellSize / 2;
        const wy = y * cellSize + cellSize / 2;
        api.lights?.temporary?.createAtWorld?.(wx, wy, {
            durationMs: 1200,
            brightness: 1.6,
            size: cellSize * 6,
            color: [0.7, 0.3, 1, 1],
        });
        if (origin.focusCamera) {
            api.camera?.setFocusAtWorld?.(wx, wy);
            setTimeout(() => {
                try {
                    api.camera?.releaseFocus?.({ durationMs: 400 });
                } catch { /* optional */ }
            }, 900);
        }
    } catch { /* optional feedback */ }

    return { x, y, elementType, remaining };
}
