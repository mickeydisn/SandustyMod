/**
 * The terrain family, against a fake `api.terrains` **and** a fake `api.grid.mutate`.
 *
 * ## What is worth testing here
 *
 * The region maths is shared and already covered. What is specific to this family is the
 * one property no other family has: **the write path is split**, and the split is the
 * whole design.
 *
 * 1. **The batched three.** `createTerrain`, `replaceTerrain` and `removeTerrain` must go
 *    through `api.grid.mutate`'s `terrains` writer — **one** `mutate` call for a whole
 *    footprint. A regression that quietly switched them to `api.terrains.*` would still
 *    work, would still be green in most tests, and would lose atomicity silently. So the
 *    test counts `mutate` calls directly.
 * 2. **The per-cell two.** `damageTerrain` and `setTerrainHitPoints` have no writer method,
 *    so they must *not* claim a batch. Counting their per-cell calls is what pins that.
 * 3. **`getIdByType`.** Terrain has it and structures do not, which is why `terrainType`
 *    returns a real id. Worth a test, because the fallback path (no converter) is the one
 *    the structure family is stuck with.
 * 4. **`hitPoints` vs `null`.** "No terrain" and "terrain with no hp" are different
 *    answers that the action deliberately collapses to one number.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { terrainActions } from "../actions/terrain/index.ts";

/** One call the fake recorded. */
interface Call {
    fn: string;
    x: number;
    y: number;
    rest: unknown[];
}

/** A cell in the fake world. */
interface FakeCell {
    x?: number;
    y?: number;
    cellType?: number;
    hitPoints?: number | null;
}

/** A terrain id, for the fake's `getIdByType` to map. */
const IDS: Record<number, string> = { 1: "dirt", 2: "stone", 3: "ice" };

/**
 * The fake `api`, holding **both** namespaces the family uses.
 *
 * `grid.mutate` is recorded and then called back with a writer, so a test can assert how
 * many times a batch was submitted as well as what the writer was told to do. That is the
 * only way to distinguish "one atomic batch of 16" from "16 calls", which is the whole
 * point of this file.
 */
function fakeApi(cells: Record<string, FakeCell> = {}) {
    const world = new Map<string, FakeCell>(Object.entries(cells));
    const calls: Call[] = [];
    /** How many times `api.grid.mutate` was entered. */
    let batches = 0;
    /** Everything the batch writer was told, across every batch. */
    const written: { fn: string; x: number; y: number; rest: unknown[] }[] = [];
    const record = (fn: string) => (x: number, y: number, ...rest: unknown[]) => {
        calls.push({ fn, x, y, rest });
    };
    const writer = {
        createAtCell: (x: number, y: number, type: unknown, options?: unknown) => {
            written.push({ fn: "w.createAtCell", x, y, rest: [type, options] });
        },
        replaceAtCell: (x: number, y: number, type: unknown, options?: unknown) => {
            written.push({ fn: "w.replaceAtCell", x, y, rest: [type, options] });
        },
        removeAtCell: (x: number, y: number, options?: unknown) => {
            written.push({ fn: "w.removeAtCell", x, y, rest: [options] });
        },
    };
    const api: Record<string, unknown> = {
        grid: {
            mutate: (cb: (w: { terrains: typeof writer }) => void) => {
                batches++;
                cb({ terrains: writer });
            },
        },
        terrains: {
            getTypeAtCell: (x: number, y: number) => {
                record("getTypeAtCell")(x, y);
                return world.get(`${x},${y}`)?.cellType ?? null;
            },
            getDataAtCell: (x: number, y: number) => {
                record("getDataAtCell")(x, y);
                const c = world.get(`${x},${y}`);
                return c ? { cellType: c.cellType, hitPoints: c.hitPoints ?? null } : null;
            },
            isAtCell: (x: number, y: number) => {
                record("isAtCell")(x, y);
                return world.has(`${x},${y}`);
            },
            isTypeAtCell: (x: number, y: number, ref: unknown) => {
                record("isTypeAtCell")(x, y, ref);
                const type = world.get(`${x},${y}`)?.cellType;
                return type === ref || IDS[type as number] === ref;
            },
            damageAtCell: (x: number, y: number, amount: number) => {
                record("damageAtCell")(x, y, amount);
            },
            setHitPointsAtCell: (x: number, y: number, hp: number) => {
                record("setHitPointsAtCell")(x, y, hp);
                return true;
            },
            getIdByType: (type: number) => {
                record("getIdByType")(-1, -1, type);
                return IDS[type] ?? "";
            },
        },
    };
    const g = globalThis as unknown as { sandkit?: { api: Record<string, unknown> } };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = { api };
    return {
        calls,
        written,
        /** How many coherent batches were submitted. */
        batchCount: () => batches,
        /** The per-cell calls of a direct `api.terrains` method. */
        all: (fn: string) => calls.filter((c) => c.fn === fn),
        done: () => {
            if (had) g.sandkit = prev;
            else delete g.sandkit;
        },
    };
}

const S4 = [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]];
const at = { x: 100, y: 200, shape: S4 };

Deno.test("a footprint write is ONE batch, not sixteen calls", () => {
    // The property this family has and the other three do not, asserted directly.
    //
    // The regression this guards against is quiet: switching these three back to
    // `api.terrains.*` would still create the terrain, would still pass every functional
    // test, and would lose atomicity with nothing reporting it. Counting `mutate` entries
    // is the only assertion that notices.
    const fake = fakeApi();
    assertEquals(
        terrainActions.createTerrain.fn(at, null, { terrain: "stone", footprint: true }),
        true,
    );
    assertEquals(fake.batchCount(), 1, "one coherent batch for sixteen cells");
    assertEquals(fake.written.length, 16, "and sixteen writes inside it");
    assertEquals(fake.all("createAtCell").length, 0, "never the per-cell api call");
    fake.done();
});

Deno.test("the batched three all go through the writer, and none through the api", () => {
    for (const key of ["createTerrain", "replaceTerrain", "removeTerrain"] as const) {
        const fake = fakeApi();
        terrainActions[key].fn(at, null, { terrain: "stone", footprint: true });
        assertEquals(fake.batchCount(), 1, `${key} must use one batch`);
        assertEquals(
            fake.all("createAtCell").length + fake.all("replaceAtCell").length +
                fake.all("removeAtCell").length,
            0,
            `${key} must not call the per-cell api`,
        );
        fake.done();
    }
});

Deno.test("the state writes are per-cell, and must not claim a batch", () => {
    // The other half of the split. There is no `w.terrains.damageAtCell`, so these are
    // sixteen independent calls — and the test is that the batch count stays at **zero**.
    // Asserting the sixteen is necessary; asserting the zero is the point.
    const fake = fakeApi();
    assertEquals(
        terrainActions.damageTerrain.fn(at, null, { damage: 5, footprint: true }),
        true,
    );
    assertEquals(fake.batchCount(), 0, "no writer method exists, so no batch is claimed");
    assertEquals(fake.all("damageAtCell").length, 16);
    assertEquals(fake.all("damageAtCell")[0].rest, [5]);
    fake.done();

    const repair = fakeApi();
    assertEquals(
        terrainActions.setTerrainHitPoints.fn(at, null, { hitPoints: 100, footprint: true }),
        true,
    );
    assertEquals(repair.batchCount(), 0);
    assertEquals(repair.all("setHitPointsAtCell").length, 16);
    repair.done();
});

Deno.test("create skips occupied cells, and replace does not", () => {
    // The difference between the two batched writes, and the reason they are separate
    // actions rather than one with a mode flag: create only fills empty cells, replace
    // overwrites whatever is there. Half a footprint already walled is half a create.
    const fake = fakeApi({ "100,200": { cellType: 1 } });
    terrainActions.createTerrain.fn(at, null, { terrain: "stone", footprint: true });
    assertEquals(
        fake.written.filter((w) => w.x === 100 && w.y === 200).length,
        0,
        "the occupied cell was skipped",
    );
    assertEquals(fake.written.length, 15, "the other fifteen were created");
    fake.done();

    const over = fakeApi({ "100,200": { cellType: 1 } });
    terrainActions.replaceTerrain.fn(at, null, { terrain: "stone", footprint: true });
    assertEquals(
        over.written.filter((w) => w.x === 100 && w.y === 200).length,
        1,
        "replace overwrites, which is its whole point",
    );
    assertEquals(over.written.length, 16);
    over.done();
});

Deno.test("terrainType returns a real id, because terrains have getIdByType", () => {
    // The one place this family is *better* than the structure family. `getTypeAtCell`
    // returns a number; `getIdByType` turns it into a name, so the bind is something an
    // author can type. Structures have no such function and `structureType` is stuck
    // returning a raw handle — the difference is the engine's, and this test is what keeps
    // the asymmetry honest.
    const fake = fakeApi({ "100,200": { cellType: 2 } });
    assertEquals(terrainActions.terrainType.fn(at, null, {}), "stone");
    assertEquals(terrainActions.isTerrainType.fn(at, null, { terrain: "stone" }), true);
    fake.done();
});

Deno.test("with no getIdByType the handle comes back, still usable", () => {
    // The fallback the structure family lives in permanently. The value is a raw handle
    // rather than a name, so it is only good for feeding back to `isTerrainType` — which
    // is exactly what the structure family's test pins, and the reason this action cannot
    // simply drop the fallback.
    const fake = fakeApi({ "100,200": { cellType: 2 } });
    const g = globalThis as unknown as { sandkit?: { api: { terrains: Record<string, unknown> } } };
    delete (g.sandkit!.api.terrains as Record<string, unknown>).getIdByType;
    assertEquals(terrainActions.terrainType.fn(at, null, {}), "2");
    assertEquals(terrainActions.isTerrainType.fn(at, null, { terrain: "2" }), true);
    fake.done();
});

Deno.test("hit points distinguish no terrain from terrain with none", () => {
    // The engine reports `hitPoints: null` for a terrain type that is not breakable, and
    // no data at all for an empty cell. Those are different facts and the action collapses
    // both to `-1` on purpose, so a `decide` step has one failure value rather than two.
    const fake = fakeApi({
        "100,200": { cellType: 1, hitPoints: 50 },
        "101,200": { cellType: 3, hitPoints: null },
    });
    assertEquals(terrainActions.terrainHitPoints.fn(at, null, {}), 50, "a normal wall");
    assertEquals(
        terrainActions.terrainHitPoints.fn(at, null, { dx: 1, size: 1 }),
        -1,
        "unbreakable terrain reports no hp, and that is -1 too",
    );
    assertEquals(
        terrainActions.terrainHitPoints.fn(at, null, { dx: 9 }),
        -1,
        "and an empty cell is the same -1",
    );
    fake.done();
});

Deno.test("an empty cell reads as the empty string, and -1 for a handle", () => {
    // Absence is spelled so every read stays bindable: `""` for the id, `-1` for the
    // number. Neither returns `null`, which `{{name}}` cannot resolve.
    const fake = fakeApi();
    assertEquals(terrainActions.terrainType.fn(at, null, {}), "");
    assertEquals(terrainActions.terrainTypeHandle.fn(at, null, {}), -1);
    assertEquals(terrainActions.hasTerrain.fn(at, null, {}), false);
    assertEquals(terrainActions.countTerrain.fn(at, null, { footprint: true }), 0);
    fake.done();
});

Deno.test("countTerrain counts a region, and skips the empties", () => {
    const fake = fakeApi({
        "100,200": { cellType: 1 },
        "101,200": { cellType: 2 },
        "102,201": { cellType: 2 },
    });
    assertEquals(terrainActions.countTerrain.fn(at, null, { footprint: true }), 3);
    fake.done();
});

Deno.test("a write with no amount refuses rather than writing nothing", () => {
    // Zero damage and an unset hit-points field both look like "nothing to do" from the
    // outside, and both are a mis-set panel field. The warning is the whole response: a
    // silent no-op would look like a successful write.
    const fake = fakeApi();
    assertEquals(terrainActions.damageTerrain.fn(at, null, { footprint: true }), false);
    assertEquals(terrainActions.damageTerrain.fn(at, null, { damage: 0 }), false);
    assertEquals(terrainActions.setTerrainHitPoints.fn(at, null, {}), false);
    assertEquals(
        terrainActions.setTerrainHitPoints.fn(at, null, { hitPoints: -5 }),
        false,
        "a negative is not hit points",
    );
    assertEquals(fake.calls.length, 0, "not one call was made");
    fake.done();
});

Deno.test("zero hit points is a value, not an absence", () => {
    // `0` is the panel's default and means "destroy the terrain" — the engine destroys at
    // zero, so this is a real instruction, not a missing field. A naive "is it set" guard
    // would refuse the single most destructive thing an author can ask for.
    const fake = fakeApi();
    assertEquals(terrainActions.setTerrainHitPoints.fn(at, null, { hitPoints: 0 }), true);
    assertEquals(fake.all("setHitPointsAtCell")[0].rest, [0]);
    fake.done();
});

Deno.test("skipShadow reaches the writer, and is absent when off", () => {
    // `TerrainMutationOptions` carries exactly one field, so this is the whole options
    // surface. Sending `{}` instead of `undefined` would be harmless to the engine, but
    // asserting the absence keeps the payload minimal and documents that nothing else is
    // quietly being sent.
    const on = fakeApi();
    terrainActions.createTerrain.fn(at, null, { terrain: "stone", skipShadow: true });
    assertEquals(on.written[0].rest, ["stone", { skipShadow: true }]);
    on.done();

    const off = fakeApi();
    terrainActions.createTerrain.fn(at, null, { terrain: "stone" });
    assertEquals(off.written[0].rest, ["stone", undefined]);
    off.done();
});

Deno.test("no grid.mutate means the batched three refuse rather than half-write", () => {
    // The Main-only cost, and the one that would bite first. `api.grid.mutate` is
    // ✓ Main / — Worker, so a mod that later adds a `workerEntry` loses the three batched
    // writes. The failure mode that matters is a **silent** downgrade to per-cell calls:
    // terrain would still appear, just without atomicity, and nothing would say so. So
    // these refuse outright rather than falling back.
    const fake = fakeApi();
    const g = globalThis as unknown as { sandkit?: { api: Record<string, unknown> } };
    delete (g.sandkit!.api as Record<string, unknown>).grid;
    for (
        const key of ["createTerrain", "replaceTerrain", "removeTerrain"] as const
    ) {
        assertEquals(
            terrainActions[key].fn(at, null, { terrain: "stone", footprint: true }),
            false,
            `${key} must refuse without a writer`,
        );
    }
    assertEquals(fake.written.length, 0, "and not one cell was written the slow way");
    fake.done();
});

Deno.test("no api.terrains means every action is falsy rather than throwing", () => {
    // A read or a state write on a thread without the namespace degrades to its "nothing
    // there" value, so a program faulting is avoided. The two batched writes refuse for a
    // different reason — they need the *reads* to decide inside the batch — and are
    // covered by the test above.
    const g = globalThis as unknown as { sandkit?: { api: Record<string, unknown> } };
    const fake = fakeApi();
    delete (g.sandkit!.api as Record<string, unknown>).terrains;
    try {
        assertEquals(terrainActions.hasTerrain.fn(at, null, {}), false);
        assertEquals(terrainActions.isTerrainType.fn(at, null, { terrain: "dirt" }), false);
        assertEquals(terrainActions.terrainType.fn(at, null, {}), "");
        assertEquals(terrainActions.terrainTypeHandle.fn(at, null, {}), -1);
        assertEquals(terrainActions.terrainHitPoints.fn(at, null, {}), -1);
        assertEquals(terrainActions.countTerrain.fn(at, null, { footprint: true }), 0);
        assertEquals(terrainActions.damageTerrain.fn(at, null, { damage: 5 }), false);
        assertEquals(terrainActions.setTerrainHitPoints.fn(at, null, { hitPoints: 5 }), false);
    } finally {
        fake.done();
    }
});

Deno.test("with no sandkit at all, nothing throws", () => {
    // The last-resort guard: an action running where the host never installed the api.
    // Every one of the eleven must return its failure value rather than raising, because a
    // throw inside a processor tick surfaces as an unexplained fault in whatever structure
    // the player is looking at.
    //
    // The expected value is **typed**, not uniformly `false`. A read returns the "nothing
    // there" value for its own shape — `""`, `-1`, `0` — and only a write returns `false`.
    // That distinction is the point of the check: it fails if an action ever starts
    // returning `false` where the panel expects a number, because a bind of `false` in a
    // numeric field is a silent wrong answer rather than a visible one.
    const expected: Record<string, unknown> = {
        terrainType: "",
        hasTerrain: false,
        isTerrainType: false,
        terrainHitPoints: -1,
        terrainTypeHandle: -1,
        countTerrain: 0,
        createTerrain: false,
        replaceTerrain: false,
        removeTerrain: false,
        damageTerrain: false,
        setTerrainHitPoints: false,
    };
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    delete g.sandkit;
    try {
        for (const [key, want] of Object.entries(expected)) {
            const action = (terrainActions as Record<
                string,
                { fn: (a: unknown, b: unknown, c: unknown) => unknown }
            >)[key];
            assertEquals(
                action.fn(at, at, { terrain: "dirt", hitPoints: 1 }),
                want,
                `${key} must return ${JSON.stringify(want)} rather than throw`,
            );
        }
    } finally {
        if (had) g.sandkit = prev;
    }
});
