/**
 * The seven atomic element actions, against a fake processing context.
 *
 * ## What is worth testing here
 *
 * The region maths is tested in `cell-region.test.ts`. What cannot be tested there is
 * the **write contract**, and it is the part that has already gone wrong once in this
 * codebase: `processorConvert` passed `type: "set"` and a bare object, neither of
 * which is a mutation, and silently did nothing. So these tests assert on the shape of
 * what reaches `commit`, not just on the return value.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { elementActions, regionFor } from "../actions/element/index.ts";
import { MAX_SCAN_SIDE } from "../core/cell-region.ts";

/** One call recorded on the fake writer. */
interface Write {
    op: "create" | "replace" | "remove";
    x: number;
    y: number;
    type?: string;
    options?: unknown;
}

/**
 * A stand-in for `StructureProcessingContext` **and** `api.grid.mutate`, recording both.
 *
 * The `mutate` half is what changed: the element family used to stage
 * `{kind, cellX, cellY}` objects and hand them to `ctx.commit`, and the tests asserted
 * on that array. It now calls `writer.elements.*` inside the batch, so the fake provides
 * a writer and records its calls in the same shape.
 *
 * The writer **applies** each call to the fake grid as it happens, and the reads go
 * through the same `cells` map. That is not incidental — it is the property the real
 * engine provides and the reason the migration is worth doing: a read inside the batch
 * sees the writes before it, so two steps over overlapping regions compose. The old
 * read-then-commit fake could not model that, and could not have caught a regression
 * that depended on it.
 */
function fakeContext(grid: Record<string, string> = {}) {
    const cells = new Map<string, string>(Object.entries(grid));
    const writes: Write[] = [];
    /** One entry per `mutate` call, so "one batch, N writes" is assertable. */
    const batches: Write[][] = [];
    let current: Write[] = [];

    const record =
        (op: Write["op"]) => (x: number, y: number, type?: string, options?: unknown) => {
            const w: Write = { op, x, y, type, options };
            writes.push(w);
            current.push(w);
            const key = `${x},${y}`;
            if (op === "remove") cells.delete(key);
            else cells.set(key, String(type));
        };

    // Installed on the global, because that is where `hostNs("grid")` looks. Restored by
    // `done`, which every test that uses this must call.
    const g = globalThis as { sandkit?: { api: Record<string, unknown> } };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = {
        api: {
            grid: {
                mutate: (fn: (w: { elements: unknown }) => void) => {
                    current = [];
                    batches.push(current);
                    fn({
                        elements: {
                            createAtCell: record("create"),
                            replaceAtCell: record("replace"),
                            removeAtCell: record("remove"),
                        },
                    });
                },
            },
        },
    };
    return {
        writes,
        batches,
        cells,
        ctx: {
            getResolvedTypeAtCell: (x: number, y: number) => cells.get(`${x},${y}`) ?? null,
            isCellEmptyAtCell: (x: number, y: number) => !cells.has(`${x},${y}`),
        },
        /** How many batches were opened. One action must open exactly one. */
        batchCount: () => batches.length,
        /** The last batch, or `[]` if `mutate` was never called. */
        batch: () => batches[batches.length - 1] ?? [],
        /** Put the global back. Every test that uses this must call it. */
        done: () => {
            if (had) g.sandkit = prev;
            else delete g.sandkit;
        },
    };
}

const S4 = [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]];
const at = { x: 100, y: 200, shape: S4 };

Deno.test("a read is bindable, and an empty cell reads as the empty string", () => {
    const { ctx } = fakeContext({ "100,200": "dirt" });
    const read = elementActions.readElement.fn;
    assertEquals(read(at, ctx, {}), "dirt");
    // `""` rather than `null`: a bound value is a string everywhere else in the
    // system, and `null` would be the one name that resolves to nothing. Read from a
    // cell that is genuinely empty — the same cell would of course still say `dirt`.
    assertEquals(read(at, ctx, { dx: 5 }), "");
});

Deno.test("countElements counts a 4x4 footprint in one call", () => {
    // The case the matrix exists for: sixteen cells asked in one question. The dirt
    // goes in the first row and the first two cells of the second, so the answer is
    // inside the 4×4 — a grid laid out wider than the footprint would be counting
    // cells the structure does not own.
    const grid: Record<string, string> = {
        "100,200": "dirt",
        "101,200": "dirt",
        "102,200": "dirt",
        "103,200": "dirt",
        "100,201": "dirt",
        "101,201": "dirt",
        "100,202": "sand",
    };
    const { ctx } = fakeContext(grid);
    const count = elementActions.countElements.fn;
    assertEquals(count(at, ctx, { element: "dirt", footprint: true }), 6);
    assertEquals(count(at, ctx, { element: "sand", footprint: true }), 1);
    assertEquals(count(at, ctx, { element: "water", footprint: true }), 0);
    // And a dirt cell *outside* the footprint is not counted, even though the same
    // action finds it with an explicit offset.
    const wider = fakeContext({ ...grid, "110,200": "dirt" });
    assertEquals(count(at, wider.ctx, { element: "dirt", footprint: true }), 6);
    assertEquals(count(at, wider.ctx, { element: "dirt", dx: 10 }), 1);
});

Deno.test("a write over a region is ONE batch, not one per cell", () => {
    // The property that makes a footprint write atomic. Split per cell it could
    // half-apply, leaving a sorter in a state its author never described.
    const fake = fakeContext();
    const ok = elementActions.createElement.fn(at, fake.ctx, {
        element: "sand",
        footprint: true,
    });
    assertEquals(ok, true);
    assertEquals(fake.batchCount(), 1, "one transaction for the whole region");
    assertEquals(fake.batch().length, 16);
    // And each call uses a real writer method. `processorConvert` once passed
    // `type: "set"`, which is not a mutation kind at all, and did nothing — the same
    // class of bug, one layer down: a writer method that does not exist fails just as
    // silently as a mutation kind that does not.
    assertEquals(fake.batch()[0].op, "create");
    assertEquals(fake.batch()[0].x, 100);
    assertEquals(fake.batch()[0].y, 200);
    assertEquals(fake.batch()[0].type, "sand");
    fake.done();
});

Deno.test("a read inside the batch sees the writes before it in that batch", () => {
    // The reason to prefer `api.grid.mutate` over `context.commit`, and the one thing
    // the old read-then-commit shape could not do. The two steps are separate actions,
    // so the second one's emptiness test would have read **pre-write** state and found
    // the cell still occupied — and skipped.
    const fake = fakeContext();
    // Step one fills the footprint.
    elementActions.createElement.fn(at, fake.ctx, { element: "sand", footprint: true });
    // Step two fills it again, into cells that are now occupied.
    const second = elementActions.createElement.fn(at, fake.ctx, {
        element: "dirt",
        footprint: true,
    });
    assertEquals(second, false, "nothing left to fill");
    assertEquals(fake.cells.get("100,200"), "sand", "the first write survived");
    assertEquals(fake.batchCount(), 2, "one batch per action, not one per cell");
    fake.done();
});

Deno.test("createElement fills gaps and leaves everything else alone", () => {
    // The whole difference from `replaceElement` is one emptiness check per cell, and
    // it is the difference between a machine that fills and one that bulldozes.
    const fake = fakeContext({ "100,200": "dirt" });
    elementActions.createElement.fn(at, fake.ctx, { element: "sand", footprint: true });
    assertEquals(fake.cells.get("100,200"), "dirt");
    assertEquals(fake.cells.get("101,200"), "sand");
    assertEquals(fake.cells.size, 16);
    fake.done();
});

Deno.test("emptyCells removes only what it read, and skips empty cells", () => {
    const fake = fakeContext({ "100,200": "dirt", "102,200": "sand" });
    elementActions.emptyCells.fn(at, fake.ctx, { footprint: true });
    assertEquals(fake.cells.size, 0);
    // Only the two occupied cells produce a removal. There is no `expectedElementType`
    // to check any more — the writer's `removeAtCell` has no such field — and the
    // guarantee it gave is now **structural**: the read that found the cell occupied and
    // the removal of it are the same atomic step inside one batch, so there is no tick
    // in between for the simulation to change the answer.
    assertEquals(fake.batch().length, 2);
    assertEquals(fake.batch().every((w) => w.op === "remove"), true);
    assertEquals(
        fake.batch().map((w) => `${w.x},${w.y}`).sort(),
        ["100,200", "102,200"],
    );
    fake.done();
});

Deno.test("transformElement maps one element to another", () => {
    // The action that turns a process into a machine: conditional, so the same
    // program means different things under different options.
    const { ctx, cells } = fakeContext({ "100,200": "dirt", "101,200": "sand" });
    elementActions.transformElement.fn(at, ctx, {
        from: "dirt",
        to: "clay",
        footprint: true,
    });
    assertEquals(cells.get("100,200"), "clay");
    assertEquals(cells.get("101,200"), "sand", "sand was not named, so it stays");
});

Deno.test("a blank `from` normalises, and a cell already correct is skipped", () => {
    // Two behaviours in one test because they share a path and the second is
    // invisible without the first.
    const { ctx, cells } = fakeContext({
        "100,200": "dirt",
        "101,200": "sand",
        "102,200": "water",
    });
    elementActions.transformElement.fn(at, ctx, { to: "stone", footprint: true });
    assertEquals(cells.get("100,200"), "stone");
    assertEquals(cells.get("101,200"), "stone");
    assertEquals(cells.get("102,200"), "stone");
    // A cell already holding `to` is left alone — a valid write, but one that would
    // fire every tick forever for no change.
    //
    // The claim is "no **writes**", not "no batch". `api.grid.mutate` is called before
    // the action knows whether anything qualifies, because deciding first would mean
    // reading outside the batch and losing the coherence that motivated the migration.
    // So an action with nothing to do still opens a batch, and it comes back empty.
    // That is why `writeCells` reports `queued > 0` rather than "did `mutate` get
    // called" — the two differ here, and the difference is invisible in the return
    // value but load-bearing in this test.
    const already = fakeContext({ "100,200": "stone" });
    assertEquals(
        elementActions.transformElement.fn(at, already.ctx, { to: "stone", footprint: true }),
        false,
    );
    assertEquals(already.batch().length, 0, "a batch was opened, with nothing in it");
    already.done();
});

Deno.test("a matrix position addresses one cell, ignoring the offsets", () => {
    // `mx`/`my` is the literal "the element at matrix x, y".
    const { ctx, cells } = fakeContext();
    elementActions.createElement.fn(at, ctx, { element: "stone", mx: 2, my: 3 });
    assertEquals([...cells.keys()], ["102,203"]);
});

Deno.test("an offset with no size is exactly one cell", () => {
    // This is what makes `replaceElement` with `dy: -1` the parameterised
    // `processorConvert` rather than a second, separate action.
    const { ctx, cells } = fakeContext();
    elementActions.createElement.fn({ x: 100, y: 200 }, ctx, {
        element: "stone",
        dx: 0,
        dy: -1,
    });
    assertEquals([...cells.keys()], ["100,199"]);
});

Deno.test("a size builds a square centred on the offset, and is clamped", () => {
    const { ctx, cells } = fakeContext();
    elementActions.createElement.fn({ x: 0, y: 0 }, ctx, { element: "stone", size: 3 });
    assertEquals(cells.size, 9, "a 3x3 around the origin");
    // A size past the cap is clamped rather than honoured, and the action still
    // runs — a silent refusal would look like a broken engine.
    const big = fakeContext();
    elementActions.createElement.fn({ x: 0, y: 0 }, big.ctx, {
        element: "stone",
        size: 500,
    });
    assertEquals(big.cells.size, MAX_SCAN_SIDE * MAX_SCAN_SIDE);
});

Deno.test("regionFor reports the clamp rather than hiding it", () => {
    assertEquals(regionFor({ x: 0, y: 0 }, { size: 3 }).clamped, false);
    assertEquals(regionFor({ x: 0, y: 0 }, { size: 500 }).clamped, true);
    // A footprint is the structure's own size, which the author does not control, so
    // it is never clamped: an 80×80 structure is 80×80.
    const big = Array.from({ length: 80 }, () => Array(80).fill(1));
    assertEquals(regionFor({ x: 0, y: 0, shape: big }, { footprint: true }).clamped, false);
});

Deno.test("createElement can set a lifetime, and it is not a separate write", () => {
    // The gap this migration closed. `durationTicks` is applied **inside** the same
    // writer call as the create, so there is no moment at which the cell holds an
    // untimed element — which is exactly what chaining `createElement` then `setDuration`
    // would leave, since the second write is a separate per-cell call at the flush.
    const fake = fakeContext();
    elementActions.createElement.fn(at, fake.ctx, {
        element: "sand",
        durationTicks: 120,
        footprint: true,
    });
    assertEquals(fake.batch().length, 16, "still one writer call per cell, in one batch");
    assertEquals(fake.batch()[0].options, { durationTicks: 120 });
    fake.done();
});

Deno.test("create options are omitted entirely when nothing is set", () => {
    // `undefined`, not `{}`. An empty options object is still an argument, and the one
    // thing to avoid here is inventing a payload the engine has to interpret — the
    // failure mode that made `processorConvert`'s `type: "set"` invisible.
    const fake = fakeContext();
    elementActions.createElement.fn(at, fake.ctx, { element: "sand", footprint: true });
    assertEquals(fake.batch()[0].options, undefined);
    fake.done();
});

Deno.test("a zero lifetime is not sent, because 0 is not a real duration", () => {
    // The panel's default is "0 = permanent", and permanent is expressed by **absence**,
    // not by asking for zero ticks. A cell created with `durationTicks: 0` would be
    // expired before it was ever observed.
    const fake = fakeContext();
    elementActions.createElement.fn(at, fake.ctx, {
        element: "sand",
        durationTicks: 0,
        density: 0,
        footprint: true,
    });
    assertEquals(fake.batch()[0].options, undefined);
    fake.done();
});

Deno.test("a velocity spawns a particle, and a zero velocity does not", () => {
    // `ElementCreateOptions.particle` is the atomic way to launch material: one writer
    // call that both places the cell and gives it a velocity. The motion family's
    // `toParticle` is the non-atomic alternative, and the two are not redundant — this
    // one cannot half-launch a footprint, that one can.
    const flying = fakeContext();
    elementActions.createElement.fn(at, flying.ctx, {
        element: "sand",
        vx: 40,
        vy: -120,
        footprint: true,
    });
    assertEquals(flying.batch()[0].options, {
        particle: { velocity: { x: 40, y: -120 } },
    });
    flying.done();

    const still = fakeContext();
    elementActions.createElement.fn(at, still.ctx, { element: "sand", footprint: true });
    assertEquals(still.batch()[0].options, undefined, "no velocity, so no particle spawn");
    still.done();
});

Deno.test("an element with no api.grid.mutate refuses rather than throwing", () => {
    // The Main-only cost of the migration, and the thing to guard: `api.grid.mutate` is
    // ✓ Main / — Worker, so a mod that later adds a `workerEntry` would lose the whole
    // element family. It must warn and return false, never throw inside a processor tick.
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    delete g.sandkit;
    try {
        assertEquals(
            elementActions.createElement.fn(at, { getResolvedTypeAtCell: () => null }, {
                element: "sand",
                footprint: true,
            }),
            false,
        );
    } finally {
        if (had) g.sandkit = prev;
    }
});

Deno.test("an element with no element set refuses rather than writing nothing", () => {
    // `replaceElement` with a blank id is a mis-set field, and the warning is the
    // whole response: an empty commit would look like a successful no-op.
    const fake = fakeContext();
    assertEquals(elementActions.replaceElement.fn(at, fake.ctx, { footprint: true }), false);
    assertEquals(fake.batch().length, 0, "an empty batch, and no writes queued");
    fake.done();
});
