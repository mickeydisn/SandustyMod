/**
 * extract-public-api.test.ts — guards the public api indexer.
 *
 * Four bugs found while building it all produced plausible output rather than
 * errors, so each is pinned here: nested namespace paths, generic method calls
 * (`api.storage.get<T>(k)`), JSDoc examples, and the wrapper-vs-host split.
 */

import {
    assert,
    assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    classifyApi,
    countArgs,
    findCalls,
    hasTopLevelIndexSignature,
    parseDts,
    parseFunctionDecl,
    parseObjectType,
    parseParams,
    stripComments,
} from "./extract-public-api.ts";

// ------------------------------------------------------------ param helpers

Deno.test("parseParams handles optionals, rest and nesting", () => {
    assertEquals(parseParams(""), []);
    assertEquals(parseParams("modId").map((p) => p.name), ["modId"]);
    assertEquals(
        parseParams("definition, options?").map((p) => [p.name, p.optional]),
        [["definition", false], ["options", true]],
    );
    const rest = parseParams("...args: [number, string]");
    assertEquals(rest[0].name, "args");
    assert(rest[0].rest, "should be flagged as rest");
    const nested = parseParams("a: { b: { c: number } }, d: number");
    assertEquals(nested.map((p) => p.name), ["a", "d"]);
    assertEquals(nested[0].type, "{ b: { c: number } }");
});

Deno.test("countArgs ignores commas inside literals", () => {
    assertEquals(countArgs(""), 0);
    assertEquals(countArgs("a"), 1);
    assertEquals(countArgs("a, b, c"), 3);
    assertEquals(countArgs("f(1, 2), { x: 1, y: 2 }"), 2);
    assertEquals(countArgs("[1, 2, 3]"), 1);
});

// --------------------------------------------------------- comment stripping

Deno.test("stripComments blanks comments and strings but keeps offsets", () => {
    const src =
        'a; // api.fake.one()\nb; /* api.fake.two() */ c; "api.fake.three()";';
    const out = stripComments(src);
    assertEquals(out.length, src.length, "offsets must be preserved");
    assertEquals(out.split("\n").length, src.split("\n").length);
    assert(out.includes("a;"), "real code survives");
    assert(!out.includes("api.fake"), "commented calls are removed");
});

Deno.test("parses namespaces, members, types and aliases", () => {
    const src = [
        "export namespace things {",
        "  /** Does the thing. */",
        "  export function doIt(a: string, b?: number): void;",
        "  export import getId = shared.api.things.getId;",
        "  /** A shape. */",
        "  export interface Shape {",
        "    /** width */",
        "    width: number;",
        "    height?: number;",
        "  }",
        "}",
    ].join("\n");
    const [ns] = parseDts(src, "t.d.ts");
    assertEquals(ns.name, "things");
    assertEquals(ns.members.length, 1);
    assertEquals(ns.members[0].name, "doIt");
    assertEquals(ns.members[0].required, 1);
    assertEquals(ns.members[0].total, 2);
    assertEquals(ns.members[0].returns, "void");
    assertEquals(ns.members[0].doc, "Does the thing.");
    assertEquals(ns.aliases.map((a) => a.name), ["getId"]);
    assertEquals(ns.types.map((t) => t.name), ["Shape"]);
    assertEquals(ns.types[0].fields.map((f) => f.name), ["width", "height"]);
    assertEquals(ns.types[0].fields[1].optional, true);
});

Deno.test("nested namespaces keep their full dotted path", () => {
    // regression: closing a nested namespace used to pop the parent off the
    // stack, so `structures.processing` came out as bare `processing`.
    const src = [
        "export namespace outer {",
        "  export function top(): void;",
        "  export namespace first {",
        "    export function one(): void;",
        "  }",
        "  export namespace second {",
        "    export function two(): void;",
        "  }",
        "  export function bottom(): void;",
        "}",
    ].join("\n");
    const parsed = parseDts(src, "t.d.ts");
    assertEquals(
        parsed.map((n) => n.name).sort(),
        ["outer", "outer.first", "outer.second"],
    );
    assertEquals(
        parsed.find((n) => n.name === "outer.first")?.members.map((m) => m.name),
        ["one"],
    );
    assertEquals(
        parsed.find((n) => n.name === "outer.second")?.members.map((m) => m.name),
        ["two"],
    );
    // the parent keeps its own members on both sides of the nested ones
    assertEquals(
        parsed.find((n) => n.name === "outer")?.members.map((m) => m.name),
        ["top", "bottom"],
    );
});

Deno.test("a code example inside JSDoc is not parsed as a declaration", () => {
    const src = [
        "export namespace doc {",
        "  /**",
        "   * @example",
        "   * ```ts",
        "   * api.structures.processing.register(\"x\", { a: 1 });",
        "   * ```",
        "   */",
        "  export function register(id: string, d: object): void;",
        "}",
    ].join("\n");
    const [ns] = parseDts(src, "t.d.ts");
    assertEquals(ns.members.length, 1);
    assertEquals(ns.members[0].name, "register");
});

Deno.test("multi-line parameter lists are captured whole", () => {
    const src = [
        "export namespace multi {",
        "  export function spread(",
        "    ...args: [number, number, string, { k?: boolean }]",
        "  ): void;",
        "}",
    ].join("\n");
    const [ns] = parseDts(src, "t.d.ts");
    assertEquals(ns.members.length, 1);
    assertEquals(ns.members[0].argNames, ["args"]);
    assert(ns.members[0].params.includes("number, number"));
});

Deno.test("an arrow in the return type does not swallow the next member", () => {
    // regression: `=>` was counted as a closing bracket, driving the depth to
    // -1 so the terminating `;` was never found and the accumulator consumed
    // the following declaration. This is the real `events.on` signature.
    const src = [
        "export namespace events {",
        "  export function on<K extends EventId>(",
        "    eventId: K,",
        "    callback: (payload: EventPayload<K>) => void,",
        "  ): () => void;",
        "  export function emit(eventId: string, payload: object): void;",
        "}",
    ].join("\n");
    const [ns] = parseDts(src, "t.d.ts");
    assertEquals(ns.members.map((m) => m.name), ["on", "emit"]);
    assertEquals(ns.members[0].returns, "() => void");
    assertEquals(ns.members[0].argNames, ["eventId", "callback"]);
    assertEquals(ns.members[1].returns, "void");
});

Deno.test("a nested object member is not a field of its interface", () => {
    // regression: the field scan was line based, so `unlocks.structures` and
    // `unlocks.items` were recorded as top level fields of the interface. That
    // made the mod's own `unlocks` look wrong and produced phantom "unexposed"
    // engine options in the Phase 2 drift report.
    const src = [
        "export interface TechDefinition {",
        "  name?: string;",
        "  unlocks?: {",
        "    structures?: readonly string[];",
        "    items?: readonly string[];",
        "  };",
        "  requires?: readonly string[];",
        "  [key: string]: unknown;",
        "}",
    ].join("\n");
    const [ns] = parseDts(src, "t.d.ts", "root");
    const t = ns.types.find((x) => x.name === "TechDefinition");
    assertEquals(
        t?.fields.map((f) => f.name),
        ["name", "unlocks", "requires"],
    );
    assert(t?.openEnded, "an index signature makes the shape open-ended");
    assert(
        t?.fields.find((f) => f.name === "unlocks")?.text.startsWith("{"),
        "unlocks keeps its nested body as text",
    );
});

Deno.test("an index signature nested in a field is not the type's own", () => {
    // regression: `ElementDefinition` has `defaultDataFields?: { [key: string]:
    // number }`, and a plain search for `[key:` called the whole type
    // open-ended, which silenced the whole mod-vs-engine comparison for it.
    const body = " id: string, defaultDataFields?: { [key: string]: number }, density: number, ";
    assertEquals(hasTopLevelIndexSignature(body), false);
    assertEquals(
        hasTopLevelIndexSignature(" a: number, [key: string]: unknown, "),
        true,
    );
});

Deno.test("parseObjectType reads comma separated object literal members", () => {
    const fields = parseObjectType(
        " id: string, nameKey: string, colors: { variants: [number, number, number][] }, " +
            "isGrabbable?: boolean, getExtraProps?: () => { data: Record<PropertyKey, any> }",
    );
    assertEquals(
        fields.map((f) => f.name),
        ["id", "nameKey", "colors", "isGrabbable", "getExtraProps"],
    );
    assertEquals(fields[3].optional, true);
    assertEquals(fields[0].optional, false);
    // a nested object must not split into separate members
    assert(fields[2].text.includes("variants"));
});

Deno.test("parseFunctionDecl accepts explicit type parameters", () => {
    const d = parseFunctionDecl(
        "export function on<K extends EventId>(eventId: K): () => void;",
    );
    assertEquals(d?.name, "on");
    assertEquals(d?.params, "(eventId: K)");
    assertEquals(d?.returns, "() => void");
});

Deno.test("findCalls captures a three segment path", () => {
    const found = findCalls("api.structures.recipes.register(m, body);");
    assertEquals(found.length, 1);
    assertEquals(found[0].path, ["structures", "recipes", "register"]);
    assert(found[0].called);
});

Deno.test("findCalls sees through generic type arguments", () => {
    // regression: the pattern required `(` straight after the method name, so
    // `api.storage.get<Panel>(key)` was never captured at all.
    const found = findCalls("const v = api.storage.get<Panel>(KEY);");
    assertEquals(found.length, 1);
    assertEquals(found[0].path, ["storage", "get"]);
    assert(found[0].called);
});

Deno.test("findCalls marks dotted access as the host handle", () => {
    const [bare] = findCalls("api.elements.register(def);");
    const [dotted] = findCalls("g()?.api?.elements?.register?.(def);");
    assertEquals(bare.host, false);
    assertEquals(dotted.host, true);
});

Deno.test("classifyApi tells the wrapper apart from the host handle", () => {
    // regression: store.ts imports the wrapper, so `api.storage.set(key, v)`
    // there is correct even though the host takes `(modId, key, v)`.
    const wrapper = classifyApi(
        'import { api } from "../packages/mysandkit.ts";\napi.storage.set(K, v);',
    );
    assertEquals(wrapper.host, false);
    const host = classifyApi('import { api } from "./api.ts";\napi.ui.toast(m);');
    assertEquals(host.host, true);
    const dotted = classifyApi("const v = g()?.api?.ui?.toast?.(m);");
    assertEquals(dotted.host, true);
});


