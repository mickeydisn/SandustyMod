import { cellAt, cellsOf, footprint, type ShapeMatrix } from "../engine/cell-region.ts";

import { api } from "../../packages/mysandkit.ts";
import type { CallSite } from "../engine/types.ts";


export interface ContextSeed {
    
    name: string;

    
    read: (args: readonly unknown[]) => unknown;
}

function safeRead(source: unknown, key: string): unknown {
    if (!source || typeof source !== "object") return undefined;
    try {
        return (source as Record<string, unknown>)[key];
    } catch {
        return undefined;
    }
}


const STRUCTURE_SEEDS: readonly ContextSeed[] = [
    { name: "structure.x", read: (a) => safeRead(a[0], "x") },
    { name: "structure.y", read: (a) => safeRead(a[0], "y") },
    { name: "structure.type", read: (a) => safeRead(a[0], "type") },
    { name: "structure.data", read: (a) => safeRead(a[0], "data") },
];


const CONTEXT_SEEDS: readonly ContextSeed[] = [
    { name: "context.getResolvedTypeAtCell", read: (a) => safeRead(a[1], "getResolvedTypeAtCell") },
    { name: "context.isCellEmptyAtCell", read: (a) => safeRead(a[1], "isCellEmptyAtCell") },
    { name: "context.commit", read: (a) => safeRead(a[1], "commit") },
    { name: "context.isEnabledAtCell", read: (a) => safeRead(a[1], "isEnabledAtCell") },
    { name: "context.setEnabledAtCell", read: (a) => safeRead(a[1], "setEnabledAtCell") },
];

function footprintSeeds(structure: unknown): Record<string, unknown> {
    const x = Number(safeRead(structure, "x")) || 0;
    const y = Number(safeRead(structure, "y")) || 0;
    let shape: ShapeMatrix | undefined;
    try {
        const type = safeRead(structure, "type");
        const typeRef = typeof type === "string" || typeof type === "number" ? type : null;
        shape = typeRef === null
            ? undefined
            : api.structures.getDefinitionByType(typeRef)?.shape as ShapeMatrix | undefined;
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


const FOOTPRINT_SEEDS: readonly ContextSeed[] = ([
    "structure.shape",
    "structure.matrixSize",
    "structure.cellAt",
    "structure.footprint",
] as const).map((name) => ({
    name,
    read: (a: readonly unknown[]) => footprintSeeds(a[0])[name],
})); 

const SCOPE_CONTEXT: Record<CallSite, readonly ContextSeed[]> = {
    processing: [...STRUCTURE_SEEDS, ...CONTEXT_SEEDS, ...FOOTPRINT_SEEDS],

    
    signal: STRUCTURE_SEEDS,

    trigger: [],

    itemAction: [
        { name: "state.x", read: (a) => safeRead(a[0], "x") },
        { name: "state.y", read: (a) => safeRead(a[0], "y") },
        { name: "action.type", read: (a) => safeRead(a[1], "type") },
    ],

    modifier: [
        { name: "args", read: (a) => a[0] },
        { name: "ctx", read: (a) => a[1] },
    ],

    upgrade: [
        { name: "item.type", read: (a) => safeRead(a[0], "type") },
    ],

    behavior: [
        { name: "key", read: (a) => a[0] },
    ],
};


export function seedsFor(
    callSite: CallSite,
    args: readonly unknown[],
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const seed of SCOPE_CONTEXT[callSite] ?? []) {
        let value: unknown;
        try {
            value = seed.read(args);
        } catch {
            continue;
        }
        if (value !== undefined) out[seed.name] = value;
    }
    return out;
}

export function scopeSeedNames(callSite: CallSite): string[] {
    return (SCOPE_CONTEXT[callSite] ?? []).map((s) => s.name);
}
