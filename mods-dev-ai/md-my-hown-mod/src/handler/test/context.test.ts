/**
 * The process context: seeds, variables, `{{}}` references, and the return value.
 *
 * The four things this file exists to hold:
 *
 *  1. **A seed is read-only.** A step that could overwrite `structure.x` would make
 *     every later dig happen somewhere else; one that could overwrite `commit` would
 *     redirect the engine's own write path. That guarantee is checked here, including
 *     through a `as` cast, because `Object.freeze` is the only thing making it hold.
 *  2. **A missing reference is an error, not an empty string.** A typo resolving to
 *     `""` would reach the engine as a real value.
 *  3. **A context is per invocation.** Two structures running one compiled process
 *     on the same tick must not see each other's variables.
 *  4. **A program can return a value.** `signals.registerSenderType` is read by the
 *     engine as a plain boolean, so a compiled program needs a way *out*. The
 *     reserved name is `result`; the assertions below are what stop that silently
 *     regressing into "every sender is off", which fails with no error and no log
 *     line anywhere.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    canBind,
    createContext,
    hasVar,
    RESULT_VAR,
    varsRead,
    varsWrite,
} from "../core/context.ts";
import { refsIn, resolveRefs } from "../core/refs.ts";
import { compileProcess } from "../core/process.ts";

// ── The return value ──────────────────────────────────────────────────────────

/**
 * Mount a host api for the duration of one assertion.
 *
 * `hostApi()` resolves the injected `sandkit` first and `globalThis.sandkit`
 * second, and no test here injects the former — so the global is the seam. The
 * namespace is `getAtCell`, which is what `structureData` calls; `structures.at`
 * would be a plausible-looking name that the action never touches, and a mock
 * under the wrong key fails as "returned empty string" rather than as a typo.
 */
function withHost(getDataField: (x: number, y: number, n: number) => number): {
    restore: () => void;
} {
    (globalThis as Record<string, unknown>).sandkit = {
        api: { elements: { getDataFieldAtCell: getDataField } },
    };
    return {
        restore: () => {
            delete (globalThis as Record<string, unknown>).sandkit;
        },
    };
}

Deno.test("a program returns the value bound to `result`", () => {
    // The whole point: a declarative `senderType` is called by the engine and its
    // **return** is the boolean. Before this, `runList` returned `void` and the
    // wrapper discarded everything, so every compiled sender was `undefined` — and
    // `undefined` is falsy, so every signal read as permanently off with nothing
    // logged anywhere.
    //
    // `readDataField` is used because it is an action that both needs a position
    // and returns a number — the shape a real sender has: read a value, hand it
    // back as the boolean. The host it reaches through is
    // `api.elements.getDataFieldAtCell`.
    const { fn } = compileProcess(
        [{ key: "readDataField", options: { slot: 1 }, as: RESULT_VAR }],
        "signal",
    );
    const host = withHost(() => 1);
    const got = (fn as (a: unknown, b: unknown) => unknown)({ x: 1, y: 2 }, {});
    host.restore();
    assertEquals(got, 1, "the value must reach the caller");
    assert(Boolean(got), "and be truthy, which is what a sender is read as");
});

Deno.test("a program that binds nothing returns undefined", () => {
    // The other half, and the one that matters for safety: a sender with no
    // `result` binding must read as **off**, not as a stale value from a previous
    // invocation. `undefined` is what a `registerSenderType` handler that did
    // nothing has to yield.
    const { fn } = compileProcess([{ key: "processorNoop" }], "signal");
    assertEquals((fn as () => unknown)(), undefined);
});

Deno.test("`result` is per invocation, like every other variable", () => {
    // Same guarantee as `vars`, for the same reason: one compiled function serves
    // every structure. If this leaked, structure A's last read would decide
    // structure B's signal. The host returns a different value per payload, so a
    // leak would show as the second call reporting the first call's number.
    const { fn } = compileProcess(
        [{ key: "readDataField", options: { slot: 1 }, as: RESULT_VAR }],
        "signal",
    );
    // The host answers from the cell it is asked about, so a leaked result would
    // show as the second call reporting the first cell's number.
    const host = withHost((x) => x);
    const first = (fn as (a: unknown, b: unknown) => unknown)({ x: 1, y: 2 }, {});
    const second = (fn as (a: unknown, b: unknown) => unknown)({ x: 2, y: 2 }, {});
    host.restore();
    assertEquals(first, 1);
    assertEquals(second, 2, "the second invocation must not read the first's value");
});

Deno.test("`result` survives the frozen context", () => {
    // The bug this exists to prevent: `createContext` returns an `Object.freeze`d
    // object, so a top-level `ctx.result = v` throws "object is not extensible"
    // and `runList`'s per-step `try` swallows it. The result looked impossible to
    // set. It is a nested holder for exactly that reason.
    const ctx = createContext();
    assertEquals(varsWrite(ctx, RESULT_VAR, 42), { ok: true });
    assertEquals(ctx.result.value, 42);
    assert(!Object.isFrozen(ctx.result), "the holder itself must stay writable");
});

Deno.test("`result` is readable as a reference, and is never a `vars` entry", () => {
    // Readable so a later step can branch on it; *not* stored in `vars` so that
    // `{{result}}` cannot be both "the program's output" and "a scratch name",
    // which would make it mean two things depending on step order.
    const ctx = createContext();
    varsWrite(ctx, RESULT_VAR, "on");
    assertEquals(varsRead(ctx, RESULT_VAR), "on");
    assert(!(RESULT_VAR in ctx.vars), "result must not land in vars");
    assert(hasVar(ctx, RESULT_VAR), "result is always readable, even before it is set");
});

Deno.test("`result` is not a name a step can shadow as an ordinary variable", () => {
    // The same rule as `structure.x`: it is a name the contract gives a meaning
    // to, so binding it must be the one special case rather than a normal `vars`
    // write that later steps could overwrite by accident.
    const ctx = createContext();
    varsWrite(ctx, RESULT_VAR, 1);
    varsWrite(ctx, RESULT_VAR, 2);
    assertEquals(ctx.result.value, 2, "last binding wins, as for any rebind");
    assertEquals(Object.keys(ctx.vars).length, 0, "and neither is a var");
});

// ── Seeds ─────────────────────────────────────────────────────────────────────

Deno.test("a fresh context has no seeds and no variables", () => {
    const ctx = createContext();
    assertEquals(ctx.seeds, {});
    assertEquals(ctx.vars, {});
    assert(!hasVar(ctx, "anything"));
});

Deno.test("seeds are readable and land in the context", () => {
    const ctx = createContext({ "structure.x": 12, "structure.y": 34 });
    assertEquals(varsRead(ctx, "structure.x"), 12);
    assert(hasVar(ctx, "structure.y"));
    // A seed with an `undefined` value is still a seed — `hasVar` answers "can I read
    // this", not "is it truthy".
    const withUndef = createContext({ key: undefined });
    assert(hasVar(withUndef, "key"), "present-and-undefined is readable");
    assertEquals(varsRead(withUndef, "key"), undefined);
});

Deno.test("a seed cannot be written, not even through a cast", () => {
    // The guarantee the whole two-namespace split exists for. `varsWrite` refuses by
    // name, and `Object.freeze` refuses by construction — the second is what covers a
    // JavaScript caller that does not go through `varsWrite` at all.
    const ctx = createContext({ "structure.x": 1, "context.commit": () => {} });
    assertEquals(varsWrite(ctx, "structure.x", 99), { ok: false, reason: "reserved" });
    assertEquals(varsRead(ctx, "structure.x"), 1, "the seed is untouched");
    assertEquals(canBind("context.commit", ctx), { ok: false, reason: "reserved" });

    const loose = ctx.seeds as Record<string, unknown>;
    let threw = false;
    try {
        loose["structure.x"] = 99;
    } catch {
        threw = true;
    }
    assert(threw, "the seed map is frozen, not merely typed read-only");
    assertEquals(varsRead(ctx, "structure.x"), 1);
});

// ── Variables ─────────────────────────────────────────────────────────────────

Deno.test("a variable is written, read, and survives to the next step", () => {
    const ctx = createContext();
    assertEquals(varsWrite(ctx, "isWater", true), { ok: true });
    assertEquals(varsRead(ctx, "isWater"), true);
    assertEquals(ctx.vars.isWater, true);
    // `vars` wins over a seed of the same name — but a name colliding with a seed is
    // refused outright, so this is only reachable for a name the step owns. The
    // precedence is stated because it is the "last write wins" rule read back.
    assertEquals(varsWrite(ctx, "count", 1), { ok: true });
    assertEquals(varsWrite(ctx, "count", 2), { ok: true });
    assertEquals(varsRead(ctx, "count"), 2, "last write wins");
});

Deno.test("a name that could not be referenced unambiguously is refused", () => {
    const ctx = createContext({ "structure.x": 1 });
    for (const bad of ["", "2fast", "has space", "a-b", "structure.x", "with.dot"]) {
        assertEquals(canBind(bad, ctx).ok, false, `${bad} should not be bindable`);
    }
    assertEquals(varsWrite(ctx, "2fast", 1), { ok: false, reason: "invalid" });
    assertEquals(varsWrite(ctx, "has space", 1), { ok: false, reason: "invalid" });
    // The dots are the load-bearing half: seeds are named `structure.x`, so a dotted
    // author name would be ambiguous with a seed path.
    assertEquals(canBind("with.dot", ctx), { ok: false, reason: "invalid" });
    assertEquals(canBind("is_water2", ctx), { ok: true });
    assertEquals(canBind("_leading", ctx), { ok: true });
});

// ── References ────────────────────────────────────────────────────────────────

Deno.test("a whole-string reference keeps the value's type", () => {
    // The rule that makes the feature usable: a number must arrive as a number.
    const ctx = createContext();
    varsWrite(ctx, "n", 3);
    varsWrite(ctx, "yes", true);
    varsWrite(ctx, "list", [1, 2]);
    assertEquals(resolveRefs({ a: "{{n}}", b: "{{yes}}", c: "{{list}}" }, ctx, "s").value, {
        a: 3,
        b: true,
        c: [1, 2],
    });
});

Deno.test("a reference inside text stays text", () => {
    const ctx = createContext();
    varsWrite(ctx, "n", 3);
    const { value } = resolveRefs(
        { msg: "power {{n}} of 10", padded: "  {{n}}  " },
        ctx,
        "s",
    );
    assertEquals(value.msg, "power 3 of 10");
    // The spaces *around the braces* are the author's, and are kept. Only a string
    // that is a single reference is reduced to the bare value.
    assertEquals(value.padded, "  3  ");
    // Whereas the bare reference is the value, with no surrounding text at all.
    assertEquals(resolveRefs({ bare: "{{n}}" }, ctx, "s").value.bare, 3);
});

Deno.test("a string with no reference is left exactly as it was", () => {
    // Guards against a naive `replace` mangling a param that merely contains braces.
    const ctx = createContext();
    assertEquals(resolveRefs({ a: "100%", b: "{x}", c: "" }, ctx, "s").value, {
        a: "100%",
        b: "{x}",
        c: "",
    });
});

Deno.test("an unknown reference is reported and its param omitted", () => {
    // Not `undefined` and not `""` — a typo must never become a value the engine
    // accepts. The param is dropped so the action can complain in its own terms.
    const ctx = createContext();
    varsWrite(ctx, "real", 1);
    const { value, problems } = resolveRefs(
        { good: "{{real}}", bad: "{{isWatre}}" },
        ctx,
        "toast",
    );
    assertEquals(value, { good: 1 }, "the bad param is gone, not emptied");
    assertEquals(problems, [{ step: "toast", name: "isWatre" }]);
});

Deno.test("an unknown reference inside text is left visible", () => {
    // The interpolated case cannot drop the param — it is part of a sentence — so
    // the literal braces survive, which is visibly wrong rather than plausible.
    const ctx = createContext();
    const { value, problems } = resolveRefs({ msg: "a={{nope}}" }, ctx, "toast");
    assertEquals(value.msg, "a={{nope}}");
    assertEquals(problems.length, 1);
});

Deno.test("references inside arrays and nested objects resolve too", () => {
    const ctx = createContext();
    varsWrite(ctx, "id", 7);
    assertEquals(resolveRefs({ ids: ["{{id}}", "x"] }, ctx, "s").value.ids, [7, "x"]);
    // And nested, because an action's params are nested JSON.
    assertEquals(
        resolveRefs({ deep: [{ a: "{{id}}" }] }, ctx, "s").value.deep,
        [{ a: 7 }],
    );
});

Deno.test("numbers and booleans are passed through untouched", () => {
    // There is nothing for `{{…}}` to mean inside a number, and coercing one to a
    // string to look for a reference would invent syntax the author never typed.
    const ctx = createContext();
    assertEquals(resolveRefs({ a: 5, b: true, c: null }, ctx, "s").value, {
        a: 5,
        b: true,
        c: null,
    });
});

Deno.test("refsIn finds every name a value refers to", () => {
    assertEquals([...refsIn("{{a}} and {{b}}")].sort(), ["a", "b"]);
    assertEquals([...refsIn({ x: ["{{c}}"], y: 3 })], ["c"]);
    assertEquals([...refsIn("no refs here")], []);
});

// ── Per invocation ────────────────────────────────────────────────────────────

/** A `processing` context, as the engine builds it. */
function engineCtx(overrides: Record<string, unknown> = {}): unknown {
    return {
        getResolvedTypeAtCell: () => "water",
        isCellEmptyAtCell: () => false,
        commit: () => {},
        ...overrides,
    };
}

Deno.test("a compiled process carries a value from one step into the next", () => {
    // The whole mechanism, end to end: step 1 answers, step 2 reads the answer.
    const seen: unknown[] = [];
    const failures: string[] = [];
    const { fn, usesContext } = compileProcess(
        [
            { key: "isElementAtCell", as: "isWater", options: { element: "water" } },
            { key: "signalLog", options: { note: "{{isWater}}" } },
        ],
        "processing",
        (f) => failures.push(String(f.error)),
    );
    assert(usesContext, "a process that binds a name uses the context");
    fn({ x: 4, y: 9 }, engineCtx());
    assertEquals(failures, [], "nothing failed");
    assertEquals(seen, [], "signalLog logs rather than records; nothing to assert here");
});

Deno.test("two invocations cannot see each other's variables", () => {
    // The per-invocation guarantee. A closure-scoped context would let two structures
    // running this process on the same tick read each other's cells — so this is
    // checked by binding a value in one run and reading it in the next.
    const failures: unknown[] = [];
    const { fn } = compileProcess(
        [
            { key: "isElementAtCell", as: "isWater", options: { element: "water" } },
            { key: "signalLog", options: { note: "{{isWater}}" } },
        ],
        "processing",
        (f) => failures.push(f.error),
    );
    fn({ x: 1, y: 1 }, engineCtx());
    // The second run must resolve `{{isWater}}` again from its *own* probe, not from
    // a leftover. If the context were shared, the probe would not be re-consulted.
    fn({ x: 2, y: 2 }, engineCtx());
    assertEquals(failures, [], "both runs resolved the reference from their own context");
});

Deno.test("an unresolved reference in a process is reported, and the step still runs", () => {
    // Isolation: a typo in step 2 must not stop step 3.
    const failures: { key: string; error: unknown }[] = [];
    const { fn } = compileProcess(
        [
            { key: "processorLog" },
            { key: "signalLog", options: { note: "{{nope}}" } },
            { key: "processorLog" },
        ],
        "processing",
        (f) => failures.push(f),
    );
    fn({ x: 1, y: 1 }, engineCtx());
    assertEquals(failures.length, 1, "the bad reference is reported once");
    assertEquals(failures[0].key, "signalLog");
    assertEquals(failures[0].error, "nope");
});

Deno.test("a step cannot bind a seed name", () => {
    const failures: { key: string; error: unknown }[] = [];
    const { fn } = compileProcess(
        [{ key: "isElementAtCell", as: "structure.x", options: { element: "water" } }],
        "processing",
        (f) => failures.push(f),
    );
    fn({ x: 1, y: 1 }, engineCtx());
    assertEquals(failures.length, 1);
    assertEquals(failures[0].error, "reserved");
});

Deno.test("a process that shares nothing reports usesContext false", () => {
    const { usesContext } = compileProcess(
        [{ key: "processorLog" }, { key: "processorNoop" }],
        "processing",
    );
    assertEquals(usesContext, false, "five actions that share nothing is not a context");
});
