/**
 * The typed position vocabulary, and the one rule that made it necessary.
 *
 * `Position` / `Offset` / `MatrixCell` are three shapes that cannot be confused, and
 * `Address` is a union that cannot be built from contradictory options. Both claims
 * are testable without a game, which is why they live in their own module.
 *
 * @module
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    addressFor,
    type Offset,
    type Position,
    positionsFor,
    shift,
    shapePositions,
    walkFor,
} from "../core/position.ts";

const AT = { x: 100, y: 200 };
const MAX = 64;

/** Resolve, asserting that it did not conflict. */
function ok(
    at: Position,
    options: Record<string, unknown>,
    shape?: number[][],
) {
    // The shape is read off the **structure**, not the options — a footprint is a
    // property of the machine, and a form that carried its own `shape` would let an
    // author count cells the structure does not actually occupy.
    const built = addressFor({ x: at.x, y: at.y, shape }, options, MAX);
    if ("conflict" in built) throw new Error(`unexpected conflict: ${built.conflict.message}`);
    return built;
}

/** The cells an address names, as `"x,y"` so a failure is readable. */
function cells(
    at: Position,
    options: Record<string, unknown>,
    shape?: number[][],
): string[] {
    return positionsFor(ok(at, options, shape).address, at).map((c) => `${c.x},${c.y}`);
}

Deno.test("an offset is a delta, not a location", () => {
    // The distinction the module exists for: `dx: 3` is three cells *from here*, and
    // there is no way to read it as "the cell at x=3".
    assertEquals(shift(AT, { dx: 3, dy: 0 }), { x: 103, y: 200 });
    assertEquals(shift(AT, { dx: 0, dy: -1 }), { x: 100, y: 199 });
    // A `Position` is not an `Offset` — enforced by shape, not by comment, so this is
    // a compile-time fact rather than a promise.
    const offset: Offset = { dx: 1, dy: 1 };
    assertEquals(Object.keys(offset), ["dx", "dy"]);
    assertEquals(Object.keys(AT), ["x", "y"]);
});

Deno.test("no options means the anchor itself", () => {
    assertEquals(cells(AT, {}), ["100,200"]);
    // A zero offset gives the same answer under a different name, so a consumer can
    // tell "here" from "an offset that happens to be zero" without re-comparing numbers.
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
    // `size: 0` used to be a separate branch. Treating it as "one cell" means a form
    // whose author typed 0 gets the cell they are standing on rather than nothing.
    assertEquals(cells(AT, { size: 1 }), ["100,200"]);
    assertEquals(cells(AT, { size: 0 }), ["100,200"]);
    assertEquals(cells(AT, { size: -3 }).length, 9);
});

Deno.test("a side past the cap is capped and reported", () => {
    // A count over a silently truncated range is a wrong number rather than a slow one.
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
    // Matrix (1,0) is the cell one to the right and (0,1) the one below. A transpose
    // here would silently rotate every structure the mod ships.
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
    // A structure with no `shape` is a 1×1 machine, and asking for its footprint
    // should give its own cell rather than an empty range a count would report as 0.
    assertEquals(shapePositions(AT, undefined), [{ x: 100, y: 200 }]);
});

Deno.test("a matrix cell is an index into the shape, not an offset", () => {
    assertEquals(cells(AT, { mx: 2, my: 3 }), ["102,203"]);
});

Deno.test("a matrix cell conflicts with a range, and says which two fields", () => {
    // The bug this rule exists for: the old `if (mx) … else if (size)` chain let the
    // matrix branch win silently, so this produced ONE cell and reported success.
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
        // The message has to name the *other* field, or the author cannot act on it.
        assert(/range field/.test(built.conflict.message));
    }
});

Deno.test("a blank form alongside a matrix cell is not a conflict", () => {
    // The panel writes every field it renders, so a config that only set `mx` still
    // carries `dx: "0"`, `size: "1"` and `footprint: "false"`. Testing *presence*
    // rather than meaning would refuse exactly the case the rule exists to protect —
    // and the classification probe found it, by answering "defined" to every field.
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
    // "The one cell at matrix 2,3" and "every cell in a range" are not two settings of
    // one question. A `logicForEach` that silently became a single-cell write is the
    // worst version of that, so the walk says no rather than quietly shrinking.
    const built = walkFor(AT, { x: 100, y: 200 }, { mx: 1, my: 1 }, MAX);
    assert("conflict" in built);
    if (!("conflict" in built)) return;
    assert(/cannot be used with a range walk/.test(built.conflict.message));
});

Deno.test("a walk accepts every address that really is a range", () => {
    // The read walks are just as firm as `forEach`, so `logicCount` cannot disagree
    // with `logicForEach` about whether a matrix cell is a range.
    for (const options of [{}, { dx: 0, dy: -1 }, { size: 3 }, { footprint: true }]) {
        const built = walkFor(AT, { x: 100, y: 200 }, options, MAX);
        assert(!("conflict" in built), `${JSON.stringify(options)} should be walkable`);
        if (!("conflict" in built)) assert(built.range.length >= 1);
    }
});
