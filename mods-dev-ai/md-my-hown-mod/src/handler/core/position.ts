/**
 * POSITION — the type a cell is, and the ways to name a set of them.
 *
 * A `dx` of `3` and a `Position.x` of `3` are the same `number`, which is why the
 * parameters used to drift apart: nothing stopped a field meaning one thing here and
 * another there, and both render as "3" in the panel. So the three things that are
 * *not* the same are three types that cannot be confused, by shape:
 *
 * | type         | fields       | means                        |
 * | ------------ | ------------ | ---------------------------- |
 * | `Position`   | `x`/`y`      | an absolute cell on the grid |
 * | `Offset`     | `dx`/`dy`    | a **delta** from elsewhere   |
 * | `MatrixCell` | `col`/`row`  | one cell of a shape matrix   |
 *
 * "The cell 3 to the left" and "the cell at x=3" are different questions, and a type is
 * cheaper than a comment saying so.
 *
 * `Range` is `readonly Position[]` and nothing else. A `CellRegion` rectangle used to
 * be the representation, but it was a *description* of cells and every consumer turned
 * it back into a list — `motion/` kept its own copy of that conversion, and the two were
 * free to drift. The rectangle now survives only in `cell-region.ts`, for the
 * `structure.*` seeds that genuinely publish a mask.
 *
 * @module
 */

/** An absolute cell on the grid. The origin is the top-left cell. */
export interface Position {
    readonly x: number;
    readonly y: number;
}

/**
 * A **delta**, never an absolute location.
 *
 * `Offset` answers "how far from here"; `Position` answers "where". Keeping them
 * apart is what stops a relative field being read as an absolute one — the bug that
 * put an item action at `(0, 0)` when its payload had no `x` and the cursor was the
 * real answer.
 */
export interface Offset {
    readonly dx: number;
    readonly dy: number;
}

/**
 * One cell of a structure's shape matrix, counted from its top-left.
 *
 * Distinct from `Position` because it is an **index**, not a location: matrix `(2, 3)`
 * is the cell at `anchor.x + 2, anchor.y + 3`, and mixing the two up is a one-cell
 * bug that looks like a working feature.
 */
export interface MatrixCell {
    readonly col: number;
    readonly row: number;
}

/** A set of cells, in the order they should be visited. */
export type Range = readonly Position[];

/** The engine's footprint matrix, as written in `StructureDefinition.shape`. */
export type ShapeMatrix = number[][];

/** A structure, as far as addressing is concerned. */
export interface Addressable {
    x?: number;
    y?: number;
    shape?: ShapeMatrix;
}

/**
 * Where an action works, named rather than implied.
 *
 * The `kind` is load-bearing: it is what lets `addressFor` reject two modes at once,
 * and it lets a consumer refuse a mode it does not support — a walk refuses `matrix`
 * outright, because "the one cell at matrix 2,3" and "every cell in a range" are not
 * two settings of the same question.
 *
 * An `Address` is **relative**: "the cell one above me", not a location. That is why
 * `positionsFor` takes the anchor separately and `addressFor` does not.
 */
export type Address =
    /** The anchor itself. The default, and why every action works with no options. */
    | { readonly kind: "here" }
    /** One cell, `offset` away from the anchor. */
    | { readonly kind: "offset"; readonly offset: Offset }
    /** A `side`×`side` square centred on `offset` from the anchor. */
    | { readonly kind: "square"; readonly offset: Offset; readonly side: number }
    /** Every occupied cell of the anchor structure's own shape. */
    | { readonly kind: "footprint"; readonly shape?: ShapeMatrix }
    /** One named cell of the anchor structure's shape matrix. */
    | { readonly kind: "matrix"; readonly cell: MatrixCell };

/** The options an address is built from: the addressing fields, and nothing else. */
export interface AddressOptions {
    dx?: unknown;
    dy?: unknown;
    size?: unknown;
    footprint?: unknown;
    /** Matrix column. Refused alongside any range field — see `addressFor`. */
    mx?: unknown;
    /** Matrix row. Refused alongside any range field. */
    my?: unknown;
}

/** A whole number, or `fallback`. `NaN` must never become a cell. */
function int(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Move a position by an offset, producing a new one. */
export function shift(at: Position, by: Offset): Position {
    return { x: at.x + by.dx, y: at.y + by.dy };
}

/**
 * The cells of a shape matrix, as positions relative to `at`.
 *
 * Row-major, because `shape` is row-major — `cell-region.ts` explains why a transpose
 * would silently rotate every structure the mod ships. A missing row is treated as
 * empty and a short row stops at its own length, because a ragged matrix is the
 * engine's own shape rather than an error to paper over.
 *
 * **An absent shape is one cell, not none.** A structure with no `shape` is a 1×1
 * machine, so "every cell of my footprint" must mean its own cell. Returning `[]`
 * would make `footprint: true` on such a structure answer `0` from every counter,
 * which reads as "this machine covers nothing" — and it covers exactly one.
 */
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

/**
 * The cells an address names.
 *
 * No clamping happens here — the side was already capped by `addressFor`, and the
 * caller is told. Doing it in one place means a walk can never be capped at a
 * different size from the one the panel's `max: 64` advertises, which would let an
 * author ask for 64 and quietly receive something else.
 */
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
            // Even sides keep the anchor **inside** the square, biased up and left, so
            // "3×3 around me" contains my own cell. A 4×4 that started one row above
            // would put the machine in the corner of its own region.
            //
            // The offset is applied to the **centre** before the grid is built, not
            // after. It used to be dropped entirely: `addressFor` puts `dx`/`dy` in
            // `offset` and this case read only `side`, so "3×3, one cell right"
            // silently produced the same 3×3 as "3×3, here" — and a config that
            // aimed a region at part of a 4×4 footprint got the wrong nine cells
            // with nothing reported. The `offset` kind honours `dx`/`dy` on its own,
            // which is why the omission survived: `size: 1` worked, and that is
            // the shape almost every action in the catalogue defaults to.
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

/**
 * Why an address could not be built, when the options contradict each other.
 *
 * A named failure rather than a boolean, because the panel shows it and an author
 * has to be told *which* two fields disagreed.
 */
export interface AddressConflict {
    readonly reason: "matrix-with-range";
    readonly message: string;
}

/** The answer of `addressFor`: either an address, or a reported conflict. */
export type AddressResult =
    | { readonly address: Address; readonly clamped: boolean }
    | { readonly conflict: AddressConflict };

/**
 * Build the address a set of options names.
 *
 * ## The conflict rule
 *
 * `mx`/`my` address a **cell of the shape matrix**; `dx`/`dy`/`size`/`footprint` address
 * a **region**. Different axes — and the old chain of `if`s let the matrix branch win
 * unconditionally, so a form with "Matrix X = 2" *and* "Region size = 5" produced one
 * cell and reported success. That is the worst failure mode here, because the action
 * still ran and the author still saw no error.
 *
 * So a contradictory fill returns `conflict` and nothing guesses. Every consumer
 * refuses it, for the same reason: the author's two fields disagree about which cell
 * they meant, and the only honest answer is to say so.
 *
 * ## Why `size` needs care
 *
 * `size: 0` and an absent `size` both mean "the anchor itself", and a negative value is
 * read as its absolute value — a sign error in a number field should not turn "the cell
 * above me" into "a 5×5 somewhere below". The side is capped at `maxSide` and **the
 * caller is told**, because a `count` over a silently truncated range is a wrong number
 * rather than a slow one.
 */
export function addressFor(
    structure: Addressable | null | undefined,
    options: AddressOptions,
    maxSide: number,
): AddressResult {
    const hasMatrix = options.mx !== undefined || options.my !== undefined;
    const size = Math.abs(int(options.size, 1));
    const wantsFootprint = options.footprint === true || options.footprint === "true";
    // A range field only *counts* when it says something other than its default.
    //
    // The panel writes every field it renders, so a config that only ever set `mx` still
    // carries `dx: "0"`, `size: "1"` and `footprint: "false"`. Testing *presence* instead
    // of meaning made every one of those report a conflict and refuse — breaking the
    // exact case the rule exists to protect.
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
        // `here` rather than a zero offset, so a consumer can tell "the anchor itself"
        // from "an offset that happens to be zero" without re-comparing the numbers.
        address: offset.dx === 0 && offset.dy === 0 ? { kind: "here" } : { kind: "offset", offset },
        clamped: false,
    };
}

/**
 * Resolve options to a walkable range, or explain why not.
 *
 * The one place a range is built for an action, and it refuses `matrix` for the
 * reason `addressFor`'s union exists: a walk over a single named cell is a
 * contradiction. It is not an error the caller should have to police — `logicForEach`
 * and every `count*` would each need the same check, and one of them would eventually
 * be forgotten.
 */
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
