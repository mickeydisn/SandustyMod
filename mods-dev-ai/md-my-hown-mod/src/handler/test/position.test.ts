
import { assert, assertEquals } from "https:
import {
    addressFor,
    type Offset,
    type Position,
    positionsFor,
    shapePositions,
    shift,
    walkFor,
} from "../core/position.ts";

const AT = { x: 100, y: 200 };
const MAX = 64;


function ok(
    at: Position,
    options: Record<string, unknown>,
    shape?: number[][],
) {
    
    
    
    const built = addressFor({ x: at.x, y: at.y, shape }, options, MAX);
    if ("conflict" in built) throw new Error(`unexpected conflict: ${built.conflict.message}`);
    return built;
}


function cells(
    at: Position,
    options: Record<string, unknown>,
    shape?: number[][],
): string[] {
    return positionsFor(ok(at, options, shape).address, at).map((c) => `${c.x},${c.y}`);
}

Deno.test("an offset is a delta, not a location", () => {
    
    
    assertEquals(shift(AT, { dx: 3, dy: 0 }), { x: 103, y: 200 });
    assertEquals(shift(AT, { dx: 0, dy: -1 }), { x: 100, y: 199 });
    
    
    const offset: Offset = { dx: 1, dy: 1 };
    assertEquals(Object.keys(offset), ["dx", "dy"]);
    assertEquals(Object.keys(AT), ["x", "y"]);
});

Deno.test("no options means the anchor itself", () => {
    assertEquals(cells(AT, {}), ["100,200"]);
    
    
    assertEquals(ok(AT, { dx: 0, dy: 0 }).address.kind, "here");
    assertEquals(ok(AT, { dx: 0, dy: -1 }).address.kind, "offset");
});

Deno.test("a 3×3 range contains the anchor", () => {
    assertEquals(cells(AT, { size: 3 }), [
        "99,199",
        "100,199",
        "101,199",
        "99,200",
        "100,200",
        "101,200",
        "99,201",
        "100,201",
        "101,201",
    ]);
});

Deno.test("a 1×1 range is the anchor, and size 0 is not a hole", () => {
    
    
    assertEquals(cells(AT, { size: 1 }), ["100,200"]);
    assertEquals(cells(AT, { size: 0 }), ["100,200"]);
    assertEquals(cells(AT, { size: -3 }).length, 9);
});

Deno.test("a side past the cap is capped and reported", () => {
    
    const built = ok(AT, { size: 500 });
    assertEquals(built.clamped, true);
    assertEquals(positionsFor(built.address, AT).length, 64 * 64);
    assertEquals(ok(AT, { size: 3 }).clamped, false);
});

Deno.test("a footprint is the shape's own occupied cells, row-major", () => {
    const shape = [
        [1, 1, 0],
        [1, 0, 0],
    ];
    
    
    assertEquals(shapePositions(AT, shape), [
        { x: 100, y: 200 },
        { x: 101, y: 200 },
        { x: 100, y: 201 },
    ]);
    assertEquals(cells(AT, { footprint: true }, shape), [
        "100,200",
        "101,200",
        "100,201",
    ]);
});

Deno.test("no shape at all is one cell, not none", () => {
    
    
    assertEquals(shapePositions(AT, undefined), [{ x: 100, y: 200 }]);
});

Deno.test("a matrix cell is an index into the shape, not an offset", () => {
    assertEquals(cells(AT, { mx: 2, my: 3 }), ["102,203"]);
});

Deno.test("a matrix cell conflicts with a range, and says which two fields", () => {
    
    
    for (
        const options of [
            { mx: 2, my: 3, size: 5 },
            { mx: 2, my: 3, footprint: true },
            { mx: 2, my: 3, dx: 1 },
        ]
    ) {
        const built = addressFor({ x: 100, y: 200 }, options, MAX);
        assert("conflict" in built, `${JSON.stringify(options)} should be refused`);
        if (!("conflict" in built)) continue;
        assertEquals(built.conflict.reason, "matrix-with-range");
        
        assert(/range field/.test(built.conflict.message));
    }
});

Deno.test("a blank form alongside a matrix cell is not a conflict", () => {
    
    
    
    
    const built = addressFor(
        { x: 100, y: 200 },
        { mx: 2, my: 3, dx: "0", dy: "0", size: "1", footprint: "false" },
        MAX,
    );
    assert(!("conflict" in built));
    if ("conflict" in built) return;
    assertEquals(built.address.kind, "matrix");
});

Deno.test("a walk refuses a matrix cell outright", () => {
    
    
    
    const built = walkFor(AT, { x: 100, y: 200 }, { mx: 1, my: 1 }, MAX);
    assert("conflict" in built);
    if (!("conflict" in built)) return;
    assert(/cannot be used with a range walk/.test(built.conflict.message));
});

Deno.test("a walk accepts every address that really is a range", () => {
    
    
    for (const options of [{}, { dx: 0, dy: -1 }, { size: 3 }, { footprint: true }]) {
        const built = walkFor(AT, { x: 100, y: 200 }, options, MAX);
        assert(!("conflict" in built), `${JSON.stringify(options)} should be walkable`);
        if (!("conflict" in built)) assert(built.range.length >= 1);
    }
});
