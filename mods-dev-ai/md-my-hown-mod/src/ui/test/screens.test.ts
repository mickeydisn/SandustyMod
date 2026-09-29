// @ts-nocheck
/**
 * Smoke tests for the two new screens.
 *
 * `renderHelp` and `renderConfigMap` are close to a thousand lines of element
 * construction, and element construction is exactly where a typo becomes a
 * white screen at runtime rather than a build error — everything is `any` by
 * the time it reaches `React.createElement`.
 *
 * So these do not assert on the output's *content*. They assert that rendering
 * completes, on an empty config and a populated one, and that the strings the
 * user is meant to read actually reach the output. That is the failure worth
 * guarding: a screen that throws, or one that silently renders nothing.
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

const { renderHelp } = await import("../panel/help.ts");
const { RELATIONS } = await import("../relations.ts");
const { MENU_GROUPS } = await import("../schema.ts");
const { graphCategories, buildGraph } = await import("../graph.ts");
const { renderConfigMap } = await import("../config-map.ts");
const { renderFixedCatalogue } = await import("../panel/handlers.ts");
const { resolveCat } = await import("../panel.ts");
const { PROJECTILE_OPTIONS } = await import("../../handler/projectile-option/index.ts");
const { EXCAVATION_OPTIONS } = await import("../../handler/excavation-option/index.ts");
const { HANDLER_META, HANDLER_TYPE_BLURBS, HANDLER_TYPE_LABELS } = await import(
    "../../handler/core/handler-registry.ts"
);

/** A `createElement` stand-in that records the tree so it can be searched. */
function fakeH() {
    const seen = [];
    const h = (tag, props, ...children) => {
        const node = { tag, props, children };
        seen.push(node);
        return node;
    };
    h.seen = seen;
    h.text = () => textOf(seen);
    return h;
}

/** Every string under `node`, so a subtree can be searched on its own. */
function textOf(node) {
    const parts = [];
    const walk = (n) => {
        if (n === null || n === undefined || n === false) return;
        if (typeof n === "string" || typeof n === "number") {
            parts.push(String(n));
            return;
        }
        if (Array.isArray(n)) {
            n.forEach(walk);
            return;
        }
        if (n.children) n.children.forEach(walk);
    };
    walk(node);
    return parts.join(" ");
}

const POPULATED = {
    elements: [
        { id: "md-my-hown-mod:water", nameKey: "w" },
        { id: "md-my-hown-mod:ash", nameKey: "a" },
    ],
    terrains: [
        { id: "md-my-hown-mod:sand", outputElement: "md-my-hown-mod:water" },
        { id: "md-my-hown-mod:cliff", outputElement: "md-my-hown-mod:ghost" },
    ],
    structures: [{ id: "md-my-hown-mod:crusher" }],
    techs: [{ id: "md-my-hown-mod:t1", unlockStructures: ["md-my-hown-mod:crusher"] }],
};

const noop = () => {};

Deno.test("the help screen renders on an empty config", () => {
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    // The bar is deliberately low: the screen is now the graph and its table,
    // not a page of prose. Whether it drew everything is checked by the arrow
    // count below, which is a real invariant rather than a rounded-up count.
    assert(h.seen.length > 30, `only ${h.seen.length} elements — suspiciously few`);
});

Deno.test("the help screen renders on a populated config", () => {
    const h = fakeH();
    renderHelp({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    assert(h.seen.length > 30, `only ${h.seen.length} elements`);
});

Deno.test("a clean config reports no breakage and does not cry wolf", () => {
    // a *clean* config — POPULATED deliberately contains a broken reference
    const h = fakeH();
    renderHelp({
        h,
        cfg: {
            elements: [{ id: "e1" }],
            terrains: [{ id: "t1", outputElement: "e1" }],
        },
        onGoTo: noop,
        onCopy: noop,
    });
    const text = h.text();
    // The clean case is carried by the header chip ("N relations"), not by a
    // banner. A "nothing is wrong" panel is noise on a screen otherwise
    // entirely about what *is* wrong, so it went with the rest of the prose.
    assert(
        text.includes("relations"),
        `the header does not report a clean config:\n${text.slice(0, 200)}`,
    );
    assert(!text.includes("broken"), "a clean config is crying wolf");
});

Deno.test("the help screen names a broken reference", () => {
    const h = fakeH();
    renderHelp({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    const text = h.text();
    assert(
        text.includes("1 broken reference"),
        `the count is wrong:\n${text.slice(0, 400)}`,
    );
    assert(text.includes("md-my-hown-mod:ghost"), "the bad id is not named");
});

Deno.test("the help screen names the kinds that own entries", () => {
    // Help no longer documents fields (that was a stale copy of the engine docs
    // that read as authoritative while being wrong), so the only thing it
    // asserts is the shape of the graph.
    //
    // The labels come from CATEGORY_META and are what the user navigates by, so
    // they have to be there. Only kinds that actually point at something are
    // nodes — "Triggers" is deliberately not in this list, because a trigger
    // names a handler rather than another entry, and there is no node for that.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const text = h.text();
    for (const label of ["Elements", "Structures", "Terrains", "Tech nodes"]) {
        assert(text.includes(label), `${label} is not on the graph`);
    }
});

Deno.test("the help screen is a graph, not a copy of the docs", () => {
    // The field tables and the opening paragraphs were removed deliberately.
    // This pins that decision, so they cannot quietly come back as a second,
    // drifting source of truth — or as a wall of text above the picture.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const text = h.text();
    assert(
        !text.includes("The objects, and their fields"),
        "the per-object field tables are back",
    );
    assert(!text.includes("How this mod works"), "the opening prose is back");
    assert(text.includes("Every reference, in words"), "the relation table is missing");
});

Deno.test("the relation table says what each edge is worth", () => {
    // The table replaced a plain edge list. It has to carry the five things
    // that decide whether a relation matters — and in particular the two counts,
    // because a relation the engine declares and nothing in your config uses
    // looks identical to one you rely on unless something says otherwise.
    const h = fakeH();
    renderHelp({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    const text = h.text();
    for (const column of ["Holds", "Field", "Points at", "In use", "Broken"]) {
        assert(text.includes(column), `the table has no "${column}" column`);
    }
});

Deno.test("the graph is grouped into the same columns as the menu", () => {
    // Grouping is what makes the picture readable: without it twenty nodes are
    // a flat field of boxes. The groups must be the *menu's* groups, or the two
    // would have to be learned separately and could disagree.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const text = h.text();
    for (const g of MENU_GROUPS) {
        if (!graphCategories().some((c) => g.categories.includes(c))) continue;
        assert(text.includes(g.label), `the graph has no "${g.label}" column`);
    }
});

Deno.test("the help screen draws an svg and one arrow per relation", () => {
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    assert(h.seen.some((n) => n.tag === "svg"), "no svg layer for the arrows");
    // Each edge is drawn as one group holding a line and its two heads, so
    // "one arrow per relation" stays a fact you can count rather than something
    // you have to re-derive from how many paths an arrowhead happens to use.
    const edges = h.seen.filter((n) =>
        n.tag === "g" && String(n.props?.key ?? "").endsWith("-edge")
    );
    assert(edges.length > 10, `only ${edges.length} arrows drawn`);
    assertEquals(
        edges.length,
        RELATIONS.length,
        "arrow count does not match the relation table",
    );
});

Deno.test("every arrow leaves by the top or bottom and never through a side", () => {
    // The rule, and the reason it exists: an arrow attaches to a box's top or
    // bottom edge. Depth puts the target above, so a link between two kinds in the
    // same group would otherwise have to run *sideways* along the row, skimming
    // the boxes between it — and a head pointing at a box's flank is easy to
    // mistake for belonging to its neighbour.
    //
    // There is exactly one exception, and it is checked rather than waved through:
    // two kinds at the *same height* in *different* groups. Those are the same
    // slot-row in neighbouring columns — every group's first box sits at the same
    // y — so the direct line would cut straight through the columns between them.
    // That one case leaves by a side and comes back in by the other, which is the
    // transpose of the dip-under-the-row it replaced. `sideways` below is the
    // count, and it has to stay at zero for everything else.
    //
    // Deliberately *not* asserting that no arrow crosses a box. With the columns
    // side by side that is not achievable, and it was never the requirement: a link
    // from a shallow group up to a deep one passes over the columns in between.
    // The only ways to stop it are to give up the edge rule, or to route every long
    // link the long way around the outside of the diagram. The arrows are painted
    // *under* the boxes, so a crossing hides behind the column it passes rather
    // than being drawn across a heading — a much smaller cost than a diagram where
    // every arrowhead is ambiguous about which box it belongs to.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const g = buildGraph({});
    const boxes = g.nodes.map((n) => ({ cat: n.cat, x: n.x, y: n.y, w: n.w, h: n.h }));
    const onHorizontalEdge = (b: typeof boxes[0], x: number, y: number) =>
        x >= b.x && x <= b.x + b.w &&
        (Math.abs(y - b.y) < 1.5 || Math.abs(y - (b.y + b.h)) < 1.5);
    // The one allowed exception: a same-height link between two groups, which
    // leaves and arrives on a side edge.
    const onVerticalEdge = (b: typeof boxes[0], x: number, y: number) =>
        y >= b.y && y <= b.y + b.h &&
        (Math.abs(x - b.x) < 1.5 || Math.abs(x - (b.x + b.w)) < 1.5);
    const sameHeightPair = (p: number[]) => Math.abs(p[1] - p[7]) < 1.5;

    let checked = 0;
    let rings = 0;
    let sideways = 0;
    for (const n of h.seen) {
        if (n.tag !== "path") continue;
        const p = String(n.props?.d ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number);
        if (!p || p.length !== 8) continue; // the line; heads are two points
        const [x1, y1, , , , , x2, y2] = p;
        // A self-reference is a ring standing above its box: both ends level with
        // each other, just above one box's top edge. Scoped to the box it
        // surrounds — an earlier version compared against the topmost box in the
        // graph, which only caught a ring on the first row and let every other one
        // be reported as a line through a box.
        const ringHost = boxes.find(
            (b) =>
                Math.abs(y1 - y2) < 1 && y1 < b.y && b.y - y1 < 40 &&
                x1 > b.x - 40 && x1 < b.x + b.w + 40 &&
                x2 > b.x - 40 && x2 < b.x + b.w + 40,
        );
        if (ringHost) {
            rings++;
            continue;
        }
        // A same-height link is allowed to leave by a side, but *only* then. Any
        // other link that arrives sideways is the bug this whole rule exists for.
        const sidewaysOk = sameHeightPair(p) &&
            boxes.some((b) => onVerticalEdge(b, x1, y1)) &&
            boxes.some((b) => onVerticalEdge(b, x2, y2));
        if (sidewaysOk) sideways++;
        // The rule itself: each end sits on a box's top or bottom edge, unless it
        // is the same-height case above.
        if (!sidewaysOk) {
            assert(
                boxes.some((b) => onHorizontalEdge(b, x1, y1)),
                `an arrow leaves at ${x1},${y1}, which is not on any box's top or bottom edge`,
            );
            assert(
                boxes.some((b) => onHorizontalEdge(b, x2, y2)),
                `an arrow arrives at ${x2},${y2}, which is not on any box's top or bottom edge`,
            );
        }
        checked++;
    }
    assert(checked > 10, `only ${checked} arrows were checked`);
    assert(rings > 0, "no self-reference was drawn as a ring, so the hard case is not being seen");
    // The exception has to be the rare one, or the rule is not really the rule.
    assert(
        sideways < checked / 3,
        `${sideways} of ${checked} arrows left by a side — the same-height case should be the exception`,
    );
});

Deno.test("an arrow joins the two facing edges, never running back through a box", () => {
    // The rule above only checked that an end sits on *some* horizontal edge, which
    // is not enough. An end on the edge facing *away* from the other box still
    // satisfies that check, and the line then leaves backwards through its own
    // source box and arrives at the target's far side — so the arrowhead points
    // up through B while the line entered its base. That is what the ends looked
    // like when the depth axis was transposed and the ternary was left as it was
    // for the old left-to-right ordering.
    //
    // So this asserts the stronger property directly: the source end is on the
    // edge facing the target, and the target end is on the edge facing the
    // source. Only the same-height case is exempt, and it is checked separately to
    // be a genuine side exit.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const g = buildGraph({});

    const horizontalArrows: number[][] = [];
    for (const n of h.seen) {
        if (n.tag !== "path") continue;
        const p = String(n.props?.d ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number);
        if (!p || p.length !== 8) continue;
        if (Math.abs(p[1] - p[7]) < 1.5) continue; // same height: a side exit
        horizontalArrows.push(p);
    }
    assert(horizontalArrows.length > 10, `only ${horizontalArrows.length} stacked arrows`);

    let facing = 0;
    for (const p of horizontalArrows) {
        const [x1, y1, , , , , x2, y2] = p;
        // Both ends must belong to a *pair of distinct* boxes, and each must sit on
        // the edge of its box that faces the other box.
        const src = g.nodes.find(
            (b) =>
                x1 >= b.x && x1 <= b.x + b.w &&
                (Math.abs(y1 - b.y) < 1.5 || Math.abs(y1 - (b.y + b.h)) < 1.5),
        );
        const dst = g.nodes.find(
            (b) =>
                x2 >= b.x && x2 <= b.x + b.w &&
                (Math.abs(y2 - b.y) < 1.5 || Math.abs(y2 - (b.y + b.h)) < 1.5),
        );
        if (!src || !dst || src === dst) continue; // ring, or a shared edge
        const srcOnTop = Math.abs(y1 - src.y) < 1.5;
        const dstOnTop = Math.abs(y2 - dst.y) < 1.5;
        // Which of the two is vertically higher. Comparing `y` is enough and is
        // exact: the only stacked case is two boxes in the same slot, where the
        // rows are `slotStepH` apart, so there is no near-tie to worry about.
        const targetAbove = dst.y < src.y;
        assertEquals(
            srcOnTop,
            targetAbove,
            `an arrow leaves ${src.cat} by its ${srcOnTop ? "top" : "bottom"} edge, ` +
                `but ${dst.cat} is ${
                    targetAbove ? "above" : "below"
                } it — the line runs back through the box`,
        );
        assertEquals(
            dstOnTop,
            !targetAbove,
            `an arrow arrives at ${dst.cat} by its ${dstOnTop ? "top" : "bottom"} edge, ` +
                `but ${src.cat} is ${targetAbove ? "above" : "below"} it`,
        );
        facing++;
    }
    assert(facing > 10, `only ${facing} stacked arrows were checked between two boxes`);
});

Deno.test("a self-reference is drawn as a ring above its box", () => {
    // `techs` requiring other `techs` has no distance to cross. A ring is the
    // honest shape, and it has to sit clear of the box it belongs to.
    const g = buildGraph({});
    const self = g.edges.filter((e) => e.from === e.to);
    assert(self.length > 0, "the fixture has no self-references");
    const techs = g.nodes.find((n) => n.cat === "techs");
    assert(techs, "there is no techs node to loop on");
    // A ring is drawn at `a.y - 18`, so the whole shape is above the box.
    assert(techs.y > 0, "the techs node is at the very top, leaving no room for a ring");
});

Deno.test("the graph reads top-to-bottom: a box is never above what it references", () => {
    // The property the whole layout exists to guarantee. If it ever fails, the
    // arrow points the wrong way and the picture is actively misleading rather
    // than just untidy.
    //
    // Equal depth is allowed and must be: terrains and items reference each
    // other, so they sit in one cycle and share a slot. A cycle has no honest
    // order inside it, and inventing one would be a lie — so for those, only the
    // depth claim is made, and the arrow is drawn between them as the geometry
    // actually falls.
    const g = buildGraph({});
    let strict = 0;
    for (const e of g.edges) {
        const a = g.nodes.find((n) => n.cat === e.from);
        const b = g.nodes.find((n) => n.cat === e.to);
        if (!a || !b || a.cat === b.cat) continue; // a self-loop has no order
        assert(
            a.depth >= b.depth,
            `${e.from} → ${e.to}: the source (depth ${a.depth}) is above its target (depth ${b.depth})`,
        );
        if (a.depth === b.depth) continue; // a cycle — no order to assert
        strict++;
        assert(
            a.y > b.y,
            `${e.from} → ${e.to}: the source is not drawn below its target`,
        );
    }
    // The strict case has to be the common one, or this test is barely checking
    // anything. Most relations are not inside a cycle.
    assert(strict > 10, `only ${strict} edges are strictly below their target`);
});

Deno.test("kinds that reference each other share a depth", () => {
    // A cycle has no honest order inside it, so the layout must not invent one.
    // If this ever fails, some kind in a cycle is being drawn as though it
    // depended on something it is in fact mutually dependent with.
    const g = buildGraph({});
    const byCat = new Map(g.nodes.map((n) => [n.cat, n]));
    // terrains → items and items → terrains are both real relations here.
    const terrains = byCat.get("terrains");
    const items = byCat.get("items");
    if (!terrains || !items) return; // the fixture changed; nothing to assert
    const bothWays = g.edges.some((e) => e.from === "terrains" && e.to === "items") &&
        g.edges.some((e) => e.from === "items" && e.to === "terrains");
    if (!bothWays) return;
    assertEquals(
        terrains.depth,
        items.depth,
        "a cycle was split across depths, inventing an order that is not there",
    );
});

Deno.test("groups are ordered by the shallowest box in each", () => {
    // The request, and the reason it helps: the groups that only feed the graph
    // come first, and a group that purely consumes lands to the right of what
    // it consumes, so most arrows are short instead of criss-crossing.
    const g = buildGraph({});
    for (let i = 1; i < g.columns.length; i++) {
        assert(
            g.columns[i - 1].minDepth <= g.columns[i].minDepth,
            `${g.columns[i].label} (min depth ${g.columns[i].minDepth}) is placed before ` +
                `${g.columns[i - 1].label} (min depth ${g.columns[i - 1].minDepth})`,
        );
    }
});

Deno.test("the groups are columns, side by side, and do not overlap", () => {
    // Groups stand as columns beside each other rather than stacking as rows, and
    // each carries its name as a heading across the top. The heading is the part
    // worth stating: as rows the name had to fit a strip at the left and the
    // longest one had nowhere to go, which is why this layout came back to
    // columns.
    const g = buildGraph({});
    for (let i = 1; i < g.columns.length; i++) {
        const prev = g.columns[i - 1];
        const cur = g.columns[i];
        assert(
            cur.x >= prev.x + prev.w,
            `${cur.label} overlaps ${prev.label} — group columns must not overlap`,
        );
        // And each really is a column: taller than it is wide.
        assert(cur.w < cur.h, `${cur.label} is wider than it is tall, so it is a row`);
    }
    // Every node sits inside the column it belongs to.
    for (const n of g.nodes) {
        const c = g.columns.find((x) => x.key === n.group);
        assert(c, `${n.cat} has no group column`);
        assert(n.x >= c.x && n.x + n.w <= c.x + c.w, `${n.cat} is outside its column`);
        assert(n.y >= c.y, `${n.cat} is drawn above its own group heading`);
    }
});

Deno.test("two kinds in one group never overlap", () => {
    // Depth is the row now, so two kinds at the same depth in the same column
    // would land on top of each other. The layout is the one thing not
    // re-checked at render time, so it is checked here.
    const g = buildGraph({});
    for (const col of g.columns) {
        const members = g.nodes.filter((n) => n.group === col.key);
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const a = members[i];
                const b = members[j];
                const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
                const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
                assert(
                    !(overlapX && overlapY),
                    `${a.cat} and ${b.cat} are drawn on top of each other`,
                );
            }
        }
    }
    // And every node is inside the canvas.
    for (const n of g.nodes) {
        assert(n.y + n.h <= g.height, `${n.cat} is drawn below the canvas`);
        assert(n.x + n.w <= g.width, `${n.cat} is drawn past the right edge`);
    }
});

Deno.test("every details has a summary", () => {
    // The whole point of the object list is that it stays scannable.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    assertEquals(
        h.seen.filter((n) => n.tag === "summary").length,
        h.seen.filter((n) => n.tag === "details").length,
        "a <details> with no <summary> cannot be opened",
    );
});

// ── the two fixed catalogues ─────────────────────────────────────────────────

/** Both "builds a value" catalogues, and the presets each one is supposed to list. */
const FIXED_CATALOGUES = [
    {
        kind: "projectileOption",
        name: "Projectile options",
        presets: PROJECTILE_OPTIONS,
    },
    {
        kind: "excavationOption",
        name: "Excavation options",
        presets: EXCAVATION_OPTIONS,
    },
];

/** The props a catalogue needs. Nothing is read from the config here. */
function fixedProps(h) {
    return {
        h,
        cfg: {},
        query: "",
        setQuery: noop,
        onlyUsed: false,
        setOnlyUsed: noop,
    };
}

for (const { kind, name, presets } of FIXED_CATALOGUES) {
    Deno.test(`${name} shows the list, and it starts open`, () => {
        // The section exists to show which options ship. Wrapping the list in a
        // closed disclosure would hide the only thing it has to say, so it is open
        // on arrival and the summary is there to collapse it.
        const h = fakeH();
        renderFixedCatalogue(kind, fixedProps(h));
        const details = h.seen.find((n) => n.tag === "details");
        assert(details, `${name} is not in a <details>`);
        assertEquals(details.props.open, true, `${name} starts closed`);
        // Every preset is named, so the list is the list and not a placeholder.
        const text = h.text();
        for (const key of Object.keys(presets)) {
            assert(text.includes(key), `${name} does not list ${key}`);
        }
        // The count is on the summary, which stays visible whether or not it is open.
        const summary = h.seen.find((n) => n.tag === "summary");
        assert(summary, `${name} has no <summary>`);
        assert(
            text.includes(`${Object.keys(presets).length} available`),
            `${name} does not say how many it has`,
        );
    });

    Deno.test(`${name} offers nothing to add, remove or edit`, () => {
        // These presets are written in code and compiled once. A `+ New`, a `Del`
        // or an `Edit` would create an entry that nothing compiles or reads, so
        // the absence is pinned: it is the property that makes the section fixed.
        //
        // Asserted on the *labels*, not on a button count. The `In use only` chip
        // is a button too, and it is legitimate — it narrows what is shown and
        // changes nothing. What is forbidden is a button that writes.
        const h = fakeH();
        renderFixedCatalogue(kind, fixedProps(h));
        const labels = h.seen.filter((n) => n.tag === "button").flatMap((n) =>
            textOf(n).split(/\s+/)
        );
        for (const forbidden of ["Edit", "Del", "New", "Add", "Remove", "Delete"]) {
            assert(
                !labels.includes(forbidden),
                `${name} offers a "${forbidden}" button`,
            );
        }
        // And nothing in the section writes to the config: the only input is the
        // search box, so a stray save path would show up here.
        const inputs = h.seen.filter((n) => n.tag === "input");
        assertEquals(inputs.length, 1, `${name} draws ${inputs.length} inputs`);
        assertEquals(inputs[0].props.placeholder, "Search options…");
    });

    Deno.test(`${name} counts what is in use`, () => {
        // "In use only" is only useful if "in use" is derived from the config, so
        // a section that is inline still has to read the entries above it.
        const h = fakeH();
        const key = Object.keys(presets)[0];
        const cfg = kind === "projectileOption"
            ? { projectiles: [{ id: "arrow", option: { key } }, { id: "arrow2", option: { key } }] }
            : { excavationProfiles: [{ id: "dig", option: { key } }] };
        renderFixedCatalogue(kind, { ...fixedProps(h), cfg });
        const expected = kind === "projectileOption" ? "used ×2" : "used ×1";
        assert(h.text().includes(expected), `${name} does not report ${expected}`);
    });
}

Deno.test("both fixed catalogues resolve to the screen they live in", () => {
    // They are sections of Items now, not screens. A stale panel state naming one
    // — saved while these did have their own screen — must land on Items, not on
    // an empty list with no way back.
    assertEquals(resolveCat("projectileOption"), "items");
    assertEquals(resolveCat("excavationOption"), "items");
    // And a real tab is untouched by that rule.
    assertEquals(resolveCat("items"), "items");
    assertEquals(resolveCat("projectiles"), "projectiles");
});

Deno.test("the map screen renders an empty config, with a way out", () => {
    const h = fakeH();
    renderConfigMap({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const text = h.text();
    assert(text.includes("Nothing to draw yet"), `no empty state:\n${text}`);
});

Deno.test("the map screen renders a populated config", () => {
    const h = fakeH();
    renderConfigMap({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    const text = h.text();
    assert(
        text.includes("6 entries"),
        `the count is wrong:\n${text.slice(0, 300)}`,
    );
    assert(text.includes("Elements"), "no legend entry for elements");
    assert(h.seen.some((n) => n.tag === "svg"), "no arrow layer");
});

// Match the headline, not the phrase. "point at nothing" also appears in
// the orphan note's prose, so a substring check would pass with no banner
// at all — and fail on a config that merely has orphans.
const BANNER = /\d+ references? points? at nothing/;

Deno.test("the map screen flags broken references and orphans", () => {
    const h = fakeH();
    renderConfigMap({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    const text = h.text();
    assert(BANNER.test(text), `no broken-reference banner:\n${text.slice(0, 300)}`);
    assert(text.includes("md-my-hown-mod:ghost"), "the bad id is not named");
    assert(text.includes("not used anywhere"), "no orphan note");
});

Deno.test("a healthy config shows neither banner", () => {
    const h = fakeH();
    renderConfigMap({
        h,
        cfg: {
            elements: [{ id: "e1" }],
            terrains: [{ id: "t1", outputElement: "e1" }],
        },
        onGoTo: noop,
        onCopy: noop,
    });
    const text = h.text();
    assert(!BANNER.test(text), "a false broken-reference banner");
    assert(!text.includes("not used anywhere"), "a false orphan note");
});

Deno.test("an orphaned config shows the orphan note but not the banner", () => {
    // The inverse of the case above. Worth its own test because the two
    // banners are independent, and one firing must not mask the other.
    const h = fakeH();
    renderConfigMap({
        h,
        cfg: { elements: [{ id: "e1" }] },
        onGoTo: noop,
        onCopy: noop,
    });
    const text = h.text();
    assert(!BANNER.test(text), "a false broken-reference banner");
    assert(text.includes("not used anywhere"), "no orphan note");
});

Deno.test("the banner is grammatical with exactly one broken reference", () => {
    // "1 reference point at nothing" is the kind of thing that ships.
    const h = fakeH();
    renderConfigMap({
        h,
        cfg: {
            elements: [{ id: "e1" }],
            terrains: [{ id: "t1", outputElement: "e1" }, { id: "t2", outputElement: "ghost" }],
        },
        onGoTo: noop,
        onCopy: noop,
    });
    const text = h.text();
    assert(text.includes("1 reference points at nothing"), `bad grammar:\n${text.slice(0, 300)}`);
});

Deno.test("both screens defer copying to the caller", () => {
    // The clipboard is a panel concern; a screen that reaches for it directly
    // cannot show the fallback toast when it is blocked.
    let copied = 0;
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: () => copied++ });
    renderConfigMap({ h, cfg: POPULATED, onGoTo: noop, onCopy: () => copied++ });
    assertEquals(copied, 0, "copying happened during render, not on click");
    const buttons = h.seen.filter((n) =>
        typeof n.props?.onClick === "function" &&
        n.children?.some((c) => typeof c === "string" && c.includes("Copy"))
    );
    assertEquals(buttons.length, 2, "each screen should have one copy button");
});

Deno.test("every handler type has a label and a blurb to show", () => {
    // The Handlers screen groups by type; a type with no blurb renders an empty
    // line where the explanation should be.
    for (const m of HANDLER_META) {
        assert(HANDLER_TYPE_LABELS[m.type], `${m.type} has no label`);
        assert(HANDLER_TYPE_BLURBS[m.type], `${m.type} has no blurb`);
    }
});
