
import { assertEquals } from "https:
import { structureActions } from "../actions/structure/index.ts";


interface Call {
    fn: string;
    x: number;
    y: number;
    rest: unknown[];
}


function mapFrame(value: number, thresholds: number[]): number {
    let index = 0;
    while (index < thresholds.length && value >= thresholds[index]) index++;
    return index;
}


interface FakeCell {
    x?: number;
    y?: number;
    type?: unknown;
    data?: Record<string, unknown>;
}


function fakeApi(cells: Record<string, FakeCell> = {}) {
    const world = new Map<string, FakeCell>(Object.entries(cells));
    const calls: Call[] = [];
    
    const pushedInstances: unknown[] = [];
    const record = (fn: string) => (x: number, y: number, ...rest: unknown[]) => {
        calls.push({ fn, x, y, rest });
    };
    const api: Record<string, unknown> = {
        getAtCell: (x: number, y: number) => world.get(`${x},${y}`) ?? null,
        hasBuiltAtCell: (x: number, y: number) => {
            record("hasBuiltAtCell")(x, y);
            return world.has(`${x},${y}`);
        },
        isTypeAtCell: (x: number, y: number, ref: string) => {
            record("isTypeAtCell")(x, y, ref);
            return world.get(`${x},${y}`)?.type === ref;
        },
        isType: (s: { type?: unknown }, ref: string) => {
            calls.push({ fn: "isType", x: -1, y: -1, rest: [ref] });
            return s?.type === ref;
        },
        isBlockedByPlayerAtCell: record("isBlockedByPlayerAtCell"),
        isLauncherAtCell: record("isLauncherAtCell"),
        buildAtCell: (x: number, y: number, ref: string) => {
            record("buildAtCell")(x, y, ref);
            const key = `${x},${y}`;
            world.set(key, { ...(world.get(key) ?? {}), type: ref });
        },
        removeAtCell: (x: number, y: number, options?: unknown) => {
            record("removeAtCell")(x, y, options);
            world.delete(`${x},${y}`);
        },
        removeAtCells: (positions: { x: number; y: number }[], options?: unknown) => {
            
            calls.push({
                fn: "removeAtCells",
                x: positions[0]?.x ?? -1,
                y: positions[0]?.y ?? -1,
                rest: [positions, options],
            });
            for (const p of positions) world.delete(`${p.x},${p.y}`);
        },
        
        
        
        update: (s: unknown, options?: unknown) => {
            calls.push({ fn: "update", x: -1, y: -1, rest: [options] });
            pushedInstances.push(s);
        },
        updateData: (s: { x?: number; y?: number }, partial: unknown, options?: unknown) => {
            calls.push({ fn: "updateData", x: -1, y: -1, rest: [partial, options] });
            if (s && typeof s.x === "number") {
                const key = `${s.x},${s.y}`;
                world.set(key, {
                    ...(world.get(key) ?? {}),
                    data: { ...(world.get(key)?.data ?? {}), ...(partial as object) },
                });
            }
        },
        setSpritesheetIndex: record("setSpritesheetIndex"),
        setSpritesheetIndexAtCell: record("setSpritesheetIndexAtCell"),
        setSpritesheetIndexByValue: record("setSpritesheetIndexByValue"),
        setSpritesheetIndexByValueAtCell: record("setSpritesheetIndexByValueAtCell"),
        
        
        mapValueToSpritesheetIndex: mapFrame,
        processing: {
            isEnabledAtCell: (x: number, y: number) => {
                record("isEnabledAtCell")(x, y);
                return world.get(`${x},${y}`) !== undefined;
            },
            setEnabledAtCell: (x: number, y: number, enabled: boolean) => {
                record("setEnabledAtCell")(x, y, enabled);
                return enabled;
            },
        },
    };
    const g = globalThis as unknown as { sandkit?: { api: Record<string, unknown> } };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = { api: { structures: api } };
    return {
        calls,
        world,
        
        names: () => calls.map((c) => c.fn),
        
        only: (fn: string) => {
            const found = calls.filter((c) => c.fn === fn);
            assertEquals(found.length, 1, `expected one ${fn}, got ${found.length}`);
            return found[0];
        },
        
        all: (fn: string) => calls.filter((c) => c.fn === fn),
        done: () => {
            if (had) g.sandkit = prev;
            else delete g.sandkit;
        },
    };
}

const S4 = [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]];
const at = { x: 100, y: 200, shape: S4 };

Deno.test("structureType returns the engine's handle, and it round-trips", () => {
    
    
    
    
    const fake = fakeApi({ "100,200": { type: 42 } });
    const handle = structureActions.structureType.fn(at, null, {});
    assertEquals(handle, "42", "stringified for binding, but the same value");
    
    
    
    
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: handle }),
        true,
        "a handle must compare correctly against itself",
    );
    fake.done();
});

Deno.test("a digit-only reference is retried as a number, and only as a number", () => {
    
    
    
    
    
    
    
    
    const fake = fakeApi({ "100,200": { type: 42 } });
    assertEquals(structureActions.isStructureType.fn(at, null, { structure: "42" }), true);
    fake.done();

    
    
    const other = fakeApi({ "100,200": { type: "planterBox2" } });
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: "planterBox2" }),
        true,
    );
    
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: "2" }),
        false,
        "a bare number is a handle, never a match for a named id",
    );
    other.done();
});

Deno.test("a real id matches by string, with no coercion involved", () => {
    
    
    const fake = fakeApi({ "100,200": { type: "planterBox" } });
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: "planterBox" }),
        true,
    );
    assertEquals(structureActions.isStructureType.fn(at, null, { structure: "furnace" }), false);
    fake.done();
});

Deno.test("an empty cell reads as the empty string, never null", () => {
    
    
    const fake = fakeApi();
    assertEquals(structureActions.structureType.fn(at, null, {}), "");
    assertEquals(structureActions.structureData.fn(at, null, { key: "mode" }), "");
    assertEquals(structureActions.hasStructure.fn(at, null, {}), false);
    assertEquals(structureActions.countStructures.fn(at, null, { footprint: true }), 0);
    fake.done();
});

Deno.test("a footprint write is one call per cell, and may half-apply", () => {
    
    
    
    
    const fake = fakeApi();
    assertEquals(
        structureActions.buildStructure.fn(at, null, { structure: "press", footprint: true }),
        true,
    );
    assertEquals(fake.all("buildAtCell").length, 16);
    fake.done();
});

Deno.test("removeStructures is ONE call, and removeStructure is sixteen", () => {
    
    
    
    
    const batched = fakeApi();
    assertEquals(structureActions.removeStructures.fn(at, null, { footprint: true }), true);
    assertEquals((batched.only("removeAtCells").rest[0] as unknown[]).length, 16);
    batched.done();

    const perCell = fakeApi();
    assertEquals(structureActions.removeStructure.fn(at, null, { footprint: true }), true);
    assertEquals(perCell.all("removeAtCell").length, 16);
    assertEquals(perCell.names().includes("removeAtCells"), false);
    perCell.done();
});

Deno.test("a numeric data field is sent as a number, and 0 is a number", () => {
    
    
    
    
    const fake = fakeApi({ "100,200": { x: 100, y: 200 } });
    structureActions.setStructureData.fn(at, null, { key: "channel", numberValue: 3 });
    assertEquals(fake.only("updateData").rest[0], { channel: 3 });
    structureActions.setStructureData.fn(at, null, { key: "channel", numberValue: 0 });
    const last = fake.all("updateData").at(-1);
    assertEquals(last?.rest[0], { channel: 0 }, "zero is a value, not an absence");
    fake.done();
});

Deno.test("a text data field is sent as a string, and Number value wins", () => {
    const fake = fakeApi({ "100,200": { x: 100, y: 200 } });
    structureActions.setStructureData.fn(at, null, { key: "mode", value: "allow" });
    assertEquals(fake.only("updateData").rest[0], { mode: "allow" });
    
    
    structureActions.setStructureData.fn(at, null, {
        key: "mode",
        value: "7",
        numberValue: 7,
    });
    assertEquals(fake.all("updateData").at(-1)?.rest[0], { mode: 7 });
    fake.done();
});

Deno.test("no key means no write, rather than an empty partial", () => {
    
    
    const fake = fakeApi();
    assertEquals(structureActions.setStructureData.fn(at, null, { value: "orphan" }), false);
    assertEquals(fake.names().includes("updateData"), false);
    fake.done();
});

Deno.test("propagateToWorkers is passed through, and defaults to off", () => {
    
    
    
    const fake = fakeApi({ "100,200": { x: 100, y: 200 } });
    structureActions.setStructureData.fn(at, null, { key: "mode", value: "allow" });
    assertEquals(fake.only("updateData").rest[1], { propagateToWorkers: false });
    structureActions.setStructureData.fn(at, null, {
        key: "mode",
        value: "deny",
        propagateToWorkers: true,
    });
    assertEquals(fake.all("updateData").at(-1)?.rest[1], { propagateToWorkers: true });
    fake.done();
});

Deno.test("a threshold list drives the frame, and a value without one does nothing", () => {
    
    
    
    const fake = fakeApi();
    const thresholds = "25,50,75";
    assertEquals(structureActions.mapSpritesheetValue.fn(at, null, { value2: 60, thresholds }), 2);
    assertEquals(
        structureActions.setSpritesheetByValue.fn(at, null, { value2: 60, thresholds }),
        true,
    );
    assertEquals(fake.only("setSpritesheetIndexByValueAtCell").rest, [60, [25, 50, 75]]);
    
    
    assertEquals(
        structureActions.setSpritesheetByValue.fn(at, null, { value2: 60, thresholds: "" }),
        false,
    );
    assertEquals(fake.all("setSpritesheetIndexByValueAtCell").length, 1, "still just the one");
    assertEquals(structureActions.mapSpritesheetValue.fn(at, null, { value2: 60 }), -1);
    fake.done();
});

Deno.test("a threshold list accepts spaces as well as commas", () => {
    
    
    
    const fake = fakeApi();
    assertEquals(
        structureActions.mapSpritesheetValue.fn(at, null, { value2: 60, thresholds: "25 50 75" }),
        2,
    );
    fake.done();
});

Deno.test("a garbage threshold is dropped, not sent as NaN", () => {
    
    
    
    
    
    
    
    
    const fake = fakeApi();
    assertEquals(
        structureActions.mapSpritesheetValue.fn(at, null, { value2: 60, thresholds: "25,x,75" }),
        1,
        "the bad entry is dropped and 75 is still reachable at a higher value",
    );
    assertEquals(
        structureActions.mapSpritesheetValue.fn(at, null, { value2: 90, thresholds: "25,x,75" }),
        2,
        "and 90 still meets the 75 threshold",
    );
    fake.done();
});

Deno.test("pushStructure is the other half of an in-place data edit", () => {
    
    
    
    
    const fake = fakeApi();
    assertEquals(structureActions.pushStructure.fn(at, null, {}), true);
    assertEquals(fake.only("update").rest, [{ propagateToWorkers: false }]);
    fake.done();

    const pushed = fakeApi();
    structureActions.pushStructure.fn(at, null, { propagateToWorkers: true });
    assertEquals(pushed.only("update").rest, [{ propagateToWorkers: true }]);
    pushed.done();
});

Deno.test("with no api.structures every write refuses rather than throwing", () => {
    
    
    
    
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    delete g.sandkit;
    try {
        for (
            const key of [
                "buildStructure",
                "removeStructure",
                "removeStructures",
                "setStructureEnabled",
                "setSpritesheetIndex",
                "setSpritesheetByValue",
                "setStructureData",
                "pushStructure",
            ] as const
        ) {
            assertEquals(
                structureActions[key].fn(at, at, {
                    structure: "x",
                    key: "k",
                    thresholds: "1,2",
                }),
                false,
                `${key} must refuse without a namespace`,
            );
        }
    } finally {
        if (had) g.sandkit = prev;
    }
});

Deno.test("reads are falsy rather than throwing when the namespace is missing", () => {
    
    
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    delete g.sandkit;
    try {
        assertEquals(structureActions.hasStructure.fn(at, null, {}), false);
        assertEquals(structureActions.isMyType.fn(at, null, { structure: "x" }), false);
        assertEquals(structureActions.isLauncher.fn(at, null, {}), false);
        assertEquals(structureActions.isBlockedByPlayer.fn(at, null, {}), false);
        assertEquals(structureActions.isStructureEnabled.fn(at, null, {}), false);
        assertEquals(structureActions.structureType.fn(at, null, {}), "");
        assertEquals(structureActions.structureData.fn(at, null, { key: "mode" }), "");
        assertEquals(structureActions.countStructures.fn(at, null, { footprint: true }), 0);
        assertEquals(structureActions.mapSpritesheetValue.fn(at, null, { value2: 1 }), -1);
    } finally {
        if (had) g.sandkit = prev;
    }
});

Deno.test("an action with no structure type set refuses rather than writing nothing", () => {
    
    
    
    const fake = fakeApi();
    assertEquals(structureActions.buildStructure.fn(at, null, { footprint: true }), false);
    assertEquals(fake.names().length, 0, "not one call was made");
    fake.done();
});
