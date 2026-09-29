/**
 * The shape matrix, and the anchor.
 *
 * Both are pure arithmetic over plain data — the one part that is *possible* to get
 * wrong, and the part that can be tested without a game. A transpose or an off-by-one
 * here produces a sorter that works on every structure except the one it was written
 * for, which is the hardest kind of bug to see.
 *
 * The **range** maths that used to live here — `rect`, `around`, and the cells a
 * region meant — moved to `position.ts`, where a range is a list of positions and no
 * rectangle is built at all. `position.test.ts` covers that half.
 *
 * @module
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cellAt, cellsOf, footprint, shapeSize } from "../core/cell-region.ts";

Deno.test("a 4×4 footprint is 16 cells, row-major from the origin", () => {
    const shape = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
    ];
    const f = footprint(100, 200, shape);
    assertEquals(shapeSize(shape), { width: 4, height: 4 });
    assertEquals(cellsOf(f).length, 16);
    // Row-major: the first cell is top-left, the last is bottom-right. A transpose would
    // still give 16 cells and look correct until the author noticed.
    assertEquals(cellsOf(f)[0], { x: 100, y: 200 });
    assertEquals(cellsOf(f)[3], { x: 103, y: 200 });
    assertEquals(cellsOf(f)[4], { x: 100, y: 201 });
    assertEquals(cellsOf(f)[15], { x: 103, y: 203 });
});

Deno.test("a footprint honours its mask, so an L-shape is six cells not nine", () => {
    // The difference between a footprint and its bounding box, stated as a number.
    const L = [
        [1, 1, 0],
        [1, 0, 0],
        [1, 1, 1],
    ];
    assertEquals(shapeSize(L), { width: 3, height: 3 });
    assertEquals(cellsOf(footprint(0, 0, L)), [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
    ]);
});

Deno.test("a structure with no shape is 1×1 at its own cell", () => {
    // Not an error and not empty. Most structures are a single tile, and a footprint
    // action that did nothing on them would be silently dead.
    for (const shape of [undefined, null, [], [[]]]) {
        assertEquals(cellsOf(footprint(7, 9, shape as never)), [{ x: 7, y: 9 }]);
    }
    assertEquals(shapeSize(undefined), { width: 1, height: 1 });
});

Deno.test("a ragged shape is read to its longest row", () => {
    // `shape` is typed `number[][]`, so uneven rows are legal. Reading only the first
    // row would drop the bottom-right cell of this one entirely.
    const ragged = [[1, 1, 1], [1]];
    assertEquals(shapeSize(ragged), { width: 3, height: 2 });
    assertEquals(cellsOf(footprint(0, 0, ragged)), [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
    ]);
});

Deno.test("cellAt is the mask position, in grid cells", () => {
    // The mask→cell direction. It uses the same row-major index as the mask, and
    // getting it backwards puts a machine's north-east cell in its south-west corner —
    // so the origin is asserted, not just the deltas.
    const f = footprint(100, 200, [[1, 1], [1, 0]]);
    assertEquals(cellAt(f, 0, 0), { x: 100, y: 200 });
    assertEquals(cellAt(f, 1, 0), { x: 101, y: 200 });
    assertEquals(cellAt(f, 0, 1), { x: 100, y: 201 });
});
