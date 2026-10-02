import { cellAt, cellsOf, footprint, type ShapeMatrix } from "../engine/cell-region.ts";

import { api } from "../../packages/mysandkit.ts";
import type { CallSite } from "../engine/types.ts";

/**
 * One thing the host hands a compiled process, and how to read it.
 *
 * The reader lives on the seed rather than in a `switch` beside the table.
 * Those used to be two independent hand-written structures that had to agree
 * on the same names: add a seed to the docs and forget the reader (or the
 * other way round) and the two silently diverge. Here a seed cannot exist
 * without its reader, so the name, the docs and the read are one entry.
 */
export interface ContextSeed {
    name: string;

    doc: string;

    from: string;

    /** Pulls this seed's value out of the call site's arguments. */
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

/** The structure's position, type and data bag — shared by signal/processing. */
const STRUCTURE_SEEDS: readonly ContextSeed[] = [
    {
        name: "structure.x",
        doc: "The structure's cell X.",
        from: "process(structure, context)",
        read: (a) => safeRead(a[0], "x"),
    },
    {
        name: "structure.y",
        doc: "The structure's cell Y.",
        from: "process(structure, context)",
        read: (a) => safeRead(a[0], "y"),
    },
    {
        name: "structure.type",
        doc: "The structure's type ref.",
        from: "Structure.type",
        read: (a) => safeRead(a[0], "type"),
    },
    {
        name: "structure.data",
        doc: "The instance's own data bag.",
        from: "Structure.data",
        read: (a) => safeRead(a[0], "data"),
    },
];

const CONTEXT_SEEDS: readonly ContextSeed[] = [
    {
        name: "context.getResolvedTypeAtCell",
        doc: "fn(x, y) → the element or terrain type at a cell, or null.",
        from: "StructureProcessingContext",
        read: (a) => safeRead(a[1], "getResolvedTypeAtCell"),
    },
    {
        name: "context.isCellEmptyAtCell",
        doc: "fn(x, y) → true when the cell holds neither element nor terrain.",
        from: "StructureProcessingContext",
        read: (a) => safeRead(a[1], "isCellEmptyAtCell"),
    },
    {
        name: "context.commit",
        doc: "fn(mutations) → queues grid changes for the main thread.",
        from: "StructureProcessingContext",
        read: (a) => safeRead(a[1], "commit"),
    },
    {
        name: "context.isEnabledAtCell",
        doc: "fn(x, y) → true when processing runs at that cell.",
        from: "StructureProcessingContext",
        read: (a) => safeRead(a[1], "isEnabledAtCell"),
    },
    {
        name: "context.setEnabledAtCell",
        doc: "fn(x, y, on) → turns processing on or off at that cell (Main only).",
        from: "StructureProcessingContext",
        read: (a) => safeRead(a[1], "setEnabledAtCell"),
    },
];
/**
 * The four footprint seeds share one lookup, so they are computed together
 * and then split out per name.
 */
function footprintSeeds(structure: unknown): Record<string, unknown> {
    const x = Number(safeRead(structure, "x")) || 0;
    const y = Number(safeRead(structure, "y")) || 0;
    let shape: ShapeMatrix | undefined;
    try {
        const type = safeRead(structure, "type");

        const lookup = api.structures.getDefinitionByType;

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

const FOOTPRINT_SEED_DOCS = {
    "structure.shape": {
        doc: "The structure's footprint matrix, 1 = occupied. 1×1 when it has no shape.",
        from: "getDefinitionByType(structure.type).shape",
    },
    "structure.matrixSize": {
        doc: "{ width, height } of the footprint, in cells.",
        from: "getDefinitionByType(structure.type).shape",
    },
    "structure.cellAt": {
        doc: "fn(mx, my) → { cellX, cellY } for a cell of the matrix. The bridge " +
            "from matrix x,y to grid x,y.",
        from: "structure.x + mx, structure.y + my",
    },
    "structure.footprint": {
        doc: "every occupied cell of the matrix, top-left to bottom-right.",
        from: "getDefinitionByType(structure.type).shape",
    },
} as const;

const FOOTPRINT_SEEDS: readonly ContextSeed[] = Object.entries(FOOTPRINT_SEED_DOCS).map((
    [name, meta],
) => ({
    name,
    doc: meta.doc,
    from: meta.from,
    read: (a: readonly unknown[]) => footprintSeeds(a[0])[name],
})); /**
 * Every seed each call site offers, keyed by call site.
 *
 * `Record<CallSite, ...>` so a new call site cannot be added to the type
 * without deciding here what it hands over.
 */

export const SCOPE_CONTEXT: Record<CallSite, readonly ContextSeed[]> = {
    processing: [...STRUCTURE_SEEDS, ...CONTEXT_SEEDS, ...FOOTPRINT_SEEDS],

    // the same structure members as processing, documented as coming from the
    // click handler rather than the process step
    signal: STRUCTURE_SEEDS.map((s) => ({ ...s, from: "handler(structure)" })),

    trigger: [],

    itemAction: [
        {
            name: "state.x",
            doc: "The item's cell X.",
            from: "handleAction(state, action)",
            read: (a) => safeRead(a[0], "x"),
        },
        {
            name: "state.y",
            doc: "The item's cell Y.",
            from: "handleAction(state, action)",
            read: (a) => safeRead(a[0], "y"),
        },
        {
            name: "action.type",
            doc: "The action being performed.",
            from: "handleAction(state, action)",
            read: (a) => safeRead(a[1], "type"),
        },
    ],

    modifier: [
        {
            name: "args",
            doc: "The intercepted arguments, as the engine passed them.",
            from: "intercept(args, ctx)",
            read: (a) => a[0],
        },
        {
            name: "ctx",
            doc: "The hook's own context.",
            from: "intercept(args, ctx)",
            read: (a) => a[1],
        },
    ],

    upgrade: [
        {
            name: "item.type",
            doc: "The upgraded item's type.",
            from: "onUpgrade(item)",
            read: (a) => safeRead(a[0], "type"),
        },
    ],

    behavior: [
        {
            name: "key",
            doc: "The key that was pressed.",
            from: "onDownKey(key) / onUpKey(key)",
            read: (a) => a[0],
        },
    ],
};

/**
 * Read every seed this call site offers.
 *
 * A seed whose reader yields `undefined` is left out, so a context that does
 * not carry a member does not advertise a seed that resolves to nothing.
 */
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
