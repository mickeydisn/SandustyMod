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

const {
    buildGraph,
    findDangling,
    graphAsText,
    graphCategories,
    neighboursOf,
} = await import("./graph.ts");
const { RELATIONS } = await import("./relations.ts");
const { MENU_GROUPS } = await import("./schema.ts");

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

Deno.test("the built-in default node resolves rather than reading as dangling", () => {
    // It is virtual — not stored — but a structure legitimately points at it, and
    // "Unlock by default" is the *safe* state. Reporting it as a broken link would
    // train the user to ignore the dangling marker, which is the one thing the
    // marker is for.
    const g = buildGraph({
        structures: [{ id: "s1", unlockNode: "md-my-hown-mod:unlock.default" }],
        unlockNodes: [],
    });
    const edge = g.edges.find((e: { field: string }) => e.field === "unlockNode");
    assert(edge, "no unlockNode edge was drawn");
    assertEquals(edge.live, 1, "the built-in default was reported as dangling");
    assertEquals(edge.dangling, 0);
});

Deno.test("a node that really is missing is still reported", () => {
    // The fix above must not have made the dangling case disappear.
    //
    // `live` stays 1 *and* `dangling` is 1: a reference was made and it points at
    // nothing. `live` on its own would read as a working link.
    const g = buildGraph({
        structures: [{ id: "s1", unlockNode: "md-my-hown-mod:unlock.gone" }],
        unlockNodes: [],
    });
    const edge = g.edges.find((e: { field: string }) => e.field === "unlockNode");
    assertEquals(edge.dangling, 1, "a genuinely missing node was not reported");
    assertEquals(g.danglingRefs.length, 1, "the missing node is not listed for the user");
    assertEquals(g.danglingRefs[0].target, "md-my-hown-mod:unlock.gone");
});

Deno.test("techs.requires and techs.parentId are separate edges", () => {
    // They are genuinely different things — a parent grid line vs a
    // prerequisite list — and the graph draws one edge per field, so they must
    // not be merged or the user cannot tell which is broken.
    //
    // Scoped to `from === "techs"`: an unlock node declares the same two fields for
    // the tech it *builds*, so an unscoped filter would match those too and the
    // assertion would be about the wrong edges.
    const g = buildGraph({
        techs: [{ id: "a", parentId: "b", requires: "c" }, { id: "b" }, { id: "c" }],
        unlockNodes: [],
    });
    const fields = g.edges
        .filter((e: { from: string; to: string }) => e.from === "techs" && e.to === "techs")
        .map((e: { field: string }) => e.field)
        .sort();
    assertEquals(fields, ["parentId", "requires"]);
    const req = g.edges.find(
        (e: { from: string; field: string }) => e.from === "techs" && e.field === "requires",
    );
    assertEquals(req.live, 1, "requires should resolve c");
    assertEquals(req.dangling, 0);
});

Deno.test("an unlock node's own edges are separate from the tech edges", () => {
    // A node's `requires`/`parentId` describe the tech it *builds*, so they are
    // filed against `unlockNodes`. Merging them into the techs pair would draw one
    // arrow where there are two different relationships, and a break in either would
    // be reported against the wrong thing.
    const g = buildGraph({
        techs: [{ id: "t" }],
        unlockNodes: [{ id: "u", parentId: "t", requires: "r" }],
    });
    const nodeEdges = g.edges
        .filter((e: { from: string }) => e.from === "unlockNodes")
        .map((e: { field: string; to: string }) => `${e.field}→${e.to}`)
        .sort();
    assertEquals(nodeEdges, [
        "gatesStructures→structures",
        "parentId→techs",
        "requires→techs",
        "techId→techs",
    ]);
});

// ── energy networks ──────────────────────────────────────────────────────────

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
    const keys = g.edges.map((e: { from: string; field: string }) => `${e.from}.${e.field}`);
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

// ── grouping, neighbours, filtering ──────────────────────────────────────────

Deno.test("every graph node lands in the column its menu group names", () => {
    // The whole readability win of the grouped layout depends on this: if a
    // node is in a different column from its menu group, the picture and the
    // menu tell the user two different stories about the same thing.
    const g = buildGraph({});
    const home = new Map<string, string>();
    for (const m of MENU_GROUPS) for (const c of m.categories) home.set(c, m.label);
    for (const n of g.nodes) {
        const want = home.get(n.cat);
        if (want) {
            assertEquals(n.groupLabel, want, `${n.cat} is under "${n.groupLabel}", not "${want}"`);
        }
    }
});

Deno.test("a kind the menu forgets still appears, in its own column", () => {
    // Dropping it would hide a real relation. The graph has to be able to show
    // something the menu does not yet know about, or adding a kind to
    // `relations.ts` alone would make it invisible.
    const g = buildGraph({});
    const inMenu = new Set(MENU_GROUPS.flatMap((m) => m.categories));
    const homeless = g.nodes.filter((n) => !inMenu.has(n.cat));
    for (const n of homeless) {
        assertEquals(n.group, "__other", `${n.cat} was dropped instead of grouped`);
    }
    if (homeless.length) {
        assert(g.columns.some((c) => c.key === "__other"), "the fallback column was not drawn");
    }
});

Deno.test("group rows stack instead of overlapping", () => {
    // A group is a row, so the only thing that can go wrong between two of them
    // is a vertical overlap. (When groups were columns this checked x instead,
    // and a transpose would have slipped past it unnoticed.)
    const g = buildGraph({});
    for (let i = 1; i < g.columns.length; i++) {
        const prev = g.columns[i - 1];
        const cur = g.columns[i];
        assert(
            cur.y >= prev.y + prev.h,
            `${cur.label} overlaps ${prev.label} — group rows must not overlap`,
        );
    }
});

Deno.test("a node sits inside its own group row, clear of the label", () => {
    // The layout is the one thing not re-checked at render time, so it is
    // checked here. A node outside its row would be drawn across the dashed
    // boundary; a node over the label would hide the group's name.
    const g = buildGraph({});
    for (const n of g.nodes) {
        const c = g.columns.find((x) => x.key === n.group);
        assert(c, `${n.cat} has no row`);
        assert(n.x >= c.x && n.x + n.w <= c.x + c.w, `${n.cat} is outside its row`);
        assert(n.y >= c.y + 20, `${n.cat} is drawn over its own group label`);
    }
    // And every node is inside the canvas.
    for (const n of g.nodes) {
        assert(n.y + n.h <= g.height, `${n.cat} is drawn below the canvas`);
        assert(n.x + n.w <= g.width, `${n.cat} is drawn past the right edge`);
    }
});

Deno.test("nodes keep their position when the config changes", () => {
    // The fixed layout exists so a picture can be aimed at. If adding an entry
    // moved a node, the feature would be worse than useless.
    const a = buildGraph({});
    const b = buildGraph({ elements: [{ id: "x" }], recipes: [{ id: "r", in: "x" }] });
    const at = (g: typeof a, cat: string) => {
        const n = g.nodes.find((x) => x.cat === cat);
        return n ? `${n.x},${n.y}` : null;
    };
    for (const cat of ["elements", "terrains", "techs", "structures"]) {
        assertEquals(at(b, cat), at(a, cat), `${cat} moved when an unrelated entry was added`);
    }
});

Deno.test("neighbours include both directions and the kind itself", () => {
    const g = buildGraph({});
    const n = neighboursOf(g, "elements");
    assert(n.has("elements"), "the kind itself is missing — the selected node would vanish");
    // Something must point at elements, and elements must point at something.
    assert(n.size > 1, "elements has no neighbours at all");
    // A leaf that only ever receives references still has to be findable.
    const all = graphCategories();
    for (const cat of all) {
        assert(neighboursOf(g, cat).has(cat), `${cat} is not in its own neighbour set`);
    }
});

Deno.test("filtering to a kind re-lays it out, keeping it and its neighbours", () => {
    // The filter now goes *into* the layout rather than over the top of it, so
    // the kept kinds are re-derived and re-packed instead of being left marooned
    // in one corner of a diagram sized for everything.
    const g = buildGraph({});
    const keep = neighboursOf(g, "elements");
    const f = buildGraph({}, keep);
    for (const n of f.nodes) assert(keep.has(n.cat), `${n.cat} survived a filter that excludes it`);
    for (const e of f.edges) {
        assert(keep.has(e.from) && keep.has(e.to), "an edge survived with an endpoint hidden");
    }
    assert(f.nodes.length < g.nodes.length, "the filter removed nothing");
    // And it is genuinely smaller, so the panel is not sized for what is hidden.
    assert(f.width <= g.width, "a filtered graph is wider than the whole one");
    assert(f.height <= g.height, "a filtered graph is taller than the whole one");
});

Deno.test("a filtered graph re-derives depth from what is left", () => {
    // The point of re-flowing: a kind's column reflects only the references
    // actually on screen. A kind that references nothing has nothing under it,
    // so it belongs in the first column — where in the full graph it need not be.
    const g = buildGraph({});
    const f = buildGraph({}, neighboursOf(g, "terrains"));
    assert(f.nodes.length > 1, "the fixture is not a neighbourhood");
    const leftmost = Math.min(...f.nodes.map((n) => n.x));
    const leaves = f.nodes.filter((n) => !f.edges.some((e) => e.from === n.cat));
    assert(leaves.length > 0, "no kind in the filtered graph references nothing");
    for (const n of leaves) {
        assertEquals(n.x, leftmost, `${n.cat} references nothing but is not in the first column`);
    }
});

Deno.test("no filter is the whole graph, not an empty one", () => {
    // "All" is a non-empty string, and a filter that treated it as a kind name
    // would empty the screen. This is the regression guard for exactly that.
    const g = buildGraph({});
    const f = buildGraph({}, null);
    assertEquals(f.nodes.length, g.nodes.length);
    assertEquals(f.edges.length, g.edges.length);
});

Deno.test("an empty filter set renders an empty graph, not a crash", () => {
    // "Filtering to nothing is a normal state" — it has to produce something the
    // screen can draw, not throw on an empty node list.
    const f = buildGraph({}, new Set());
    assertEquals(f.nodes.length, 0);
    assertEquals(f.edges.length, 0);
    assertEquals(f.columns.length, 0);
});

Deno.test("filtering keeps the dangling report for what is still visible", () => {
    // A broken reference is the most important thing on the screen. Narrowing
    // the view must not quietly drop the ones that are still on it.
    const cfg = { terrains: [{ id: "t1", outputElement: "gone" }] };
    const broken = findDangling(cfg, () => new Set(["Sand"]));
    assert(broken.length > 0, "the fixture has nothing broken");
    const g = buildGraph(cfg);
    const f = buildGraph(cfg, neighboursOf(g, "terrains"));
    assertEquals(f.danglingRefs.length, g.danglingRefs.length);
});
