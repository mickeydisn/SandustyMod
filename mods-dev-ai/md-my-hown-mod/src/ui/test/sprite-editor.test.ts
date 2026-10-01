// @ts-nocheck: the `sandkit` shim below has no declared type, and the dynamic
// import that follows would otherwise resolve to `any`.
/**
 * The sprite-editor (`./sprite-editor/`) wired into this mod.
 *
 *     deno test --allow-read --allow-env src/ui/test/sprite-editor.test.ts
 *
 * The package arrived with an integration patch. Its own hunks were written
 * against an older `panel.ts` and an older `mysandkit.ts`, and neither applies
 * here, so the wiring was done by hand and is pinned by these tests instead —
 * otherwise a later `deno fmt` or refactor could quietly drop one half of it
 * and leave a Draw tab whose sprites never reach the game.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";

/** Every `sprites.*` call, in order, as `[method, id, source]`. */
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

const { registerSprite } = await import("../../packages/mysandkit.ts");
const { CATEGORY_META, MENU_GROUPS } = await import("../schema.ts");
const { ATTACHED } = await import("../panel/attach.ts");

/**
 * The config `loadConfig()` hands back. Tests rewrite `sprites` on it to describe a
 * drawn sprite, and the picker reads the same array the editor writes into.
 */
const cfg: Record<string, unknown> = { sprites: [] };

// ── the register routing ──────────────────────────────────────────────────────

Deno.test("a drawn sprite is not looked up as a file", () => {
    // The failure this prevents is silent and total: `loadFromMod` is handed the
    // base64 string as if it were a path, finds no such mod asset, and the id
    // ends up registered with no texture — a sprite that is saved, listed, and
    // draws nothing.
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
        // **This** is the line that proves the registrar ran. Both paths call
        // `load` with the same data URL — the plain `source` branch reaches the
        // same call — so asserting only the two lines above passes even with the
        // branch deleted. The registrar's second strategy is the same bytes as a
        // blob URL, and only it does that. (`getById` returns null in this shim,
        // which is what makes it fall through to that strategy.)
        assertEquals(
            spriteCalls[1]?.[2]?.startsWith("blob:"),
            true,
            `the registrar's blob-URL fallback never ran: ${JSON.stringify(spriteCalls)}`,
        );
    });
});

Deno.test("a file-based sprite still goes to the mod loader", () => {
    // The counterweight. The `data:` branch sits *above* the `path` branch, so a
    // sprite that has both a path and a source must still resolve the way it did
    // before the editor existed.
    spriteCalls.length = 0;
    return registerSprite({ id: "t:file", path: "assets/crate.png" }).then(() => {
        assertEquals(spriteCalls, [["loadFromMod", "t:file", "assets/crate.png"]]);
    });
});

Deno.test("an ordinary source is not mistaken for a drawn one", () => {
    // The test is `startsWith("data:")`, not merely "has a source". A path-shaped
    // `source` must keep reaching `load`.
    spriteCalls.length = 0;
    return registerSprite({ id: "t:pathsrc", source: "assets/stone.png" }).then(() => {
        assertEquals(spriteCalls, [["load", "t:pathsrc", "assets/stone.png"]]);
    });
});

// ── the tab ───────────────────────────────────────────────────────────────────

Deno.test("the editor is a screen of its own, not a list", () => {
    // A tab with a `configKey` gets a list screen with an `Edit` form behind each
    // row. The editor is neither: it is one component that reads and writes the
    // `sprites` category directly. Declaring a `configKey` here would build an
    // entry type for a screen that has no entries.
    assertEquals(CATEGORY_META.spriteEditor.configKey, undefined);
});

Deno.test("the editor sits beside the sprites it produces", () => {
    const assets = MENU_GROUPS.find((g) => g.key === "assets");
    assertEquals(assets.categories, ["sprites", "spriteEditor", "draws"]);
    // And it is a chip, so it is reachable from the menu at all.
    assert(
        !Object.values(ATTACHED).flat().includes("spriteEditor"),
        "the editor is attached under something, so it has no chip",
    );
});

Deno.test("the editor does not claim the name of the screen next to it", () => {
    // `draws` is "Custom draw" and the editor is the thing that draws pixels.
    // The two are unrelated — one is a catalogue of the engine's draw functions,
    // the other a pixel editor — so they must not end up under a name the reader
    // would take to mean either.
    assert(CATEGORY_META.spriteEditor.label !== CATEGORY_META.draws.label);
    assert(!CATEGORY_META.spriteEditor.label.startsWith(CATEGORY_META.draws.label));
});

Deno.test("a drawn sprite is selectable, and says so", async () => {
    const { listSpriteIds } = await import("../../catalog.ts");

    const before = cfg.sprites;
    // The editor saves a drawn sprite as base64 PNG in `source`, with no `path`.
    // It must still be offered in the structure's Sprite dropdown: that dropdown
    // is the only route to pointing a `drawnSprite` draw key at anything, and a
    // binding nobody can find from the panel is one nobody uses.
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
        // Exact labels, not `includes`: an id that happened to contain the word
        // "drawn" would make a substring check pass with the marker removed, which
        // is precisely the regression this is here to catch.
        assertEquals(drawn?.label, "t:sketch (drawn)");
        assertEquals(file?.label, "t:crate (this mod)");
    } finally {
        cfg.sprites = before;
    }
});
