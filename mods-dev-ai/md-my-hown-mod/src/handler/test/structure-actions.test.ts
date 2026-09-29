/**
 * The structure family, against a fake `api.structures`.
 *
 * ## What is worth testing here
 *
 * The region maths is already covered in `cell-region.test.ts` and is shared with the
 * element family, so what is left is the part specific to *this* family:
 *
 * 1. **The handle trap.** `Structure` has no declared `type`, and there is no
 *    `getIdByType` for structures. `structureType` returns whatever the engine holds, and
 *    the honest thing to assert is that it comes back *unchanged* rather than prettified
 *    into something the engine would not accept again.
 * 2. **The batched removal.** `removeStructures` is the only batched structure write that
 *    exists, so "one call for the whole region" is the property worth pinning.
 * 3. **The numeric data field.** `numberValue` exists because `{channel: "3"}` where the
 *    machine reads `channel === 3` is a silent failure; a test that does not check the
 *    *type* of what is sent has not checked the thing that matters.
 * 4. **The missing namespace.** A worker thread has no `api.structures`, and every action
 *    must warn and return a falsy value rather than throw inside a processor tick.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { structureActions } from "../actions/structure/index.ts";

/** One call the fake recorded. */
interface Call {
    fn: string;
    x: number;
    y: number;
    rest: unknown[];
}

/** The engine's own rule as the docs describe it: first threshold met or exceeded. */
function mapFrame(value: number, thresholds: number[]): number {
    let index = 0;
    while (index < thresholds.length && value >= thresholds[index]) index++;
    return index;
}

/** A cell in the fake world: the engine's own record, so `x`/`y` are present. */
interface FakeCell {
    x?: number;
    y?: number;
    type?: unknown;
    data?: Record<string, unknown>;
}

/**
 * A stand-in for `api.structures` on the global, which is where `hostNs` looks.
 *
 * The world is a `Map` keyed `"x,y"` so a **missing** cell stays distinct from a cell
 * holding `""` — the same reason the element family's fake is shaped that way.
 *
 * Every method is present, not just the ones a given test uses, so a test reaching for
 * something undeclared fails as a *missing* call rather than as a silent `undefined` that
 * a `=== true` check would quietly turn into `false`.
 */
function fakeApi(cells: Record<string, FakeCell> = {}) {
    const world = new Map<string, FakeCell>(Object.entries(cells));
    const calls: Call[] = [];
    /** The instances handed to instance-taking methods, in order. */
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
            // One call, many positions — the whole reason this is a separate action.
            calls.push({
                fn: "removeAtCells",
                x: positions[0]?.x ?? -1,
                y: positions[0]?.y ?? -1,
                rest: [positions, options],
            });
            for (const p of positions) world.delete(`${p.x},${p.y}`);
        },
        // `update` takes the **instance**, not a cell — it is the push half of an
        // in-place `data` edit, so it has no cell coordinates. The instance is asserted
        // on separately rather than mixed into `rest`, which is for the *options*.
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
        // Recreated rather than stubbed, so a threshold list is actually exercised
        // instead of echoed back — a stub returning a constant would pass either way.
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
        /** The calls made, by method name. */
        names: () => calls.map((c) => c.fn),
        /** The single call of a given method, asserting there was exactly one. */
        only: (fn: string) => {
            const found = calls.filter((c) => c.fn === fn);
            assertEquals(found.length, 1, `expected one ${fn}, got ${found.length}`);
            return found[0];
        },
        /** Every call of a method, for the ones expected to repeat. */
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
    // The trap, pinned from both sides. The engine stores a **number** on a field it
    // never declares and offers no `getIdByType` to convert it to an id, so this action
    // cannot invent one — it hands the value back, stringified, because a bind is a
    // string.
    const fake = fakeApi({ "100,200": { type: 42 } });
    const handle = structureActions.structureType.fn(at, null, {});
    assertEquals(handle, "42", "stringified for binding, but the same value");
    // The round-trip that matters: a handle read and fed straight back **must** match,
    // or the two actions cannot be composed at all. This is what forced `isStructureType`
    // to retry a digit-only reference as a number — `42 === "42"` is false, and the
    // first version of the pair failed here.
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: handle }),
        true,
        "a handle must compare correctly against itself",
    );
    fake.done();
});

Deno.test("a digit-only reference is retried as a number, and only as a number", () => {
    // The other half of the round-trip fix, and the guard on it. The fake holds the
    // **number** `42`, and `42 === "42"` is false — so a digit-only reference only
    // answers true because `isStructureType` retries it as a number. That retry is
    // exactly the behaviour under test, not an accident of the fake.
    //
    // The narrowness matters as much as the retry: an id that merely *contains* digits is
    // never coerced, because a structure id that looks partly numeric is far more likely
    // to be an id than a handle, and guessing would turn a real id into a false match.
    const fake = fakeApi({ "100,200": { type: 42 } });
    assertEquals(structureActions.isStructureType.fn(at, null, { structure: "42" }), true);
    fake.done();

    // A non-numeric id is left alone: `"planterBox2"` is an id, and coercing it would
    // invent a type that does not exist.
    const other = fakeApi({ "100,200": { type: "planterBox2" } });
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: "planterBox2" }),
        true,
    );
    // …and the digit-only form of it is not silently accepted as that id.
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: "2" }),
        false,
        "a bare number is a handle, never a match for a named id",
    );
    other.done();
});

Deno.test("a real id matches by string, with no coercion involved", () => {
    // The ordinary case, which must not regress because of the numeric fallback: a
    // string type matches the string id directly on the first try.
    const fake = fakeApi({ "100,200": { type: "planterBox" } });
    assertEquals(
        structureActions.isStructureType.fn(at, null, { structure: "planterBox" }),
        true,
    );
    assertEquals(structureActions.isStructureType.fn(at, null, { structure: "furnace" }), false);
    fake.done();
});

Deno.test("an empty cell reads as the empty string, never null", () => {
    // Every read here is bindable, and a bind carries a string. Returning `null` would
    // be the one value `{{name}}` cannot resolve, so absence is spelled `""`.
    const fake = fakeApi();
    assertEquals(structureActions.structureType.fn(at, null, {}), "");
    assertEquals(structureActions.structureData.fn(at, null, { key: "mode" }), "");
    assertEquals(structureActions.hasStructure.fn(at, null, {}), false);
    assertEquals(structureActions.countStructures.fn(at, null, { footprint: true }), 0);
    fake.done();
});

Deno.test("a footprint write is one call per cell, and may half-apply", () => {
    // The property this family cannot have, asserted rather than assumed. `buildAtCell` is
    // not part of any batch — `GridMutationWriter` has no `structures` member — so a 4×4
    // build really is sixteen independent calls, and a throw on the ninth would leave
    // eight machines standing.
    const fake = fakeApi();
    assertEquals(
        structureActions.buildStructure.fn(at, null, { structure: "press", footprint: true }),
        true,
    );
    assertEquals(fake.all("buildAtCell").length, 16);
    fake.done();
});

Deno.test("removeStructures is ONE call, and removeStructure is sixteen", () => {
    // The distinction that keeps them two actions. `removeAtCells` takes a position list;
    // `removeAtCell` takes one cell. Same intent, different engine call, different failure
    // mode — and a program clearing a footprint should get the first without knowing the
    // second exists.
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
    // `{channel: "3"}` where the machine reads `channel === 3` is the failure this
    // parameter exists to prevent, so the assertion is on the *type* of what is sent.
    // The 0 case matters more than it looks: 0 is the panel's default, so a naive
    // "is it set" check would swallow the most common integer a machine stores.
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
    // Both set: the number wins, because a bound variable is always a string and the
    // number is what the author meant when they filled in both.
    structureActions.setStructureData.fn(at, null, {
        key: "mode",
        value: "7",
        numberValue: 7,
    });
    assertEquals(fake.all("updateData").at(-1)?.rest[0], { mode: 7 });
    fake.done();
});

Deno.test("no key means no write, rather than an empty partial", () => {
    // What an unvalidated `partial` does: send `{}`, the engine merges nothing, reports
    // success, and the author sees a data write that silently did not happen.
    const fake = fakeApi();
    assertEquals(structureActions.setStructureData.fn(at, null, { value: "orphan" }), false);
    assertEquals(fake.names().includes("updateData"), false);
    fake.done();
});

Deno.test("propagateToWorkers is passed through, and defaults to off", () => {
    // Instance data lives on Main. A worker that must see the change immediately needs
    // the flag, and the default has to be **off** — sending every write would be a
    // per-tick cost nobody asked for.
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
    // The progress bar, end to end: the same list and the same value through the pure
    // mapper and the writing action, so the two cannot drift apart — which is the reason
    // `mapSpritesheetValue` is a separate action rather than an internal detail.
    const fake = fakeApi();
    const thresholds = "25,50,75";
    assertEquals(structureActions.mapSpritesheetValue.fn(at, null, { value2: 60, thresholds }), 2);
    assertEquals(
        structureActions.setSpritesheetByValue.fn(at, null, { value2: 60, thresholds }),
        true,
    );
    assertEquals(fake.only("setSpritesheetIndexByValueAtCell").rest, [60, [25, 50, 75]]);
    // And with no thresholds there is no frame to choose, so it refuses rather than
    // sending an empty list the engine would have to guess about.
    assertEquals(
        structureActions.setSpritesheetByValue.fn(at, null, { value2: 60, thresholds: "" }),
        false,
    );
    assertEquals(fake.all("setSpritesheetIndexByValueAtCell").length, 1, "still just the one");
    assertEquals(structureActions.mapSpritesheetValue.fn(at, null, { value2: 60 }), -1);
    fake.done();
});

Deno.test("a threshold list accepts spaces as well as commas", () => {
    // Trivial, and worth pinning because the failure is invisible: a list typed with a
    // space that failed to parse would send one garbage threshold and quietly pick frame 0
    // for everything.
    const fake = fakeApi();
    assertEquals(
        structureActions.mapSpritesheetValue.fn(at, null, { value2: 60, thresholds: "25 50 75" }),
        2,
    );
    fake.done();
});

Deno.test("a garbage threshold is dropped, not sent as NaN", () => {
    // `Number("x")` is `NaN`, and a list containing one would compare false against
    // everything and shift every later threshold. Filtering keeps a mistyped entry from
    // silently moving the whole scale.
    //
    // The expectation is `1`, not `2`: with the bad entry gone the scale is `[25, 75]`,
    // and 60 clears 25 (index 1) but not 75. Had the `NaN` survived it would have
    // compared false and 60 would still have stopped at 25 — so the visible difference
    // is that the *tail* of the list still works, which is the part that matters.
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
    // The REMEMBER family's `structureWriteData` assigns `structure.data[key]` and returns
    // without pushing — which mutates a local object and reaches the engine only if
    // something calls `update`. This is that something, and the two together are the
    // engine's documented split: mutate, then push.
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
    // The Main-only cost, and the thing to guard. A mod that later adds a `workerEntry`
    // loses this whole family, and the symptom must be a warning and a `false` — not an
    // exception thrown inside a processor tick, which the engine would surface as an
    // unexplained fault in a structure the player is looking at.
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
    // The other half of the same guard: a read on a worker returns the "nothing there"
    // value — `false`, `""`, `0`, `-1` — so a program degrades instead of faulting.
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
    // A blank id is a mis-set field, and the warning is the whole response — an empty
    // batch would look like a successful no-op, which is the failure mode this family is
    // most exposed to because almost every write goes through a per-cell loop.
    const fake = fakeApi();
    assertEquals(structureActions.buildStructure.fn(at, null, { footprint: true }), false);
    assertEquals(fake.names().length, 0, "not one call was made");
    fake.done();
});
