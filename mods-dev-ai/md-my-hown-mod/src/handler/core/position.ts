export interface Position {
    readonly x: number;
    readonly y: number;
}

export interface Offset {
    readonly dx: number;
    readonly dy: number;
}

export interface MatrixCell {
    readonly col: number;
    readonly row: number;
}

export type Range = readonly Position[];

export type ShapeMatrix = number[][];

export interface Addressable {
    x?: number;
    y?: number;
    shape?: ShapeMatrix;
}

export type Address =
    | { readonly kind: "here" }
    | { readonly kind: "offset"; readonly offset: Offset }
    | { readonly kind: "square"; readonly offset: Offset; readonly side: number }
    | { readonly kind: "footprint"; readonly shape?: ShapeMatrix }
    | { readonly kind: "matrix"; readonly cell: MatrixCell };

export interface AddressOptions {
    dx?: unknown;
    dy?: unknown;
    size?: unknown;
    footprint?: unknown;

    mx?: unknown;

    my?: unknown;
}

function int(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function shift(at: Position, by: Offset): Position {
    return { x: at.x + by.dx, y: at.y + by.dy };
}

export function shapePositions(at: Position, shape?: ShapeMatrix): Position[] {
    if (!shape || shape.length === 0) return [at];
    const out: Position[] = [];
    for (let row = 0; row < shape.length; row++) {
        const cells = shape[row] ?? [];
        for (let col = 0; col < cells.length; col++) {
            if (cells[col] === 0) continue;
            out.push(shift(at, { dx: col, dy: row }));
        }
    }
    return out;
}

export function positionsFor(address: Address, at: Position): Range {
    switch (address.kind) {
        case "here":
            return [at];
        case "offset":
            return [shift(at, address.offset)];
        case "matrix":
            return [shift(at, { dx: address.cell.col, dy: address.cell.row })];
        case "footprint":
            return shapePositions(at, address.shape);
        case "square": {
            const centre = address.offset ? shift(at, address.offset) : at;
            const low = Math.floor((address.side - 1) / 2);
            const high = Math.ceil((address.side - 1) / 2);
            const out: Position[] = [];
            for (let dy = -low; dy <= high; dy++) {
                for (let dx = -low; dx <= high; dx++) out.push(shift(centre, { dx, dy }));
            }
            return out;
        }
    }
}

export interface AddressConflict {
    readonly reason: "matrix-with-range";
    readonly message: string;
}

export type AddressResult =
    | { readonly address: Address; readonly clamped: boolean }
    | { readonly conflict: AddressConflict };

export function addressFor(
    structure: Addressable | null | undefined,
    options: AddressOptions,
    maxSide: number,
): AddressResult {
    const hasMatrix = options.mx !== undefined || options.my !== undefined;
    const size = Math.abs(int(options.size, 1));
    const wantsFootprint = options.footprint === true || options.footprint === "true";

    const dx = int(options.dx);
    const dy = int(options.dy);
    const hasOffset = dx !== 0 || dy !== 0;

    if (hasMatrix) {
        if (wantsFootprint || size > 1 || hasOffset) {
            return {
                conflict: {
                    reason: "matrix-with-range",
                    message: "Matrix X/Y names one cell of the shape matrix, but a range " +
                        "field (Offset, Region size or My whole footprint) is also " +
                        "set. Choose one: a single matrix cell, or a region.",
                },
            };
        }
        return {
            address: { kind: "matrix", cell: { col: int(options.mx), row: int(options.my) } },
            clamped: false,
        };
    }

    if (wantsFootprint) {
        return { address: { kind: "footprint", shape: structure?.shape }, clamped: false };
    }

    if (size > 1) {
        return {
            address: {
                kind: "square",
                offset: { dx: int(options.dx), dy: int(options.dy) },
                side: Math.min(size, maxSide),
            },
            clamped: size > maxSide,
        };
    }

    const offset = { dx: int(options.dx), dy: int(options.dy) };
    return {
        address: offset.dx === 0 && offset.dy === 0 ? { kind: "here" } : { kind: "offset", offset },
        clamped: false,
    };
}

export function walkFor(
    at: Position,
    structure: Addressable | null | undefined,
    options: AddressOptions,
    maxSide: number,
): { range: Range; clamped: boolean } | { conflict: AddressConflict } {
    const built = addressFor(structure, options, maxSide);
    if ("conflict" in built) return built;
    if (built.address.kind === "matrix") {
        return {
            conflict: {
                reason: "matrix-with-range",
                message: "Matrix X/Y cannot be used with a range walk: a walk already asks " +
                    "for every cell in a region. Leave it blank, or use a single-cell " +
                    "action such as isElementAtCell.",
            },
        };
    }
    return { range: positionsFor(built.address, at), clamped: built.clamped };
}

// --- Positions: the queryable view over a Range -------------------------------
//
// This used to live in `positions.ts` — one letter away from this file, holding a
// different concept (a walker over cells, not a cell) — with exactly one importer.
// It is now the lower half of the same file: `Positions` is a `Range` with methods
// on it, so splitting the two only hid that relationship.
export type CellTest = (cell: Position) => boolean;

export type CellValue = (cell: Position) => number;

export type CellVisit = (cell: Position) => void;

export interface Positions {
    readonly cells: readonly Position[];

    readonly requested: number;

    readonly clamped: boolean;

    forEach(visit: CellVisit): number;

    any(test: CellTest): boolean;

    all(test: CellTest): boolean;

    count(test: CellTest): number;

    sum(value: CellValue): number;
}

function safely(test: CellTest): CellTest {
    return (cell) => {
        try {
            return test(cell) === true;
        } catch {
            return false;
        }
    };
}

function safelyNumber(value: CellValue): CellValue {
    return (cell) => {
        try {
            const n = Number(value(cell));
            return Number.isFinite(n) ? n : 0;
        } catch {
            return 0;
        }
    };
}

export function positionsOver(range: Range, clamped = false): Positions {
    const cells = range;
    return {
        cells,
        requested: cells.length,
        clamped,
        forEach(visit) {
            for (const cell of cells) {
                try {
                    visit(cell);
                } catch {
                }
            }
            return cells.length;
        },
        any(test) {
            const safe = safely(test);
            for (const cell of cells) if (safe(cell)) return true;
            return false;
        },
        all(test) {
            const safe = safely(test);
            for (const cell of cells) if (!safe(cell)) return false;
            return true;
        },
        count(test) {
            const safe = safely(test);
            let n = 0;
            for (const cell of cells) if (safe(cell)) n++;
            return n;
        },
        sum(value) {
            const safe = safelyNumber(value);
            let total = 0;
            for (const cell of cells) total += safe(cell);
            return total;
        },
    };
}

export function singleCell(at: Position): Positions {
    return positionsOver([at]);
}
