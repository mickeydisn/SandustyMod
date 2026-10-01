
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { MAX_SCAN_SIDE } from "../../core/cell-region.ts";
import { regionFor } from "../element/index.ts";


interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}


interface Vector2 {
    x: number;
    y: number;
}


interface TerrainOptions {
    
    dx?: unknown;
    dy?: unknown;
    
    size?: unknown;
    
    footprint?: unknown;
    
    mx?: unknown;
    
    my?: unknown;
    
    terrain?: unknown;
    
    damage?: unknown;
    
    hitPoints?: unknown;
    
    skipShadow?: unknown;
}


interface TerrainDataLike {
    cellType?: number;
    hitPoints?: number | null;
    
    hp?: number | null;
}


type TerrainNamespace = typeof api.terrains;


interface TerrainWriter {
    createAtCell: (x: number, y: number, type: string | number, options?: unknown) => void;
    replaceAtCell: (x: number, y: number, type: string | number, options?: unknown) => void;
    removeAtCell: (x: number, y: number, options?: unknown) => void;
}


function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}


function refOf(options: TerrainOptions): string {
    return String(options.terrain ?? "");
}


function terrains() {
    
    
    
    
    return (api.raw as { terrains?: TerrainNamespace } | undefined)?.terrains ?? null;
}


function regionCells(
    structure: StructureLike | null,
    options: TerrainOptions,
    label: string,
): { x: number; y: number }[] {
    const resolved = regionFor(structure ?? {}, options as never);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:process] ${label}: ${resolved.error}`);
        return [];
    }
    if (resolved.clamped) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: range clamped to ${MAX_SCAN_SIDE}×` +
                `${MAX_SCAN_SIDE} — this call covered less than you asked for`,
        );
    }
    return resolved.range.map((cell) => ({ x: cell.x, y: cell.y }));
}


function firstCell(
    structure: StructureLike | null,
    options: TerrainOptions,
    label: string,
): { x: number; y: number } | null {
    return regionCells(structure, options, label)[0] ?? null;
}


function mutationOptions(options: TerrainOptions): Record<string, unknown> | undefined {
    return options.skipShadow === true ? { skipShadow: true } : undefined;
}


function writeShape(
    structure: unknown,
    options: unknown,
    label: string,
    decide: (
        writer: TerrainWriter,
        cell: { x: number; y: number },
        api: TerrainNamespace,
    ) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    
    
    
    const mutate = api?.grid?.mutate;
    if (!s) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no structure on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const ns = terrains();
    if (!ns) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.terrains on this thread, so the ` +
                "batch had nothing to decide against",
        );
        return false;
    }
    const o = (options ?? {}) as TerrainOptions;
    const cells = regionCells(s, o, label);
    let queued = 0;
    if (!mutate((writer: { terrains: TerrainWriter }) => {
        for (const cell of cells) {
            if (decide(writer.terrains, cell, ns)) queued++;
        }
    })) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.grid.mutate on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    return queued > 0;
}


export const terrainSenseActions = defineActions({
    
    terrainType: {
        role: "sense",
        doc: "Reads the terrain id at a cell. Empty means no terrain. Bind it with As.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = terrains();
            if (!s || typeof ns?.getTypeAtCell !== "function") return "";
            const o = (options ?? {}) as TerrainOptions;
            const cell = firstCell(s, o, "terrainType");
            if (!cell) return "";
            const type = ns.getTypeAtCell(cell.x, cell.y);
            if (type === null || type === undefined) return "";
            if (typeof ns.getIdByType === "function") {
                const id = ns.getIdByType(type);
                if (id !== undefined && id !== null && id !== "") return String(id);
            }
            return String(type);
        },
    },

    
    hasTerrain: {
        role: "sense",
        doc: "True when the cell holds terrain. Bind it with As.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = terrains();
            if (!s || typeof ns?.isAtCell !== "function") return false;
            const cell = firstCell(s, (options ?? {}) as TerrainOptions, "hasTerrain");
            return cell ? ns.isAtCell(cell.x, cell.y) === true : false;
        },
    },

    
    isTerrainType: {
        role: "sense",
        doc: "True when the cell holds terrain of the given type. Accepts an id or a " +
            "handle from Terrain type.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = terrains();
            const o = (options ?? {}) as TerrainOptions;
            const want = refOf(o);
            if (!s || !want || typeof ns?.isTypeAtCell !== "function") return false;
            const cell = firstCell(s, o, "isTerrainType");
            if (!cell) return false;
            if (ns.isTypeAtCell(cell.x, cell.y, want) === true) return true;
            
            
            
            if (!/^\d+$/.test(want)) return false;
            return ns.isTypeAtCell(cell.x, cell.y, Number(want)) === true;
        },
    },

    
    terrainHitPoints: {
        role: "sense",
        doc: "Reads the terrain's hit points at a cell. Returns -1 when there are none. " +
            "Bind it to watch a wall wear down.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = terrains();
            const o = (options ?? {}) as TerrainOptions;
            if (!s || !ns || typeof ns.getDataAtCell !== "function") return -1;
            const cell = firstCell(s, o, "terrainHitPoints");
            if (!cell) return -1;
            const data = ns.getDataAtCell(cell.x, cell.y);
            if (!data) return -1;
            const hp = data.hitPoints ?? data.hp;
            return typeof hp === "number" && Number.isFinite(hp) ? hp : -1;
        },
    },

    
    terrainTypeHandle: {
        role: "sense",
        doc: "Reads the engine's own numeric handle for the terrain at a cell. Returns " +
            "-1 when there is none.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = terrains();
            if (!s || !ns || typeof ns.getDataAtCell !== "function") return -1;
            const o = (options ?? {}) as TerrainOptions;
            const cell = firstCell(s, o, "terrainTypeHandle");
            if (!cell) return -1;
            const type = ns.getDataAtCell(cell.x, cell.y)?.cellType;
            return typeof type === "number" && Number.isFinite(type) ? type : -1;
        },
    },

    
    countTerrain: {
        role: "sense",
        doc: "Counts cells holding terrain in the region. Bind it to size a footprint.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = terrains();
            if (!s || typeof ns?.isAtCell !== "function") return 0;
            const o = (options ?? {}) as TerrainOptions;
            let found = 0;
            for (const cell of regionCells(s, o, "countTerrain")) {
                if (ns.isAtCell(cell.x, cell.y)) found++;
            }
            return found;
        },
    },
});



function writeState(
    structure: unknown,
    options: unknown,
    label: string,
    act: (ns: TerrainNamespace, cell: { x: number; y: number }) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    const ns = terrains();
    if (!s || !ns) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: api.terrains is not on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as TerrainOptions;
    let wrote = false;
    for (const cell of regionCells(s, o, label)) {
        if (act(ns, cell)) wrote = true;
    }
    return wrote;
}


export const terrainActActions = defineActions({
    
    createTerrain: {
        role: "act",
        doc: "Creates terrain of the given type in empty cells. One atomic batch.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const want = refOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] createTerrain: no terrain type set");
                return false;
            }
            return writeShape(structure, options, "createTerrain", (writer, cell, ns) => {
                
                
                if (typeof ns.isAtCell === "function" && ns.isAtCell(cell.x, cell.y)) {
                    return false;
                }
                writer.createAtCell(cell.x, cell.y, want, mutationOptions(o));
                return true;
            });
        },
    },

    
    replaceTerrain: {
        role: "act",
        doc: "Replaces terrain in every cell of the region. One atomic batch.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const want = refOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] replaceTerrain: no terrain type set");
                return false;
            }
            return writeShape(structure, options, "replaceTerrain", (writer, cell) => {
                writer.replaceAtCell(cell.x, cell.y, want, mutationOptions(o));
                return true;
            });
        },
    },

    
    removeTerrain: {
        role: "act",
        doc: "Removes terrain from every cell of the region. One atomic batch.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            return writeShape(structure, options, "removeTerrain", (writer, cell) => {
                writer.removeAtCell(cell.x, cell.y, mutationOptions(o));
                return true;
            });
        },
    },

    
    damageTerrain: {
        role: "act",
        doc: "Damages terrain in the region. Per-cell, so a large area can half-apply.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const amount = num(o.damage, 0);
            if (amount <= 0) {
                console.warn(
                    "[md-my-hown-mod:process] damageTerrain: no damage amount, so there " +
                        "was nothing to do",
                );
                return false;
            }
            return writeState(structure, options, "damageTerrain", (ns, cell) => {
                if (typeof ns.damageAtCell !== "function") return false;
                return api.terrains.damageAtCell(cell.x, cell.y, amount);
            });
        },
    },

    
    setTerrainHitPoints: {
        role: "act",
        doc: "Sets the terrain's hit points in the region. Use it to repair a wall.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const hp = num(o.hitPoints, -1);
            if (hp < 0) {
                console.warn(
                    "[md-my-hown-mod:process] setTerrainHitPoints: no hit points set, and " +
                        "a negative value is not one",
                );
                return false;
            }
            return writeState(structure, options, "setTerrainHitPoints", (ns, cell) => {
                if (typeof ns.setHitPointsAtCell !== "function") return false;
                return api.terrains.setHitPointsAtCell(cell.x, cell.y, hp);
            });
        },
    },
});


export const terrainActions = {
    ...terrainSenseActions,
    ...terrainActActions,
};
