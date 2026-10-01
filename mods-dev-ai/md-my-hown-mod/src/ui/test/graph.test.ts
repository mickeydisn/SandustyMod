

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
} = await import("../graph.ts");
const { RELATIONS } = await import("../relations.ts");
const { MENU_GROUPS } = await import("../schema.ts");

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
    
    
    
    const self = g.edges.find(
        (e: { from: string; to: string; field: string }) =>
            e.from === "techs" && e.to === "techs" && e.field === "parentId",
    );
    assert(self, "the techs parentId self-reference is missing");
    assertEquals(self.live, 1);
    assertEquals(self.dangling, 0);
});

Deno.test("the built-in default node resolves rather than reading as dangling", () => {
    
    
    
    
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



Deno.test("a reference to a game id is not reported as dangling", () => {
    
    
    
    
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
    
    const d = findDangling(
        { contacts: [{ id: "c", inputA: "Unobtainium" }], elements: [{ id: "mdmy.acid" }] },
        () => new Set(["Sand"]),
    );
    assertEquals(d.length, 1);
    assertEquals(d[0].target, "Unobtainium");
});

Deno.test("a hidden game id resolves, so pointing at one is not an alarm", () => {
    
    
    const d = findDangling(
        { contacts: [{ id: "c", inputA: "_resolved" }], elements: [] },
        () => new Set(["_resolved"]),
    );
    assertEquals(d.length, 0);
});

Deno.test("with no host available, nothing built-in is invented", () => {
    
    
    const d = findDangling(
        { contacts: [{ id: "c", inputA: "Sand" }], elements: [] },
        () => new Set(),
    );
    assertEquals(d.length, 0, "an empty registry must not make everything dangle");
});

Deno.test("the layout is stable for the same config", () => {
    
    
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



Deno.test("every graph node lands in the column its menu group names", () => {
    
    
    
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

Deno.test("group bands never overlap, whichever way they are laid out", () => {
    
    
    
    
    
    
    
    
    
    const g = buildGraph({});
    for (let i = 0; i < g.columns.length; i++) {
        for (let j = i + 1; j < g.columns.length; j++) {
            const a = g.columns[i];
            const b = g.columns[j];
            const apart = a.x + a.w <= b.x || b.x + b.w <= a.x ||
                a.y + a.h <= b.y || b.y + b.h <= a.y;
            assert(
                apart,
                `${a.label} overlaps ${b.label} — group bands must not overlap`,
            );
        }
    }
});

Deno.test("groups are columns, side by side, taller than they are wide", () => {
    
    
    
    
    
    
    
    
    
    
    const g = buildGraph({});
    assert(g.columns.length > 1, "the fixture needs more than one group to be meaningful");
    for (let i = 1; i < g.columns.length; i++) {
        const prev = g.columns[i - 1];
        const cur = g.columns[i];
        assert(
            cur.x >= prev.x + prev.w,
            `${cur.label} overlaps ${prev.label} — group columns must sit beside each other`,
        );
        
        assert(cur.h > cur.w, `${cur.label} is wider than it is tall, so it is a row`);
    }
    
    const tops = new Set(g.columns.map((c) => c.y));
    assertEquals(tops.size, 1, `the columns do not share a top edge: ${[...tops]}`);
});

Deno.test("every box in a group shares one x, with a margin either side", () => {
    
    
    
    
    
    
    
    
    
    const g = buildGraph({});
    for (const c of g.columns) {
        const members = g.nodes.filter((n) => n.group === c.key);
        assert(members.length > 0, `${c.label} has no boxes to align`);
        const xs = new Set(members.map((n) => n.x));
        assertEquals(
            xs.size,
            1,
            `${c.label} has boxes at ${[...xs].join(", ")} — a group is one column, not a grid`,
        );
        const x = members[0].x;
        const left = x - c.x;
        const right = c.x + c.w - (x + members[0].w);
        assert(left > 0 && right > 0, `${c.label} has a box flush against its boundary`);
        assertEquals(left, right, `${c.label} is not centred: ${left} left, ${right} right`);
    }
    
    for (let i = 1; i < g.columns.length; i++) {
        const prev = g.columns[i - 1];
        const cur = g.columns[i];
        assert(cur.x >= prev.x + prev.w, `${cur.label} overlaps ${prev.label}`);
    }
});

Deno.test("a node sits inside its own group column, clear of the heading", () => {
    
    
    
    const g = buildGraph({});
    for (const n of g.nodes) {
        const c = g.columns.find((x) => x.key === n.group);
        assert(c, `${n.cat} has no group column`);
        assert(n.x >= c.x && n.x + n.w <= c.x + c.w, `${n.cat} is outside its column`);
        assert(n.y >= c.y + 20, `${n.cat} is drawn over its own group heading`);
    }
    
    for (const n of g.nodes) {
        assert(n.y + n.h <= g.height, `${n.cat} is drawn below the canvas`);
        assert(n.x + n.w <= g.width, `${n.cat} is drawn past the right edge`);
    }
});

Deno.test("nodes keep their position when the config changes", () => {
    
    
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
    
    assert(n.size > 1, "elements has no neighbours at all");
    
    const all = graphCategories();
    for (const cat of all) {
        assert(neighboursOf(g, cat).has(cat), `${cat} is not in its own neighbour set`);
    }
});

Deno.test("filtering to a kind re-lays it out, keeping it and its neighbours", () => {
    
    
    
    const g = buildGraph({});
    const keep = neighboursOf(g, "elements");
    const f = buildGraph({}, keep);
    for (const n of f.nodes) assert(keep.has(n.cat), `${n.cat} survived a filter that excludes it`);
    for (const e of f.edges) {
        assert(keep.has(e.from) && keep.has(e.to), "an edge survived with an endpoint hidden");
    }
    assert(f.nodes.length < g.nodes.length, "the filter removed nothing");
    
    assert(f.width <= g.width, "a filtered graph is wider than the whole one");
    assert(f.height <= g.height, "a filtered graph is taller than the whole one");
});

Deno.test("a filtered graph re-derives depth from what is left", () => {
    
    
    
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
    
    
    const g = buildGraph({});
    const f = buildGraph({}, null);
    assertEquals(f.nodes.length, g.nodes.length);
    assertEquals(f.edges.length, g.edges.length);
});

Deno.test("an empty filter set renders an empty graph, not a crash", () => {
    
    
    const f = buildGraph({}, new Set());
    assertEquals(f.nodes.length, 0);
    assertEquals(f.edges.length, 0);
    assertEquals(f.columns.length, 0);
});

Deno.test("filtering keeps the dangling report for what is still visible", () => {
    
    
    const cfg = { terrains: [{ id: "t1", outputElement: "gone" }] };
    const broken = findDangling(cfg, () => new Set(["Sand"]));
    assert(broken.length > 0, "the fixture has nothing broken");
    const g = buildGraph(cfg);
    const f = buildGraph(cfg, neighboursOf(g, "terrains"));
    assertEquals(f.danglingRefs.length, g.danglingRefs.length);
});
