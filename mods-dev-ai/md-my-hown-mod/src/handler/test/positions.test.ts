/**
 * The bounded list of positions, and its five combinators.
 *
 * Pure arithmetic, so all of it is testable without a game — which is the reason this
 * primitive lives in its own module rather than inside an action.
 *
 * @module
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { Position, Range } from "../core/position.ts";
import { positionsOver, singleCell } from "../core/positions.ts";

/** A run of cells, as a `Range` — the shape `position.ts` hands a walk. */
function run(...xs: number[]): Range {
    return xs.map((x) => ({ x, y: 0 }));
}

Deno.test("a list holds the range it was given, in order", () => {
    assertEquals(positionsOver(run(10, 11, 12)).cells, [
        { x: 10, y: 0 },
        { x: 11, y: 0 },
        { x: 12, y: 0 },
    ]);
});

Deno.test("any and all are the two halves of the same question", () => {
    const list = positionsOver(run(0, 1, 2));
    // Columns run 0, 1, 2, so "some x is even" is true and "every x is even" is not.
    const even = ({ x }: Position) => x % 2 === 0;
    assert(list.any(even));
    assert(!list.all(even));
    assert(list.all(({ x }) => x < 3));
});

Deno.test("any and all short-circuit", () => {
    // The property that stops a large range from becoming a hang. Observable only if a
    // *later* cell throws — which is exactly what it does here.
    const list = positionsOver(run(0, 1, 2, 3));
    let seen = 0;
    const trip = (hit: boolean) => (c: Position) => {
        seen++;
        if (c.x === 0) return hit;
        throw new Error("walked past the answer");
    };
    assertEquals(list.any(trip(true)), true);
    assertEquals(seen, 1);
    seen = 0;
    assertEquals(list.all(trip(false)), false);
    assertEquals(seen, 1);
});

Deno.test("count and sum reduce the whole list", () => {
    const list = positionsOver([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
    assertEquals(list.count(({ x, y }) => x === y), 3);
    // x*10+y over the diagonal: 0 + 11 + 22. Written out rather than recomputed,
    // because a test that recomputes the expression it is checking is not checking it.
    assertEquals(list.sum(({ x, y }) => x * 10 + y), 33);
});

Deno.test("a predicate that throws counts as a miss, and never ends the walk", () => {
    // A 64×64 range that stopped at the first bad cell would answer a question about
    // one cell instead of 4096 — a plausible number, and a wrong one.
    const list = positionsOver(run(0, 1, 2, 3));
    assertEquals(
        list.count((c) => {
            if (c.x === 0) return true;
            throw new Error("bad cell");
        }),
        1,
    );
    assertEquals(
        list.any(() => {
            throw new Error("everything is broken");
        }),
        false,
    );
    assertEquals(
        list.all(() => {
            throw new Error("everything is broken");
        }),
        false,
    );
});

Deno.test("one unreadable cell does not poison a sum", () => {
    // NaN would make every later total NaN, so the whole process looks broken rather
    // than one step of it.
    const list = positionsOver(run(0, 1, 2));
    assertEquals(list.sum((c) => (c.x === 1 ? NaN : 2)), 4);
    assertEquals(list.sum(() => Infinity), 0);
});

Deno.test("all is true and any is false over an empty list", () => {
    // The collection convention, and the mathematically correct answer. It is a trap
    // for `all` specifically: a range that resolved to nothing is "all water" by it.
    const empty = positionsOver([]);
    assertEquals(empty.cells, []);
    assertEquals(empty.all(() => true), true);
    assertEquals(empty.any(() => true), false);
    assertEquals(empty.count(() => true), 0);
    assertEquals(empty.sum(() => 1), 0);
});

Deno.test("forEach reports how many cells it visited", () => {
    const list = positionsOver(run(0, 1, 2));
    let seen = 0;
    assertEquals(
        list.forEach(() => {
            seen++;
        }),
        3,
    );
    assertEquals(seen, 3);
});

Deno.test("a visit that throws does not stop the remaining cells", () => {
    const list = positionsOver(run(0, 1, 2, 3));
    const visited: number[] = [];
    const done = list.forEach((c) => {
        visited.push(c.x);
        if (c.x === 0) throw new Error("this cell is broken");
    });
    assertEquals(visited, [0, 1, 2, 3]);
    assertEquals(done, 4);
});

Deno.test("a clamp is carried on the list, not applied quietly", () => {
    // A count over a silently-capped range is a wrong number rather than a slow one,
    // and the author has no other way to learn it was truncated.
    assertEquals(positionsOver(run(0, 1), true).clamped, true);
    assertEquals(positionsOver(run(0, 1)).clamped, false);
});

Deno.test("a single cell is a one-cell list", () => {
    assertEquals(singleCell({ x: 7, y: 9 }).cells, [{ x: 7, y: 9 }]);
    assert(singleCell({ x: 7, y: 9 }).any(({ x }) => x === 7));
});
