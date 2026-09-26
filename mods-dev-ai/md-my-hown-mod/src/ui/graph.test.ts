// @ts-nocheck
/**
 * Tests for the relation graph.
 *
 * The dangling-reference detection is the point of this module: it finds the
 * entries that register cleanly and then quietly do nothing in-game, which is
 * the single most confusing failure this mod can have. The layout is worth
 * testing too, but only for the property that matters — it is stable.
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

const { buildGraph, findDangling, graphAsText, graphCategories } = await import(
    "./graph.ts"
);
const { RELATIONS } = await import("./relations.ts");

Deno.test("an empty config produces a graph with no live references", () => {
    const g = buildGraph({});
    assert(g.nodes.length > 0, "no nodes");
    assertEquals(g.edges.length, RELATIONS.length);
    assert(g.edges.every((e: { live: number }) => e.live === 0));
    assertEquals(g.danglingRefs, []);
});

Deno.test("a reference that resolves is not reported as dangling", () => {
    const g = buildGraph({
        elements: [{ id: "md-my-hown-mod:water" }],
        terrains: [{
            id: "md-my-hown-mod:sand",
            outputElement: "md-my-hown-mod:water",
        }],
    });
    assertEquals(g.danglingRefs, []);
    const edge = g.edges.find(
        (e: { from: string; field: string }) =>
            e.from === "terrains" && e.field === "outputElement",
    );
    assertEquals(edge.live, 1);
    assertEquals(edge.dangling, 0);
});

Deno.test("a reference to a deleted object is reported", () => {
    const g = buildGraph({
        elements: [{ id: "md-my-hown-mod:water" }],
        terrains: [{
            id: "md-my-hown-mod:sand",
            outputElement: "md-my-hown-mod:ghost",
        }],
    });
    assertEquals(g.danglingRefs.length, 1);
    assertEquals(g.danglingRefs[0].field, "outputElement");
    assertEquals(g.danglingRefs[0].target, "md-my-hown-mod:ghost");
    assertEquals(g.danglingRefs[0].fromId, "md-my-hown-mod:sand");
});

Deno.test("a reference into a kind with no entries is not called dangling", () => {
    // It may legitimately point at a built-in the mod does not own, so calling
    // it broken would be a false alarm on every fresh config.
    const g = buildGraph({
        terrains: [{ id: "md-my-hown-mod:sand", outputElement: "sand:0" }],
    });
    assertEquals(g.danglingRefs, []);
});

Deno.test("a multi-valued reference reports every bad id separately", () => {
    const g = buildGraph({
        techs: [{
            id: "md-my-hown-mod:t1",
            unlockStructures: ["md-my-hown-mod:ok", "md-my-hown-mod:gone"],
        }],
        structures: [{ id: "md-my-hown-mod:ok" }],
    });
    assertEquals(g.danglingRefs.length, 1);
    assertEquals(g.danglingRefs[0].target, "md-my-hown-mod:gone");
});

Deno.test("a self-referencing tech tree still draws its edge", () => {
    const g = buildGraph({
        techs: [{ id: "a", parentId: "b" }, { id: "b" }],
    });
    // Matched by field, not by the category pair. techs now has two edges to
    // techs (parentId and requires), and picking the first one by category pair
    // silently tested whichever happened to be declared first.
    const self = g.edges.find(
        (e: { from: string; to: string; field: string }) =>
            e.from === "techs" && e.to === "techs" && e.field === "parentId",
    );
    assert(self, "the techs parentId self-reference is missing");
    assertEquals(self.live, 1);
    assertEquals(self.dangling, 0);
});

Deno.test("techs.requires and techs.parentId are separate edges", () => {
    // They are genuinely different things — a parent grid line vs a
    // prerequisite list — and the graph draws one edge per field, so they must
    // not be merged or the user cannot tell which is broken.
    const g = buildGraph({
        techs: [{ id: "a", parentId: "b", requires: "c" }, { id: "b" }, { id: "c" }],
    });
    const fields = g.edges
        .filter((e: { from: string; to: string }) => e.from === "techs" && e.to === "techs")
        .map((e: { field: string }) => e.field)
        .sort();
    assertEquals(fields, ["parentId", "requires"]);
    const req = g.edges.find((e: { field: string }) => e.field === "requires");
    assertEquals(req.live, 1, "requires should resolve c");
    assertEquals(req.dangling, 0);
});

Deno.test("a reference to a game id is not reported as dangling", () => {
    // The pickers offer the game's own elements, so pointing at one is the
    // normal case — not a broken reference. Before this, `known` held only the
    // mod's own entries, so a reaction on the game's "Sand" was flagged the
    // moment the mod had one element of its own.
    const d = findDangling(
        {
            contacts: [{ id: "c", inputA: "Sand", inputB: "mdmy.acid" }],
            elements: [{ id: "mdmy.acid" }],
        },
        () => new Set(["Sand", "Water"]),
    );
    assertEquals(
        d.map((x: { target: string }) => x.target),
        [],
        "a resolvable game id was reported as dangling",
    );
});

Deno.test("a reference to nothing at all is still reported", () => {
    // The fix above must not turn the check off.
    const d = findDangling(
        { contacts: [{ id: "c", inputA: "Unobtainium" }], elements: [{ id: "mdmy.acid" }] },
        () => new Set(["Sand"]),
    );
    assertEquals(d.length, 1);
    assertEquals(d[0].target, "Unobtainium");
});

Deno.test("a hidden game id resolves, so pointing at one is not an alarm", () => {
    // A mod that deliberately targets an internal element has a working
    // reference; flagging it would invite the user to "fix" something correct.
    const d = findDangling(
        { contacts: [{ id: "c", inputA: "_resolved" }], elements: [] },
        () => new Set(["_resolved"]),
    );
    assertEquals(d.length, 0);
});

Deno.test("with no host available, nothing built-in is invented", () => {
    // An unavailable host must degrade to config-only rather than report every
    // built-in as broken.
    const d = findDangling(
        { contacts: [{ id: "c", inputA: "Sand" }], elements: [] },
        () => new Set(),
    );
    assertEquals(d.length, 0, "an empty registry must not make everything dangle");
});

Deno.test("the layout is stable for the same config", () => {
    // Stability is the whole reason this is a fixed layout and not a force
    // simulation: a node that moves when nothing changed is useless to aim at.
    const one = buildGraph({ elements: [{ id: "x" }] });
    const two = buildGraph({ elements: [{ id: "x" }] });
    assertEquals(
        one.nodes.map((n) => [n.cat, n.x, n.y]),
        two.nodes.map((n) => [n.cat, n.x, n.y]),
    );
});

Deno.test("every node fits inside the reported canvas", () => {
    const g = buildGraph({});
    for (const n of g.nodes) {
        assert(n.x >= 0 && n.y >= 0, `${n.cat} is off-canvas`);
        assert(n.x + n.w <= g.width, `${n.cat} overflows horizontally`);
        assert(n.y + n.h <= g.height, `${n.cat} overflows vertically`);
    }
});

Deno.test("every relation appears exactly once as an edge", () => {
    const g = buildGraph({});
    assertEquals(g.edges.length, RELATIONS.length);
    const keys = g.edges.map((e: { from: string; field: string }) =>
        `${e.from}.${e.field}`
    );
    assertEquals(new Set(keys).size, keys.length);
});

Deno.test("every node belongs to a category that takes part in a relation", () => {
    const g = buildGraph({});
    const involved = new Set(graphCategories());
    for (const n of g.nodes) {
        assert(
            involved.has(n.cat),
            `${n.cat} is in the graph but relates to nothing`,
        );
    }
});

Deno.test("the text export names the dangling references", () => {
    const g = buildGraph({
        elements: [{ id: "md-my-hown-mod:water" }],
        terrains: [{
            id: "md-my-hown-mod:sand",
            outputElement: "md-my-hown-mod:ghost",
        }],
    });
    const text = graphAsText(g);
    assert(text.includes("Dangling references:"), "no dangling section");
    assert(text.includes("md-my-hown-mod:ghost"), "the bad id is not named");
    assert(text.includes("--outputElement-->"), "the edge is not shown");
});

Deno.test("the text export is readable on an empty config", () => {
    const text = graphAsText(buildGraph({}));
    assert(text.includes("Elements"), "no node lines");
    assert(text.includes("References:"), "no reference section");
    assert(!text.includes("DANGLING"), "an empty config should be clean");
});
