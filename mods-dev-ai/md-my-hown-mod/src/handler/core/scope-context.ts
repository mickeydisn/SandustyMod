
import { cellAt, cellsOf, footprint, type ShapeMatrix } from "./cell-region.ts";

import { api } from "./types.ts";
import type { CallSite } from "./types.ts";


export interface ContextSeed {
    
    name: string;
    
    doc: string;
    
    from: string;
}


export const SCOPE_CONTEXT: Record<CallSite, ContextSeed[]> = {
    
    processing: [
        {
            name: "structure.x",
            doc: "The structure's cell X.",
            from: "process(structure, context)",
        },
        {
            name: "structure.y",
            doc: "The structure's cell Y.",
            from: "process(structure, context)",
        },
        { name: "structure.type", doc: "The structure's type ref.", from: "Structure.type" },
        { name: "structure.data", doc: "The instance's own data bag.", from: "Structure.data" },
        {
            name: "context.getResolvedTypeAtCell",
            doc: "fn(x, y) → the element or terrain type at a cell, or null.",
            from: "StructureProcessingContext",
        },
        {
            name: "context.isCellEmptyAtCell",
            doc: "fn(x, y) → true when the cell holds neither element nor terrain.",
            from: "StructureProcessingContext",
        },
        {
            name: "context.commit",
            doc: "fn(mutations) → queues grid changes for the main thread.",
            from: "StructureProcessingContext",
        },
        
        
        
        
        
        
        {
            name: "context.isEnabledAtCell",
            doc: "fn(x, y) → true when processing runs at that cell.",
            from: "StructureProcessingContext",
        },
        {
            name: "context.setEnabledAtCell",
            doc: "fn(x, y, on) → turns processing on or off at that cell (Main only).",
            from: "StructureProcessingContext",
        },
        
        
        
        
        
        
        
        {
            name: "structure.shape",
            doc: "The structure's footprint matrix, 1 = occupied. 1×1 when it has no shape.",
            from: "getDefinitionByType(structure.type).shape",
        },
        {
            name: "structure.matrixSize",
            doc: "{ width, height } of the footprint, in cells.",
            from: "getDefinitionByType(structure.type).shape",
        },
        {
            name: "structure.cellAt",
            doc: "fn(mx, my) → { cellX, cellY } for a cell of the matrix. The bridge " +
                "from matrix x,y to grid x,y.",
            from: "structure.x + mx, structure.y + my",
        },
        {
            name: "structure.footprint",
            doc: "every occupied cell of the matrix, top-left to bottom-right.",
            from: "getDefinitionByType(structure.type).shape",
        },
    ],

    
    signal: [
        { name: "structure.x", doc: "The structure's cell X.", from: "handler(structure)" },
        { name: "structure.y", doc: "The structure's cell Y.", from: "handler(structure)" },
        { name: "structure.type", doc: "The structure's type ref.", from: "Structure.type" },
        { name: "structure.data", doc: "The instance's own data bag.", from: "Structure.data" },
    ],

    
    trigger: [],

    
    itemAction: [
        { name: "state.x", doc: "The item's cell X.", from: "handleAction(state, action)" },
        { name: "state.y", doc: "The item's cell Y.", from: "handleAction(state, action)" },
        {
            name: "action.type",
            doc: "The action being performed.",
            from: "handleAction(state, action)",
        },
    ],

    
    modifier: [
        {
            name: "args",
            doc: "The intercepted arguments, as the engine passed them.",
            from: "intercept(args, ctx)",
        },
        { name: "ctx", doc: "The hook's own context.", from: "intercept(args, ctx)" },
    ],

    
    upgrade: [
        { name: "item.type", doc: "The upgraded item's type.", from: "onUpgrade(item)" },
    ],

    
    behavior: [
        { name: "key", doc: "The key that was pressed.", from: "onDownKey(key) / onUpKey(key)" },
    ],
};


function safeRead(source: unknown, key: string): unknown {
    if (!source || typeof source !== "object") return undefined;
    try {
        return (source as Record<string, unknown>)[key];
    } catch {
        return undefined;
    }
}


function readSeeds(
    callSite: CallSite,
    args: readonly unknown[],
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    switch (callSite) {
        case "signal":
        case "processing": {
            const s = args[0];
            out["structure.x"] = safeRead(s, "x");
            out["structure.y"] = safeRead(s, "y");
            out["structure.type"] = safeRead(s, "type");
            out["structure.data"] = safeRead(s, "data");
            if (callSite === "processing") {
                const c = args[1];
                out["context.getResolvedTypeAtCell"] = safeRead(c, "getResolvedTypeAtCell");
                out["context.isCellEmptyAtCell"] = safeRead(c, "isCellEmptyAtCell");
                out["context.commit"] = safeRead(c, "commit");
                out["context.isEnabledAtCell"] = safeRead(c, "isEnabledAtCell");
                out["context.setEnabledAtCell"] = safeRead(c, "setEnabledAtCell");
                
                
                
                Object.assign(out, footprintSeeds(s));
            }
            break;
        }
        case "itemAction": {
            out["state.x"] = safeRead(args[0], "x");
            out["state.y"] = safeRead(args[0], "y");
            out["action.type"] = safeRead(args[1], "type");
            break;
        }
        case "modifier": {
            out.args = args[0];
            out.ctx = args[1];
            break;
        }
        case "upgrade":
            out["item.type"] = safeRead(args[0], "type");
            break;
        case "behavior":
            out.key = args[0];
            break;
        
        
        
        case "trigger":
            break;
    }
    return out;
}


function footprintSeeds(structure: unknown): Record<string, unknown> {
    const x = Number(safeRead(structure, "x")) || 0;
    const y = Number(safeRead(structure, "y")) || 0;
    let shape: ShapeMatrix | undefined;
    try {
        const type = safeRead(structure, "type");
        
        
        
        const lookup = api?.structures?.getDefinitionByType;
        
        
        
        
        const typeRef = typeof type === "string" || typeof type === "number" ? type : null;
        if (typeof lookup === "function" && typeRef !== null) {
            shape = lookup(typeRef)?.shape as ShapeMatrix | undefined;
        }
    } catch {
        
        shape = undefined;
    }
    const region = footprint(x, y, shape);
    return {
        "structure.shape": region.mask,
        "structure.matrixSize": { width: region.width, height: region.height },
        "structure.cellAt": (col: number, row: number) => cellAt(region, col, row),
        "structure.footprint": cellsOf(region),
    };
}


export function seedsFor(
    callSite: CallSite,
    args: readonly unknown[],
): Record<string, unknown> {
    const read = readSeeds(callSite, args);
    
    
    
    const offered = new Set(scopeSeedNames(callSite));
    for (const name of Object.keys(read)) {
        if (!offered.has(name) || read[name] === undefined) delete read[name];
    }
    return read;
}


export function scopeSeedNames(callSite: CallSite): string[] {
    return (SCOPE_CONTEXT[callSite] ?? []).map((s) => s.name);
}
