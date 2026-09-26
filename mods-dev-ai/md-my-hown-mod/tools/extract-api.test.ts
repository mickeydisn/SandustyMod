/**
 * extract-api.test.ts — guards the Phase 0 index.
 *
 * The extractor had two silent-corruption bugs (an unanchored regex and a
 * frame stack that accumulated instead of push/popping). Both produced
 * plausible-looking output rather than errors, so these tests assert against
 * the real source and against hand-written fixtures.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { countParams, extractApi, splitParams, summarise } from "./extract-api.ts";

const HERE = new URL(".", import.meta.url).pathname;
const REPO = HERE.replace(/\/$/, "").split("/").slice(0, -3).join("/") + "/";
const BUNDLE = `${REPO}__bundel/modules/bundel.js/46781.js`;

/** read the shipped bundle, or skip the test when it is not checked out */
async function readBundle(): Promise<string | null> {
    try {
        return await Deno.readTextFile(BUNDLE);
    } catch {
        console.warn(`skipping: bundle not present at ${BUNDLE}`);
        return null;
    }
}

// ------------------------------------------------------------ param helpers

Deno.test("splitParams handles defaults, destructuring and nesting", () => {
    assertEquals(splitParams("()"), []);
    assertEquals(splitParams("(e)"), ["e"]);
    assertEquals(splitParams("(e, t)"), ["e", "t"]);
    assertEquals(splitParams("(e, t = 1)"), ["e", "t = 1"]);
    assertEquals(splitParams("({ a, b }, t)"), ["{ a, b }", "t"]);
    assertEquals(splitParams("(e, { a: { b } }, t)"), ["e", "{ a: { b } }", "t"]);
    assertEquals(splitParams("(e, [x, y])"), ["e", "[x, y]"]);
    // a comma inside a call default must not split
    assertEquals(splitParams("(e, t = f(1, 2))"), ["e", "t = f(1, 2)"]);
});

Deno.test("countParams agrees with splitParams", () => {
    assertEquals(countParams("(e, t, n)"), 3);
    assertEquals(countParams("()"), 0);
    assertEquals(countParams("({ a, b })"), 1);
});

// ------------------------------------------------------- structural parsing

Deno.test("parses namespaces, nesting and arity from a fixture", () => {
    const src = [
        "const Dt = {",
        "    alpha: {",
        "        doThing: (e, t, n) => {",
        "            e.session.settings.x = t;",
        "        },",
        "        bare: e => e.store.y,",
        "        group: {",
        "            inner: (e, t) => t,",
        "        },",
        "        reexport: someModule.fn,",
        "    },",
        "    beta: {",
        "        boom: (e) => {",
        '            throw new Error("nope");',
        "        },",
        "    },",
        "};",
    ].join("\n");
    const idx = extractApi(src);
    assertEquals(Object.keys(idx).sort(), ["alpha", "beta"]);
    const find = (p: string) => idx.alpha.find((m) => m.path === p);
    assertEquals(find("alpha.doThing")?.arity, 3);
    assertEquals(find("alpha.doThing")?.takesContext, true);
    assertEquals(find("alpha.bare")?.arity, 1);
    assertEquals(find("alpha.group.inner")?.arity, 2);
    assertEquals(find("alpha.reexport")?.kind, "re-export");
    assertEquals(idx.beta[0].throws, true);
});

Deno.test("a function body is not mistaken for a namespace", () => {
    // regression: body braces used to be parsed as namespaces, yielding
    // paths like "alpha.doThing.gamma"
    const src = [
        "const Dt = {",
        "    alpha: {",
        "        doThing: (e) => {",
        "            const inner = { deep: 1 };",
        "            return inner;",
        "        },",
        "        after: (e) => e,",
        "    },",
        "};",
    ].join("\n");
    assertEquals(
        extractApi(src).alpha.map((m) => m.path),
        ["alpha.doThing", "alpha.after"],
    );
});

Deno.test("method shorthand bodies are consumed, not re-scanned", () => {
    const src = [
        "const Dt = {",
        "    alpha: {",
        "        doThing(e, t) {",
        "            return t;",
        "        },",
        "    },",
        "};",
    ].join("\n");
    const idx = extractApi(src);
    assertEquals(idx.alpha[0].path, "alpha.doThing");
    assertEquals(idx.alpha[0].arity, 2);
});

Deno.test("strings and comments cannot corrupt brace counting", () => {
    const src = [
        "const Dt = {",
        "    alpha: {",
        "        tricky: (e) => e, // } not a close",
        '        quoted: (e) => "}",',
        "        blocky: (e) => e, /* { */",
        "        real: (e, t) => t,",
        "    },",
        "};",
    ].join("\n");
    const idx = extractApi(src);
    assertEquals(
        idx.alpha.map((m) => m.path),
        ["alpha.tricky", "alpha.quoted", "alpha.blocky", "alpha.real"],
    );
    assertEquals(idx.alpha[3].arity, 2);
});

Deno.test("every indexed entry matches the real source line", async () => {
    const src = await readBundle();
    if (src === null) return;
    const idx = extractApi(src);
    const lines = src.split("\n");
    const all = Object.values(idx).flat();
    assert(all.length > 300, `expected a large api, got ${all.length}`);

    const problems: string[] = [];
    const squash = (s: string) => s.replace(/\s+/g, " ").trim();
    for (const m of all) {
        const line = lines[m.line - 1] ?? "";
        const keyRe = new RegExp(
            `(^|[^\\w$])${m.name.replace(/\$/g, "\\$")}\\s*:`,
        );
        if (!keyRe.test(line)) {
            problems.push(`key "${m.path}" absent from line ${m.line}`);
            continue;
        }
        if (m.params && !line.includes(m.params)) {
            problems.push(`params "${m.params}" of "${m.path}" absent from line ${m.line}`);
        }
        if (m.arity !== 0 && m.arity !== countParams(m.params)) {
            problems.push(`arity ${m.arity} disagrees with params "${m.params}" (${m.path})`);
        }
        // The body snippet is sliced from the real source, so it must appear
        // near the recorded line. Bodies can be long and multi-line (the bundle
        // writes `name: (e, t) =>` with the body starting on the next line), so
        // compare a short head against a generous forward window.
        if (m.snippet && m.snippet.length > 8) {
            const window = lines.slice(m.line - 1, m.line + 12).join(" ");
            const head = squash(m.snippet).slice(0, 24);
            if (!squash(window).includes(head)) {
                problems.push(`snippet of "${m.path}" absent near line ${m.line}`);
            }
        }
    }
    assertEquals(problems, [], `${problems.length} entries disagree with source`);
});

Deno.test("known engine signatures stay pinned", async () => {
    const src = await readBundle();
    if (src === null) return;
    const idx = extractApi(src);
    const get = (p: string) => {
        const [ns, ...rest] = p.split(".");
        const tail = rest.join(".");
        return idx[ns]?.find((m) => m.path === p || (tail && m.name === tail));
    };
    // these arities drive the mod's update paths in Phases 3 and 6
    assertEquals(get("elements.register")?.arity, 2);
    assertEquals(get("elements.updateDefinition")?.arity, 3);
    assertEquals(get("upgrades.register")?.arity, 2);
    assertEquals(get("upgrades.updateDefinition")?.arity, 4);
    assertEquals(get("upgrades.registerCategory")?.throws, true);
    assertEquals(get("storage.get")?.arity, 3);
    assertEquals(get("storage.set")?.arity, 4);
    // the name the mod gets wrong
    assertEquals(get("elements.getTypeFromId"), undefined);
    assert(get("elements.getElementTypeFromId"), "getElementTypeFromId should exist");
    assert(get("elements.getElementIdFromType"), "getElementIdFromType should exist");
});

Deno.test("summarise counts every entry exactly once", async () => {
    const src = await readBundle();
    if (src === null) return;
    const idx = extractApi(src);
    const s = summarise(idx);
    const total = Object.values(idx).flat().length;
    assertEquals(s.entries, total);
    assertEquals(
        s.functions + s.reExports + s.values,
        total,
        "every entry must be exactly one kind",
    );
    assertEquals(s.namespaces, Object.keys(idx).length);
    assert("elements" in idx, "elements should be an indexed namespace");
});
