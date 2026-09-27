// @ts-nocheck
/**
 * Which folder a definition lives in is a claim about *who owns the object*.
 *
 * `core/` holds objects the engine has a first-class `register()` for;
 * `custom/` holds objects the mod invented, which the engine only ever sees as
 * the strings they resolve to. That distinction is worth a folder boundary
 * because it is the one question the file list cannot answer on its own, and it
 * is easy to lose: a new definition lands wherever the author was editing, and
 * a wrong folder is invisible to every other test in the suite.
 *
 * The two mod-owned objects are named explicitly below rather than derived,
 * because the rule is a judgement about intent and a derived rule would happily
 * re-classify `network` if its shape ever changed. `network` is the case that
 * proves the rule is not about size — it is two fields, and it is still custom.
 */
import { assert, assertEquals } from "jsr:@std/assert";

// The catalog reads the host `sandkit` global at import time, so it must exist
// before any definition that imports it resolves. Same stub shape as the other
// UI tests, including the (modId, key) storage signature.
const store: Record<string, unknown> = {};
(globalThis as Record<string, unknown>).sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (_m: string, k: string) => store[k],
            set: (_m: string, k: string, v: unknown) => {
                store[k] = v;
            },
            remove: (_m: string, k: string) => {
                delete store[k];
            },
        },
        ui: { toast: () => {} },
        elements: { list: () => [], register: () => {} },
        items: { list: () => [] },
        sprites: { list: () => [] },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
    },
    react: { createElement: () => null },
    enums: {},
};

const DEF_ROOT = new URL("../definition/", import.meta.url);

/**
 * Objects the mod owns. `register()` never receives one of these; it receives
 * the ids/strings the entry produces.
 *
 *   - `networks`     — `api.energy.registerType` never sees a network, only an
 *                      `options.energyType` string that two types must match.
 *   - `unlockNodes`  — the mod's own gate in front of a structure, separate from
 *                      `techs` on purpose (see `constants.ts`).
 */
const CUSTOM = new Set(["networks", "unlockNodes"]);

/**
 * The tabs each folder is expected to hold, so a misfile is *named*.
 *
 * Asserting only "custom/ has two files" would catch the wrong count while
 * saying nothing about which file moved — and adding a legitimate third
 * mod-owned object would fail that count for a reason that has nothing to do
 * with a bug. Spelling the whole split out makes the failure name the object
 * and say which folder it belongs in.
 */
const EXPECTED: Record<string, string[]> = {
    core: [
        "behaviors",
        "categories",
        "contacts",
        "elements",
        "energy",
        "excavation",
        "inputs",
        "interactions",
        "items",
        "modifiers",
        "processing",
        "projectiles",
        "recipes",
        "signals",
        "sprites",
        "structures",
        "techs",
        "terrains",
        "triggers",
        "upgrades",
    ],
    custom: ["networks", "unlockNodes"],
};

/** The tab each definition file in a folder actually claims. */
async function tabsIn(folder: string) {
    const names = [...Deno.readDirSync(new URL(folder, DEF_ROOT).pathname)]
        .filter((e) => e.isFile && e.name.endsWith(".ts"))
        .map((e) => e.name.replace(/\.ts$/, ""));
    const out: Record<string, string> = {};
    for (const name of names.sort()) {
        const mod = await import(new URL(`${name}.ts`, new URL(folder, DEF_ROOT)).href);
        // A definition is the export carrying a `tab`; anything else in the
        // module is a helper. Asserting one exists is a separate test, so a
        // missing `tab` here surfaces as "no tab recorded" rather than a hole.
        const found = Object.values(mod).find((d) =>
            d && typeof d === "object" && typeof (d as { tab?: unknown }).tab === "string"
        ) as { tab: string } | undefined;
        out[name] = found?.tab ?? "";
    }
    return out;
}

Deno.test("every definition is filed by who owns the object", async () => {
    const byFolder: Record<string, Record<string, string>> = {
        core: await tabsIn("core/"),
        custom: await tabsIn("custom/"),
    };

    // Compare the *tabs*, not the filenames: a file is correctly placed when the
    // object it defines is owned the right way, and a rename is not a bug.
    for (const [folder, expected] of Object.entries(EXPECTED)) {
        const actual = Object.values(byFolder[folder]).sort();
        assertEquals(
            actual,
            [...expected].sort(),
            `${folder}/ holds ${JSON.stringify(actual)} — an object is in the wrong folder, ` +
                `or one is missing entirely`,
        );
    }

    // Nothing may be left in the parent: a definition sitting beside `index.ts`
    // is outside the split, and the tools' folder walk would not see it.
    //
    // The allowlist is for **shared helpers**, not for definitions. `types` is the
    // contract, `fields`/`values` are the field builders every object uses, `index`
    // is the registry. `actions-field` joins them for the same reason: it is the one
    // `actions` field all seven process-storing objects share, and it defines no
    // object of its own. Putting it in `core/` would be a lie — `custom/` owns two
    // of the seven.
    const SHARED_HELPERS = ["types", "fields", "values", "index", "actions-field"];
    for (const entry of [...Deno.readDirSync(DEF_ROOT.pathname)]) {
        const stem = entry.name.replace(/\.ts$/, "");
        // A test is not a definition, and a shared helper's test sits beside it.
        const isTest = entry.name.endsWith(".test.ts");
        assert(
            entry.name === "core" || entry.name === "custom" || !entry.isFile || isTest ||
                SHARED_HELPERS.includes(stem),
            `${entry.name} sits outside core/ and custom/ — every definition belongs to one of them`,
        );
    }
});

Deno.test("only the mod-owned objects are in custom/", async () => {
    // The rule restated as a claim, so the reason for the split is checked and
    // not just its current shape. `network` is the case that proves the test is
    // not about size: two fields, and still not an engine object.
    const custom = await tabsIn("custom/");
    for (const [name, tab] of Object.entries(custom)) {
        assert(
            CUSTOM.has(tab),
            `${name}.ts claims tab "${tab}", which the engine has a register() for — ` +
                "it belongs in core/",
        );
    }
    assert(CUSTOM.size === Object.keys(custom).length, "custom/ holds a file the registry ignores");
});

Deno.test("each definition file exports exactly one definition, for one tab", async () => {
    for (const folder of ["core/", "custom/"]) {
        const found = await tabsIn(folder);
        for (const [name, tab] of Object.entries(found)) {
            assert(tab, `${folder}${name}.ts exports no object with a \`tab\``);
        }
    }
});

Deno.test("the tools find every definition in both folders", async () => {
    // The failure this protects against is silent and total: `schema-source.ts`
    // walks a fixed list of directories, so a folder it does not name
    // contributes no paths, every tab in it reports zero fields, and both
    // generators emit a document that is confidently wrong.
    const { schemaSourceWithDefinitions } = await import("../../../tools/schema-source.ts");
    const src = schemaSourceWithDefinitions();
    const seen = [...src.matchAll(/\/\* definition: (.*?) \*\//g)].map((m) => m[1]);
    // `tabsIn` keys by filename, so the count is the key count — `.length` on the
    // object is `undefined`, which compares false against 22 and reads as
    // "nothing was spliced" rather than "the arithmetic is wrong".
    const total = Object.keys(await tabsIn("core/")).length +
        Object.keys(await tabsIn("custom/")).length;
    assertEquals(seen.length, total, "a definition was not spliced in");
    assert(
        seen.some((p) => p.includes("/core/")),
        "no core definition was spliced",
    );
    assert(
        seen.some((p) => p.includes("/custom/")),
        "no custom definition was spliced",
    );
});
