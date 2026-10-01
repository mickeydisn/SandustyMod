
import { cellReaders, type ElementOptions, walkRangeFor, writeCells } from "../element/index.ts";
import { defineActions, hostNs } from "../../core/types.ts";
import { type Positions, positionsOver } from "../../core/positions.ts";


interface LogicOptions extends ElementOptions {
    
    element?: unknown;
    
    to?: unknown;
    
    when?: unknown;
    
    onlyEmpty?: unknown;
}


function walkOf(structure: unknown, options: LogicOptions): Positions | null {
    const resolved = walkRangeFor(structure as never, options);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:logic] ${resolved.error}`);
        return null;
    }
    return positionsOver(resolved.range, resolved.clamped);
}


function warnClamp(what: string, list: Positions, options: LogicOptions): void {
    if (!list.clamped) return;
    console.warn(
        `[md-my-hown-mod:logic] ${what}: a range of ${Number(options.size ?? 1)} cells ` +
            `per side was capped at ${list.requested} cells — the answer covers the ` +
            "capped range only",
    );
}


function typeTest(
    context: unknown,
    wanted: string,
    onlyEmpty: boolean,
): ((cell: { x: number; y: number }) => boolean) | null {
    const readers = cellReaders(context);
    if (!readers) return null;
    
    
    
    const holds = readers.matches(wanted);
    return ({ x, y }) => {
        if (onlyEmpty && readers.isEmpty && !readers.isEmpty(x, y)) return false;
        return holds(x, y);
    };
}

export const logicActions = defineActions({
    
    logicAny: {
        role: "logic",
        doc: "fn(size?, element, …) → true when **any** cell in the range holds that " +
            "element. Bind the answer with the step's As field.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const wanted = String(o.element ?? "");
                if (!wanted) return false;
                const list = walkOf(structure, o);
                if (!list) return false;
                warnClamp("logicAny", list, o);
                const test = typeTest(context, wanted, o.onlyEmpty === true);
                return test ? list.any(test) : false;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] any failed", e);
                return false;
            }
        },
    },

    
    logicAll: {
        role: "logic",
        doc: "fn(size?, element, …) → true when **all** cells in the range hold that element.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const wanted = String(o.element ?? "");
                const list = walkOf(structure, o);
                if (!list) return false;
                warnClamp("logicAll", list, o);
                const test = typeTest(context, wanted, o.onlyEmpty === true);
                return test ? list.all(test) : false;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] all failed", e);
                return false;
            }
        },
    },

    
    logicCount: {
        role: "logic",
        doc: "fn(size?, element, …) → how **many** cells in the range hold that " +
            "element. Bind the number with the step's As field.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const wanted = String(o.element ?? "");
                if (!wanted) return 0;
                const list = walkOf(structure, o);
                if (!list) return 0;
                warnClamp("logicCount", list, o);
                const test = typeTest(context, wanted, o.onlyEmpty === true);
                return test ? list.count(test) : 0;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] count failed", e);
                return 0;
            }
        },
    },

    
    logicSum: {
        role: "logic",
        doc: "fn(size?, …) → the total terrain hit points in the range. A cell with " +
            "no terrain counts as 0.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const list = walkOf(structure, o);
                if (!list) return 0;
                warnClamp("logicSum", list, o);
                
                
                const fromCtx = (context as {
                    getTerrainHitPointsAtCell?: (x: number, y: number) => number;
                } | null)?.getTerrainHitPointsAtCell;
                const api = hostNs("terrains");
                const read = typeof fromCtx === "function"
                    ? fromCtx
                    : typeof api?.getDataAtCell === "function"
                    ? (x: number, y: number) => {
                        const data = api.getDataAtCell(x, y) as
                            | { hitPoints?: unknown; hp?: unknown }
                            | null
                            | undefined;
                        const hp = data?.hitPoints ?? data?.hp;
                        return typeof hp === "number" ? hp : 0;
                    }
                    : null;
                if (!read) return 0;
                return list.sum(({ x, y }) => {
                    const n = Number(read(x, y));
                    return Number.isFinite(n) && n > 0 ? n : 0;
                });
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] sum failed", e);
                return 0;
            }
        },
    },

    
    logicForEach: {
        role: "logic",
        doc: "fn(size?, to, …) → writes an element at **every** cell in the range. " +
            "Set `when` to only touch cells already holding another element.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const to = String(o.to ?? o.element ?? "");
                if (!to) return 0;
                const when = o.when === undefined ? "" : String(o.when);
                
                
                
                let changed = 0;
                writeCells(structure, context, o, "logicForEach", (writer, cell, current) => {
                    if (when && current !== when) return false;
                    writer.createAtCell(cell.x, cell.y, to);
                    changed++;
                    return true;
                });
                return changed;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] forEach failed", e);
                return 0;
            }
        },
    },
});
