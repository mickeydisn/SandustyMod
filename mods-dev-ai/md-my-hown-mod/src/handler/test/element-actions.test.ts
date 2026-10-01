
import { assert, assertEquals } from "https:
import { elementActions, regionFor, walkRangeFor } from "../actions/element/index.ts";
import { MAX_SCAN_SIDE } from "../core/cell-region.ts";


interface Write {
    op: "create" | "replace" | "remove";
    x: number;
    y: number;
    type?: string;
    options?: unknown;
}


function fakeContext(grid: Record<string, string> = {}) {
    const cells = new Map<string, string>(Object.entries(grid));
    const writes: Write[] = [];
    
    const batches: Write[][] = [];
    let current: Write[] = [];
    
    let pending: { writer: unknown; run?: (w: { elements: unknown }) => void }[] = [];

    const record =
        (op: Write["op"]) => (x: number, y: number, type?: string, options?: unknown) => {
            const w: Write = { op, x, y, type, options };
            writes.push(w);
            current.push(w);
            const key = `${x},${y}`;
            if (op === "remove") cells.delete(key);
            else cells.set(key, String(type));
        };

    
    
    const g = globalThis as unknown as { sandkit?: { api: Record<string, unknown> } };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = {
        api: {
            grid: {
                mutate: (fn: (w: { elements: unknown }) => void) => {
                    current = [];
                    batches.push(current);
                    
                    const writer = {
                        elements: {
                            createAtCell: record("create"),
                            replaceAtCell: record("replace"),
                            
                        },
                    };
                    pending.push({ writer });
                    pending[pending.length - 1].run = fn;
                },
            },
            
            
            elements: { removeAtCell: record("remove") },
        },
    };
    
    
    
    
    
    let inProcess = true;
    const guard = <T>(v: T): T => {
        if (!inProcess) {
            throw new Error("Structure processor context can only be used during process().");
        }
        return v;
    };
    const ctx = {
        getResolvedTypeAtCell: (x: number, y: number) => {
            guard(0);
            return cells.get(`${x},${y}`) ?? null;
        },
        isCellEmptyAtCell: (x: number, y: number) => {
            guard(0);
            return !cells.has(`${x},${y}`);
        },
    };
    
    
    
    const out = {
        batches,
        ctx,
        
        retire() {
            inProcess = false;
        },
        
        flush() {
            const open = pending;
            pending = [];
            for (const b of open) b.run?.(b.writer as { elements: unknown });
        },
        
        get cells() {
            out.flush();
            return cells;
        },
        get writes() {
            out.flush();
            return writes;
        },
        
        writer: () => ({
            createAtCell: (x: number, y: number, t: string) => cells.set(`${x},${y}`, t),
            replaceAtCell: (x: number, y: number, t: string) => cells.set(`${x},${y}`, t),
        }),
        
        batchCount: () => (out.flush(), batches.length),
        
        batch: () => (out.flush(), batches[batches.length - 1] ?? []),
        
        done: () => {
            if (had) g.sandkit = prev;
            else delete g.sandkit;
        },
    };

    
    
    
    
    return out;
}

const S4 = [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]];
const at = { x: 100, y: 200, shape: S4 };

Deno.test("a read is bindable, and an empty cell reads as the empty string", () => {
    const { ctx } = fakeContext({ "100,200": "dirt" });
    const read = elementActions.readElement.fn;
    assertEquals(read(at, ctx, {}), "dirt");
    
    
    
    assertEquals(read(at, ctx, { dx: 5 }), "");
});

Deno.test("countElements counts a 4x4 footprint in one call", () => {
    
    
    
    
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
    
    
    const wider = fakeContext({ ...grid, "110,200": "dirt" });
    assertEquals(count(at, wider.ctx, { element: "dirt", footprint: true }), 6);
    assertEquals(count(at, wider.ctx, { element: "dirt", dx: 10 }), 1);
});

Deno.test("a write over a region is ONE batch, not one per cell", () => {
    
    
    const fake = fakeContext();
    const ok = elementActions.createElement.fn(at, fake.ctx, {
        element: "sand",
        footprint: true,
    });
    assertEquals(ok, true);
    assertEquals(fake.batchCount(), 1, "one transaction for the whole region");
    assertEquals(fake.batch().length, 16);
    
    
    
    
    assertEquals(fake.batch()[0].op, "create");
    assertEquals(fake.batch()[0].x, 100);
    assertEquals(fake.batch()[0].y, 200);
    assertEquals(fake.batch()[0].type, "sand");
    fake.done();
});

Deno.test("a batch is deferred, and the context is dead by the time it runs", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    const fake = fakeContext();
    const wrote = elementActions.createElement.fn(at, fake.ctx, {
        element: "sand",
        footprint: true,
    });
    assertEquals(wrote, true, "the decision is made up front, so the answer is real");

    
    assertEquals(fake.batches.length, 1, "one batch per action, not one per cell");

    
    fake.retire();
    fake.flush();

    
    assertEquals(fake.cells.get("100,200"), "sand", "the batch landed");
    fake.done();
});

Deno.test("two steps over one region each decide against pre-write state", () => {
    
    
    
    
    
    
    const fake = fakeContext();
    elementActions.createElement.fn(at, fake.ctx, { element: "sand", footprint: true });
    const second = elementActions.createElement.fn(at, fake.ctx, {
        element: "dirt",
        footprint: true,
    });
    assertEquals(second, true, "step two decides before step one's batch has flushed");
    fake.flush();
    
    assertEquals(fake.batchCount(), 2, "one batch per action, not one per cell");
    fake.done();
});

Deno.test("createElement fills gaps and leaves everything else alone", () => {
    
    
    const fake = fakeContext({ "100,200": "dirt" });
    elementActions.createElement.fn(at, fake.ctx, { element: "sand", footprint: true });
    assertEquals(fake.cells.get("100,200"), "dirt");
    assertEquals(fake.cells.get("101,200"), "sand");
    assertEquals(fake.cells.size, 16);
    fake.done();
});

Deno.test("the batch writer offers only the two methods the engine declares", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    const fake = fakeContext();
    let offered: string[] | undefined;
    const g = globalThis as unknown as {
        sandkit: {
            api: {
                grid: { mutate: (fn: (w: { elements: object }) => void) => void };
            };
        };
    };
    g.sandkit.api.grid.mutate = (fn) => fn({ elements: fake.writer() });
    g.sandkit.api.grid.mutate((w) => {
        offered = Object.keys(w.elements as Record<string, unknown>);
    });
    assertEquals(
        offered,
        ["createAtCell", "replaceAtCell"],
        "the fake writer no longer matches grid.d.ts — re-read it before changing this",
    );
    fake.done();
});

Deno.test("emptyCells removes only what it read, and skips empty cells", () => {
    const fake = fakeContext({ "100,200": "dirt", "102,200": "sand" });
    elementActions.emptyCells.fn(at, fake.ctx, { footprint: true });
    assertEquals(fake.cells.size, 0);
    
    
    
    
    
    assertEquals(fake.batch().length, 2);
    assertEquals(fake.batch().every((w) => w.op === "remove"), true);
    assertEquals(
        fake.batch().map((w) => `${w.x},${w.y}`).sort(),
        ["100,200", "102,200"],
    );
    fake.done();
});






Deno.test("removeElement takes only the named element, leaving the rest", () => {
    const fake = fakeContext({
        "100,200": "gold",
        "101,200": "gold",
        "102,200": "copper",
    });
    const wrote = elementActions.removeElement.fn(at, fake.ctx, {
        element: "gold",
        footprint: true,
    });
    
    
    assertEquals(wrote, true);
    
    
    assertEquals(
        fake.cells.get("100,200"),
        undefined,
        "the gold was taken",
    );
    assertEquals(
        fake.cells.get("101,200"),
        undefined,
        "the second gold was taken",
    );
    assertEquals(
        fake.cells.get("102,200"),
        "copper",
        "a different element must survive — this is the whole point of the action",
    );
    assertEquals(fake.batch().every((w) => w.op === "remove"), true);
    fake.done();
});

Deno.test("removeElement with nothing to take writes nothing", () => {
    
    
    const fake = fakeContext({ "100,200": "copper" });
    assertEquals(
        elementActions.removeElement.fn(at, fake.ctx, { element: "gold", footprint: true }),
        false,
    );
    assertEquals(fake.batch().length, 0, "an empty batch, and no writes queued");
    assertEquals(fake.cells.get("100,200"), "copper");
    fake.done();
});

Deno.test("removeElement with no element named refuses rather than clearing", () => {
    
    
    
    const fake = fakeContext({ "100,200": "gold" });
    assertEquals(elementActions.removeElement.fn(at, fake.ctx, { footprint: true }), false);
    assertEquals(fake.batch().length, 0);
    assertEquals(fake.cells.get("100,200"), "gold", "and nothing was removed");
    fake.done();
});

Deno.test("transformElement maps one element to another", () => {
    
    
    const fake = fakeContext({ "100,200": "dirt", "101,200": "sand" });
    elementActions.transformElement.fn(at, fake.ctx, {
        from: "dirt",
        to: "clay",
        footprint: true,
    });
    assertEquals(fake.cells.get("100,200"), "clay");
    assertEquals(fake.cells.get("101,200"), "sand", "sand was not named, so it stays");
});

Deno.test("a blank `from` normalises, and a cell already correct is skipped", () => {
    
    
    const fake = fakeContext({
        "100,200": "dirt",
        "101,200": "sand",
        "102,200": "water",
    });
    elementActions.transformElement.fn(at, fake.ctx, { to: "stone", footprint: true });
    assertEquals(fake.cells.get("100,200"), "stone");
    assertEquals(fake.cells.get("101,200"), "stone");
    assertEquals(fake.cells.get("102,200"), "stone");
    
    
    
    
    
    
    
    
    
    
    const already = fakeContext({ "100,200": "stone" });
    assertEquals(
        elementActions.transformElement.fn(at, already.ctx, { to: "stone", footprint: true }),
        false,
    );
    assertEquals(already.batch().length, 0, "a batch was opened, with nothing in it");
    already.done();
});

Deno.test("a matrix position addresses one cell, ignoring the offsets", () => {
    
    const fake = fakeContext();
    elementActions.createElement.fn(at, fake.ctx, { element: "stone", mx: 2, my: 3 });
    assertEquals([...fake.cells.keys()], ["102,203"]);
});

Deno.test("an offset with no size is exactly one cell", () => {
    
    
    const fake = fakeContext();
    elementActions.createElement.fn({ x: 100, y: 200 }, fake.ctx, {
        element: "stone",
        dx: 0,
        dy: -1,
    });
    assertEquals([...fake.cells.keys()], ["100,199"]);
});

Deno.test("a size builds a square centred on the offset, and is clamped", () => {
    const fake = fakeContext();
    elementActions.createElement.fn({ x: 0, y: 0 }, fake.ctx, { element: "stone", size: 3 });
    assertEquals(fake.cells.size, 9, "a 3x3 around the origin");
    
    
    const big = fakeContext();
    elementActions.createElement.fn({ x: 0, y: 0 }, big.ctx, {
        element: "stone",
        size: 500,
    });
    assertEquals(big.cells.size, MAX_SCAN_SIDE * MAX_SCAN_SIDE);
});

Deno.test("regionFor reports the clamp rather than hiding it", () => {
    
    
    
    const clampedOf = (r: ReturnType<typeof regionFor>) => ("clamped" in r ? r.clamped : null);
    assertEquals(clampedOf(regionFor({ x: 0, y: 0 }, { size: 3 })), false);
    assertEquals(clampedOf(regionFor({ x: 0, y: 0 }, { size: 500 })), true);
    
    
    const big = Array.from({ length: 80 }, () => Array(80).fill(1));
    assertEquals(clampedOf(regionFor({ x: 0, y: 0, shape: big }, { footprint: true })), false);
});

Deno.test("a matrix cell and a region are refused together, not silently merged", () => {
    
    
    
    const built = regionFor({ x: 0, y: 0 }, { mx: 2, my: 3, size: 5 });
    assert("error" in built, "a contradictory address should be refused");
    if (!("error" in built)) return;
    
    assert(/Matrix X\/Y/.test(built.error));
    
    const alone = regionFor({ x: 0, y: 0 }, { mx: 2, my: 3 });
    assert(!("error" in alone));
    if (!("error" in alone)) assertEquals(alone.range, [{ x: 2, y: 3 }]);
});

Deno.test("a walk never accepts a matrix cell", () => {
    
    
    const built = walkRangeFor({ x: 0, y: 0 }, { mx: 1, my: 1 });
    assert("error" in built);
    if ("error" in built) assert(/range walk/.test(built.error));
});

Deno.test("createElement can set a lifetime, and it is not a separate write", () => {
    
    
    
    
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
    
    
    
    const fake = fakeContext();
    elementActions.createElement.fn(at, fake.ctx, { element: "sand", footprint: true });
    assertEquals(fake.batch()[0].options, undefined);
    fake.done();
});

Deno.test("a zero lifetime is not sent, because 0 is not a real duration", () => {
    
    
    
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
    
    
    const fake = fakeContext();
    assertEquals(elementActions.replaceElement.fn(at, fake.ctx, { footprint: true }), false);
    assertEquals(fake.batch().length, 0, "an empty batch, and no writes queued");
    fake.done();
});
