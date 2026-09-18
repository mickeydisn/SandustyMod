/**
 * Per-offset vote masks shared by the worker profiles.
 *
 * A mask is a small row-major grid of multipliers that scales how strongly each
 * neighbour offsets the vote centroid. `Vote.mask` centre-crops/pads it into
 * the 5x5 `Sense` window, so a 3x3 mask works there unchanged; the window
 * centre is always ignored.
 *
 * Profiles look entries up by name, e.g. `mask: MASK.FULL`.
 */

/** One row of a 3x3 mask. */
export type Mask3Row = readonly [number, number, number];
/** A 3x3 mask over the 8 surrounding neighbours. */
export type Mask3 = readonly [Mask3Row, Mask3Row, Mask3Row];

/** One row of a 5x5 mask. */
export type Mask5Row = readonly [number, number, number, number, number];
/** A 5x5 mask over the full `Sense` window. */
export type Mask5 = readonly [Mask5Row, Mask5Row, Mask5Row, Mask5Row, Mask5Row];

export const MASK: Record<string, Mask3 | Mask5> = {
    // vertical neighbours
    VERT: [[0, 1, 0], [0, 0, 0], [0, 1, 0]],
    // horizontal neighbours
    SIDE: [[0, 0, 0], [1, 0, 1], [0, 0, 0]],
    // orthogonal neighbours
    CROSS: [[0, 1, 0], [1, 0, 1], [0, 1, 0]],
    // orthogonal neighbours
    PLUS: [[0, 1, 0], [1, 0, 1], [0, 1, 0]],
    // all 8 neighbours
    ALL: [[1, 1, 1], [1, 0, 1], [1, 1, 1]],
    GRAVITY: [
        [0, 0, 0, 0, 0],
        [0, 0, .5, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0.5, 0, 0],
    ],
    OUT: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 0],
    ],
    FULL: [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 0, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
    ],
};
