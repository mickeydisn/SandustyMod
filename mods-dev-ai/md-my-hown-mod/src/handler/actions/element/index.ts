
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { ELEMENT_DATA_SLOTS } from "../../../ui/definition/data-fields.ts";
import { anchorFor, MAX_SCAN_SIDE } from "../../core/cell-region.ts";
import {
    addressFor,
    type Position,
    positionsFor,
    type Range,
    walkFor,
} from "../../core/position.ts";






import type { ProcessingContext } from "../act/index.ts";


interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}


export interface ElementOptions {
    
    dx?: unknown;
    dy?: unknown;
    
    size?: unknown;
    
    from?: unknown;
    
    to?: unknown;
    
    element?: unknown;
    
    footprint?: unknown;
    
    mx?: unknown;
    
    my?: unknown;
    
    
    
    durationTicks?: unknown;
    
    density?: unknown;
    
    freeFalling?: unknown;
    
    vx?: unknown;
    
    vy?: unknown;
    
    slot?: unknown;
    
    slotValue?: unknown;
}


function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}


function anchorPosition(structure: StructureLike | null): Position | null {
    const anchor = anchorFor(structure);
    return anchor.source === "none" ? null : { x: anchor.x, y: anchor.y };
}


export function regionFor(
    structure: StructureLike | null,
    options: ElementOptions,
): { range: Range; clamped: boolean } | { error: string } {
    const at = anchorPosition(structure);
    if (!at) {
        return {
            error: "this call site delivered no position and there is no cursor to read, " +
                "so there is no cell to work on",
        };
    }
    const built = addressFor(structure, options, MAX_SCAN_SIDE);
    if ("conflict" in built) return { error: built.conflict.message };
    return { range: positionsFor(built.address, at), clamped: built.clamped };
}


export function walkRangeFor(
    structure: StructureLike | null,
    options: ElementOptions,
): { range: Range; clamped: boolean } | { error: string } {
    const at = anchorPosition(structure);
    if (!at) return { error: "no position and no cursor: a walk has no cells to visit" };
    const built = walkFor(at, structure, options, MAX_SCAN_SIDE);
    if ("conflict" in built) return { error: built.conflict.message };
    return { range: built.range, clamped: built.clamped };
}


function clampNote(clamped: boolean, label: string): string {
    return clamped
        ? `[md-my-hown-mod:process] ${label}: range clamped to ${MAX_SCAN_SIDE}×${MAX_SCAN_SIDE} — the count below covers less than you asked for`
        : "";
}


function elementOf(options: ElementOptions): string {
    return String(options.element ?? "");
}


function dataSlotOf(options: ElementOptions): number {
    const n = Math.round(Number(options.slot));
    return Number.isInteger(n) && n >= 1 && n <= ELEMENT_DATA_SLOTS ? n : 0;
}


export function cellReaders(context: unknown): {
    readType: (x: number, y: number) => unknown;
    isEmpty: ((x: number, y: number) => boolean) | undefined;
    
    idOf: (found: unknown) => string;
    
    matches: (id: string) => (x: number, y: number) => boolean;
    
    holdsValue: (id: string) => (found: unknown) => boolean;
} | null {
    const ctx = context as ProcessingContext | null;
    const readType = typeof ctx?.getResolvedTypeAtCell === "function"
        ? ctx.getResolvedTypeAtCell
        : api.elements.getResolvedTypeAtCell;
    if (typeof readType !== "function") return null;
    const isEmpty = typeof ctx?.isCellEmptyAtCell === "function"
        ? ctx.isCellEmptyAtCell
        : api.grid.isCellEmptyAtCell;
    
    const forms = (id: string): Set<unknown> => {
        const set = new Set<unknown>([id]);
        try {
            const t = api.elements.getTypeFromId(id);
            if (t != null) set.add(t);
        } catch {
            
        }
        return set;
    };

    const idOf = (found: unknown): string => {
        if (found == null) return "";
        if (typeof found === "string") return found;
        try {
            const id = api.elements.getIdByType(found as number);
            if (typeof id === "string" && id) return id;
        } catch {
            
        }
        return String(found);
    };

    const holdsValue = (id: string) => {
        const want = forms(id);
        return (found: unknown) => found != null && want.has(found);
    };

    return {
        readType: readType as (x: number, y: number) => unknown,
        isEmpty: typeof isEmpty === "function"
            ? isEmpty as (x: number, y: number) => boolean
            : undefined,
        idOf,
        holdsValue,
        matches: (id: string) => {
            const test = holdsValue(id);
            return (x: number, y: number) => test(readType(x, y));
        },
    };
}


export interface ElementWriter {
    createAtCell: (x: number, y: number, type: string, options?: unknown) => void;
    replaceAtCell: (x: number, y: number, type: string, options?: unknown) => void;
    
    removeAtCell?: (x: number, y: number, options?: unknown) => void;
}


function elementsApi():
    | { remove?: (x: number, y: number, options?: unknown) => void }
    | undefined {
    const remove = api.elements.removeAtCellWhenIdle ?? api.elements.removeAtCell;
    return { remove };
}


export function writeCells(
    structure: unknown,
    context: unknown,
    options: unknown,
    label: string,
    decide: (
        writer: ElementWriter,
        cell: { x: number; y: number },
        current: unknown,
        empty: boolean,
    ) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    const ctx = context as ProcessingContext | null;
    
    
    
    const readType = ctx?.getResolvedTypeAtCell;
    const isEmpty = ctx?.isCellEmptyAtCell;
    if (!s || typeof readType !== "function") {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no cell reader on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as ElementOptions;
    const resolved = regionFor(s, o);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:process] ${label}: ${resolved.error} — nothing was written`);
        return false;
    }
    const { range, clamped } = resolved;
    const note = clampNote(clamped, label);
    if (note) console.warn(note);
    const cells = range;

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const plan: { cell: { x: number; y: number }; current: unknown; empty: boolean }[] = [];
    for (const cell of cells) {
        const empty = isEmpty ? isEmpty(cell.x, cell.y) : false;
        plan.push({ cell, current: empty ? null : readType(cell.x, cell.y), empty });
    }

    
    
    
    
    
    
    
    
    
    
    
    const noop: ElementWriter = {
        createAtCell: () => {},
        replaceAtCell: () => {},
        removeAtCell: () => {},
    };
    let queued = 0;
    for (const step of plan) {
        if (decide(noop, step.cell, step.current, step.empty)) queued++;
    }
    if (queued === 0) return false;

    if (!api.grid.mutate((writer: { elements: ElementWriter }) => {
        for (const step of plan) {
            decide(writer.elements, step.cell, step.current, step.empty);
        }
    })) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.grid.mutate on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    return true;
}


function createOptions(options: ElementOptions): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    const ticks = num(options.durationTicks);
    if (ticks > 0) out.durationTicks = ticks;
    const density = Number(options.density);
    if (Number.isFinite(density) && density > 0) out.density = density;
    if (options.freeFalling === true) out.isFreeFalling = true;
    
    
    
    const vx = Number(options.vx);
    const vy = Number(options.vy);
    if (Number.isFinite(vx) && Number.isFinite(vy) && (vx !== 0 || vy !== 0)) {
        out.particle = { velocity: { x: vx, y: vy } };
    }
    return Object.keys(out).length > 0 ? out : undefined;
}




export const elementActions = defineActions({
    

    
    readElement: {
        role: "sense",
        doc: "Reads the element at the cell and returns its id. Bind it with As, then " +
            "use {{name}} in a later step.",
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
                    const api = elementsApi();
                    if (typeof api?.remove !== "function") {
                        console.warn(
                            "[md-my-hown-mod:process] emptyCells: neither the batch " +
                                "writer nor api.elements can remove, so nothing was removed",
                        );
                        return false;
                    }
                    api.remove(cell.x, cell.y, {});
                    return true;
                },
            );
        },
    },

    
    removeElement: {
        role: "act",
        doc: "Removes the element from every cell in the region that holds `element`. " +
            "Leave the element blank to empty every non-empty cell.",
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
                    const api = elementsApi();
                    if (typeof api?.remove !== "function") {
                        console.warn(
                            "[md-my-hown-mod:process] removeElement: neither the batch " +
                                "writer nor api.elements can remove, so nothing was removed",
                        );
                        return false;
                    }
                    api.remove(cell.x, cell.y, {});
                    return true;
                },
            );
        },
    },

    
    transformElement: {
        role: "act",
        doc: "Where the region holds `from`, writes `to`. Leave `from` blank to convert " +
            "whatever element is there.",
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
