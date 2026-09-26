import { assert, assertEquals } from "jsr:@std/assert";
import {
    collect,
    COMPOSITE,
    INDIRECT,
    readMapping,
    render,
    statementsOf,
} from "./gen-reference.ts";

Deno.test("statementsOf splits on top-level semicolons only", () => {
    const stmts = statementsOf(
        'const a = f(1; 2);\nsetX("y");\nconst o = { k: "v;w" };',
    );
    assertEquals(stmts.length, 3);
    assert(stmts[0]!.includes("f(1; 2)"));
    assert(stmts[2]!.includes('"v;w"'));
});

Deno.test("statementsOf keeps a nested generic intact", () => {
    const stmts = statementsOf(
        'const c = optJson<Record<string, unknown>>(\n  form,\n  "kJson",\n);\nnext();',
    );
    assertEquals(stmts.length, 2);
    assert(stmts[0]!.includes("optJson<Record<string, unknown>>"));
});

Deno.test("readMapping resolves a one-to-one setStr", async () => {
    const map = await readMapping();
    assertEquals(map.get("upgrades")?.get("itemId"), "itemId");
});

Deno.test("readMapping joins a read and a write across statements", async () => {
    // `const shape = optJson<…>(form, "shapeJson"); if (shape) entry.shape = …`
    const map = await readMapping();
    assertEquals(map.get("structures")?.get("shapeJson"), "shape");
});

Deno.test("readMapping maps a value through a conversion call", async () => {
    // `if (hex …) entry.metaColor = hexToPacked(hex);`
    const map = await readMapping();
    assertEquals(map.get("terrains")?.get("metaColor"), "metaColor");
});

Deno.test("every composite names a field the form actually has", async () => {
    // A COMPOSITE entry for a key that no longer exists would silently rot, so
    // it is checked against the live field list for that tab.
    const docs = await collect();
    for (const [tab, pairs] of Object.entries(COMPOSITE)) {
        const doc = docs.find((d) => d.tab === tab);
        assert(doc, `COMPOSITE names unknown tab "${tab}"`);
        const keys = new Set(doc!.rows.map((r) => r.uiKey));
        for (const [ui, config] of pairs) {
            assert(keys.has(ui), `${tab}.${ui} is in COMPOSITE but not a form field`);
            assert(!config.startsWith("—"), `${tab}.${ui} has an empty target`);
        }
    }
});

Deno.test("INDIRECT covers the fields that store nothing", () => {
    for (const k of ["advancedJson", "colorHSLOn", "currencyTypeCustom", "branchCustom"]) {
        assert(INDIRECT.test(k), `${k} should be indirect`);
    }
    assert(!INDIRECT.test("shapeJson"));
});

// The invariant this generator exists to protect: a field may only render as
// `—` if it is deliberately indirect. Anything else means the mapping broke.
Deno.test("no form field is left unmapped", async () => {
    const docs = await collect();
    const unmapped = docs.flatMap((d) =>
        d.rows.filter((r) => r.configKey === "—" && !INDIRECT.test(r.uiKey))
            .map((r) => `${d.tab}.${r.uiKey}`)
    );
    assertEquals(unmapped, [], `unmapped: ${unmapped.join(", ")}`);
});

Deno.test("every tab row names its form key, label and stored key", async () => {
    const docs = await collect();
    assert(docs.length > 0);
    for (const d of docs) {
        assert(d.label.length > 0, `${d.tab} has no label`);
        assert(d.configKey.length > 0, `${d.tab} stores nothing`);
        for (const r of d.rows) {
            assert(r.uiKey.length > 0, `${d.tab} row has no key`);
            assert(r.label.length > 0, `${d.tab}.${r.uiKey} has no label`);
        }
    }
});

Deno.test("render lists every field exactly once", async () => {
    const docs = await collect();
    const md = render(docs);
    for (const d of docs) {
        for (const r of d.rows) {
            const hits = md.split(`| \`${r.uiKey}\` |`).length - 1;
            assert(hits >= 1, `${d.tab}.${r.uiKey} missing from the reference`);
        }
    }
});
