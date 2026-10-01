
import { assertEquals } from "https:
import { motionActions } from "../actions/motion/index.ts";


interface Call {
    fn: string;
    args: unknown[];
}


function withApi(overrides: Record<string, unknown> = {}, run: () => void): Call[] {
    const g = globalThis as unknown as { sandkit?: { api: Record<string, unknown> } };
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
    
    
    
    const calls = withApi({}, () => {
        const ok = motionActions.setVelocity.fn(S4, {}, { vx: 5, vy: -10, footprint: true });
        assertEquals(ok, true);
    });
    assertEquals(calls.length, 16);
    assertEquals(calls[0], {
        fn: "setVelocityAtCell",
        args: [100, 200, { x: 5, y: -10 }],
    });
    
    assertEquals(calls[3].args.slice(0, 2), [103, 200]);
    assertEquals(calls[4].args.slice(0, 2), [100, 201]);
    assertEquals(calls[15].args.slice(0, 2), [103, 203]);
});

Deno.test("velocity is a float, never truncated to a cell", () => {
    
    
    
    const calls = withApi({}, () => {
        motionActions.setVelocity.fn({ x: 0, y: 0 }, {}, { vx: 0.5, vy: -0.25 });
    });
    assertEquals(calls[0].args[2], { x: 0.5, y: -0.25 });
});

Deno.test("a NaN velocity is dropped, not passed to the engine", () => {
    
    
    
    const calls = withApi({}, () => {
        motionActions.setVelocity.fn({ x: 0, y: 0 }, {}, { vx: "", vy: "" });
    });
    assertEquals(calls[0].args[2], { x: 0, y: 0 });
});

Deno.test("addVelocity omits maxSpeed when it is zero", () => {
    
    
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
    
    
    withApi({}, () => {
        assertEquals(motionActions.getVelocity.fn({ x: 0, y: 0 }, {}, {}), 5);
    });
    withApi({ getVelocityAtCell: () => null }, () => {
        assertEquals(motionActions.getVelocity.fn({ x: 0, y: 0 }, {}, {}), -1);
    });
    
});

Deno.test("findFreeCell defaults to the structure's own size", () => {
    
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
    
    
    withApi({ findFreeCellInStructure: () => ({ x: 1, y: 2 }) }, () => {
        assertEquals(motionActions.findFreeCell.fn(S4, {}, {}), 9);
    });
    
    
    withApi({ findFreeCellInStructure: () => null }, () => {
        assertEquals(motionActions.findFreeCell.fn(S4, {}, {}), -1);
    });
});

Deno.test("setDuration passes ticks and the rearm flag", () => {
    const rearm = withApi({}, () => {
        motionActions.setDuration.fn({ x: 0, y: 0 }, {}, { ticks: 120, rearm: true });
    });
    assertEquals(rearm[0].args, [0, 0, 120, { updateMax: true }]);

    
    const noRearm = withApi({}, () => {
        motionActions.setDuration.fn({ x: 0, y: 0 }, {}, { ticks: 60, rearm: "false" });
    });
    assertEquals(noRearm[0].args, [0, 0, 60, { updateMax: false }]);
});

Deno.test("teleportElement offsets the region, and a zero offset does nothing", () => {
    
    
    
    const one = withApi({}, () => {
        assertEquals(motionActions.teleportElement.fn(at, {}, { ty: 1 }), true);
    });
    assertEquals(one.length, 1);
    assertEquals(one[0].args, [100, 200, 100, 201]);

    
    const four = withApi({}, () => {
        assertEquals(
            motionActions.teleportElement.fn(at, {}, { ty: 1, footprint: true }),
            true,
        );
    });
    assertEquals(four.length, 4);

    
    
    const none = withApi({}, () => {
        assertEquals(motionActions.teleportElement.fn(at, {}, { tx: 0, ty: 0 }), false);
    });
    assertEquals(none.length, 0, "no calls at all");
});

Deno.test("an absent api.elements is a warning and a false, never a throw", () => {
    
    
    
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
        
        assertEquals(motionActions.getVelocity.fn(at, {}, {}), -1);
        assertEquals(motionActions.findFreeCell.fn(at, {}, {}), -1);
    } finally {
        if (had) g.sandkit = prev;
    }
});

Deno.test("a namespace missing one method degrades that action only", () => {
    
    
    const calls = withApi({ setDurationAtCell: undefined }, () => {
        assertEquals(motionActions.setDuration.fn(at, {}, { ticks: 10 }), false);
        assertEquals(motionActions.setVelocity.fn(at, {}, { vx: 1 }), true);
    });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].fn, "setVelocityAtCell");
});
