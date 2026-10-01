


import { assert, assertEquals } from "jsr:@std/assert@1";


const spriteCalls: [string, string, string][] = [];

globalThis.sandkit = {
    api: {
        sprites: {
            loadFromMod: (id: string, path: string) => {
                spriteCalls.push(["loadFromMod", id, path]);
            },
            load: (id: string, source: string) => {
                spriteCalls.push(["load", id, source]);
            },
            getById: () => null,
            list: () => [],
        },
        storage: {
            ensure: () => {},
            get: () => cfg,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
    },
    react: { createElement: () => null },
    enums: {},
};

const { registerSprite } = await import("../../packages/registrations.ts");
const { CATEGORY_META, MENU_GROUPS } = await import("../schema.ts");
const { ATTACHED } = await import("../panel/attach.ts");


const cfg: Record<string, unknown> = { sprites: [] };



Deno.test("a drawn sprite is not looked up as a file", () => {
    
    
    
    
    spriteCalls.length = 0;
    const png = "data:image/png;base64,iVBORw0KGgo=";
    return registerSprite({ id: "t:drawn", source: png }).then(() => {
        assertEquals(
            spriteCalls.filter(([m]) => m === "loadFromMod"),
            [],
            "the base64 PNG was handed to the mod-file loader as if it were a path",
        );
        assertEquals(spriteCalls[0][0], "load");
        assertEquals(spriteCalls[0][2], png, "the data URL was not tried first");
        
        
        
        
        
        
        assertEquals(
            spriteCalls[1]?.[2]?.startsWith("blob:"),
            true,
            `the registrar's blob-URL fallback never ran: ${JSON.stringify(spriteCalls)}`,
        );
    });
});

Deno.test("a file-based sprite still goes to the mod loader", () => {
    
    
    
    spriteCalls.length = 0;
    return registerSprite({ id: "t:file", path: "assets/crate.png" }).then(() => {
        assertEquals(spriteCalls, [["loadFromMod", "t:file", "assets/crate.png"]]);
    });
});

Deno.test("an ordinary source is not mistaken for a drawn one", () => {
    
    
    spriteCalls.length = 0;
    return registerSprite({ id: "t:pathsrc", source: "assets/stone.png" }).then(() => {
        assertEquals(spriteCalls, [["load", "t:pathsrc", "assets/stone.png"]]);
    });
});



Deno.test("the editor is a screen of its own, not a list", () => {
    
    
    
    
    assertEquals(CATEGORY_META.spriteEditor.configKey, undefined);
});

Deno.test("the editor sits beside the sprites it produces", () => {
    const assets = MENU_GROUPS.find((g) => g.key === "assets");
    assertEquals(assets.categories, ["sprites", "spriteEditor", "draws"]);
    
    assert(
        !Object.values(ATTACHED).flat().includes("spriteEditor"),
        "the editor is attached under something, so it has no chip",
    );
});

Deno.test("the editor does not claim the name of the screen next to it", () => {
    
    
    
    
    assert(CATEGORY_META.spriteEditor.label !== CATEGORY_META.draws.label);
    assert(!CATEGORY_META.spriteEditor.label.startsWith(CATEGORY_META.draws.label));
});

Deno.test("a drawn sprite is selectable, and says so", async () => {
    const { listSpriteIds } = await import("../../catalog.ts");

    const before = cfg.sprites;
    
    
    
    
    cfg.sprites = [
        { id: "t:sketch", source: "data:image/png;base64,iVBORw0KGgo=" },
        { id: "t:crate", path: "assets/icons/crate.png" },
    ];
    try {
        const opts = listSpriteIds();
        const drawn = opts.find((o) => o.value === "t:sketch");
        const file = opts.find((o) => o.value === "t:crate");
        assertEquals(drawn?.source, "mod", "a drawn sprite is not offered at all");
        assertEquals(file?.source, "mod");
        
        
        
        assertEquals(drawn?.label, "t:sketch (drawn)");
        assertEquals(file?.label, "t:crate (this mod)");
    } finally {
        cfg.sprites = before;
    }
});
