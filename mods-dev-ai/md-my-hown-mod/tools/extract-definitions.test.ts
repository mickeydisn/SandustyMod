/**
 * extract-definitions.test.ts — guards the Phase 3 implementation reader.
 *
 * Every case here is a way the reader once produced a confident wrong answer:
 * a body taken from the wrong function, a field read off a module alias, a
 * shadowed variable, and the wrong argument treated as the definition.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    bodyOf,
    collectRegisters,
    definitionArg,
    delegateOf,
    externalDelegate,
    indexHelpers,
    readsOf,
    throwMessagesOf,
} from "./extract-definitions.ts";

const fields = (body: string, p: string) =>
    Object.fromEntries(readsOf(body, p).map((r) => [r.field, r]));

Deno.test("bodyOf takes a block body", () => {
    const src = ["f: (a) => {", "    return a.x;", "}"].join("\n");
    assertEquals(bodyOf(src, 1).includes("a.x"), true);
});

Deno.test("bodyOf takes a parenthesised expression, not the next block", () => {
    // regression: the bundle delegates as `=> (0, mod.fn)(e, t, n)`. Searching
    // for a `{` ran into a later function and reported *its* fields as required.
    const src = [
        "a: (e, t) => (0,",
        "xe.registerTechNode)(e, t, n),",
        "b: (e, t) => {",
        "    return e.other.thing;",
        "}",
    ].join("\n");
    const body = bodyOf(src, 1);
    assertEquals(body.includes("xe.registerTechNode"), true);
    assertEquals(body.includes("other"), false);
});

Deno.test("externalDelegate names code we cannot see", () => {
    assertEquals(
        externalDelegate("(0,\nxe.registerTechNode)(e, t, n)"),
        "xe.registerTechNode",
    );
    assertEquals(externalDelegate("{ return t.x; }"), null);
});

Deno.test("readsOf separates a value read from a dereference", () => {
    // `t.id` merely evaluates: an absent field is undefined, not an error.
    // `t.sprite.id` reaches into the value and is what actually fails.
    const f = fields("{ t.id; t.colors && f(t.colors); t.sprite.id; }", "t");
    assertEquals(f.id.derefs, 0);
    assertEquals(f.id.valueReads, 1);
    assertEquals(f.sprite.derefs, 1);
});

Deno.test("readsOf does not read a module alias as the definition", () => {
    // regression: `$t` is an imported module, and `\bt\.` matched inside
    // `$t.triggers`, inventing a required field called `triggers`.
    const f = fields("{ $t.triggers.register(e, id, {}); t.id; }", "t");
    assertEquals("triggers" in f, false);
    assertEquals(f.id !== undefined, true);
});

Deno.test("readsOf only takes the first segment after the parameter", () => {
    assertEquals(
        Object.keys(fields("{ t.colors.variants.map(f); }", "t")),
        ["colors"],
    );
});

Deno.test("a nested scope redeclaring the name is ignored", () => {
    // regression: `var t` inside an arrow shadowed the parameter, so `t.indexOf`
    // was reported as a field of the definition.
    const names = readsOf(
        "{ t.id; (e => { var t; return t.indexOf(1); })(e); }",
        "t",
    ).map((r) => r.field);
    assertEquals(names.includes("indexOf"), false);
    assertEquals(names.includes("id"), true);
});

Deno.test("a nested scope not redeclaring the name is kept", () => {
    assertEquals(
        readsOf("{ t.id; (e => { return e.thing; })(e); }", "t")
            .map((r) => r.field)
            .includes("id"),
        true,
    );
});

Deno.test("definitionArg uses the public parameter names when available", () => {
    // `processing.register(ctx, id, definition)` — the definition is third.
    // Guessing by shape would read properties off the id instead.
    assertEquals(
        definitionArg("register", ["e", "t", "n"], ["id", "definition"]),
        2,
    );
    assertEquals(definitionArg("register", ["e", "t"], ["definition"]), 1);
    assertEquals(definitionArg("register", ["e", "t", "n"]), 1);
    assertEquals(definitionArg("updateDefinition", ["e", "t", "n"]), 2);
});

Deno.test("indexHelpers finds assignment and function declarations alike", () => {
    // regression: only `Name = (…)` was indexed, so `function Ke(…)` was
    // invisible and `structures.register` — a one-line wrapper — reported nothing.
    const src = [
        "function Ke(a, b) {",
        "    return a.id + b.shape;",
        "}",
        ", Ye = (a) => {",
        "    return a.sprite.id;",
        "}",
    ].join("\n");
    const helpers = indexHelpers(src);
    assertEquals(helpers.has("Ke"), true);
    assertEquals(helpers.has("Ye"), true);
    assertEquals(
        delegateOf("{ Ke(e, t, n) }", "t", helpers)?.includes("a.id"),
        true,
    );
});

Deno.test("delegateOf only follows a delegate carrying the definition", () => {
    const helpers = new Map([["Nope", "{ return 1; }"]]);
    assertEquals(delegateOf("{ Nope(e, n) }", "t", helpers), null);
});

Deno.test("throwMessagesOf keeps a template literal with apostrophes", () => {
    // regression: one character class for all three quote styles truncated the
    // message at the first `'` in `Terrain '${id}' has invalid materialId`.
    const [msg] = throwMessagesOf(
        "throw new Error(`Terrain '${t.id}' has invalid materialId ${s}. Must be > 1 and < 150.`)",
    );
    assertEquals(msg.includes("invalid materialId"), true);
    assertEquals(msg.includes("Must be > 1"), true);
    assertEquals(msg.includes("${"), false);
});

Deno.test("collectRegisters keys on the full path, not namespace plus name", () => {
    // regression: `structures`, `structures.recipes` and `structures.processing`
    // each have a `register`; collapsing them attributed the recipe registrar's
    // body to `structures.register`.
    const index = {
        structures: [
            {
                name: "register",
                path: "structures.register",
                params: "(e,t)",
                line: 10,
                kind: "arrow",
            },
            {
                name: "register",
                path: "structures.recipes.register",
                params: "(e,t)",
                line: 20,
                kind: "arrow",
            },
            {
                name: "register",
                path: "structures.processing.register",
                params: "(e,t,n)",
                line: 30,
                kind: "arrow",
            },
            {
                name: "getAtCell",
                path: "structures.getAtCell",
                params: "(e,t)",
                line: 40,
                kind: "arrow",
            },
        ],
    };
    assertEquals(
        collectRegisters(index as never).map((m) => m.method).sort(),
        [
            "structures.processing.register",
            "structures.recipes.register",
            "structures.register",
        ],
    );
});
