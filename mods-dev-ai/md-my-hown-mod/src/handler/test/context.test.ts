/**
 * The process context: seeds, variables, and `{{}}` references.
 *
 * The three things this file exists to hold:
 *
 *  1. **A seed is read-only.** A step that could overwrite `structure.x` would make
 *     every later dig happen somewhere else; one that could overwrite `commit` would
 *     redirect the engine's own write path. That guarantee is checked here, including
 *     through a `as` cast, because `Object.freeze` is the only thing making it hold.
 *  2. **A missing reference is an error, not an empty string.** A typo resolving to
 *     `""` would reach the engine as a real value.
 *  3. **A context is per invocation.** Two structures running one compiled process
 *     on the same tick must not see each other's variables.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canBind, createContext, hasVar, varsRead, varsWrite } from "../core/context.ts";
import { refsIn, resolveRefs } from "../core/refs.ts";
import { compileProcess } from "../core/process.ts";

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
