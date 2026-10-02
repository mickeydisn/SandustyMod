/**
 * Material selector structures — one per EAT_MATERIALS entry.
 * When the generator's current cycle material matches this structure's
 * element, it activates (sprite variant) and becomes a signal source ON.
 * All structures live in the "Artefact" category.
 */
import "@sandmd/sandkit";
import type { JsonMapBuffer } from "@sandmd/buffer";
import {
    CATEGORY_KEY,
    EAT_MATERIALS,
    GENERATOR_INTERVAL_MS,
    LOG,
    MOD_ID,
    materialByIndex,
    materialStructureId,
    type ArtefactProgress,
    type EatMaterial,
} from "../constants.ts";
import { unlockInBuildMenu } from "../utils/buildMenu.ts";

interface StructurePos {
    x: number;
    y: number;
    data?: Record<string, unknown>;
    type?: string | number;
}

/** One horizontal sheet per material: frame 0 idle, 1 active (32×16). */
export type MaterialSprites = Record<string, string>;

export function registerMaterialStructures(
    map: JsonMapBuffer<ArtefactProgress>,
    sprites: MaterialSprites,
): void {
    const api = sandkit.api;

    for (const mat of EAT_MATERIALS) {
        registerOne(api, map, mat, sprites[mat.id] ?? `${MOD_ID}:material-${mat.id}`);
    }
}

function registerOne(
    api: typeof sandkit.api,
    map: JsonMapBuffer<ArtefactProgress>,
    mat: EatMaterial,
    sheetId: string,
): void {
    const id = materialStructureId(mat.id);

    api.structures.register({
        id,
        name: `Artefact ${mat.label} Link`,
        description:
            `Activates when the Artefact Generator is eating ${mat.label} (×${mat.mult}). Outputs a signal while active.`,
        categoryKey: CATEGORY_KEY,
        order: 50 + EAT_MATERIALS.findIndex((m) => m.id === mat.id),
        alwaysUnlocked: true,
        hideFromBuildMenu: false,
        shape: [[0]],
        useRawShape: true,
        copyData: true,
        buildModes: [{ type: "single" }],
        defaultData: {
            elementType: mat.id,
            active: 0,
            mult: mat.mult,
            status: "idle",
        },
        render: {
            imageName: sheetId,
            size: { width: 16, height: 16 },
            offset: { x: 0, y: 0 },
            ui: { outline: true, imageName: sheetId },
        },
        spritesheet: { frameSize: { width: 16, height: 16 } },
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                message: "{elementType} ×{mult} — {status}",
                fields: [
                    { param: "elementType", field: "elementType", fallback: mat.id },
                    { param: "mult", field: "mult", fallback: mat.mult },
                    { param: "status", field: "status", fallback: "idle" },
                ],
            },
        },
    });

    if (!unlockInBuildMenu(id)) {
        console.warn(`${LOG} material link not unlocked — build menu will hide ${id}`);
    }

    // Signal sender: ON while this material is the generator's active cycle pick
    try {
        api.signals.registerSenderType?.(id, (structure: StructurePos) => {
            return Number(structure.data?.active ?? 0) === 1;
        });
    } catch (err) {
        console.warn(`${LOG} registerSenderType failed ${id}`, err);
    }

    const structureType =
        api.structures.getTypeFromId?.(id) ??
        api.structures.getTypeById?.(id) ??
        id;

    const processFn = (structure: StructurePos) => {
        try {
            const idx = Number(map.getPath("materialIndex") ?? 0);
            const current = materialByIndex(idx);
            const isActive = current.id === mat.id ? 1 : 0;
            const status = isActive ? `ACTIVE — generator eating ${mat.label}` : "idle";

            const prev = structure.data ?? {};
            if (Number(prev.active) === isActive && String(prev.status) === status) {
                // still push signal output
                try {
                    api.signals.setOutputAtCell?.(structure.x, structure.y, isActive === 1);
                } catch { /* optional */ }
                return;
            }

            api.structures.updateData?.(structure, {
                ...prev,
                elementType: mat.id,
                mult: mat.mult,
                active: isActive,
                status,
            }, { propagateToWorkers: true });

            // Frame 0 = idle, 1 = active on the horizontal sheet
            try {
                api.structures.setSpritesheetIndexByValueAtCell?.(
                    structure.x,
                    structure.y,
                    isActive,
                    [0, 1],
                );
            } catch { /* optional */ }

            try {
                api.signals.setOutputAtCell?.(structure.x, structure.y, isActive === 1);
            } catch { /* optional */ }
        } catch (err) {
            console.error(`${LOG} material tick failed ${id}`, err);
        }
    };

    try {
        if (typeof api.structures.addProcessor === "function") {
            api.structures.addProcessor(structureType, {
                intervalMs: GENERATOR_INTERVAL_MS,
                process: processFn,
            });
        } else {
            api.structures.processing?.register?.(`${id}:process`, {
                structureType: id,
                intervalMs: GENERATOR_INTERVAL_MS,
                process: processFn,
            });
        }
    } catch (err) {
        console.error(`${LOG} material processor failed ${id}`, err);
    }

    console.log(`${LOG} material structure ${id} registered`);
}
