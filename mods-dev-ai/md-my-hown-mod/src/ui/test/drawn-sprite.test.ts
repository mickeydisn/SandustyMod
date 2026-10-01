

import { assert, assertEquals } from "jsr:@std/assert@1";

const PNG = "data:image/png;base64,iVBORw0KGgo=";


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


let made = 0;

function fakeImage() {
    made = 0;
    (globalThis as { Image?: unknown }).Image = class {
        onload?: () => void;
        onerror?: () => void;
        src = "";
        
        complete = true;
        width = 16;
        height = 16;
        constructor() {
            made++;
        }
    };
}


function given(spriteId = "t:crate", source: unknown = PNG) {
    clearDrawnSpriteCache();
    cfg.sprites = source ? [{ id: spriteId, source }] : [];
    cellSize = 4;
}

function cleanUp() {
    clearDrawnSpriteCache();
    (globalThis as { Image?: unknown }).Image = undefined;
}


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
    
    for (let i = 0; i < 5; i++) draw(null, { x: 0, y: 0 }, { ctx: imgCtx() });
    assertEquals(made, 1, "the image was rebuilt on a later frame");
    cleanUp();
});

Deno.test("redrawing a sprite in the editor replaces the cached image", () => {
    given();
    fakeImage();
    const draw = drawFor("t:crate");
    draw(null, { x: 0, y: 0 }, { ctx: imgCtx() });
    
    
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
        
        complete = false;
    };
    const ctx = imgCtx();
    
    
    
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
    
    
    
    given();
    fakeImage();
    assertEquals(drawFor(undefined)(null, { x: 0, y: 0 }, { ctx: imgCtx() }), false);
    cleanUp();
});

Deno.test("it survives having no renderer API", () => {
    given();
    fakeImage();
    
    
    
    const host = (globalThis as { sandkit: { api: Record<string, unknown> } }).sandkit.api;
    const had = host.rendering;
    host.rendering = undefined;
    try {
        const ctx = imgCtx();
        assertEquals(drawFor("t:crate")(null, { x: 0, y: 0 }, { ctx }), true);
        
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
