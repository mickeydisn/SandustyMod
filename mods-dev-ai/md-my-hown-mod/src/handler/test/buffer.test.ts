/**
 * The shared **buffer** — the slots, the store, and the three actions.
 *
 * Two halves that have to agree, and the reason they are tested together is
 * that the disagreement is invisible: a slot the panel accepts and the store
 * refuses produces a buffer that is quietly missing one of its paths, and every
 * action against it returns zero with nothing anywhere reporting a problem.
 *
 * The host is absent for all of this. `JsonMapBuffer` reaches shared memory
 * through `ensureBuffer`, which returns `null` when `api.shared.buffers` is not
 * there, and every path below still works — which is the same fallback the
 * actions rely on when they run before the engine has mounted.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { build, coerceDefault, planSlot, resetBuffer, zeroFor } from "../buffer-store.ts";
import { bufferActions, setBufferSource } from "../actions/buffer/index.ts";
import type { BufferEntryConfig } from "../../constants.ts";

// ── the host ─────────────────────────────────────────────────────────────────

/**
 * A fresh `sandkit` with just enough `shared.buffers` for the real
 * `JsonMapBuffer`.
 *
 * This is not optional scaffolding. `JsonMapBuffer`'s constructor **throws** when
 * `sandkit` is undefined, so without a host `build()` returns `null` for a
 * perfectly valid slot and every assertion below would be testing a silent
 * no-op.
 *
 * It is a *fresh* host per test, and the freshness is the point rather than
 * hygiene. The engine hands out one shared buffer per key, and the key here is a
 * constant — so a host installed once would carry the previous test's values
 * into the next one, and a test asserting "starts at its default" would pass or
 * fail depending on what ran before it. That is the exact class of bug these
 * tests exist to catch, so the harness must not have it.
 *
 * The views are typed because that is what the real engine returns and what the
 * package casts to; a bare `ArrayBuffer` fails in the constructor, before any
 * assertion is reached.
 */
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

/** Take the host away, so the next test starts from no shared memory at all. */
function unmountHost() {
    (globalThis as unknown as { sandkit?: unknown }).sandkit = undefined;
}

/**
 * `build` against a freshly mounted host, for the tests that read the buffer
 * directly rather than through an action.
 */
function freshBuild(entries: BufferEntryConfig[]) {
    mountHost();
    return build(entries);
}

/** A valid number slot, the one most of these tests start from. */
const counter = (over: Partial<BufferEntryConfig> = {}): BufferEntryConfig => ({
    id: "digs",
    path: "counters.digs",
    type: "number",
    default: 0,
    min: 0,
    max: 100,
    ...over,
});

// ── the default value ────────────────────────────────────────────────────────

Deno.test("a default is coerced to the shape its type promises", () => {
    // The form stores text, so these are the values that actually arrive. The
    // `false` case is the one that would bite: `Boolean("false")` is `true`.
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

// ── the slot rules ───────────────────────────────────────────────────────────

Deno.test("a number slot needs both bounds, because a counter is clamped", () => {
    // The rule that is easy to get wrong and impossible to debug later: an
    // unbounded number is not "a number with a wide range", it is a constructor
    // throw. Both bounds are checked, and either one missing is the same error.
    assert(planSlot(counter({ min: undefined })).problem?.includes("min and a max"));
    assert(planSlot(counter({ max: undefined })).problem?.includes("min and a max"));
    assertEquals(planSlot(counter()).problem, null);
});

Deno.test("a bool or string slot needs no bounds", () => {
    // They are not counters — they live in the JSON payload — so the bounds a
    // number cannot do without would have nothing to clamp.
    assertEquals(planSlot(counter({ type: "bool", default: "false" })).problem, null);
    assertEquals(planSlot(counter({ type: "string", default: "hi" })).problem, null);
});

Deno.test("min above max is refused rather than clamped into nothing", () => {
    // Left alone, the clamp would make every write land on `max` and the slot
    // would look like it worked while never moving.
    assert(planSlot(counter({ min: 10, max: 0 })).problem?.includes("above max"));
});

Deno.test("a number's default must be a whole number", () => {
    // The counter is an Int32Array. A fraction would be truncated by the buffer
    // and read back as a different number than the author typed.
    assert(planSlot(counter({ default: 1.5 })).problem?.includes("whole number"));
    assertEquals(planSlot(counter({ default: 3 })).problem, null);
});

Deno.test("a slot needs a path, and it has to be one", () => {
    assert(planSlot(counter({ path: "" })).problem?.includes("path is required"));
    assert(planSlot(counter({ path: "  " })).problem?.includes("path is required"));
    // `a..b` and a leading digit are not paths the getter can walk.
    assert(planSlot(counter({ path: "a..b" })).problem);
    assert(planSlot(counter({ path: "0abc" })).problem);
    assertEquals(planSlot(counter({ path: "counters.digs" })).problem, null);
    assertEquals(planSlot(counter({ path: "players[0].score" })).problem, null);
});

// ── building ─────────────────────────────────────────────────────────────────

Deno.test("two slots cannot share a path, and the second says who took it", () => {
    // Not merged and not last-wins: which one survived would depend on list
    // order, and the losing row would still look declared in the panel.
    const { problems } = freshBuild([counter({ id: "a" }), counter({ id: "b" })]);
    const dup = problems.find((p) => p.id === "b");
    assert(dup, "the duplicate was not reported");
    assert(
        dup.reason.includes('"a"'),
        `the reason does not name the first claimant: ${dup.reason}`,
    );
});

Deno.test("a bad slot is skipped and reported, and the good ones still work", () => {
    // The important half: one bad row must not cost the author every other slot.
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
    // A mod that declares nothing is the common case, and must not allocate
    // shared memory it will never touch.
    assertEquals(build([]).buffer, null);
    assertEquals(build([]).problems, []);
});

Deno.test("a nested path becomes a real container, not a key with a dot in it", () => {
    // `setDeep` is the reason: writing `"counters.digs"` as one key would leave
    // `getPath` walking to nothing.
    const { buffer } = freshBuild([counter()]);
    assertEquals(buffer?.getPath("counters.digs"), 0);
});

Deno.test("an array segment makes an array, not an object", () => {
    const { buffer } = freshBuild([counter({ path: "players[0].score" })]);
    assertEquals(buffer?.getPath("players[0].score"), 0);
});

// ── the actions ──────────────────────────────────────────────────────────────

/**
 * Run one action, mounting a host and a buffer exactly once per test.
 *
 * `setBufferSource` resets the built buffer, so a helper that re-mounted on every
 * call would throw away the write a previous line had just made — and a
 * write-then-read test would read a freshly seeded default and pass or fail for
 * reasons that have nothing to do with the code. The host is therefore mounted
 * once too, so a test owns one buffer for its whole body.
 *
 * `using` is not involved: the teardown is a plain `finally`, which is the right
 * tool here and does the same job.
 */
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
        // And after a write, the read sees it — that is the whole contract, and it
        // is why these two share one buffer rather than being separate cases.
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
        // Read back as `true` and not `1`: the JSON payload keeps the type, and a
        // bool slot that read back as a number would break every `if` on it.
        assertEquals(run("bufferRead", { path: "flags.on" }), true);
        assertEquals(run("bufferRead", { path: "label" }), "running");
    });
});

Deno.test("bufferIncrement adds, and clamps at the slot's own bounds", () => {
    withBuffer([counter({ default: 98, min: 0, max: 100 })], (run) => {
        // The clamp is the buffer's, and it is why `max` is a required field
        // rather than a suggestion: 98 + 5 is 100, not 103.
        run("bufferIncrement", { path: "counters.digs", delta: 5 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 100);
        run("bufferIncrement", { path: "counters.digs", delta: -500 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 0);
    });
});

Deno.test("a value that is not an integer cannot break a counter", () => {
    // `setPath` throws on a fraction for a mapped counter, and a thrown action
    // aborts the rest of the process. Rounding keeps "count this" working.
    withBuffer([counter({ default: 0 })], (run) => {
        run("bufferWrite", { path: "counters.digs", value: true });
        assertEquals(typeof run("bufferRead", { path: "counters.digs" }), "number");
        run("bufferWrite", { path: "counters.digs", value: 2.6 });
        assertEquals(run("bufferRead", { path: "counters.digs" }), 3);
    });
});

Deno.test("increment refuses a bool or string slot rather than throwing", () => {
    withBuffer([counter({ id: "b", path: "flags.on", type: "bool", default: "false" })], (run) => {
        // A no-op is the answer: the slot is not a counter, and the author finds
        // out from the field hint rather than from a swallowed exception.
        run("bufferIncrement", { path: "flags.on", delta: 1 });
        assertEquals(run("bufferRead", { path: "flags.on" }), false);
    });
});

Deno.test("a path that no slot declares reads as zero, not as undefined", () => {
    // The author deleted a row and a process still points at it. Throwing would
    // skip every later step, and returning `undefined` would be worse: it is the
    // one value that makes `{{hits}} < 3` quietly false instead of an error.
    withBuffer([counter()], (run) => {
        assertEquals(run("bufferRead", { path: "counters.gone" }), 0);
    });
});

Deno.test("a write to a path nothing declares is dropped, not created", () => {
    // The dangerous half, and the reason the write checks the declaration.
    // `setPath` *creates* what it is given, so without the guard a typo'd path
    // would write successfully, invent a slot, and leave the real one at its
    // default — a process that looks right and is quietly not counting.
    withBuffer([counter({ default: 4 })], (run) => {
        run("bufferWrite", { path: "counters.typo", value: 1 });
        run("bufferIncrement", { path: "counters.typo", delta: 1 });
        // The invented slot is not there, and the real one is untouched.
        assertEquals(run("bufferRead", { path: "counters.typo" }), 0);
        assertEquals(run("bufferRead", { path: "counters.digs" }), 4);
    });
});

Deno.test("a read of a deleted slot is the zero of the type it used to be", () => {
    // The slot is gone from the list, so the buffer cannot answer for it — but the
    // *config* no longer knows the type either, so this is the honest limit: the
    // answer falls back to the numeric zero. A `bool` slot that still existed
    // would answer `false`, which is the case the `typeAt` lookup exists for.
    withBuffer([counter({ id: "b", path: "flags.on", type: "bool", default: "true" })], (run) => {
        // Present and declared, so the real value comes back — not the zero.
        assertEquals(run("bufferRead", { path: "flags.on" }), true);
    });
});

Deno.test("a missing path option is ignored by both", () => {
    withBuffer([counter()], (run) => {
        assertEquals(run("bufferRead", {}), 0);
        run("bufferWrite", { value: 5 });
        // Unchanged, because there was no path to write to.
        assertEquals(run("bufferRead", { path: "counters.digs" }), 0);
    });
});

Deno.test("no declared slots leaves every action a no-op", () => {
    // Before boot wiring, or in a mod that declared none. Not a crash.
    withBuffer([], (run) => {
        assertEquals(run("bufferRead", { path: "counters.digs" }), 0);
        run("bufferWrite", { path: "counters.digs", value: 1 });
        run("bufferIncrement", { path: "counters.digs", delta: 1 });
    });
});
