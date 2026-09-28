/**
 * The motion family, against a fake `api.elements`.
 *
 * ## What these tests are actually for
 *
 * The element family's tests assert on **one batched commit** per region. These cannot:
 * `api.elements.*` has no batch form, so a footprint write is N independent calls and
 * the engine applies them at the flush. The tests below therefore assert the thing that
 * would actually go wrong — a wrong *cell*, a wrong *argument*, or a silent no-op when
 * the namespace is missing — rather than pretending the write is atomic.
 *
 * The fake records every call in order, so "did it hit the right 16 cells in the right
 * order" is checkable even though "did it land as one transaction" is not.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { motionActions } from "../actions/motion/index.ts";

/** One recorded `api.elements` call. */
interface Call {
    fn: string;
    args: unknown[];
}

/**
 * Install a fake `api.elements` on the global the actions read it from, and return the
 * calls it recorded.
 *
 * The actions reach the host through `hostNs("elements")` → `globalThis.sandkit.api`,
 * so a fake has to be installed **there** rather than passed in. That is also the point
 * worth pinning: it is the same path the engine uses, so a test that passed by
 * injection could pass while the real lookup failed.
 */
function withApi(overrides: Record<string, unknown> = {}, run: () => void): Call[] {
    const g = globalThis as { sandkit?: { api: Record<string, unknown> } };
    const calls: Call[] = [];
    const record = (fn: string, result: unknown = undefined) => (...args: unknown[]) => {
        calls.push({ fn, args });
        return result;
    };
    const elements: Record<string, unknown> = {
        setVelocityAtCell: record("setVelocityAtCell"),
        addParticleVelocityAtCell: record("addParticleVelocityAtCell"),
        getVelocityAtCell: record("getVelocityAtCell", { x: 3, y: -4 }),
        setDurationAtCell: record("setDurationAtCell", true),
        teleportBetweenCells: record("teleportBetweenCells"),
        convertToParticleAtCell: record("convertToParticleAtCell"),
        findFreeCellInStructure: record("findFreeCellInStructure", { x: 1, y: 2 }),
        ...overrides,
    };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = { api: { elements } };
    try {
        run();
    } finally {
        if (had) g.sandkit = prev;
        else delete g.sandkit;
    }
    return calls;
}

const at = { x: 100, y: 200, shape: [[1, 1], [1, 1]] };
const S4 = { x: 100, y: 200, shape: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]] };

Deno.test("setVelocity hits every cell of a 4x4 footprint, in row-major order", () => {
    // The order matters as much as the count: a transposed traversal would visit all 16
    // cells and still be a bug, because the *order* is what a reader checking the call
    // log compares against the shape.
    const calls = withApi({}, () => {
        const ok = motionActions.setVelocity.fn(S4, {}, { vx: 5, vy: -10, footprint: true });
        assertEquals(ok, true);
    });
    assertEquals(calls.length, 16);
    assertEquals(calls[0], {
        fn: "setVelocityAtCell",
        args: [100, 200, { x: 5, y: -10 }],
    });
    // (0,0) → (0,3) is the first row; (1,0) starts the second.
    assertEquals(calls[3].args.slice(0, 2), [103, 200]);
    assertEquals(calls[4].args.slice(0, 2), [100, 201]);
    assertEquals(calls[15].args.slice(0, 2), [103, 203]);
});

Deno.test("velocity is a float, never truncated to a cell", () => {
    // The element family truncates every option because cells are integers. Velocity
    // must NOT be: truncating 0.5 to 0 would silently stop a slow drift, and the
    // failure would look like "the engine ignores small velocities".
    const calls = withApi({}, () => {
        motionActions.setVelocity.fn({ x: 0, y: 0 }, {}, { vx: 0.5, vy: -0.25 });
    });
    assertEquals(calls[0].args[2], { x: 0.5, y: -0.25 });
});

Deno.test("a NaN velocity is dropped, not passed to the engine", () => {
    // A blank panel field is `""`, which is `NaN`. The engine would either ignore it or
    // produce a cell that is not a cell; the action substitutes 0 and says so by
    // writing a real vector.
    const calls = withApi({}, () => {
        motionActions.setVelocity.fn({ x: 0, y: 0 }, {}, { vx: "", vy: "" });
    });
    assertEquals(calls[0].args[2], { x: 0, y: 0 });
});

Deno.test("addVelocity omits maxSpeed when it is zero", () => {
    // Passing an explicit 0 would read to the engine as a real clamp and stop the cell
    // dead — the opposite of "add some speed".
    const clamped = withApi({}, () => {
        motionActions.addVelocity.fn({ x: 0, y: 0 }, {}, { vx: 1, maxSpeed: 120 });
    });
    assertEquals(clamped[0].args.length, 4);
    assertEquals(clamped[0].args[3], 120);

    const unclamped = withApi({}, () => {
        motionActions.addVelocity.fn({ x: 0, y: 0 }, {}, { vx: 1, maxSpeed: 0 });
    });
    assertEquals(unclamped[0].args.length, 3, "no clamp argument at all");
});

Deno.test("getVelocity returns a speed, and -1 when there is no particle", () => {
    // Magnitude, not a vector: a bound value has to be comparable by a `decide` step,
    // and an object cannot be. 3-4-5 is the clearest possible proof it is a magnitude.
    withApi({}, () => {
        assertEquals(motionActions.getVelocity.fn({ x: 0, y: 0 }, {}, {}), 5);
    });
    withApi({ getVelocityAtCell: () => null }, () => {
        assertEquals(motionActions.getVelocity.fn({ x: 0, y: 0 }, {}, {}), -1);
    });
    // -1 rather than 0, because 0 is a real answer: a particle sitting still.
});

Deno.test("findFreeCell defaults to the structure's own size", () => {
    // A 4x4 machine asks about a 4x4, not about the single cell it is anchored at.
    const calls = withApi({}, () => {
        motionActions.findFreeCell.fn(S4, {}, {});
    });
    assertEquals(calls[0].args, [100, 200, 4]);

    const explicit = withApi({}, () => {
        motionActions.findFreeCell.fn(S4, {}, { size: 9 });
    });
    assertEquals(explicit[0].args, [100, 200, 9]);
});

Deno.test("findFreeCell returns an index, and -1 when there is no room", () => {
    // `y * side + x` — the only single-number answer that keeps two different cells
    // distinguishable. With side 4, (1,2) is index 9.
    withApi({ findFreeCellInStructure: () => ({ x: 1, y: 2 }) }, () => {
        assertEquals(motionActions.findFreeCell.fn(S4, {}, {}), 9);
    });
    // Null is a **meaningful** answer — "nowhere free" — and must not become 0, which
    // would read as the first cell of the square and look like a success.
    withApi({ findFreeCellInStructure: () => null }, () => {
        assertEquals(motionActions.findFreeCell.fn(S4, {}, {}), -1);
    });
});

Deno.test("setDuration passes ticks and the rearm flag", () => {
    const rearm = withApi({}, () => {
        motionActions.setDuration.fn({ x: 0, y: 0 }, {}, { ticks: 120, rearm: true });
    });
    assertEquals(rearm[0].args, [0, 0, 120, { updateMax: true }]);

    // The panel sends a string, and `"false"` must not read as truthy.
    const noRearm = withApi({}, () => {
        motionActions.setDuration.fn({ x: 0, y: 0 }, {}, { ticks: 60, rearm: "false" });
    });
    assertEquals(noRearm[0].args, [0, 0, 60, { updateMax: false }]);
});

Deno.test("teleportElement offsets the region, and a zero offset does nothing", () => {
    // No `footprint`, so the region is the single cell at the offset — which is the
    // point of the shared resolver: `ty: 1` on its own means "the cell below me",
    // exactly as it does for every other action in the system.
    const one = withApi({}, () => {
        assertEquals(motionActions.teleportElement.fn(at, {}, { ty: 1 }), true);
    });
    assertEquals(one.length, 1);
    assertEquals(one[0].args, [100, 200, 100, 201]);

    // Over the footprint it is a group move, and the count proves the region was used.
    const four = withApi({}, () => {
        assertEquals(
            motionActions.teleportElement.fn(at, {}, { ty: 1, footprint: true }),
            true,
        );
    });
    assertEquals(four.length, 4);

    // The zero case is worth its own assertion: it would otherwise be one engine call
    // per cell that achieves nothing, on a 100 ms tick, forever.
    const none = withApi({}, () => {
        assertEquals(motionActions.teleportElement.fn(at, {}, { tx: 0, ty: 0 }), false);
    });
    assertEquals(none.length, 0, "no calls at all");
});

Deno.test("an absent api.elements is a warning and a false, never a throw", () => {
    // The failure mode this file exists to prevent: the mod gains a `workerEntry`, the
    // namespace vanishes, and every motion action throws inside a processor tick —
    // taking the whole simulation with it.
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    delete g.sandkit;
    try {
        for (
            const key of [
                "setVelocity",
                "addVelocity",
                "setDuration",
                "teleportElement",
                "toParticle",
            ] as const
        ) {
            assertEquals(
                motionActions[key].fn(at, {}, { vx: 1, ticks: 1, ty: 1 }),
                false,
                `${key} should report failure`,
            );
        }
        // And the sense actions answer their sentinels rather than throwing.
        assertEquals(motionActions.getVelocity.fn(at, {}, {}), -1);
        assertEquals(motionActions.findFreeCell.fn(at, {}, {}), -1);
    } finally {
        if (had) g.sandkit = prev;
    }
});

Deno.test("a namespace missing one method degrades that action only", () => {
    // Older engine builds, and the `?.` chain. A missing `setDurationAtCell` must not
    // take `setVelocity` down with it, because they are separate actions.
    const calls = withApi({ setDurationAtCell: undefined }, () => {
        assertEquals(motionActions.setDuration.fn(at, {}, { ticks: 10 }), false);
        assertEquals(motionActions.setVelocity.fn(at, {}, { vx: 1 }), true);
    });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].fn, "setVelocityAtCell");
});
