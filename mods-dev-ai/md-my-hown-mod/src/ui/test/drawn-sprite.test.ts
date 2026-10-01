/**
 * The drawn-sprite draw function, driven against a fake canvas.
 *
 *     deno test --allow-read --allow-env src/ui/test/drawn-sprite.test.ts
 *
 * This answers the one question the sprite integration turned on: a sprite drawn in
 * the editor is a base64 PNG in the config, **not a file the game can load**.
 * `api.sprites.load` is documented for paths, so whether it accepts a data URL is
 * unknown until someone runs the game. These tests pin the part that has to work
 * either way — the mod paints the bytes itself, so it does not depend on the engine's
 * sprite registry at all.
 *
 * The signature and the canvas calls come from a shipping mod
 * (`__scraped-mods/workshop/3791498201`), not from inference.
 */
// @ts-nocheck: the `sandkit` shim below has no declared type.
import { assert, assertEquals } from "jsr:@std/assert@1";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

/** The config `loadConfig()` will hand back; tests rewrite `sprites` on it. */
const cfg: Record<string, unknown> = { sprites: [] };

let cellSize = 4;

globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => cfg,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        sprites: { list: () => [] },
        elements: { list: () => [] },
        items: { list: () => [] },
        input: {},
        actions: { list: () => [] },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        rendering: {
            getGridMetrics: () => ({ cellSize }),
            getDrawPositionAtCell: (x: number, y: number) => ({ x: x * cellSize, y: y * cellSize }),
        },
    },
    react: { createElement: () => null },
    enums: {},
};

const { resolveDraw } = await import("../../register/core/structures.ts");
const { clearDrawnSpriteCache } = await import("../../register/core/drawn-sprite.ts");

/** A recording canvas. Starts *dirty*, the way a tool effect leaves it. */
function imgCtx() {
    const calls: string[] = [];
    return {
        calls,
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        filter: "none",
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowColor: "",
        imageSmoothingEnabled: true,
        save: () => calls.push("save"),
        restore: () => calls.push("restore"),
        drawImage: (...a: unknown[]) =>
            calls.push(
                `drawImage(${a[1]},${a[2]},${a[3]},${a[4]})`,
            ),
    };
}

/** How many `Image`s have been constructed since the last reset. */
let made = 0;
/** Install an `Image` that "decodes" instantly, and start counting. */
function fakeImage() {
    made = 0;
    (globalThis as { Image?: unknown }).Image = class {
        onload?: () => void;
        onerror?: () => void;
        src = "";
        /** Decodes on assignment, as a cached browser image does. */
        complete = true;
        width = 16;
        height = 16;
        constructor() {
            made++;
        }
    };
}

/** One drawn sprite in the config, and a clean cache. */
function given(spriteId = "t:crate", source: unknown = PNG) {
    clearDrawnSpriteCache();
    cfg.sprites = source ? [{ id: spriteId, source }] : [];
    cellSize = 4;
}

function cleanUp() {
    clearDrawnSpriteCache();
    (globalThis as { Image?: unknown }).Image = undefined;
}

/** The `draw` for one structure bound to a sprite id. */
function drawFor(imageName: string | undefined, st: Record<string, unknown> = {}) {
    return resolveDraw({
        id: "a",
        drawKey: "drawnSprite",
        ...st,
        render: imageName ? { imageName } : undefined,
    }).draw!;
}
Deno.test("a drawn sprite is painted from the config, not the sprite registry", () => {
    given();
    fakeImage();
    const ctx = imgCtx();
    drawFor("t:crate")(null, { x: 0, y: 0 }, { ctx });
    // The engine's registry is never consulted: this is a canvas draw of bytes the
    // mod read out of the config itself. If `sprites.load` never accepted the data
    // URL, this is the only copy — which is the whole reason the key exists.
    assert(
        ctx.calls.some((c: string) => c.startsWith("drawImage")),
        `nothing was painted: ${ctx.calls.join(", ")}`,
    );
    assertEquals(made, 1);
    cleanUp();
});

Deno.test("the sprite is stretched over the footprint, in pixels", () => {
    given();
    fakeImage();
    const ctx = imgCtx();
    // 2 rows x 3 cols at cellSize 4 -> 12 wide by 8 high. `shape` is rows-of-columns,
    // so reading the axes the other way round is right for a square footprint and
    // silently wrong for every other one.
    drawFor("t:crate", {
        shape: [
            [1, 1, 1],
            [1, 1, 1],
        ],
    })(null, { x: 2, y: 3 }, { ctx });
    assertEquals(
        ctx.calls.find((c: string) => c.startsWith("drawImage")),
        "drawImage(8,12,12,8)",
    );
    cleanUp();
});

Deno.test("a re-draw of the same sprite reuses the decoded image", () => {
    given();
    fakeImage();
    const draw = drawFor("t:crate");
    // Per frame, per structure. Building an Image here would allocate forever.
    for (let i = 0; i < 5; i++) draw(null, { x: 0, y: 0 }, { ctx: imgCtx() });
    assertEquals(made, 1, "the image was rebuilt on a later frame");
    cleanUp();
});

Deno.test("redrawing a sprite in the editor replaces the cached image", () => {
    given();
    fakeImage();
    const draw = drawFor("t:crate");
    draw(null, { x: 0, y: 0 }, { ctx: imgCtx() });
    // Same id, different pixels. Without the source in the cache key the world
    // would keep showing the first version drawn, and nothing would say so.
    cfg.sprites = [{ id: "t:crate", source: `${PNG}REDRAWN` }];
    draw(null, { x: 0, y: 0 }, { ctx: imgCtx() });
    assertEquals(made, 2, "the edited sprite was not picked up");
    cleanUp();
});

Deno.test("the frame is claimed even while the image is still loading", () => {
    given();
    (globalThis as { Image?: unknown }).Image = class {
        onload?: () => void;
        onerror?: () => void;
        src = "";
        /** An image assigned a src but not yet decoded. */
        complete = false;
    };
    const ctx = imgCtx();
    // True, not false: returning false would let the engine draw `render.imageName`
    // underneath, which is the double-draw this key exists to avoid whenever
    // `sprites.load` *did* accept the data URL.
    assertEquals(drawFor("t:crate")(null, { x: 0, y: 0 }, { ctx }), true);
    assertEquals(ctx.calls, [], "it painted something without an image");
    cleanUp();
});

Deno.test("a sprite id that is not in the config claims the frame and paints nothing", () => {
    given("t:crate", null);
    fakeImage();
    const ctx = imgCtx();
    assertEquals(drawFor("t:missing")(null, { x: 0, y: 0 }, { ctx }), true);
    assertEquals(ctx.calls, []);
    cleanUp();
});

Deno.test("a drawn sprite with no image name does not claim the frame", () => {
    // No id at all is a config that has not picked a sprite yet, which is a
    // different thing from a bad id: the engine should still draw whatever `render`
    // describes, so this has to fall through.
    given();
    fakeImage();
    assertEquals(drawFor(undefined)(null, { x: 0, y: 0 }, { ctx: imgCtx() }), false);
    cleanUp();
});

Deno.test("it survives having no renderer API", () => {
    given();
    fakeImage();
    // `api.raw` is a live getter over `sandkit.api`, so removing the key here really
    // does leave the draw function with no renderer to talk to — which is the whole
    // point, since a throw in here takes the render loop with it.
    const host = (globalThis as { sandkit: { api: Record<string, unknown> } }).sandkit.api;
    const had = host.rendering;
    host.rendering = undefined;
    try {
        const ctx = imgCtx();
        assertEquals(drawFor("t:crate")(null, { x: 0, y: 0 }, { ctx }), true);
        // Falls back to cell x cellSize, so the sprite still lands somewhere sensible.
        assertEquals(
            ctx.calls.find((c: string) => c.startsWith("drawImage")),
            "drawImage(0,0,4,4)",
        );
    } finally {
        host.rendering = had;
    }
    cleanUp();
});

Deno.test("it normalises the canvas it inherits", () => {
    // Without this the sprite renders solid black and keeps repainting that way,
    // with nothing to explain it. This is the real mod's own warning.
    given();
    fakeImage();
    const ctx = imgCtx();
    Object.assign(ctx, {
        globalAlpha: 0.25,
        globalCompositeOperation: "multiply",
        filter: "blur(4px)",
        shadowBlur: 12,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        shadowColor: "rgba(0,0,0,0.9)",
    });
    drawFor("t:crate")(null, { x: 0, y: 0 }, { ctx });

    assertEquals(ctx.globalAlpha, 1, "inherited alpha");
    assertEquals(ctx.globalCompositeOperation, "source-over", "inherited compositing");
    assertEquals(ctx.filter, "none", "inherited filter");
    assertEquals(ctx.shadowBlur, 0, "inherited shadow");
    assertEquals(ctx.shadowColor, "rgba(0,0,0,0)", "inherited shadow colour");
    assertEquals(ctx.imageSmoothingEnabled, false, "a pixel sprite was smoothed");
    assertEquals(ctx.calls[0], "save");
    assertEquals(ctx.calls[ctx.calls.length - 1], "restore");
    cleanUp();
});
