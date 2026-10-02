import { ALL_SLOTS } from "../../engine/registry/types.ts";
import { CREATE_PARAMS, MATRIX_PARAMS, MOTION_REGION_PARAMS, REGION_PARAMS, VELOCITY_PARAMS, elementRef, p } from "../../engine/registry/params.ts";
import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { shapeSize } from "../../engine/cell-region.ts";
import {
    cellReaders,
    clampNote,
    createOptions,
    dataSlotOf,
    elementOf,
    regionFor,
    writeCells,
    type ElementOptions,
} from "./cells.ts";
interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}


interface Vector2 {
    x: number;
    y: number;
}


interface MotionOptions {
    
    vx?: unknown;
    
    vy?: unknown;
    
    ticks?: unknown;
    
    rearm?: unknown;
    
    tx?: unknown;
    ty?: unknown;
    
    maxSpeed?: unknown;
    
    size?: unknown;
    
    particle?: unknown;
}


function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function flag(value: unknown): boolean {
    return value === true || value === "true";
}


function vectorOf(options: MotionOptions): Vector2 {
    return { x: num(options.vx), y: num(options.vy) };
}


function regionCells(
    structure: StructureLike | null,
    options: MotionOptions,
    label: string,
): { x: number; y: number }[] {
    const resolved = regionFor(structure ?? {}, options as never);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:process] ${label}: ${resolved.error}`);
        return [];
    }
    if (resolved.clamped) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: range clamped to 64×64 — this call covered ` +
                "less than you asked for",
        );
    }
    return resolved.range.map((cell) => ({ x: cell.x, y: cell.y }));
}


function overRegion(
    structure: unknown,
    options: unknown,
    label: string,
    call: (cell: { x: number; y: number }) => boolean,
): boolean {
    const s = (structure ?? null) as StructureLike | null;
    if (!s) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: this thread has no api.elements, so nothing ` +
                "was changed",
        );
        return false;
    }
    let touched = 0;
    for (const cell of regionCells(s, (options ?? {}) as MotionOptions, label)) {
        if (call(cell)) touched++;
    }
    return touched > 0;
}


export const elementsActions = defineActions({
    readElement: {
        role: "sense",
        doc: "Reads the element at the cell and returns its id. Bind it with As, then " +
            "use {{name}} in a later step.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        
        params: [...REGION_PARAMS, ...MATRIX_PARAMS],
        fn: (structure, context, options) => {
            try {
                const s = structure as StructureLike | null;
                const readers = cellReaders(context);
                if (!s || !readers) return "";
                const resolved = regionFor(s, (options ?? {}) as ElementOptions);
                if ("error" in resolved) return "";
                const first = resolved.range[0];
                if (!first) return "";
                const found = readers.readType(first.x, first.y);
                
                
                
                return found === undefined || found === null ? "" : readers.idOf(found);
            } catch (e) {
                console.warn("[md-my-hown-mod:process] readElement failed", e);
                return "";
            }
        },
    },

    

    readDataField: {
        role: "sense",
        doc: "Reads data slot N (1–4) at the cell and returns the number. Bind it with " +
            "As. The slot is the number from the element's Data fields list.",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "cell",
        params: [
        p("slot", "Data slot", "select", {
        required: true,
        def: "1",
        options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Field ${n}` })),
        hint:
        "1–4, from the element's Data fields list. The engine stores only these four.",
        }),
        ],
        fn: (structure, _context, options) => {
            try {
                const s = structure as StructureLike | null;
                if (!s) return 0;
                const o = (options ?? {}) as ElementOptions;
                
                
                
                
                
                
                
                
                
                const slot = dataSlotOf(o);
                if (!slot) return 0;
                const region = regionFor(s, o);
                if ("error" in region) return 0;
                const first = region.range[0];
                if (!first) return 0;
                const value = api.elements.getDataFieldAtCell(first.x, first.y, slot);
                return typeof value === "number" && Number.isFinite(value) ? value : 0;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] readDataField failed", e);
                return 0;
            }
        },
    },

    

    writeDataField: {
        role: "act",
        doc: "Writes a number into data slot N (1–4) at the cell. Set `slot` (1–4) and " +
            "`value`.",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "cell",
        params: [
        p("slot", "Data slot", "select", {
        required: true,
        def: "1",
        options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Field ${n}` })),
        hint: "1–4, from the element's Data fields list",
        }),
        p("slotValue", "Value", "text", {
        required: true,
        hint: "a number, or {{aVariable}} from an earlier step. Rounded to a whole number.",
        }),
        ],
        fn: (structure, _context, options) => {
            try {
                const s = structure as StructureLike | null;
                if (!s) return;
                const o = (options ?? {}) as ElementOptions;
                
                
                
                
                const slot = dataSlotOf(o);
                if (!slot) return;
                const region = regionFor(s, o);
                if ("error" in region) return;
                const first = region.range[0];
                if (!first) return;
                
                
                
                
                
                const n = Math.round(Number(o.slotValue));
                if (!Number.isFinite(n)) return;
                api.elements.setDataFieldAtCell(first.x, first.y, slot, n);
            } catch (e) {
                console.warn("[md-my-hown-mod:process] writeDataField failed", e);
            }
        },
    },

    

    countElements: {
        role: "sense",
        doc: "Counts cells holding `element` in the region. Returns a number — bind it " +
            "with As to compare against a threshold.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        elementRef("the element to count"),
        ...REGION_PARAMS,
        ],
        fn: (structure, context, options) => {
            try {
                const s = structure as StructureLike | null;
                const readers = cellReaders(context);
                if (!s || !readers) return 0;
                const o = (options ?? {}) as ElementOptions;
                const want = elementOf(o);
                const resolved = regionFor(s, o);
                if ("error" in resolved) {
                    console.warn(`[md-my-hown-mod:process] countElements: ${resolved.error}`);
                    return 0;
                }
                const note = clampNote(resolved.clamped, "countElements");
                if (note) console.warn(note);
                
                
                const holds = readers.matches(want);
                let n = 0;
                for (const cell of resolved.range) {
                    if (holds(cell.x, cell.y)) n++;
                }
                return n;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] countElements failed", e);
                return 0;
            }
        },
    },

    

    countEmpty: {
        role: "sense",
        doc: "Counts cells in the region that hold neither element nor terrain. This is " +
            "the free space.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
        fn: (structure, context, options) => {
            try {
                const s = structure as StructureLike | null;
                const readers = cellReaders(context);
                if (!s || !readers?.isEmpty) return 0;
                const resolved = regionFor(s, (options ?? {}) as ElementOptions);
                if ("error" in resolved) return 0;
                const isEmpty = readers.isEmpty;
                let n = 0;
                for (const cell of resolved.range) {
                    if (isEmpty(cell.x, cell.y)) n++;
                }
                return n;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] countEmpty failed", e);
                return 0;
            }
        },
    },

    

    
    

    replaceElement: {
        role: "act",
        doc: "Writes `element` over every cell in the region, replacing what was there.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        elementRef("the element to write"),
        ...CREATE_PARAMS,
        ...REGION_PARAMS,
        ],
        fn: (structure, context, options) => {
            const o = (options ?? {}) as ElementOptions;
            const want = elementOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] replaceElement: no element set");
                return false;
            }
            const opts = createOptions(o);
            return writeCells(
                structure,
                context,
                options,
                "replaceElement",
                (writer, cell) => {
                    writer.replaceAtCell(cell.x, cell.y, want, opts);
                    return true;
                },
            );
        },
    },

    

    createElement: {
        role: "act",
        doc: "Writes `element` into every **empty** cell in the region, leaving anything " +
            "already there alone.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        elementRef("the element to place"),
        ...CREATE_PARAMS,
        ...REGION_PARAMS,
        ],
        fn: (structure, context, options) => {
            const o = (options ?? {}) as ElementOptions;
            const want = elementOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] createElement: no element set");
                return false;
            }
            const opts = createOptions(o);
            return writeCells(
                structure,
                context,
                options,
                "createElement",
                (writer, cell, _current, empty) => {
                    if (!empty) return false;
                    writer.createAtCell(cell.x, cell.y, want, opts);
                    return true;
                },
            );
        },
    },

    

    emptyCells: {
        role: "act",
        doc: "Removes the element from every occupied cell in the region.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
        fn: (structure, context, options) => {
            return writeCells(
                structure,
                context,
                options,
                "emptyCells",
                (writer, cell, _current, empty) => {
                    if (empty) return false;
                    if (typeof writer.removeAtCell === "function") {
                        writer.removeAtCell(cell.x, cell.y, {});
                        return true;
                    }
                    api.elements.removeAtCellWhenIdle(cell.x, cell.y, {});
                    return true;
                },
            );
        },
    },

    

    removeElement: {
        role: "act",
        doc: "Removes the element from every cell in the region that holds `element`. " +
            "Leave the element blank to empty every non-empty cell.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        elementRef("only cells holding this are emptied"),
        ...REGION_PARAMS,
        ],
        fn: (structure, context, options) => {
            const want = elementOf(options as ElementOptions);
            if (!want) {
                console.warn("[md-my-hown-mod:process] removeElement: no element set");
                return false;
            }
            
            
            
            
            
            const isGold = cellReaders(context)?.holdsValue(want) ?? null;
            return writeCells(
                structure,
                context,
                options,
                "removeElement",
                (writer, cell, current) => {
                    
                    if (current === null || current === undefined) return false;
                    if (!isGold || !isGold(current)) return false;
                    
                    
                    
                    
                    if (typeof writer.removeAtCell === "function") {
                        writer.removeAtCell(cell.x, cell.y, {});
                        return true;
                    }
                    api.elements.removeAtCellWhenIdle(cell.x, cell.y, {});
                    return true;
                },
            );
        },
    },

    

    transformElement: {
        role: "act",
        doc: "Where the region holds `from`, writes `to`. Leave `from` blank to convert " +
            "whatever element is there.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        p("from", "From element", "text", {
        hint: "only cells holding this are changed. Leave blank for any.",
        }),
        p("to", "To element", "text", { required: true, hint: "what they become" }),
        
        ...CREATE_PARAMS,
        ...REGION_PARAMS,
        ],
        fn: (structure, context, options) => {
            const o = (options ?? {}) as ElementOptions;
            
            
            
            
            
            const to = String(o.to ?? "");
            if (!to) {
                console.warn("[md-my-hown-mod:process] transformElement: no target element set");
                return false;
            }
            const from = String(o.from ?? "");
            const opts = createOptions(o);
            return writeCells(
                structure,
                context,
                options,
                "transformElement",
                (writer, cell, current, empty) => {
                    if (empty) return false;
                    if (from && current !== from) return false;
                    if (current === to) return false;
                    writer.createAtCell(cell.x, cell.y, to, opts);
                    return true;
                },
            );
        },
    },

});


export const motionActions = defineActions({
    getVelocity: {
        role: "sense",
        doc: "Reads the particle speed at the first cell of the region and returns it. " +
            "Bind it with As. Returns -1 when there is no particle to measure.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        ...MOTION_REGION_PARAMS,
        ],
        fn: (structure, _context, options) => {
            try {
                const s = (structure ?? null) as StructureLike | null;
                if (!s) return -1;
                const first = regionCells(s, (options ?? {}) as MotionOptions, "getVelocity")[0];
                if (!first) return -1;
                
                
                const v = api.elements.getVelocityAtCell(first.x, first.y);
                if (!v) return -1;
                return Math.hypot(num(v.x), num(v.y));
            } catch (e) {
                console.warn("[md-my-hown-mod:process] getVelocity failed", e);
                return -1;
            }
        },
    },

    

    findFreeCell: {
        role: "sense",
        doc: "Finds a free cell within `size` cells of the structure. Returns its index " +
            "as a number, or -1 when the whole area is occupied.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        
        params: [
        p("size", "Search size", "number", {
        def: "0",
        min: 1,
        hint: "cells to search from me. 0 = my own footprint size.",
        }),
        ],
        fn: (structure, _context, options) => {
            try {
                const s = (structure ?? null) as StructureLike | null;
                if (!s) return -1;
                const o = (options ?? {}) as MotionOptions;
                const own = shapeSize(s.shape);
                
                
                const side = Math.max(1, Math.trunc(num(o.size, Math.max(own.width, own.height))));
                const found = api.elements.findFreeCellInStructure(
                    num(s.x),
                    num(s.y),
                    side,
                ) as Vector2 | null | undefined;
                if (!found) return -1;
                return num(found.y) * side + num(found.x);
            } catch (e) {
                console.warn("[md-my-hown-mod:process] findFreeCell failed", e);
                return -1;
            }
        },
    },

    

    

    setVelocity: {
        role: "act",
        doc: "Sets the particle velocity (vx, vy) on every cell in the region. Only " +
            "affects particles — use toParticle to turn a cell into one first.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...VELOCITY_PARAMS, ...MOTION_REGION_PARAMS],
        fn: (structure, _context, options) => {
            const v = vectorOf((options ?? {}) as MotionOptions);
            
            
            
            return overRegion(
                structure,
                options,
                "setVelocity",
                (cell) => api.elements.setVelocityAtCell(cell.x, cell.y, { x: v.x, y: v.y }),
            );
        },
    },

    

    addVelocity: {
        role: "act",
        doc: "Adds (vx, vy) to the particle velocity in the region. Set maxSpeed to " +
            "clamp the result in cells per second.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        ...VELOCITY_PARAMS,
        p("maxSpeed", "Max speed", "number", {
        def: "0",
        min: 0,
        hint: "cells/second. 0 = no clamp.",
        }),
        ...MOTION_REGION_PARAMS,
        ],
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as MotionOptions;
            const v = vectorOf(o);
            const max = num(o.maxSpeed, 0);
            return overRegion(structure, options, "addVelocity", (cell) =>
                
                
                api.elements.addParticleVelocityAtCell(cell.x, cell.y, v, max));
        },
    },

    

    setDuration: {
        role: "act",
        doc: "Sets the remaining duration in ticks for every cell in the region. Set " +
            "rearm to also raise the maximum, so it fires again next cycle.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        p("ticks", "Ticks", "number", { def: "60", min: 0, int: true }),
        p("rearm", "Rearm", "bool", {
        def: "false",
        hint: "also raise the maximum, so it fires again next cycle",
        }),
        ...MOTION_REGION_PARAMS,
        ],
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as MotionOptions;
            const ticks = Math.max(0, Math.trunc(num(o.ticks)));
            const rearm = flag(o.rearm);
            return overRegion(
                structure,
                options,
                "setDuration",
                (cell) =>
                    api.elements.setDurationAtCell(cell.x, cell.y, ticks, { updateMax: rearm }),
            );
        },
    },

    

    teleportElement: {
        role: "act",
        doc: "Moves everything in the region by the (tx, ty) offset. ty: 1 moves it down " +
            "one cell. Cells that would land on something are not moved.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
        p("tx", "Move X", "number", { def: "0", int: true }),
        p("ty", "Move Y", "number", { def: "1", int: true, hint: "1 = one cell down" }),
        ...MOTION_REGION_PARAMS,
        ],
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const o = (options ?? {}) as MotionOptions;
            if (!s) {
                console.warn(
                    "[md-my-hown-mod:process] teleportElement: this thread has no " +
                        "teleportBetweenCells, so nothing moved",
                );
                return false;
            }
            const dx = Math.trunc(num(o.tx));
            const dy = Math.trunc(num(o.ty));
            
            if (dx === 0 && dy === 0) return false;
            const cells = regionCells(s, o, "teleportElement");
            let moved = 0;
            for (const cell of cells) {
                
                
                
                if (api.elements.teleportBetweenCells(cell.x, cell.y, cell.x + dx, cell.y + dy)) {
                    moved++;
                }
            }
            return moved > 0;
        },
    },

    

    toParticle: {
        role: "act",
        doc: "Turns every cell in the region into a particle moving at (vx, vy). This is " +
            "what actually launches material — setVelocity alone will not move sand.",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...VELOCITY_PARAMS, ...MOTION_REGION_PARAMS],
        fn: (structure, _context, options) => {
            const v = vectorOf((options ?? {}) as MotionOptions);
            return overRegion(structure, options, "toParticle", (cell) => {
                return api.elements.convertToParticleAtCell(cell.x, cell.y, {
                    x: v.x,
                    y: v.y,
                });
            });
        },
    },

});
