
import { assertEquals } from "https:
import { terrainActions } from "../actions/terrain/index.ts";


interface Call {
    fn: string;
    x: number;
    y: number;
    rest: unknown[];
}


interface FakeCell {
    x?: number;
    y?: number;
    cellType?: number;
    hitPoints?: number | null;
}


const IDS: Record<number, string> = { 1: "dirt", 2: "stone", 3: "ice" };


function fakeApi(cells: Record<string, FakeCell> = {}) {
    const world = new Map<string, FakeCell>(Object.entries(cells));
    const calls: Call[] = [];
    
    let batches = 0;
    
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
        
        batchCount: () => batches,
        
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
    
    
    
    
    
    const fake = fakeApi({ "100,200": { cellType: 2 } });
    assertEquals(terrainActions.terrainType.fn(at, null, {}), "stone");
    assertEquals(terrainActions.isTerrainType.fn(at, null, { terrain: "stone" }), true);
    fake.done();
});

Deno.test("with no getIdByType the handle comes back, still usable", () => {
    
    
    
    
    const fake = fakeApi({ "100,200": { cellType: 2 } });
    const g = globalThis as unknown as { sandkit?: { api: { terrains: Record<string, unknown> } } };
    delete (g.sandkit!.api.terrains as Record<string, unknown>).getIdByType;
    assertEquals(terrainActions.terrainType.fn(at, null, {}), "2");
    assertEquals(terrainActions.isTerrainType.fn(at, null, { terrain: "2" }), true);
    fake.done();
});

Deno.test("hit points distinguish no terrain from terrain with none", () => {
    
    
    
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
    
    
    
    const fake = fakeApi();
    assertEquals(terrainActions.setTerrainHitPoints.fn(at, null, { hitPoints: 0 }), true);
    assertEquals(fake.all("setHitPointsAtCell")[0].rest, [0]);
    fake.done();
});

Deno.test("skipShadow reaches the writer, and is absent when off", () => {
    
    
    
    
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
