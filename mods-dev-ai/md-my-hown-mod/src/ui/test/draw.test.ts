/**
 * The built-in `draw` functions, exercised against a fake canvas.
 *
 * These exist because `draw` is a callback: it is the one part of the config
 * layer that is code rather than data, so the round-trip tests cannot reach it,
 * and a mistake here shows up as a structure that silently stops drawing. The
 * signature and the canvas calls come from a shipping mod
 * (`__scraped-mods/workshop/3791498201`), not from inference.
 */
// @ts-nocheck
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
        // The two rendering calls the real mod's draw function makes.
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

/**
 * A canvas that records what was done to it, and starts out dirty.
 *
 * The dirty state is the point: that is what a tool or weapon effect leaves
 * behind, and a draw function that inherits it is the documented way to end up
 * with a solid-black structure that keeps repainting, with no error anywhere.
 */
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
    // A passthrough function would cost a lookup per structure per frame for no
    // benefit — with no `draw` at all the engine already does the right thing.
    assertEquals(resolveDraw({ id: "a", drawKey: "default" }).draw, undefined);
});

Deno.test("an unknown key is dropped, not passed through as a string", () => {
    // This is the exact bug the whole indirection exists to prevent: a string
    // handed to `T(id, fn)` does not throw, it just stops drawing.
    assertEquals(resolveDraw({ id: "a", drawKey: "nope" }).draw, undefined);
});

Deno.test("hidden consumes the frame and draws nothing", () => {
    const out = resolveDraw({ id: "a", drawKey: "hidden" });
    assertEquals(typeof out.draw, "function");
    const ctx = fakeCtx();
    // Anything other than `false` means "handled", so the sprite is skipped.
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
    // `false` = fall through, so the sprite draws underneath the outline.
    assertEquals(out.draw(null, { x: 2, y: 3 }, { ctx }), false);
    const rect = ctx.calls.find((c: string) => c.startsWith("strokeRect"));
    assert(rect, `no outline was drawn: ${ctx.calls.join(", ")}`);
    // cell x=2,y=3 at cellSize 4 -> pixel 8,12. The shape is 2 rows x 3 cols,
    // so 12px wide by 8px high, less the 1px line, nudged half a pixel so the
    // line sits on the boundary.
    assertEquals(rect, "strokeRect(8.5,12.5,11,7)");
});

Deno.test("outline reads the footprint from the shape rather than assuming 1x1", () => {
    // 1 row of 5 columns -> 20px wide, 4px high. A square-only footprint would
    // pass even with the two axes swapped, which is the bug this pins.
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
    // Without this the structure renders solid black and keeps repainting that
    // way, with nothing to explain it. This is the real mod's own warning.
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
    // A draw callback runs inside the render loop; throwing here would take the
    // whole frame with it, so every failure path returns quietly.
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
    // The catalogue and resolveDraw live in different files, and a key in one
    // but not the other is a picker option that silently does nothing.
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
    // A missing shape must not become a zero-size rect, which would draw
    // nothing and look like the feature is simply broken.
    const ctx = fakeCtx();
    resolveDraw({ id: "a", drawKey: "outline" }).draw(null, { x: 0, y: 0 }, { ctx });
    assert(ctx.calls.some((c: string) => c.startsWith("strokeRect")), "nothing drawn");
});
