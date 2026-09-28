/**
 * The region maths, and the seven actions built on it.
 *
 * The region is pure arithmetic, so it is tested as arithmetic — a transpose or an
 * off-by-one here would produce a sorter that works on every structure except the one
 * it was written for, which is the hardest kind of bug to see.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    areaOf,
    around,
    cellAt,
    cellsOf,
    contains,
    footprint,
    isOccupied,
    maskAt,
    occupiedCount,
    rect,
    shapeSize,
} from "../core/cell-region.ts";

// ── rect ──────────────────────────────────────────────────────────────────────

Deno.test("a rect is every cell it says it is", () => {
    const r = rect(10, 20, 3, 2);
    assertEquals(r.width, 3);
    assertEquals(r.height, 2);
    assertEquals(areaOf(r), 6);
    assertEquals(occupiedCount(r), 6);
    assertEquals(cellsOf(r), [
        { x: 10, y: 20 },
        { x: 11, y: 20 },
        { x: 12, y: 20 },
        { x: 10, y: 21 },
        { x: 11, y: 21 },
        { x: 12, y: 21 },
    ]);
});

Deno.test("a degenerate rect is empty, not an exception", () => {
    // Panel options arrive as strings, and a half-filled field is `""` or `0`. The
    // engine must never be asked about a cell that cannot exist.
    assertEquals(areaOf(rect(0, 0, 0, 5)), 0);
    assertEquals(cellsOf(rect(0, 0, -3, 3)), []);
    assertEquals(areaOf(rect(0, 0, NaN, NaN)), 0);
    assertEquals(cellsOf(rect(0, 0, Infinity, 2)), []);
});

// ── around ────────────────────────────────────────────────────────────────────

Deno.test("around is centred, and even sides keep the named cell at the origin", () => {
    // The case that decides the tie-break: size 1 must be exactly one cell, at the
    // cell the author named.
    assertEquals(cellsOf(around(5, 5, 1)), [{ x: 5, y: 5 }]);
    // 3 → one back, one forward, in both axes.
    assertEquals(cellAt(around(5, 5, 3), 0, 0), { x: 4, y: 4 });
    assertEquals(cellAt(around(5, 5, 3), 2, 2), { x: 6, y: 6 });
    assertEquals(areaOf(around(5, 5, 3)), 9);
    // 2 has no centre. The extra cell goes right/down, so the origin stays put.
    assertEquals(cellsOf(around(5, 5, 2)), [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, {
        x: 6,
        y: 6,
    }]);
});

// ── footprint ────────────────────────────────────────────────────────────────

Deno.test("a 4x4 footprint is 16 cells, row-major from the origin", () => {
    // The 4×4 case from the brief, and the indexing that has to be right for it.
    const shape = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
    ];
    const f = footprint(100, 200, shape);
    assertEquals(shapeSize(shape), { width: 4, height: 4 });
    assertEquals(areaOf(f), 16);
    assertEquals(cellsOf(f).length, 16);
    // Row-major: the first cell is top-left, the last is bottom-right. A transpose
    // would still give 16 cells and look correct until the author noticed.
    assertEquals(cellsOf(f)[0], { x: 100, y: 200 });
    assertEquals(cellsOf(f)[3], { x: 103, y: 200 });
    assertEquals(cellsOf(f)[4], { x: 100, y: 201 });
    assertEquals(cellsOf(f)[15], { x: 103, y: 203 });
});

Deno.test("a footprint honours its mask, so an L-shape is five cells not nine", () => {
    // The difference between a footprint and its bounding box, stated as a number.
    const L = [
        [1, 1, 0],
        [1, 0, 0],
        [1, 1, 1],
    ];
    const f = footprint(0, 0, L);
    assertEquals(shapeSize(L), { width: 3, height: 3 });
    assertEquals(areaOf(f), 9);
    assertEquals(occupiedCount(f), 6);
    assertEquals(cellsOf(f), [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
    ]);
    assert(isOccupied(f, 2, 0) === false, "the notch is not part of the structure");
    assert(isOccupied(f, 2, 2) === true);
});

Deno.test("a structure with no shape is 1x1 at its own cell", () => {
    // Not an error and not empty. Most structures are a single tile, and a
    // footprint action that did nothing on them would be silently dead.
    for (const shape of [undefined, null, [], [[]]]) {
        const f = footprint(7, 9, shape as never);
        assertEquals(cellsOf(f), [{ x: 7, y: 9 }]);
    }
});

Deno.test("a ragged shape is read to its longest row", () => {
    // `shape` is typed `number[][]`, so uneven rows are legal. Reading only the
    // first row would drop the bottom-right cell of this one entirely.
    const f = footprint(0, 0, [[1, 1, 1], [1]]);
    assertEquals(shapeSize([[1, 1, 1], [1]]), { width: 3, height: 2 });
    assertEquals(occupiedCount(f), 4);
    assertEquals(isOccupied(f, 2, 1), false, "the missing cell is unoccupied, not skipped");
});

// ── the two conversions ───────────────────────────────────────────────────────

Deno.test("cellAt and maskAt are inverses, and round-trip through the origin", () => {
    const f = footprint(100, 200, [[1, 1], [1, 0]]);
    for (let col = 0; col < f.width; col++) {
        for (let row = 0; row < f.height; row++) {
            const cell = cellAt(f, col, row);
            const back = maskAt(f, cell.x, cell.y);
            assertEquals(back, { col, row });
        }
    }
    // One cell outside on each side, in both axes.
    for (const [x, y] of [[99, 200], [102, 200], [100, 199], [100, 202]]) {
        assertEquals(maskAt(f, x, y), undefined, `${x},${y} is outside`);
    }
});

Deno.test("contains and isOccupied answer different questions", () => {
    const f = footprint(0, 0, [[1, 0]]);
    assertEquals(contains(f, 1, 0), true, "in the rectangle");
    assertEquals(isOccupied(f, 1, 0), false, "but not in the shape");
    assertEquals(contains(f, 5, 0), false);
});
