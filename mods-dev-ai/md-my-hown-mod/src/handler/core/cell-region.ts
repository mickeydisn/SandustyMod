/**
 * The shape **matrix**, and the one place that asks the engine where it is.
 *
 * This used to own "which cells does this mean" — a rectangle with a mask that four
 * action families all took. That moved to `position.ts`, which resolves an `Address`
 * straight to a list of positions with no rectangle in between.
 *
 * What is left is what a rectangle was still genuinely needed for: the mask, for the
 * `structure.*` context seeds (a flat list would lose the holes that make an L-shaped
 * structure an L), and `anchorFor`, the only code in the action system that asks the
 * engine where the current call site is.
 *
 * @module
 */

import { hostNs } from "./types.ts";

/** One cell. `x`/`y` are absolute **grid** cells, never matrix coordinates. */
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

/** A whole number within a bound, or 0. `NaN` is never a cell and never a side. */
function sane(value: number, max: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
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
export function footprint(x: number, y: number, shape?: ShapeMatrix | null): CellRegion {
    if (!Array.isArray(shape) || shape.length === 0) {
        return { x, y, width: 1, height: 1, mask: [[1]] };
    }
    // A ragged matrix is the engine's own shape, not an error: a row that stops early
    // is a row with fewer cells, and a hole is a cell the structure does not occupy.
    const width = sane(Math.max(...shape.map((r) => (Array.isArray(r) ? r.length : 0))), MAX_SCAN_SIDE);
    // A shape with no width at all — `[[]]`, or a row of nothing — describes a machine
    // that occupies a cell, so it gets the same 1×1 every shape-less structure does.
    // Without this the mask would be empty and every counter would answer 0.
    if (width === 0) return { x, y, width: 1, height: 1, mask: [[1]] };
    const height = sane(shape.length, MAX_SCAN_SIDE);
    const mask = Array.from({ length: height }, (_, row) => {
        const cells = shape[row];
        return Array.from(
            { length: width },
            (_, col) => (Array.isArray(cells) ? Number(cells[col]) || 0 : 0),
        );
    });
    return { x, y, width, height, mask };
}

/**
 * A matrix's size, read to its longest row.
 *
 * A ragged matrix is read to its **longest** row because that is the box it actually
 * spans; reading to the first would report a narrower box for an L than it is.
 */
export function shapeSize(shape: ShapeMatrix | undefined | null): Size {
    const region = footprint(0, 0, shape);
    return { width: region.width, height: region.height };
}

/**
 * The absolute cell for a mask position.
 *
 * The mask→cell direction. Exported because it is the one conversion a caller cannot
 * do safely by hand: it uses the same row-major index as the mask, and getting it
 * backwards puts a machine's north-east cell in its south-west corner.
 */
export function cellAt(region: CellRegion, col: number, row: number): Cell {
    return { x: region.x + col, y: region.y + row };
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
            if (region.mask[row]?.[col] !== 0) out.push(cellAt(region, col, row));
        }
    }
    return out;
}

// ── The position resolver ────────────────────────────────────────────────────
//
// Added because four families each re-derived "where am I" on their own, and every
// one of them read `payload.x` / `payload.y` directly. That works for a structure
// (`process(structure, context)` hands one over) and **silently resolves to (0,0) for
// an item**, because `handleAction(state, action)` hands over the engine *state* — the
// cursor position lives at `state.session.input.mouse.cellPosition`, not at `state.x`.
// The four resolvers were the reason "a Tool cannot dig where the player is pointing"
// was a structural fact rather than a bug report.

/** A resolved cell. `ok: false` means the call site could not tell us where it is. */
export interface Anchor {
    x: number;
    y: number;
    /** Where the value came from. For the panel's "where does this come from" column. */
    source: "payload" | "cursor" | "none";
}

/** A number, or `undefined` when it is not one. `NaN` is never a cell. */
function coord(value: unknown): number | undefined {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * The cell this process is anchored at: payload first, cursor second, and an honest
 * "no anchor" otherwise.
 *
 * The cursor is not a fallback for convenience, it is the **only** path an item use
 * has: `handleAction(state, action)` hands over the engine *state*, whose `x`/`y` do
 * not exist — the pointer is recorded at `state.session.input.mouse.cellPosition`.
 * `input.d.ts:37` documents `getMouseCellPosition()` as "the cell under the cursor",
 * and the three shipping mods that dig from a hotbar tool all read it.
 *
 * `source` is returned rather than discarded because the panel shows it: "it dug the
 * wrong cell" is a different bug to chase when the list says `cursor` than when it says
 * `payload`.
 *
 * Not `(0, 0)` on failure. Silently treating "I do not know where I am" as "I am at the
 * origin" is how a process ends up writing to the top-left corner of the map and
 * reporting success — so the caller gets `source: "none"` and must refuse.
 *
 * The cursor lookup is guarded twice: `hostNs` for a missing namespace, and a `try` for
 * a host that throws on a call it cannot serve. An anchor is on the path of every cell
 * action, so it must not be the thing that takes down a tick.
 */
export function anchorFor(payload: unknown): Anchor {
    const x = coord(readProp(payload, "x"));
    const y = coord(readProp(payload, "y"));
    if (x !== undefined && y !== undefined) return { x, y, source: "payload" };

    try {
        const cursor = hostNs("input")?.getMouseCellPosition?.();
        const cx = coord(readProp(cursor, "x"));
        const cy = coord(readProp(cursor, "y"));
        if (cx !== undefined && cy !== undefined) return { x: cx, y: cy, source: "cursor" };
    } catch {
        // A thread with no pointer. Falls through to "no anchor" below, which is the
        // honest answer: this call site really cannot say where it is.
    }
    return { x: 0, y: 0, source: "none" };
}

/**
 * A property read, tolerating a host object that throws on access.
 *
 * The same defensive read `scope-context.ts` needs, for the same reason: the payload
 * is the engine's own object, and a getter that throws must not escape into a tick.
 */
function readProp(source: unknown, key: string): unknown {
    if (source === null || (typeof source !== "object" && typeof source !== "function")) {
        return undefined;
    }
    try {
        return (source as Record<string, unknown>)[key];
    } catch {
        return undefined;
    }
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
