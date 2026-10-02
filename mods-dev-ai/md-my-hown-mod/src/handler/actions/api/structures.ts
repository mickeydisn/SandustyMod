import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { MAX_SCAN_SIDE } from "../../engine/cell-region.ts";
import { regionFor } from "./cells.ts";
interface Vector2 {
    x: number;
    y: number;
}


interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}


interface StructureRecord {
    x?: number;
    y?: number;
    data?: Record<string, unknown>;
    [key: string]: unknown;
}


interface StructureOptions {
    
    dx?: unknown;
    dy?: unknown;
    
    size?: unknown;
    
    footprint?: unknown;
    
    mx?: unknown;
    
    my?: unknown;
    
    structure?: unknown;
    
    key?: unknown;
    
    value?: unknown;
    
    numberValue?: unknown;
    
    removeCells?: unknown;
    
    skipVisuals?: unknown;
    
    preserveUnselectable?: unknown;
    
    propagateToWorkers?: unknown;
    
    enabled?: unknown;
    
    index?: unknown;
    
    value2?: unknown;
    
    thresholds?: unknown;
}


function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}


function float(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function refOf(options: StructureOptions): string {
    return String(options.structure ?? "");
}


function regionCells(
    structure: StructureLike | null,
    options: StructureOptions,
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
    options: StructureOptions,
    label: string,
): { x: number; y: number } | null {
    return regionCells(structure, options, label)[0] ?? null;
}


function at(
    structure: StructureLike | null,
    options: StructureOptions,
    label: string,
): StructureRecord | null {
    
    
    const cell = firstCell(structure, options, label);
    if (!cell) return null;
    return api.structures.getAtCell(cell.x, cell.y) ?? null;
}


function removalOptions(options: StructureOptions): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    if (options.removeCells === true) out.removeCells = true;
    if (options.skipVisuals === true) out.skipVisuals = true;
    if (options.preserveUnselectable === true) out.preserveUnselectable = true;
    return Object.keys(out).length > 0 ? out : undefined;
}


function dataPartial(options: StructureOptions): Record<string, unknown> | null {
    const key = String(options.key ?? "");
    if (!key) return null;
    const asNumber = options.numberValue;
    if (asNumber !== undefined && asNumber !== "" && Number.isFinite(Number(asNumber))) {
        return { [key]: Number(asNumber) };
    }
    return { [key]: String(options.value ?? "") };
}


function thresholdsOf(options: StructureOptions): number[] {
    const raw = String(options.thresholds ?? "");
    if (!raw) return [];
    return raw
        .split(/[\s,]+/)
        .filter((part) => part.length > 0)
        .map(Number)
        .filter((n) => Number.isFinite(n));
}


function writeEach(
    structure: unknown,
    options: unknown,
    label: string,
    act: (cell: { x: number; y: number }) => boolean,
): boolean {
    const s = (structure ?? null) as StructureLike | null;
    if (!s) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no structure on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as StructureOptions;
    let wrote = false;
    for (const cell of regionCells(s, o, label)) {
        if (act(cell)) wrote = true;
    }
    return wrote;
}

export const structureSenseActions = defineActions({
    structureType: {
        role: "sense",
        doc: "Reads the type of the structure at a cell and returns the engine's own " +
            "handle for it. Feed it back into Is structure type — do not compare it to " +
            "an id by hand.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) return "";
            const o = (options ?? {}) as StructureOptions;
            
            
            
            const type = at(s, o, "structureType")?.type;
            return type === undefined || type === null ? "" : String(type);
        },
    },

    

    hasStructure: {
        role: "sense",
        doc: "True when a structure has been built at the cell. Bind it with As.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) return false;
            const cell = firstCell(s, (options ?? {}) as StructureOptions, "hasStructure");
            return cell ? api.structures.hasBuiltAtCell(cell.x, cell.y) === true : false;
        },
    },

    

    isStructureType: {
        role: "sense",
        doc: "True when the cell holds a structure of the given type. Accepts an id or " +
            "a handle from Structure type.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const o = (options ?? {}) as StructureOptions;
            const want = refOf(o);
            if (!s || !want) return false;
            const cell = firstCell(s, o, "isStructureType");
            if (!cell) return false;
            if (api.structures.isTypeAtCell(cell.x, cell.y, want) === true) return true;
            
            
            if (!/^\d+$/.test(want)) return false;
            return api.structures.isTypeAtCell(cell.x, cell.y, Number(want)) === true;
        },
    },

    

    isMyType: {
        role: "sense",
        doc: "True when **this** structure is of the given type. No offsets — it asks " +
            "about the instance the process is running on.",
        fn: (structure, _context, options) => {
            const s = structure as StructureRecord | null;
            const want = refOf((options ?? {}) as StructureOptions);
            if (!s || !want) return false;
            return api.structures.isType(s, want) === true;
        },
    },

    

    isBlockedByPlayer: {
        role: "sense",
        doc: "True when a player has blocked building at the cell.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) return false;
            const o = (options ?? {}) as StructureOptions;
            const cell = firstCell(s, o, "isBlockedByPlayer");
            return cell ? api.structures.isBlockedByPlayerAtCell(cell.x, cell.y) === true : false;
        },
    },

    

    isLauncher: {
        role: "sense",
        doc: "True when the cell is a structure launcher.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) return false;
            const cell = firstCell(s, (options ?? {}) as StructureOptions, "isLauncher");
            return cell ? api.structures.isLauncherAtCell(cell.x, cell.y) === true : false;
        },
    },

    

    isStructureEnabled: {
        role: "sense",
        doc: "True when processing is enabled at the cell. Bind it to gate later steps.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) return false;
            const o = (options ?? {}) as StructureOptions;
            const cell = firstCell(s, o, "isStructureEnabled");
            return cell ? api.structures.processing.isEnabledAtCell(cell.x, cell.y) === true : false;
        },
    },

    

    countStructures: {
        role: "sense",
        doc: "Counts structures in the region. Bind it to check a footprint is clear " +
            "before building.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) return 0;
            const o = (options ?? {}) as StructureOptions;
            let found = 0;
            for (const cell of regionCells(s, o, "countStructures")) {
                if (api.structures.hasBuiltAtCell(cell.x, cell.y)) found++;
            }
            return found;
        },
    },

    

    structureData: {
        role: "sense",
        doc: "Reads one key from the structure's saved data and returns it. Bind it " +
            "with As. Returns the empty string when the key is absent.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const o = (options ?? {}) as StructureOptions;
            const key = String(o.key ?? "");
            if (!s || !key) return "";
            const value = at(s, o, "structureData")?.data?.[key];
            return value === undefined || value === null ? "" : String(value);
        },
    },

});


export const structureActActions = defineActions({
    buildStructure: {
        role: "act",
        doc: "Builds a structure of the given type at the cell.",
        fn: (structure, _context, options) => {
            const want = refOf((options ?? {}) as StructureOptions);
            if (!want) {
                console.warn("[md-my-hown-mod:process] buildStructure: no structure type set");
                return false;
            }
            return writeEach(structure, options, "buildStructure", (cell) => {
                return api.structures.buildAtCell(cell.x, cell.y, want);
            });
        },
    },

    

    removeStructure: {
        role: "act",
        doc: "Removes the structure at the cell. Use Remove structures to clear a whole " +
            "region in one call.",
        fn: (structure, _context, options) => {
            return writeEach(structure, options, "removeStructure", (cell) => {
                return api.structures.removeAtCell(
                    cell.x,
                    cell.y,
                    removalOptions((options ?? {}) as StructureOptions),
                );
            });
        },
    },

    

    removeStructures: {
        role: "act",
        doc: "Removes every structure in the region with a single engine call. Prefer " +
            "this to Remove structure over an area.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            if (!s) {
                console.warn(
                    "[md-my-hown-mod:process] removeStructures: api.structures." +
                        "removeAtCells is not on this thread, so nothing was removed",
                );
                return false;
            }
            const o = (options ?? {}) as StructureOptions;
            const positions = regionCells(s, o, "removeStructures");
            if (positions.length === 0) return false;
            return api.structures.removeAtCells(positions, removalOptions(o));
        },
    },

    

    setStructureEnabled: {
        role: "act",
        doc: "Enables or disables processing at the cell.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            return writeEach(structure, options, "setStructureEnabled", (cell) => {
                return api.structures.processing.setEnabledAtCell(
                    cell.x,
                    cell.y,
                    o.enabled === true,
                );
            });
        },
    },

    

    setSpritesheetIndex: {
        role: "act",
        doc: "Sets this instance's spritesheet frame. Bind a number to it for a gauge.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const frame = num(o.index, 0);
            return writeEach(structure, options, "setSpritesheetIndex", (cell) => {
                if (api.structures.setSpritesheetIndexAtCell(cell.x, cell.y, frame)) return true;
                const found = api.structures.getAtCell(cell.x, cell.y) ?? null;
                if (!found) return false;
                return api.structures.setSpritesheetIndex(found, frame);
            });
        },
    },

    

    setSpritesheetByValue: {
        role: "act",
        doc: "Sets the frame by mapping a value onto a threshold list — the progress bar. " +
            "Thresholds are comma-separated, ascending.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const value = float(o.value2, 0);
            const thresholds = thresholdsOf(o);
            if (thresholds.length === 0) {
                console.warn(
                    "[md-my-hown-mod:process] setSpritesheetByValue: no thresholds, so there " +
                        "is no frame to choose",
                );
                return false;
            }
            return writeEach(structure, options, "setSpritesheetByValue", (cell) => {
                if (
                    api.structures.setSpritesheetIndexByValueAtCell(
                        cell.x,
                        cell.y,
                        value,
                        thresholds,
                    )
                ) {
                    return true;
                }
                const found = api.structures.getAtCell(cell.x, cell.y) ?? null;
                if (!found) return false;
                return api.structures.setSpritesheetIndexByValue(
                    found,
                    value,
                    thresholds,
                );
            });
        },
    },

    

    setStructureData: {
        role: "act",
        doc: "Writes one key into the structure's saved data, through the engine. Use " +
            "Number value for a numeric field.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const partial = dataPartial(o);
            if (!partial) {
                console.warn("[md-my-hown-mod:process] setStructureData: no key set");
                return false;
            }
            return writeEach(structure, options, "setStructureData", (cell) => {
                const found = api.structures.getAtCell(cell.x, cell.y) ?? null;
                if (!found) return false;
                api.structures.updateData(found, partial, {
                    propagateToWorkers: o.propagateToWorkers === true,
                });
                return true;
            });
        },
    },

    

    pushStructure: {
        role: "act",
        doc: "Pushes this structure's data to the engine. Only needed after an action " +
            "that edits the data bag in place.",
        fn: (structure, _context, options) => {
            const s = structure as StructureRecord | null;
            if (!s) return false;
            const o = (options ?? {}) as StructureOptions;
            return api.structures.update(s, { propagateToWorkers: o.propagateToWorkers === true });
        },
    },

});


export const structurePureActions = defineActions({
    mapSpritesheetValue: {
        role: "sense",
        doc: "Maps a value onto a threshold list and returns the frame index the engine " +
            "would pick. Thresholds are comma-separated, ascending.",
        fn: (_structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const thresholds = thresholdsOf(o);
            if (thresholds.length === 0) {
                return -1;
            }
            const frame = api.structures.mapValueToSpritesheetIndex(float(o.value2, 0), thresholds);
            return Number.isFinite(frame) ? num(frame, -1) : -1;
        },
    },

});


export const structureActions = {
    ...structureSenseActions,
    ...structurePureActions,
    ...structureActActions,
};
