/**
 * Terrain Collector — manual only (no signal / no sensor).
 * Own charge config. When charged + clicked: stamp a 64×64 terrain pattern
 * from a random Dicebear icon.
 *
 * Ring layout, by Manhattan distance from the glyph:
 *   d = 0                → fill    (dirt)
 *   d = 1                → outline (moss)
 *   d = 2 … 1+ERASE_RING → erase   (element + terrain wiped to empty)
 *   beyond               → untouched
 *
 * Max 1 on the map. Category: Artefact.
 */
import "@sandmd/sandkit";
import type { JsonMapBuffer } from "@sandmd/buffer";
import {
    CATEGORY_KEY,
    GENERATOR_CENTER_OFFSET,
    GENERATOR_SIZE,
    LOG,
    MAX_TERRAIN_COLLECTORS,
    TERRAIN_COLLECTOR_ID,
    TERRAIN_EAT_COUNT,
    TERRAIN_EAT_MATERIALS,
    TERRAIN_INTERVAL_MS,
    TERRAIN_MAX_PROGRESS,
    TERRAIN_ZONE_SIZE,
    type ArtefactProgress,
    type EatMaterial,
} from "../constants.ts";
import {
    cellHasElement,
    removeElementAt,
    resolveElementType,
} from "../utils/elements.ts";
import { runTerrainStamp } from "../utils/iconTerrain.ts";

interface StructurePos {
    x: number;
    y: number;
    data?: Record<string, unknown>;
    type?: string | number;
}

function makeZeroShape(size: number): number[][] {
    return Array.from({ length: size }, () =>
        Array.from({ length: size }, () => 0),
    );
}

function pickMatIndex(): number {
    return Math.floor(Math.random() * TERRAIN_EAT_MATERIALS.length);
}

function matByIndex(i: number): EatMaterial {
    const n = TERRAIN_EAT_MATERIALS.length;
    return TERRAIN_EAT_MATERIALS[((i % n) + n) % n]!;
}

export function registerTerrainCollector(
    map: JsonMapBuffer<ArtefactProgress>,
    sheetId: string,
): void {
    const api = sandkit.api;

    const resolved = TERRAIN_EAT_MATERIALS.map((m) => ({
        ...m,
        type: resolveElementType(m.id),
    }));
    const first = TERRAIN_EAT_MATERIALS[0]!;

    api.structures.register({
        id: TERRAIN_COLLECTOR_ID,
        name: "Terrain Collector",
        description:
            `Manual only. Charge with materials, then click to stamp a ${TERRAIN_ZONE_SIZE}×${TERRAIN_ZONE_SIZE} dirt/moss pattern from a random icon. Max 1.`,
        categoryKey: CATEGORY_KEY,
        order: 15,
        alwaysUnlocked: true,
        hideFromBuildMenu: false,
        shape: makeZeroShape(GENERATOR_SIZE),
        useRawShape: true,
        copyData: true,
        buildModes: [{ type: "single" }],
        defaultData: {
            progress: 0,
            max: TERRAIN_MAX_PROGRESS,
            remaining: TERRAIN_MAX_PROGRESS,
            material: first.label,
            mult: first.mult,
            status: "charging",
            charged: 0,
        },
        render: {
            imageName: sheetId,
            size: { width: 16, height: 16 },
            offset: { x: 0, y: 0 },
            ui: { outline: true, imageName: sheetId },
        },
        spritesheet: {
            frameSize: { width: 16, height: 16 },
            frames: 2,
        },
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                message:
                    "Need {remaining} more ({progress}/{max}) · eating {material} ×{mult} · {status}",
                fields: [
                    { param: "remaining", field: "remaining", fallback: TERRAIN_MAX_PROGRESS, round: true },
                    { param: "progress", field: "progress", fallback: 0, round: true },
                    { param: "max", field: "max", fallback: TERRAIN_MAX_PROGRESS, round: true },
                    { param: "material", field: "material", fallback: first.label },
                    { param: "mult", field: "mult", fallback: first.mult },
                    { param: "status", field: "status", fallback: "charging" },
                ],
            },
        },
    });

    try {
        api.player.buildings.add?.(TERRAIN_COLLECTOR_ID);
    } catch { /* best-effort */ }

    // Max 1
    try {
        api.hooks.modify(
            "building:placementLimit:prepare",
            (args: { structureId?: string; maxCount?: number | null }) => {
                const id = String(args.structureId ?? "");
                if (id === TERRAIN_COLLECTOR_ID || id.endsWith(":terrain-collector")) {
                    args.maxCount = MAX_TERRAIN_COLLECTORS;
                }
            },
        );
    } catch { /* optional */ }

    try {
        api.hooks.intercept(
            "building:place",
            (args: { structureId?: string }, context: { cancel?: () => void }) => {
                const id = String(args.structureId ?? "");
                if (id !== TERRAIN_COLLECTOR_ID && !id.endsWith(":terrain-collector")) return;
                let count = 0;
                try {
                    api.structures.forEachOfType?.(TERRAIN_COLLECTOR_ID, () => {
                        count++;
                    });
                } catch { /* best-effort */ }
                if (count >= MAX_TERRAIN_COLLECTORS) {
                    context.cancel?.();
                    try {
                        api.ui.toast?.("Only one Terrain Collector allowed", {});
                    } catch { /* optional */ }
                }
            },
        );
    } catch { /* optional */ }

    const structureType =
        api.structures.getTypeFromId?.(TERRAIN_COLLECTOR_ID) ??
        api.structures.getTypeById?.(TERRAIN_COLLECTOR_ID) ??
        TERRAIN_COLLECTOR_ID;

    const cycleMat = new Map<string, number>();

    const syncData = (
        structure: StructurePos,
        progress: number,
        active: number,
        mat: EatMaterial,
    ) => {
        const remaining = Math.max(0, TERRAIN_MAX_PROGRESS - progress);
        const status = active === 1 ? "READY — click to stamp terrain" : "charging";
        try {
            api.structures.updateData?.(structure, {
                ...(structure.data ?? {}),
                progress,
                max: TERRAIN_MAX_PROGRESS,
                remaining,
                material: mat.label,
                mult: mat.mult,
                status,
                charged: active,
            }, { propagateToWorkers: true });
        } catch { /* best-effort */ }
        try {
            api.structures.setSpritesheetIndexByValueAtCell?.(
                structure.x,
                structure.y,
                active === 1 ? 1 : 0,
                [0, 1],
            );
        } catch { /* optional */ }
    };

    const processFn = (structure: StructurePos) => {
        try {
            let progress = Number(map.getPath("terrainProgress") ?? 0);
            let active = Number(map.getPath("terrainActive") ?? 0);

            // Track count
            let n = 0;
            try {
                api.structures.forEachOfType?.(TERRAIN_COLLECTOR_ID, () => {
                    n++;
                });
            } catch { /* best-effort */ }
            if (Number(map.getPath("nbTerrainCollectorPlace") ?? 0) !== n) {
                map.setPath("nbTerrainCollectorPlace", Math.min(n, MAX_TERRAIN_COLLECTORS));
                map.commit();
            }

            const key = `${structure.x},${structure.y}`;
            if (!cycleMat.has(key)) {
                let idx = Number(map.getPath("terrainMaterialIndex") ?? -1);
                if (idx < 0 || idx >= TERRAIN_EAT_MATERIALS.length) {
                    idx = pickMatIndex();
                    map.setPath("terrainMaterialIndex", idx);
                    map.commit();
                }
                cycleMat.set(key, idx);
            }
            const mat = matByIndex(cycleMat.get(key)!);
            const matR = resolved.find((r) => r.id === mat.id);

            if (progress >= TERRAIN_MAX_PROGRESS) {
                if (active !== 1) {
                    map.setPath("terrainActive", 1);
                    map.commit();
                    active = 1;
                }
                syncData(structure, progress, 1, mat);
                return;
            }

            let cells = 0;
            if (matR?.type != null) {
                const cx = structure.x + GENERATOR_CENTER_OFFSET;
                const cy = structure.y + GENERATOR_CENTER_OFFSET;
                const spots: { x: number; y: number }[] = [{ x: cx, y: cy }];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        spots.push({ x: cx + dx, y: cy + dy });
                    }
                }
                for (const cell of spots) {
                    if (cells >= TERRAIN_EAT_COUNT) break;
                    if (
                        cell.x < structure.x || cell.x >= structure.x + GENERATOR_SIZE ||
                        cell.y < structure.y || cell.y >= structure.y + GENERATOR_SIZE
                    ) continue;
                    if (!cellHasElement(cell.x, cell.y, matR.type, mat.id)) continue;
                    removeElementAt(cell.x, cell.y);
                    cells++;
                }
            }

            if (cells > 0) {
                const gained = Math.max(0, Math.round(cells / mat.mult));
                progress = Math.min(TERRAIN_MAX_PROGRESS, progress + gained);
                map.setPath("terrainProgress", progress);
                if (progress >= TERRAIN_MAX_PROGRESS) {
                    map.setPath("terrainActive", 1);
                    active = 1;
                }
                map.commit();
            }

            syncData(structure, progress, active, mat);
        } catch (err) {
            console.error(`${LOG} terrain collector tick failed`, err);
        }
    };

    try {
        if (typeof api.structures.addProcessor === "function") {
            api.structures.addProcessor(structureType, {
                intervalMs: TERRAIN_INTERVAL_MS,
                process: processFn,
            });
        } else {
            api.structures.processing?.register?.(`${TERRAIN_COLLECTOR_ID}:process`, {
                structureType: TERRAIN_COLLECTOR_ID,
                intervalMs: TERRAIN_INTERVAL_MS,
                process: processFn,
            });
        }
    } catch (err) {
        console.error(`${LOG} terrain collector processor failed`, err);
    }

    // Click only — no signal
    try {
        api.signals.interactables.register(TERRAIN_COLLECTOR_ID, (structure: StructurePos) => {
            const active = Number(map.getPath("terrainActive") ?? 0);
            const progress = Number(map.getPath("terrainProgress") ?? 0);
            if (active !== 1 && progress < TERRAIN_MAX_PROGRESS) {
                const remaining = TERRAIN_MAX_PROGRESS - progress;
                const mat = matByIndex(Number(map.getPath("terrainMaterialIndex") ?? 0));
                try {
                    api.ui.toast?.(
                        `Terrain Collector: need ${remaining} more · ${mat.label}`,
                        {},
                    );
                } catch { /* optional */ }
                return;
            }

            try {
                api.ui.toast?.("Stamping terrain pattern…", {});
            } catch { /* optional */ }

            void (async () => {
                try {
                    const result = await runTerrainStamp({
                        x: structure.x,
                        y: structure.y,
                    });
                    if (!result) {
                        try {
                            api.ui.toast?.(
                                `No free ${TERRAIN_ZONE_SIZE}×${TERRAIN_ZONE_SIZE} zone (auth/structures)`,
                                {},
                            );
                        } catch { /* optional */ }
                        return;
                    }

                    map.setPath("terrainProgress", 0);
                    map.setPath("terrainActive", 0);
                    map.setPath("terrainMaterialIndex", pickMatIndex());
                    map.commit();
                    cycleMat.delete(`${structure.x},${structure.y}`);
                    const mat = matByIndex(Number(map.getPath("terrainMaterialIndex") ?? 0));
                    syncData(structure, 0, 0, mat);

                    try {
                        api.ui.toast?.(
                            `Terrain @(${result.ox},${result.oy}) dirt=${result.fill} moss=${result.outline} erased=${result.erase}`,
                            {},
                        );
                    } catch { /* optional */ }
                    if (result.url) {
                        console.log(`${LOG} terrain stamp URL: ${result.url}`);
                    }
                } catch (err) {
                    console.error(`${LOG} terrain stamp failed`, err);
                    try {
                        api.ui.toast?.("Terrain stamp failed (see console)", {});
                    } catch { /* optional */ }
                }
            })();
        });
    } catch (err) {
        console.error(`${LOG} terrain collector interactable failed`, err);
    }

    console.log(`${LOG} terrain collector registered ${TERRAIN_COLLECTOR_ID}`);
}
