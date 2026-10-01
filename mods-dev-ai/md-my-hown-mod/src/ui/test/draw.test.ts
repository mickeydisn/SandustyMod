

import { assert, assertEquals } from "jsr:@std/assert";

const store: Record<string, unknown> = {};
globalThis.sandkit = {
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
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        items: { list: () => [] },
        sprites: { list: () => [] },
        
        rendering: {
            getGridMetrics: () => ({ cellSize: 4 }),
            getDrawPositionAtCell: (x: number, y: number) => ({ x: x * 4, y: y * 4 }),
        },
    },
    react: { createElement: () => null },
    enums: {},
};

const { resolveDraw } = await import("../../register/core/structures.ts");
const { DRAW_FUNCTIONS, listDrawFunctions, drawDoc } = await import("../../catalog.ts");


function fakeCtx() {
    const calls: string[] = [];
    return {
        calls,
        globalAlpha: 0.25,
        globalCompositeOperation: "multiply",
        filter: "blur(4px)",
        shadowBlur: 12,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        shadowColor: "rgba(0,0,0,0.9)",
        lineWidth: 0,
        strokeStyle: "",
        save: () => calls.push("save"),
        restore: () => calls.push("restore"),
        strokeRect: (x: number, y: number, w: number, h: number) =>
            calls.push(`strokeRect(${x},${y},${w},${h})`),
    };
}

Deno.test("no drawKey means no draw function at all", () => {
    const out = resolveDraw({ id: "a" });
    assertEquals(out.draw, undefined);
    assertEquals("drawKey" in out, false, "the key leaked into the definition");
});

Deno.test("the default key is dropped rather than registered", () => {
    
    
    assertEquals(resolveDraw({ id: "a", drawKey: "default" }).draw, undefined);
});

Deno.test("an unknown key is dropped, not passed through as a string", () => {
    
    
    assertEquals(resolveDraw({ id: "a", drawKey: "nope" }).draw, undefined);
});








Deno.test("disallowPick is renamed to the engine's disallowSelection", () => {
    const out = resolveDraw({ id: "a", disallowPick: true });
    
    
    
    
    assertEquals(out.disallowSelection, true);
    
    
    assertEquals("disallowPick" in out, false, "the config spelling leaked through");
});

Deno.test("an absent disallowPick writes no disallowSelection at all", () => {
    
    
    const out = resolveDraw({ id: "a" });
    assertEquals("disallowSelection" in out, false);
    assertEquals(resolveDraw({ id: "a", disallowPick: false }).disallowSelection, undefined);
});

Deno.test("maxPlaced never reaches the engine", () => {
    
    
    const out = resolveDraw({ id: "a", maxPlaced: 1 });
    assertEquals("maxPlaced" in out, false, "the mod-only cap leaked through");
    
    
    assertEquals("drawKey" in resolveDraw({ id: "a", drawKey: "hidden" }), false);
    assertEquals("unlockNode" in resolveDraw({ id: "a", unlockNode: "n" }), false);
});

Deno.test("the selection guard survives a drawKey", () => {
    
    
    
    for (const drawKey of ["default", "hidden", "outline", "nope"]) {
        const out = resolveDraw({ id: "a", drawKey, disallowPick: true });
        assertEquals(out.disallowSelection, true, `lost for drawKey=${drawKey}`);
        assertEquals("disallowPick" in out, false, `leaked for drawKey=${drawKey}`);
    }
});

Deno.test("hidden consumes the frame and draws nothing", () => {
    const out = resolveDraw({ id: "a", drawKey: "hidden" });
    assertEquals(typeof out.draw, "function");
    const ctx = fakeCtx();
    
    assert(out.draw(null, { x: 0, y: 0 }, { ctx }) !== false);
    assertEquals(ctx.calls, [], "hidden touched the canvas");
});

Deno.test("outline strokes the footprint and lets the sprite render", () => {
    const out = resolveDraw({
        id: "a",
        drawKey: "outline",
        shape: [
            [1, 1, 1],
            [1, 1, 1],
        ],
    });
    const ctx = fakeCtx();
    
    assertEquals(out.draw(null, { x: 2, y: 3 }, { ctx }), false);
    const rect = ctx.calls.find((c: string) => c.startsWith("strokeRect"));
    assert(rect, `no outline was drawn: ${ctx.calls.join(", ")}`);
    
    
    
    assertEquals(rect, "strokeRect(8.5,12.5,11,7)");
});

Deno.test("outline reads the footprint from the shape rather than assuming 1x1", () => {
    
    
    const out = resolveDraw({
        id: "a",
        drawKey: "outline",
        shape: [[1, 1, 1, 1, 1]],
    });
    const ctx = fakeCtx();
    out.draw(null, { x: 0, y: 0 }, { ctx });
    assert(ctx.calls.includes("strokeRect(0.5,0.5,19,3)"), ctx.calls.join(", "));
});

Deno.test("outline normalises the canvas it inherits", () => {
    
    
    const ctx = fakeCtx();
    resolveDraw({ id: "a", drawKey: "outline" }).draw(null, { x: 0, y: 0 }, { ctx });
    assertEquals(ctx.globalAlpha, 1, "inherited alpha");
    assertEquals(ctx.globalCompositeOperation, "source-over", "inherited compositing");
    assertEquals(ctx.filter, "none", "inherited filter");
    assertEquals(ctx.shadowBlur, 0, "inherited shadow");
    assertEquals(ctx.shadowColor, "rgba(0,0,0,0)", "inherited shadow colour");
});

Deno.test("outline saves and restores around itself", () => {
    const ctx = fakeCtx();
    resolveDraw({ id: "a", drawKey: "outline" }).draw(null, { x: 0, y: 0 }, { ctx });
    assertEquals(ctx.calls[0], "save");
    assertEquals(ctx.calls[ctx.calls.length - 1], "restore");
});

Deno.test("outline survives a missing renderer API", () => {
    
    
    const ctx = fakeCtx();
    const saved = globalThis.sandkit.api.rendering;
    globalThis.sandkit.api.rendering = undefined;
    try {
        assertEquals(
            resolveDraw({ id: "a", drawKey: "outline" }).draw(null, { x: 0, y: 0 }, { ctx }),
            false,
        );
    } finally {
        globalThis.sandkit.api.rendering = saved;
    }
});

Deno.test("outline survives a canvas that throws", () => {
    const ctx = fakeCtx();
    ctx.strokeRect = () => {
        throw new Error("canvas gone");
    };
    assertEquals(
        resolveDraw({ id: "a", drawKey: "outline" }).draw(null, { x: 0, y: 0 }, { ctx }),
        false,
    );
});

Deno.test("every advertised draw key is actually implemented", () => {
    
    
    for (const d of DRAW_FUNCTIONS) {
        const out = resolveDraw({ id: "a", drawKey: d.key });
        if (d.key === "default") {
            assertEquals(out.draw, undefined, "default must not register a function");
        } else {
            assertEquals(typeof out.draw, "function", `${d.key} is advertised but not implemented`);
        }
        assert((drawDoc(d.key) ?? "").length > 20, `${d.key} has no usable description`);
    }
});

Deno.test("the picker offers exactly the implemented keys", () => {
    assertEquals(
        listDrawFunctions().map((o: { value: string }) => o.value),
        DRAW_FUNCTIONS.map((d: { key: string }) => d.key),
    );
});
Deno.test("outline draws something for a structure with no shape", () => {
    
    
    const ctx = fakeCtx();
    resolveDraw({ id: "a", drawKey: "outline" }).draw(null, { x: 0, y: 0 }, { ctx });
    assert(ctx.calls.some((c: string) => c.startsWith("strokeRect")), "nothing drawn");
});
