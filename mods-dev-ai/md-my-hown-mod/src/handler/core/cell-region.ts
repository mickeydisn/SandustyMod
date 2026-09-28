/**
 * Rectangles of cells: the one shape every element action is expressed in.
 *
 * ## Why a region, and not a pair of coordinates
 *
 * The first element actions were written as "the cell above the structure" and "the
 * cell below it" — `processorLift` and `processorConvert` still are. That works for
 * exactly two cells and cannot be parameterised, which is why every new behaviour
 * wanted a new *action* instead of a new *option*.
 *
 * A **region** is a rectangle of cells with an origin and a size. It is the shape
 * three separate things all turned out to need:
 *
 * 1. **An offset** — "the cell above me" is a 1×1 region at `(x, y-1)`.
 * 2. **A structure's footprint** — `StructureDefinition.shape` is a `number[][]`, and
 *    a 4×4 structure is a 4×4 region plus an occupancy mask.
 * 3. **A neighbourhood** — "count water in the 5×5 around me" is a region too.
 *
 * So one type covers all three, and `rect`, `around` and `footprint` are three ways
 * to build it. An action written against `CellRegion` works unchanged on all three,
 * which is the property that makes *atomic element actions work on a matrix*.
 *
 * ## The origin is the region's top-left, in **grid** cells
 *
 * Not matrix coordinates. `footprint()` converts, so a caller never has to know that
 * matrix `(1, 2)` and cell `(x+1, y+2)` are one place expressed twice.
 *
 * ## Nothing here touches the engine
 *
 * Pure arithmetic over plain data. Deliberate: this is the part that is *possible* to
 * get wrong, and it can be tested without a game.
 *
 * @module
 */

/** One cell. `x`/`y` are absolute grid cells. */
export interface Cell {
    x: number;
    y: number;
}

/**
 * A rectangle of cells, plus the mask of which are occupied.
 *
 * `mask[row][col]` corresponds to the cell at `(x + col, y + row)` — **row-major**,
 * because `shape` is row-major and transposing it would silently rotate every
 * structure the mod ships. The indexing is spelled out here and asserted in the test,
 * because a transpose is the kind of bug that looks like a working feature.
 */
export interface CellRegion {
    /** Grid X of the leftmost cell. */
    x: number;
    /** Grid Y of the topmost cell. */
    y: number;
    /** Columns. */
    width: number;
    /** Rows. */
    height: number;
    /**
     * `mask[row][col]` — `1` occupied, `0` free. Always present, so a region from a
     * structure with no `shape` and a plain rectangle behave identically downstream.
     */
    mask: number[][];
}

/** The engine's footprint matrix, as written in `StructureDefinition.shape`. */
export type ShapeMatrix = number[][];

/** A size, as the engine's `render.size` spells it. */
export interface Size {
    width: number;
    height: number;
}

/** Nothing here allocates a region with a non-positive or non-finite side. */
function sane(width: number, height: number): { width: number; height: number } {
    return {
        width: Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0,
        height: Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0,
    };
}

/** A mask with every cell occupied. */
function fullMask(width: number, height: number): number[][] {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => 1));
}

/**
 * A plain rectangle of cells, every one occupied.
 *
 * The default way to build a region. `width`/`height` are clamped rather than
 * rejected, because they usually come from panel options where `0` means "the author
 * has not set this yet" and an exception would take down a processing tick.
 */
export function rect(
    x: number,
    y: number,
    width: number,
    height: number,
    mask?: number[][],
): CellRegion {
    const size = sane(width, height);
    return {
        x: Math.floor(Number.isFinite(x) ? x : 0),
        y: Math.floor(Number.isFinite(y) ? y : 0),
        width: size.width,
        height: size.height,
        mask: mask ?? fullMask(size.width, size.height),
    };
}

/**
 * A square region **centred** on a cell.
 *
 * Centred because "the 5×5 around me" means that, and the alternative — an origin plus
 * a size — makes the author do arithmetic to say "around".
 *
 * An **even** size has no centre, and cells are not points, so the choice is
 * arbitrary. One extra cell goes to the **right/below**, so `around(x, y, 2)` is
 * `[x, x+1]` rather than `[x-1, x]` and the origin stays the cell the author named —
 * which keeps `around(0, 0, 1)` at exactly one cell, the case that would otherwise be
 * ambiguous.
 */
export function around(cx: number, cy: number, size: number): CellRegion {
    const n = sane(size, size).width;
    if (n <= 0) return rect(cx, cy, 0, 0);
    const back = Math.floor((n - 1) / 2);
    // The forward extent is `n - 1 - back`, and `n` already covers it — a region of
    // side `n` starting `back` cells back reaches exactly `forward` cells ahead.
    return rect(cx - back, cy - back, n, n);
}

/**
 * A structure's own footprint, as a region.
 *
 * `shape` is optional in the engine, and a structure with none is a **1×1 region at
 * its own cell** — not an error, and not an empty region. A single-tile structure is
 * the common case (every `unlockNode`, every conveyor segment), and refusing to read it
 * would mean the footprint actions silently did nothing on most structures.
 *
 * A ragged `shape` (rows of differing length) is read up to the **longest** row, with
 * short rows padded as unoccupied. The engine type is `number[][]`, which permits it;
 * reading only the first row would drop cells off an L-shaped structure.
 *
 * `[[]]` — one row, no columns — is the one degenerate shape, and it resolves to a
 * 1×1 region for the same reason a missing shape does. A declared shape of "nothing
 * here" means the author wrote the field without filling it, and treating that as a
 * structure occupying **no** cell would make every footprint action on it a silent
 * no-op; one cell is the reading that keeps the action alive. It is a judgement call
 * about a malformed input, so it is stated rather than left to the reader.
 */
export function footprint(
    originX: number,
    originY: number,
    shape: ShapeMatrix | undefined | null,
): CellRegion {
    if (!Array.isArray(shape) || shape.length === 0) return rect(originX, originY, 1, 1);
    const width = Math.max(...shape.map((row) => (Array.isArray(row) ? row.length : 0)));
    const height = shape.length;
    if (width === 0) return rect(originX, originY, 1, 1);
    const mask: number[][] = shape.map((row) =>
        Array.from(
            { length: width },
            (_, col) => (Array.isArray(row) ? Number(row[col]) || 0 : 0),
        )
    );
    return { x: originX, y: originY, width, height, mask };
}

/** The size of a shape, without keeping the region. For the panel's context list. */
export function shapeSize(shape: ShapeMatrix | undefined | null): Size {
    const region = footprint(0, 0, shape);
    return { width: region.width, height: region.height };
}

/** Whether `(col, row)` is inside the region at all. */
export function contains(region: CellRegion, col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < region.width && row < region.height;
}

/** Whether `(col, row)` is inside **and** its mask bit is set. */
export function isOccupied(region: CellRegion, col: number, row: number): boolean {
    if (!contains(region, col, row)) return false;
    return region.mask[row]?.[col] !== 0;
}

/**
 * The absolute cell for a mask position.
 *
 * The mask→cell direction. Exported because it is the one conversion a caller cannot
 * do safely by hand; `maskAt` below is its inverse.
 */
export function cellAt(region: CellRegion, col: number, row: number): Cell {
    return { x: region.x + col, y: region.y + row };
}

/**
 * The mask position for an absolute cell, or `undefined` if it is outside.
 *
 * Used to answer "is this cell part of me?", which is cheaper than materialising the
 * region just to test membership.
 */
export function maskAt(
    region: CellRegion,
    cellX: number,
    cellY: number,
): { col: number; row: number } | undefined {
    const col = cellX - region.x;
    const row = cellY - region.y;
    return contains(region, col, row) ? { col, row } : undefined;
}

/**
 * Every **occupied** cell, row-major.
 *
 * Row-major to match the mask, so index `n` is "the n-th occupied cell, top-left to
 * bottom-right" — the order an author sees the footprint in the panel.
 *
 * This allocates once per call. Fine at the sizes a structure occupies; not at a map
 * scale — which is why the count actions cap their side length.
 */
export function cellsOf(region: CellRegion): Cell[] {
    const out: Cell[] = [];
    for (let row = 0; row < region.height; row++) {
        for (let col = 0; col < region.width; col++) {
            if (isOccupied(region, col, row)) out.push(cellAt(region, col, row));
        }
    }
    return out;
}

/** How many cells the region covers, occupied or not. */
export function areaOf(region: CellRegion): number {
    return region.width * region.height;
}

/** How many of the region's cells are occupied. The footprint's real size. */
export function occupiedCount(region: CellRegion): number {
    let n = 0;
    for (let row = 0; row < region.height; row++) {
        for (let col = 0; col < region.width; col++) if (isOccupied(region, col, row)) n++;
    }
    return n;
}

/**
 * The largest side a **scan** action will walk.
 *
 * A cap, not a style choice: `countElements` over a 200×200 region is 40,000 engine
 * calls on a tick the author set to 100 ms, and the result is a process that looks
 * like it hangs the game. The scan actions clamp to this **and report the clamp**,
 * because a count that quietly covered less than the author asked for is a wrong
 * answer dressed as a right one.
 */
export const MAX_SCAN_SIDE = 64;
