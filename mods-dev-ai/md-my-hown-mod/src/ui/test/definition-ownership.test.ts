

import { assert, assertEquals } from "jsr:@std/assert";




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


const CUSTOM = new Set(["networks", "unlockNodes", "customProcess", "buffers"]);


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
        
        
        
        "placementConfigs",
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
    
    
    
    
    custom: ["networks", "unlockNodes", "customProcess", "buffers"],
};


async function tabsIn(folder: string) {
    const names = [...Deno.readDirSync(new URL(folder, DEF_ROOT).pathname)]
        .filter((e) => e.isFile && e.name.endsWith(".ts"))
        .map((e) => e.name.replace(/\.ts$/, ""));
    const out: Record<string, string> = {};
    for (const name of names.sort()) {
        const mod = await import(new URL(`${name}.ts`, new URL(folder, DEF_ROOT)).href);
        
        
        
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

    
    
    for (const [folder, expected] of Object.entries(EXPECTED)) {
        const actual = Object.values(byFolder[folder]).sort();
        assertEquals(
            actual,
            [...expected].sort(),
            `${folder}/ holds ${JSON.stringify(actual)} — an object is in the wrong folder, ` +
                `or one is missing entirely`,
        );
    }

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const SHARED_HELPERS = [
        "types",
        "fields",
        "values",
        "index",
        "actions-field",
        "projectile-option-field",
        "excavation-option-field",
        "process-ref-field",
        
        
        
        
        
        "data-fields",
    ];
    for (const entry of [...Deno.readDirSync(DEF_ROOT.pathname)]) {
        const stem = entry.name.replace(/\.ts$/, "");
        
        const isTest = entry.name.endsWith(".test.ts");
        assert(
            entry.name === "core" || entry.name === "custom" || !entry.isFile || isTest ||
                SHARED_HELPERS.includes(stem),
            `${entry.name} sits outside core/ and custom/ — every definition belongs to one of them`,
        );
    }
});

Deno.test("only the mod-owned objects are in custom/", async () => {
    
    
    
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
    
    
    
    
    const { schemaSourceWithDefinitions } = await import("../../../tools/schema-source.ts");
    const src = schemaSourceWithDefinitions();
    const seen = [...src.matchAll(/\/\* definition: (.*?) \*\
    
    
    
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
