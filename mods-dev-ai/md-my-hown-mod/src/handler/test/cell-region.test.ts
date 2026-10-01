
import { assertEquals } from "https:
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
    
    
    assertEquals(cellsOf(f)[0], { x: 100, y: 200 });
    assertEquals(cellsOf(f)[3], { x: 103, y: 200 });
    assertEquals(cellsOf(f)[4], { x: 100, y: 201 });
    assertEquals(cellsOf(f)[15], { x: 103, y: 203 });
});

Deno.test("a footprint honours its mask, so an L-shape is six cells not nine", () => {
    
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
    
    
    for (const shape of [undefined, null, [], [[]]]) {
        assertEquals(cellsOf(footprint(7, 9, shape as never)), [{ x: 7, y: 9 }]);
    }
    assertEquals(shapeSize(undefined), { width: 1, height: 1 });
});

Deno.test("a ragged shape is read to its longest row", () => {
    
    
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
    
    
    
    const f = footprint(100, 200, [[1, 1], [1, 0]]);
    assertEquals(cellAt(f, 0, 0), { x: 100, y: 200 });
    assertEquals(cellAt(f, 1, 0), { x: 101, y: 200 });
    assertEquals(cellAt(f, 0, 1), { x: 100, y: 201 });
});
