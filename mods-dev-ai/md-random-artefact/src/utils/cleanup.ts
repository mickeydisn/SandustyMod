/**
 * On load: ignore stored placement counts, scan the live world, log real counts,
 * write those into the buffer so limits match reality.
 */
import "@sandmd/sandkit";
import type { JsonMapBuffer } from "@sandmd/buffer";
import {
    ARTEFACT_ID,
    GENERATOR_ID,
    LOG,
    MAP_KEY,
    MAX_ARTEFACTS,
    MAX_CREATORS,
    MAX_TERRAIN_COLLECTORS,
    TERRAIN_COLLECTOR_ID,
    type ArtefactProgress,
} from "../constants.ts";

interface StructurePos {
    x: number;
    y: number;
    type?: string | number;
    id?: string;
}

export interface LiveStructureCounts {
    generators: number;
    terrainCollectors: number;
    artefacts: number;
}

function idOf(s: StructurePos): string {
    return String(s.type ?? s.id ?? "");
}

function matches(id: string, target: string): boolean {
    if (!id) return false;
    if (id === target) return true;
    // numeric type ids won't match string — forEachOfType is preferred
    return false;
}

function countOfType(typeId: string): { count: number; samples: string[] } {
    const api = sandkit.api;
    let count = 0;
    const samples: string[] = [];

    try {
        api.structures.forEachOfType?.(typeId, (s: StructurePos) => {
            count++;
            if (samples.length < 5) {
                samples.push(`(${s.x},${s.y})`);
            }
        });
    } catch (err) {
        console.warn(`${LOG} forEachOfType(${typeId}) failed`, err);
    }

    // Fallback full scan if forEachOfType found nothing (type id format mismatch)
    if (count === 0) {
        try {
            api.structures.forEach?.((s: StructurePos) => {
                const id = idOf(s);
                if (
                    id === typeId ||
                    (typeof s.type === "string" && s.type === typeId)
                ) {
                    count++;
                    if (samples.length < 5) samples.push(`(${s.x},${s.y}) id=${id}`);
                }
            });
        } catch { /* optional */ }
    }

    return { count, samples };
}

/**
 * Scan the world for our structures. Does not trust buffer / storage counts.
 */
export function scanLiveStructureCounts(): LiveStructureCounts {
    const gen = countOfType(GENERATOR_ID);
    const tc = countOfType(TERRAIN_COLLECTOR_ID);
    const art = countOfType(ARTEFACT_ID);

    console.log(
        `${LOG} world scan: generators=${gen.count} ${gen.samples.join(" ") || "(none)"}`,
    );
    console.log(
        `${LOG} world scan: terrainCollectors=${tc.count} ${tc.samples.join(" ") || "(none)"}`,
    );
    console.log(
        `${LOG} world scan: artefacts=${art.count} ${art.samples.join(" ") || "(none)"}`,
    );

    return {
        generators: gen.count,
        terrainCollectors: tc.count,
        artefacts: art.count,
    };
}

/**
 * Overwrite buffer counts from a live scan (ignore whatever was loaded from storage).
 */
export function syncBufferFromWorld(
    map: JsonMapBuffer<ArtefactProgress> | null,
): LiveStructureCounts {
    const live = scanLiveStructureCounts();

    try {
        if (map) {
            const prevG = Number(map.getPath("nbCreatorPlace") ?? -1);
            const prevT = Number(map.getPath("nbTerrainCollectorPlace") ?? -1);
            const prevA = Number(map.getPath("nbArtefactPlace") ?? -1);

            map.setPath(
                "nbCreatorPlace",
                Math.min(live.generators, MAX_CREATORS),
            );
            map.setPath(
                "nbTerrainCollectorPlace",
                Math.min(live.terrainCollectors, MAX_TERRAIN_COLLECTORS),
            );
            map.setPath(
                "nbArtefactPlace",
                Math.min(live.artefacts, Math.max(MAX_ARTEFACTS, live.artefacts)),
            );
            // If no generator exists, clear charge so a fresh one starts clean
            if (live.generators === 0) {
                map.setPath("progress", 0);
                map.setPath("active", 0);
            }
            map.commit();

            console.log(
                `${LOG} buffer sync from world: ` +
                    `nbCreatorPlace ${prevG}→${live.generators}, ` +
                    `nbTerrainCollectorPlace ${prevT}→${live.terrainCollectors}, ` +
                    `nbArtefactPlace ${prevA}→${live.artefacts}`,
            );
        }
    } catch (err) {
        console.warn(`${LOG} buffer sync failed`, err);
    }

    // Clear stale storage mirror of counts
    try {
        const api = sandkit.api;
        const raw = api.storage?.get?.(MAP_KEY);
        if (raw && typeof raw === "object") {
            api.storage?.set?.(MAP_KEY, {
                ...(raw as Record<string, unknown>),
                nbCreatorPlace: live.generators,
                nbTerrainCollectorPlace: live.terrainCollectors,
                nbArtefactPlace: live.artefacts,
            });
        }
    } catch { /* optional */ }

    return live;
}

/**
 * Optional: remove all generators (not used by default — user asked to scan, not wipe).
 * Kept for manual use if needed.
 */
export function removeAllArtefactGenerators(
    map: JsonMapBuffer<ArtefactProgress> | null,
): number {
    const api = sandkit.api;
    const targets: StructurePos[] = [];

    try {
        api.structures.forEachOfType?.(GENERATOR_ID, (s: StructurePos) => {
            targets.push({ x: s.x, y: s.y });
        });
    } catch { /* best-effort */ }

    let removed = 0;
    for (const s of targets) {
        try {
            if (typeof api.structures.removeAtCellWhenIdle === "function") {
                api.structures.removeAtCellWhenIdle(s.x, s.y);
            } else if (typeof api.structures.removeAtCell === "function") {
                api.structures.removeAtCell(s.x, s.y);
            } else {
                api.structures.remove?.(s);
            }
            removed++;
        } catch (err) {
            console.warn(`${LOG} remove generator @${s.x},${s.y} failed`, err);
        }
    }

    syncBufferFromWorld(map);
    console.log(`${LOG} removed ${removed} generator(s)`);
    return removed;
}
