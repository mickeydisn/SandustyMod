/**
 * A **finite list of positions**, and the only five ways to walk one.
 *
 * A process is a list of steps run in order, and this is the *only* iteration it can
 * do. There is no `while`, no interruptible `find` and no recursion, because arbitrary
 * control flow in a **tick handler** is how a mod hangs a game: one wrong comparison
 * is not a bug report, it is a frozen process the author cannot see.
 *
 * | method    | answers                         |
 * | --------- | ------------------------------- |
 * | `forEach` | "do this at every cell"         |
 * | `any`     | "does **any** cell hold this"   |
 * | `all`     | "do **all** cells hold this"    |
 * | `count`   | "how **many** cells hold this"  |
 * | `sum`     | "what do these cells add up to" |
 *
 * The names are a collection's, because this is one, and the short-circuiting is
 * inherited rather than invented: a test that could not stop would make cost depend
 * on the data, which is what turns a large range into a hang.
 *
 * `clamped` travels with the list because a count over a silently-truncated range is a
 * wrong number rather than a slow one, and the author has no other way to know.
 *
 * @module
 */

import type { Position, Range } from "./position.ts";

/** A predicate over one position. */
export type CellTest = (cell: Position) => boolean;

/** A number taken from one position. Non-finite is treated as 0. */
export type CellValue = (cell: Position) => number;

/** Something done at one position. Its return value is ignored. */
export type CellVisit = (cell: Position) => void;

/**
 * A bounded list of positions, and the only five ways to walk one.
 *
 * It is built from a `Range` — a plain `readonly Position[]` — so there is no second
 * representation of "which cells" left to disagree with. The mask, the origin and
 * the side all belong to `position.ts`'s `Address`, and they have already been
 * resolved by the time a `Range` exists.
 */
export interface Positions {
    /** The positions, in the order they should be visited. */
    readonly cells: readonly Position[];
    /** How many the author asked for. Differs from `cells.length` only after a cap. */
    readonly requested: number;
    /** Whether the range was capped, so the answer covers less than was asked for. */
    readonly clamped: boolean;
    /** Cells visited. Returns the count, so `forEach` reports the work it did. */
    forEach(visit: CellVisit): number;
    /** Stops at the first cell that passes. */
    any(test: CellTest): boolean;
    /** Stops at the first cell that fails. `all` over nothing is `true`. */
    all(test: CellTest): boolean;
    /** How many cells pass. */
    count(test: CellTest): number;
    /** The total of `value` over every cell. */
    sum(value: CellValue): number;
}

/** A predicate that never throws, so one bad cell cannot end a walk early. */
function safely(test: CellTest): CellTest {
    return (cell) => {
        try {
            return test(cell) === true;
        } catch {
            return false;
        }
    };
}

/** A number that is safe to add: one `NaN` would poison an entire sum. */
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

/**
 * Build the walkable list from a `Range`.
 *
 * `cells` is the array it was handed, and that array is **private to this list**:
 * every producer in `position.ts` allocates a fresh one, so no two `Positions` can
 * share a cell array. A copy was tempting and was not needed — nothing here mutates
 * `cells`, and the one place a caller could have reached it (`forEach`'s visit) only
 * ever receives one position at a time.
 */
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
                    // One cell's failure is that cell's. The walk continues, because a
                    // region of 64×64 that stops at the first bad cell silently answers
                    // a question about 1 cell instead of 4096.
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

/** A one-cell walk. The degenerate range, and what a bare offset resolves to. */
export function singleCell(at: Position): Positions {
    return positionsOver([at]);
}
