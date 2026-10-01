
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { shapeSize } from "../../core/cell-region.ts";
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


function elements() {
    
    
    
    
    return (api.raw as { elements?: { [k: string]: any } } | undefined)?.elements;
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



type ElementsNs = Record<string, any>;

function overRegion(
    structure: unknown,
    options: unknown,
    label: string,
    call: (ns: ElementsNs, cell: { x: number; y: number }) => boolean,
): boolean {
    const s = (structure ?? null) as StructureLike | null;
    const ns = elements();
    if (!s || !ns) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: this thread has no api.elements, so nothing ` +
                "was changed",
        );
        return false;
    }
    let touched = 0;
    for (const cell of regionCells(s, (options ?? {}) as MotionOptions, label)) {
        if (call(ns, cell)) touched++;
    }
    return touched > 0;
}




export const motionActions = defineActions({
    

    
    getVelocity: {
        role: "sense",
        doc: "Reads the particle speed at the first cell of the region and returns it. " +
            "Bind it with As. Returns -1 when there is no particle to measure.",
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
        fn: (structure, _context, options) => {
            try {
                const s = (structure ?? null) as StructureLike | null;
                const ns = elements();
                if (!s || !ns?.findFreeCellInStructure) return -1;
                const o = (options ?? {}) as MotionOptions;
                const own = shapeSize(s.shape);
                
                
                const side = Math.max(1, Math.trunc(num(o.size, Math.max(own.width, own.height))));
                const found = ns.findFreeCellInStructure(
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
        fn: (structure, _context, options) => {
            const v = vectorOf((options ?? {}) as MotionOptions);
            
            
            
            return overRegion(
                structure,
                options,
                "setVelocity",
                (_ns, cell) => api.elements.setVelocityAtCell(cell.x, cell.y, { x: v.x, y: v.y }),
            );
        },
    },

    
    addVelocity: {
        role: "act",
        doc: "Adds (vx, vy) to the particle velocity in the region. Set maxSpeed to " +
            "clamp the result in cells per second.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as MotionOptions;
            const v = vectorOf(o);
            const max = num(o.maxSpeed, 0);
            return overRegion(structure, options, "addVelocity", (_ns, cell) =>
                
                
                api.elements.addParticleVelocityAtCell(cell.x, cell.y, v, max));
        },
    },

    
    setDuration: {
        role: "act",
        doc: "Sets the remaining duration in ticks for every cell in the region. Set " +
            "rearm to also raise the maximum, so it fires again next cycle.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as MotionOptions;
            const ticks = Math.max(0, Math.trunc(num(o.ticks)));
            const rearm = flag(o.rearm);
            return overRegion(
                structure,
                options,
                "setDuration",
                (_ns, cell) =>
                    api.elements.setDurationAtCell(cell.x, cell.y, ticks, { updateMax: rearm }),
            );
        },
    },

    
    teleportElement: {
        role: "act",
        doc: "Moves everything in the region by the (tx, ty) offset. ty: 1 moves it down " +
            "one cell. Cells that would land on something are not moved.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const o = (options ?? {}) as MotionOptions;
            const ns = elements();
            if (!s || typeof ns?.teleportBetweenCells !== "function") {
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
        fn: (structure, _context, options) => {
            const v = vectorOf((options ?? {}) as MotionOptions);
            return overRegion(structure, options, "toParticle", (ns, cell) => {
                if (typeof ns.convertToParticleAtCell !== "function") return false;
                ns.convertToParticleAtCell(cell.x, cell.y, { x: v.x, y: v.y });
                return true;
            });
        },
    },
});
