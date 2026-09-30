/**
 * The five range walks, against a fake engine.
 *
 * These are the only tests that prove the walks *do* something rather than merely
 * compile: the other suites in this directory measure structure (needs, classes,
 * slots) and would happily pass if a walk returned a constant.
 *
 * The fake implements only what the five actions actually call —
 * `getResolvedTypeAtCell`, `isCellEmptyAtCell`, `grid.mutate`'s writer and
 * `terrains.getDataAtCell` — so a passing test is evidence about these actions
 * rather than about a mock that happens to agree with whatever the code does.
 *
 * @module
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logicActions } from "../actions/logic/index.ts";

interface FakeWorld {
    read: (x: number, y: number) => string | null;
    written: { x: number; y: number; type: string }[];
    setHp: (x: number, y: number, n: number) => void;
    /** Run the deferred `mutate` batches, as the engine's flush does. */
    flush(): void;
}

function fakeWorld(cells: Record<string, string>): FakeWorld {
    const read = (x: number, y: number) => cells[`${x},${y}`] ?? null;
    const written: { x: number; y: number; type: string }[] = [];
    const hp = new Map<string, number>();
    /**
     * Batches opened but not yet run.
     *
     * `api.grid.mutate` **defers** its callback, and this fake used to call it
     * synchronously. That is what let every write action pass here and throw
     * `Structure processor context can only be used during process()` in the game —
     * the synchronous fake kept the context alive past the point where the engine
     * destroys it. `withWorld` flushes on teardown, so the assertions below see
     * the same grid the engine would.
     */
    let pending: { writer: unknown; run?: (w: { elements: unknown }) => void }[] = [];
    (globalThis as { sandkit?: unknown }).sandkit = {
        api: {
            elements: { getResolvedTypeAtCell: read },
            grid: {
                isCellEmptyAtCell: (x: number, y: number) => read(x, y) === null,
                mutate: (fn: (w: { elements: unknown }) => void) => {
                    const writer = {
                        elements: {
                            createAtCell: (x: number, y: number, t: string) => {
                                written.push({ x, y, type: t });
                                cells[`${x},${y}`] = t;
                            },
                        },
                    };
                    pending.push({ writer });
                    pending[pending.length - 1].run = fn;
                },
            },
            terrains: {
                getDataAtCell: (x: number, y: number) =>
                    hp.has(`${x},${y}`) ? { hitPoints: hp.get(`${x},${y}`) } : null,
            },
        },
    };
    // `written` is a getter that flushes first, so an assertion inside `body` sees
    // the writes the engine would have applied — the batch is deferred, and a
    // synchronous read of `written` would otherwise be reading nothing.
    const out: FakeWorld = {
        read,
        setHp(x: number, y: number, n: number) {
            hp.set(`${x},${y}`, n);
        },
        flush() {
            const open = pending;
            pending = [];
            for (const b of open) b.run?.(b.writer as { elements: unknown });
        },
        get written() {
            out.flush();
            return written;
        },
    };
    return out;
}

/**
 * Install a fake engine, and put the previous one back afterwards.
 *
 * The restore is the point. `globalThis.sandkit` is a **module global** that every
 * action in the catalogue reads, so a fake left behind by one test is a fake the
 * next test's actions quietly talk to — and the failure looks like a bug in
 * whichever action happened to run second.
 */
function withWorld(
    cells: Record<string, string>,
    body: (w: FakeWorld) => void,
): void {
    const previous = (globalThis as { sandkit?: unknown }).sandkit;
    const w = fakeWorld(cells);
    try {
        body(w);
    } finally {
        if (previous === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = previous;
    }
}

/**
 * The emptiness answer the batch path needs, derived from the same world.
 *
 * Not `() => true`: `writeCells` reads `null` for an empty cell, so a mock claiming
 * every cell is empty makes every `when` guard compare against `null` and match
 * nothing. That is a real property of the write path rather than a quirk of the
 * mock, and it is why emptiness has to come from the same source as the type read.
 */
const isEmptyOf = (w: FakeWorld) => (x: number, y: number) => w.read(x, y) === null;

/** Run one walk the way `compileProcess` would, and hand back what it answered. */
function run(fn: unknown, structure: unknown, options: unknown, context: unknown = null) {
    return (fn as (a: unknown, b: unknown, c: unknown) => unknown)(
        structure,
        context,
        options,
    );
}

const at = (x: number, y: number) => ({ x, y });

Deno.test("logicCount counts the cells holding a type across the range", () => {
    withWorld({ "0,0": "water", "1,0": "water", "0,1": "sand", "1,1": "sand" }, () => {
        // A 2×2 at the origin: two of the four are water.
        assertEquals(run(logicActions.logicAny.fn, at(0, 0), { size: 2, element: "water" }), true);
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 2, element: "water" }), 2);
        assertEquals(run(logicActions.logicAll.fn, at(0, 0), { size: 2, element: "sand" }), false);
    });
});

Deno.test("the walks anchor on the structure, not on the cursor", () => {
    // Three water cells around (50, 60) and none near the origin. A walk that ignored
    // its anchor would answer from the wrong place — the exact bug the shared
    // `anchorFor` exists to prevent, and the one that put an item action at (0, 0).
    withWorld({ "50,60": "water", "50,61": "water", "51,60": "water" }, () => {
        assertEquals(run(logicActions.logicCount.fn, at(50, 60), { size: 2, element: "water" }), 3);
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 2, element: "water" }), 0);
    });
});

Deno.test("a walk with no element to look for refuses rather than matching everything", () => {
    // Without the guard an absent `element` would make `count` return the whole area
    // and `all` return true — both confident, both wrong.
    withWorld({ "0,0": "water" }, () => {
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 1 }), 0);
        assertEquals(run(logicActions.logicAny.fn, at(0, 0), { size: 1 }), false);
        assertEquals(run(logicActions.logicAll.fn, at(0, 0), { size: 1 }), false);
    });
});

Deno.test("logicSum totals hit points and counts an empty cell as zero", () => {
    withWorld({ "0,0": "water" }, (w) => {
        w.setHp(0, 0, 40);
        w.setHp(1, 0, 60);
        // (1,0) has no terrain data, so it contributes 0 rather than -1.
        assertEquals(run(logicActions.logicSum.fn, at(0, 0), { size: 2 }), 100);
    });
});

Deno.test("logicForEach writes at every cell of the range", () => {
    withWorld({ "0,0": "air", "1,0": "air", "0,1": "air", "1,1": "air" }, (w) => {
        // `writeCells` reads the batch through the context, so a walk needs one.
        const n = run(
            logicActions.logicForEach.fn,
            at(0, 0),
            { size: 2, to: "stone" },
            { getResolvedTypeAtCell: w.read, isCellEmptyAtCell: isEmptyOf(w) },
        );
        assertEquals(n, 4);
        assertEquals(
            w.written.map((c) => `${c.x},${c.y}`).sort(),
            ["0,0", "0,1", "1,0", "1,1"],
        );
        assertEquals(w.written.every((c) => c.type === "stone"), true);
    });
});

Deno.test("the `when` guard is applied per cell, not once for the range", () => {
    // The case the single-guard rule exists for. Evaluated once for the whole region,
    // "any cell is water" would rewrite all four — plausible-looking and wrong.
    withWorld({ "0,0": "water", "1,0": "sand", "0,1": "sand", "1,1": "sand" }, (w) => {
        const n = run(
            logicActions.logicForEach.fn,
            at(0, 0),
            { size: 2, to: "stone", when: "water" },
            { getResolvedTypeAtCell: w.read, isCellEmptyAtCell: isEmptyOf(w) },
        );
        assertEquals(n, 1, "only the water cell should change");
        assertEquals(w.written, [{ x: 0, y: 0, type: "stone" }]);
    });
});

Deno.test("logicForEach with no type to write changes nothing", () => {
    withWorld({ "0,0": "air" }, (w) => {
        const n = run(
            logicActions.logicForEach.fn,
            at(0, 0),
            { size: 2 },
            { getResolvedTypeAtCell: w.read, isCellEmptyAtCell: isEmptyOf(w) },
        );
        assertEquals(n, 0);
        assertEquals(w.written, []);
    });
});

Deno.test("a walk with no engine to ask answers rather than throwing", () => {
    // A tool used on a thread with no `api`, or before the host is ready. Every walk
    // must answer, because a tick that throws takes the rest of the process with it.
    const previous = (globalThis as { sandkit?: unknown }).sandkit;
    delete (globalThis as { sandkit?: unknown }).sandkit;
    try {
        assertEquals(run(logicActions.logicAny.fn, at(0, 0), { size: 3, element: "water" }), false);
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 3, element: "water" }), 0);
        assertEquals(run(logicActions.logicAll.fn, at(0, 0), { size: 3, element: "water" }), false);
        assertEquals(run(logicActions.logicSum.fn, at(0, 0), { size: 3 }), 0);
        assertEquals(run(logicActions.logicForEach.fn, at(0, 0), { size: 3, to: "stone" }), 0);
    } finally {
        if (previous !== undefined) (globalThis as { sandkit?: unknown }).sandkit = previous;
    }
});
