// @ts-nocheck
/**
 * Tests for the instance map.
 *
 * Two things matter here beyond the obvious. First, a broken reference must be
 * *drawn*, not dropped — it is the reason the screen exists, so silently
 * omitting it would make the picture lie. Second, an entry that nothing
 * references is worth telling the user about, since it is usually a typo.
 */
import { assert, assertEquals } from "jsr:@std/assert";

globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        elements: { list: () => [] },
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { buildInstanceMap, instanceMapAsText } = await import("./config-map.ts");

const BASE = {
    elements: [{ id: "md-my-hown-mod:water" }, { id: "md-my-hown-mod:ash" }],
    terrains: [{ id: "md-my-hown-mod:sand", outputElement: "md-my-hown-mod:water" }],
};

Deno.test("an empty config draws nothing but still has a size", () => {
    const m = buildInstanceMap({});
    assertEquals(m.nodes, []);
    assertEquals(m.columns, []);
    assert(m.width > 0 && m.height > 0, "a zero-sized canvas cannot be drawn");
});

Deno.test("each kind gets its own column, in a stable order", () => {
    const m = buildInstanceMap(BASE);
    assertEquals(m.columns.map((c) => c.cat), ["elements", "terrains"]);
    assert(
        m.columns[0].x < m.columns[1].x,
        "columns are not ordered left to right",
    );
});

Deno.test("a resolving reference becomes an edge, not a broken one", () => {
    const m = buildInstanceMap(BASE);
    assertEquals(m.edges.length, 1);
    assertEquals(m.edges[0].broken, false);
    assertEquals(m.edges[0].toId, "md-my-hown-mod:water");
    assertEquals(m.brokenEdges, []);
});

Deno.test("a reference to nothing is kept and marked broken", () => {
    const m = buildInstanceMap({
        elements: [{ id: "md-my-hown-mod:water" }],
        terrains: [{
            id: "md-my-hown-mod:sand",
            outputElement: "md-my-hown-mod:ghost",
        }],
    });
    assertEquals(m.edges.length, 1, "the broken edge was dropped instead of flagged");
    assertEquals(m.edges[0].broken, true);
    assertEquals(m.brokenEdges.length, 1);
});

Deno.test("an entry nothing points at is reported as an orphan", () => {
    const m = buildInstanceMap(BASE);
    // water is referenced by the terrain; ash is referenced by nothing
    assertEquals(m.orphans, ["elements:md-my-hown-mod:ash"]);
});

Deno.test("a multi-valued field produces one edge per id", () => {
    const m = buildInstanceMap({
        elements: [{ id: "a" }, { id: "b" }],
        techs: [{ id: "t", unlockStructures: ["a", "b"] }],
    });
    assertEquals(m.edges.length, 2);
    assertEquals(m.brokenEdges.length, 2, "the techs point at elements, none defined");
});

Deno.test("a long column is capped and says so in the text export", () => {
    const many = {
        elements: Array.from({ length: 30 }, (_, i) => ({ id: `e${i}` })),
    };
    const m = buildInstanceMap(many);
    assertEquals(m.columns[0].count, 30, "the header should report the real count");
    assert(m.nodes.length <= 24, `${m.nodes.length} nodes drawn, the cap is 24`);
    const text = instanceMapAsText(m, many);
    assert(text.includes("and 6 more"), `the truncation is not reported:\n${text}`);
});

Deno.test("nodes never overlap inside a column", () => {
    const m = buildInstanceMap(BASE);
    const byCol = new Map();
    for (const n of m.nodes) {
        byCol.set(n.col, [...(byCol.get(n.col) ?? []), n]);
    }
    for (const [col, nodes] of byCol) {
        const sorted = [...nodes].sort((a, b) => a.y - b.y);
        for (let i = 1; i < sorted.length; i++) {
            assert(
                sorted[i].y >= sorted[i - 1].y + sorted[i - 1].h,
                `column ${col} overlaps at row ${i}`,
            );
        }
    }
});

Deno.test("every node fits inside the canvas", () => {
    const m = buildInstanceMap(BASE);
    for (const n of m.nodes) {
        assert(n.x >= 0 && n.y >= 0, `${n.id} is off-canvas`);
        assert(n.x + n.w <= m.width, `${n.id} overflows horizontally`);
        assert(n.y + n.h <= m.height, `${n.id} overflows vertically`);
    }
});

Deno.test("the text export lists every kind and flags the broken ones", () => {
    const cfg = {
        elements: [{ id: "water" }],
        terrains: [{ id: "sand", outputElement: "ghost" }],
    };
    const text = instanceMapAsText(buildInstanceMap(cfg), cfg);
    assert(text.includes("Elements (1)"), "no element column");
    assert(text.includes("Terrains (1)"), "no terrain column");
    assert(text.includes("[BROKEN]"), "the broken edge is not flagged in text");
});

Deno.test("the layout is stable for the same config", () => {
    const one = buildInstanceMap(BASE);
    const two = buildInstanceMap(BASE);
    assertEquals(
        one.nodes.map((n) => [n.cat, n.id, n.x, n.y]),
        two.nodes.map((n) => [n.cat, n.id, n.x, n.y]),
    );
});

Deno.test("a kind with no entries gets no column", () => {
    // An empty column is noise; the Help screen already lists every kind.
    const m = buildInstanceMap({ elements: [{ id: "a" }] });
    assertEquals(m.columns.length, 1);
});
