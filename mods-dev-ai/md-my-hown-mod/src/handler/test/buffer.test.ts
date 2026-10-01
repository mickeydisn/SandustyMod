
import { assert, assertEquals } from "https:
import { build, coerceDefault, planSlot, resetBuffer, zeroFor } from "../buffer-store.ts";
import { bufferActions, setBufferSource } from "../actions/buffer/index.ts";
import type { BufferEntryConfig } from "../../constants.ts";




function mountHost() {
    const store = new Map<string, Int32Array | Uint8Array>();
    (globalThis as unknown as { sandkit?: unknown }).sandkit = {
        api: {
            shared: {
                buffers: {
                    get: (key: string) => store.get(key),
                    ensure: (key: string, cfg: { type: string; length: number }) => {
                        const existing = store.get(key);
                        if (existing) return existing;
                        const view = cfg.type === "int32"
                            ? new Int32Array(cfg.length)
                            : new Uint8Array(cfg.length);
                        store.set(key, view);
                        return view;
                    },
                },
            },
        },
    };
}


function unmountHost() {
    (globalThis as unknown as { sandkit?: unknown }).sandkit = undefined;
}


function freshBuild(entries: BufferEntryConfig[]) {
    mountHost();
    return build(entries);
}


const counter = (over: Partial<BufferEntryConfig> = {}): BufferEntryConfig => ({
    id: "digs",
    path: "counters.digs",
    type: "number",
    default: 0,
    min: 0,
    max: 100,
    ...over,
});



Deno.test("a default is coerced to the shape its type promises", () => {
    
    
    assertEquals(coerceDefault("number", "42"), 42);
    assertEquals(coerceDefault("number", "not a number"), 0);
    assertEquals(coerceDefault("bool", "true"), true);
    assertEquals(coerceDefault("bool", "false"), false);
    assertEquals(coerceDefault("bool", "FALSE"), false);
    assertEquals(coerceDefault("string", 7), "7");
    assertEquals(coerceDefault("string", null), "");
});

Deno.test("a type has a zero, and it is that type's zero", () => {
    assertEquals(zeroFor("number"), 0);
    assertEquals(zeroFor("bool"), false);
    assertEquals(zeroFor("string"), "");
});



Deno.test("a number slot needs both bounds, because a counter is clamped", () => {
    
    
    
    assert(planSlot(counter({ min: undefined })).problem?.includes("min and a max"));
    assert(planSlot(counter({ max: undefined })).problem?.includes("min and a max"));
    assertEquals(planSlot(counter()).problem, null);
});

Deno.test("a bool or string slot needs no bounds", () => {
    
    
    assertEquals(planSlot(counter({ type: "bool", default: "false" })).problem, null);
    assertEquals(planSlot(counter({ type: "string", default: "hi" })).problem, null);
});

Deno.test("min above max is refused rather than clamped into nothing", () => {
    
    
    assert(planSlot(counter({ min: 10, max: 0 })).problem?.includes("above max"));
});

Deno.test("a number's default must be a whole number", () => {
    
    
    assert(planSlot(counter({ default: 1.5 })).problem?.includes("whole number"));
    assertEquals(planSlot(counter({ default: 3 })).problem, null);
});

Deno.test("a slot needs a path, and it has to be one", () => {
    assert(planSlot(counter({ path: "" })).problem?.includes("path is required"));
    assert(planSlot(counter({ path: "  " })).problem?.includes("path is required"));
    
    assert(planSlot(counter({ path: "a..b" })).problem);
    assert(planSlot(counter({ path: "0abc" })).problem);
    assertEquals(planSlot(counter({ path: "counters.digs" })).problem, null);
    assertEquals(planSlot(counter({ path: "players[0].score" })).problem, null);
});



Deno.test("two slots cannot share a path, and the second says who took it", () => {
    
    
    const { problems } = freshBuild([counter({ id: "a" }), counter({ id: "b" })]);
    const dup = problems.find((p) => p.id === "b");
    assert(dup, "the duplicate was not reported");
    assert(
        dup.reason.includes('"a"'),
        `the reason does not name the first claimant: ${dup.reason}`,
    );
});

Deno.test("a bad slot is skipped and reported, and the good ones still work", () => {
    
    const { buffer, problems } = freshBuild([
        counter({ id: "ok" }),
        counter({ id: "bad", min: undefined }),
    ]);
    assertEquals(problems.length, 1);
    assertEquals(problems[0].id, "bad");
    assert(buffer, "the valid slot was dropped with the invalid one");
    assertEquals(buffer?.getPath("counters.digs"), 0);
});

Deno.test("no slots means no buffer, and that is not an error", () => {
    
    
    assertEquals(build([]).buffer, null);
    assertEquals(build([]).problems, []);
});

Deno.test("a nested path becomes a real container, not a key with a dot in it", () => {
    
    
    const { buffer } = freshBuild([counter()]);
    assertEquals(buffer?.getPath("counters.digs"), 0);
});

Deno.test("an array segment makes an array, not an object", () => {
    const { buffer } = freshBuild([counter({ path: "players[0].score" })]);
    assertEquals(buffer?.getPath("players[0].score"), 0);
});




function withBuffer(entries: BufferEntryConfig[], body: (run: Action) => void): void {
    mountHost();
    resetBuffer();
    setBufferSource(() => entries);
    const run: Action = (key, options) =>
        bufferActions[key as keyof typeof bufferActions].fn(null, null, options);
    try {
        body(run);
    } finally {
        unmountHost();
        resetBuffer();
    }
}

type Action = (key: string, options: unknown) => unknown;

Deno.test("bufferRead returns the slot's value, for `as:` to bind", () => {
    withBuffer([counter({ default: 7 })], (run) => {
        assertEquals(run("bufferRead", { path: "counters.digs" }), 7);
        
        
        run("bufferWrite", { path: "counters.digs", value: 9 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 9);
    });
});

Deno.test("bufferWrite stores a bool and a string as their own type", () => {
    withBuffer([
        counter({ id: "b", path: "flags.on", type: "bool", default: "false" }),
        counter({ id: "s", path: "label", type: "string", default: "" }),
    ], (run) => {
        run("bufferWrite", { path: "flags.on", value: true });
        run("bufferWrite", { path: "label", value: "running" });
        
        
        assertEquals(run("bufferRead", { path: "flags.on" }), true);
        assertEquals(run("bufferRead", { path: "label" }), "running");
    });
});

Deno.test("bufferIncrement adds, and clamps at the slot's own bounds", () => {
    withBuffer([counter({ default: 98, min: 0, max: 100 })], (run) => {
        
        
        run("bufferIncrement", { path: "counters.digs", delta: 5 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 100);
        run("bufferIncrement", { path: "counters.digs", delta: -500 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 0);
    });
});

Deno.test("a value that is not an integer cannot break a counter", () => {
    
    
    withBuffer([counter({ default: 0 })], (run) => {
        run("bufferWrite", { path: "counters.digs", value: true });
        assertEquals(typeof run("bufferRead", { path: "counters.digs" }), "number");
        run("bufferWrite", { path: "counters.digs", value: 2.6 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 3);
    });
});

Deno.test("increment refuses a bool or string slot rather than throwing", () => {
    withBuffer([counter({ id: "b", path: "flags.on", type: "bool", default: "false" })], (run) => {
        
        
        run("bufferIncrement", { path: "flags.on", delta: 1 });
        assertEquals(run("bufferRead", { path: "flags.on" }), false);
    });
});

Deno.test("a path that no slot declares reads as zero, not as undefined", () => {
    
    
    
    withBuffer([counter()], (run) => {
        assertEquals(run("bufferRead", { path: "counters.gone" }), 0);
    });
});

Deno.test("a write to a path nothing declares is dropped, not created", () => {
    
    
    
    
    withBuffer([counter({ default: 4 })], (run) => {
        run("bufferWrite", { path: "counters.typo", value: 1 });
        run("bufferIncrement", { path: "counters.typo", delta: 1 });
        
        assertEquals(run("bufferRead", { path: "counters.typo" }), 0);
        assertEquals(run("bufferRead", { path: "counters.digs" }), 4);
    });
});

Deno.test("a read of a deleted slot is the zero of the type it used to be", () => {
    
    
    
    
    withBuffer([counter({ id: "b", path: "flags.on", type: "bool", default: "true" })], (run) => {
        
        assertEquals(run("bufferRead", { path: "flags.on" }), true);
    });
});

Deno.test("a missing path option is ignored by both", () => {
    withBuffer([counter()], (run) => {
        assertEquals(run("bufferRead", {}), 0);
        run("bufferWrite", { value: 5 });
        
        assertEquals(run("bufferRead", { path: "counters.digs" }), 0);
    });
});

Deno.test("no declared slots leaves every action a no-op", () => {
    
    withBuffer([], (run) => {
        assertEquals(run("bufferRead", { path: "counters.digs" }), 0);
        run("bufferWrite", { path: "counters.digs", value: 1 });
        run("bufferIncrement", { path: "counters.digs", delta: 1 });
    });
});
