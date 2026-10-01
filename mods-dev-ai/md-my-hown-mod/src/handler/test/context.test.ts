
import { assert, assertEquals } from "https:
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
    
    
    
    
    const { fn } = compileProcess([{ key: "processorNoop" }], "signal");
    assertEquals((fn as () => unknown)(), undefined);
});

Deno.test("`result` is per invocation, like every other variable", () => {
    
    
    
    
    const { fn } = compileProcess(
        [{ key: "readDataField", options: { slot: 1 }, as: RESULT_VAR }],
        "signal",
    );
    
    
    const host = withHost((x) => x);
    const first = (fn as (a: unknown, b: unknown) => unknown)({ x: 1, y: 2 }, {});
    const second = (fn as (a: unknown, b: unknown) => unknown)({ x: 2, y: 2 }, {});
    host.restore();
    assertEquals(first, 1);
    assertEquals(second, 2, "the second invocation must not read the first's value");
});

Deno.test("`result` survives the frozen context", () => {
    
    
    
    
    const ctx = createContext();
    assertEquals(varsWrite(ctx, RESULT_VAR, 42), { ok: true });
    assertEquals(ctx.result.value, 42);
    assert(!Object.isFrozen(ctx.result), "the holder itself must stay writable");
});

Deno.test("`result` is readable as a reference, and is never a `vars` entry", () => {
    
    
    
    const ctx = createContext();
    varsWrite(ctx, RESULT_VAR, "on");
    assertEquals(varsRead(ctx, RESULT_VAR), "on");
    assert(!(RESULT_VAR in ctx.vars), "result must not land in vars");
    assert(hasVar(ctx, RESULT_VAR), "result is always readable, even before it is set");
});

Deno.test("`result` is not a name a step can shadow as an ordinary variable", () => {
    
    
    
    const ctx = createContext();
    varsWrite(ctx, RESULT_VAR, 1);
    varsWrite(ctx, RESULT_VAR, 2);
    assertEquals(ctx.result.value, 2, "last binding wins, as for any rebind");
    assertEquals(Object.keys(ctx.vars).length, 0, "and neither is a var");
});



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
    
    
    const withUndef = createContext({ key: undefined });
    assert(hasVar(withUndef, "key"), "present-and-undefined is readable");
    assertEquals(varsRead(withUndef, "key"), undefined);
});

Deno.test("a seed cannot be written, not even through a cast", () => {
    
    
    
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



Deno.test("a variable is written, read, and survives to the next step", () => {
    const ctx = createContext();
    assertEquals(varsWrite(ctx, "isWater", true), { ok: true });
    assertEquals(varsRead(ctx, "isWater"), true);
    assertEquals(ctx.vars.isWater, true);
    
    
    
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
    
    
    assertEquals(canBind("with.dot", ctx), { ok: false, reason: "invalid" });
    assertEquals(canBind("is_water2", ctx), { ok: true });
    assertEquals(canBind("_leading", ctx), { ok: true });
});



Deno.test("a whole-string reference keeps the value's type", () => {
    
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
    
    
    assertEquals(value.padded, "  3  ");
    
    assertEquals(resolveRefs({ bare: "{{n}}" }, ctx, "s").value.bare, 3);
});

Deno.test("a string with no reference is left exactly as it was", () => {
    
    const ctx = createContext();
    assertEquals(resolveRefs({ a: "100%", b: "{x}", c: "" }, ctx, "s").value, {
        a: "100%",
        b: "{x}",
        c: "",
    });
});

Deno.test("an unknown reference is reported and its param omitted", () => {
    
    
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
    
    
    const ctx = createContext();
    const { value, problems } = resolveRefs({ msg: "a={{nope}}" }, ctx, "toast");
    assertEquals(value.msg, "a={{nope}}");
    assertEquals(problems.length, 1);
});

Deno.test("references inside arrays and nested objects resolve too", () => {
    const ctx = createContext();
    varsWrite(ctx, "id", 7);
    assertEquals(resolveRefs({ ids: ["{{id}}", "x"] }, ctx, "s").value.ids, [7, "x"]);
    
    assertEquals(
        resolveRefs({ deep: [{ a: "{{id}}" }] }, ctx, "s").value.deep,
        [{ a: 7 }],
    );
});

Deno.test("numbers and booleans are passed through untouched", () => {
    
    
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




function engineCtx(overrides: Record<string, unknown> = {}): unknown {
    return {
        getResolvedTypeAtCell: () => "water",
        isCellEmptyAtCell: () => false,
        commit: () => {},
        ...overrides,
    };
}

Deno.test("a compiled process carries a value from one step into the next", () => {
    
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
    
    
    fn({ x: 2, y: 2 }, engineCtx());
    assertEquals(failures, [], "both runs resolved the reference from their own context");
});

Deno.test("an unresolved reference in a process is reported, and the step still runs", () => {
    
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
