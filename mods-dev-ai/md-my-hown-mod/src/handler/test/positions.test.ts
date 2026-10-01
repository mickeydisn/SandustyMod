
import { assert, assertEquals } from "https:
import type { Position, Range } from "../core/position.ts";
import { positionsOver, singleCell } from "../core/positions.ts";


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
    
    const even = ({ x }: Position) => x % 2 === 0;
    assert(list.any(even));
    assert(!list.all(even));
    assert(list.all(({ x }) => x < 3));
});

Deno.test("any and all short-circuit", () => {
    
    
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
    
    
    assertEquals(list.sum(({ x, y }) => x * 10 + y), 33);
});

Deno.test("a predicate that throws counts as a miss, and never ends the walk", () => {
    
    
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
    
    
    const list = positionsOver(run(0, 1, 2));
    assertEquals(list.sum((c) => (c.x === 1 ? NaN : 2)), 4);
    assertEquals(list.sum(() => Infinity), 0);
});

Deno.test("all is true and any is false over an empty list", () => {
    
    
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
    
    
    assertEquals(positionsOver(run(0, 1), true).clamped, true);
    assertEquals(positionsOver(run(0, 1)).clamped, false);
});

Deno.test("a single cell is a one-cell list", () => {
    assertEquals(singleCell({ x: 7, y: 9 }).cells, [{ x: 7, y: 9 }]);
    assert(singleCell({ x: 7, y: 9 }).any(({ x }) => x === 7));
});
