

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
    
    
    
    assert(h.seen.length > 30, `only ${h.seen.length} elements — suspiciously few`);
});

Deno.test("the help screen renders on a populated config", () => {
    const h = fakeH();
    renderHelp({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    assert(h.seen.length > 30, `only ${h.seen.length} elements`);
});

Deno.test("a clean config reports no breakage and does not cry wolf", () => {
    
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
    
    
    
    
    
    
    
    
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const text = h.text();
    for (const label of ["Elements", "Structures", "Terrains", "Tech nodes"]) {
        assert(text.includes(label), `${label} is not on the graph`);
    }
});

Deno.test("the help screen is a graph, not a copy of the docs", () => {
    
    
    
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
    
    
    
    
    const h = fakeH();
    renderHelp({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    const text = h.text();
    for (const column of ["Holds", "Field", "Points at", "In use", "Broken"]) {
        assert(text.includes(column), `the table has no "${column}" column`);
    }
});

Deno.test("the graph is grouped into the same columns as the menu", () => {
    
    
    
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
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const g = buildGraph({});
    const boxes = g.nodes.map((n) => ({ cat: n.cat, x: n.x, y: n.y, w: n.w, h: n.h }));
    const onHorizontalEdge = (b: typeof boxes[0], x: number, y: number) =>
        x >= b.x && x <= b.x + b.w &&
        (Math.abs(y - b.y) < 1.5 || Math.abs(y - (b.y + b.h)) < 1.5);
    
    
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
        if (!p || p.length !== 8) continue; 
        const [x1, y1, , , , , x2, y2] = p;
        
        
        
        
        
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
        
        
        const sidewaysOk = sameHeightPair(p) &&
            boxes.some((b) => onVerticalEdge(b, x1, y1)) &&
            boxes.some((b) => onVerticalEdge(b, x2, y2));
        if (sidewaysOk) sideways++;
        
        
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
    
    assert(
        sideways < checked / 3,
        `${sideways} of ${checked} arrows left by a side — the same-height case should be the exception`,
    );
});

Deno.test("an arrow joins the two facing edges, never running back through a box", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const g = buildGraph({});

    const horizontalArrows: number[][] = [];
    for (const n of h.seen) {
        if (n.tag !== "path") continue;
        const p = String(n.props?.d ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number);
        if (!p || p.length !== 8) continue;
        if (Math.abs(p[1] - p[7]) < 1.5) continue; 
        horizontalArrows.push(p);
    }
    assert(horizontalArrows.length > 10, `only ${horizontalArrows.length} stacked arrows`);

    let facing = 0;
    for (const p of horizontalArrows) {
        const [x1, y1, , , , , x2, y2] = p;
        
        
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
        if (!src || !dst || src === dst) continue; 
        const srcOnTop = Math.abs(y1 - src.y) < 1.5;
        const dstOnTop = Math.abs(y2 - dst.y) < 1.5;
        
        
        
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
    
    
    const g = buildGraph({});
    const self = g.edges.filter((e) => e.from === e.to);
    assert(self.length > 0, "the fixture has no self-references");
    const techs = g.nodes.find((n) => n.cat === "techs");
    assert(techs, "there is no techs node to loop on");
    
    assert(techs.y > 0, "the techs node is at the very top, leaving no room for a ring");
});

Deno.test("the graph reads top-to-bottom: a box is never above what it references", () => {
    
    
    
    
    
    
    
    
    
    const g = buildGraph({});
    let strict = 0;
    for (const e of g.edges) {
        const a = g.nodes.find((n) => n.cat === e.from);
        const b = g.nodes.find((n) => n.cat === e.to);
        if (!a || !b || a.cat === b.cat) continue; 
        assert(
            a.depth >= b.depth,
            `${e.from} → ${e.to}: the source (depth ${a.depth}) is above its target (depth ${b.depth})`,
        );
        if (a.depth === b.depth) continue; 
        strict++;
        assert(
            a.y > b.y,
            `${e.from} → ${e.to}: the source is not drawn below its target`,
        );
    }
    
    
    assert(strict > 10, `only ${strict} edges are strictly below their target`);
});

Deno.test("kinds that reference each other share a depth", () => {
    
    
    
    const g = buildGraph({});
    const byCat = new Map(g.nodes.map((n) => [n.cat, n]));
    
    const terrains = byCat.get("terrains");
    const items = byCat.get("items");
    if (!terrains || !items) return; 
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
    
    
    
    
    
    const g = buildGraph({});
    for (let i = 1; i < g.columns.length; i++) {
        const prev = g.columns[i - 1];
        const cur = g.columns[i];
        assert(
            cur.x >= prev.x + prev.w,
            `${cur.label} overlaps ${prev.label} — group columns must not overlap`,
        );
        
        assert(cur.w < cur.h, `${cur.label} is wider than it is tall, so it is a row`);
    }
    
    for (const n of g.nodes) {
        const c = g.columns.find((x) => x.key === n.group);
        assert(c, `${n.cat} has no group column`);
        assert(n.x >= c.x && n.x + n.w <= c.x + c.w, `${n.cat} is outside its column`);
        assert(n.y >= c.y, `${n.cat} is drawn above its own group heading`);
    }
});

Deno.test("two kinds in one group never overlap", () => {
    
    
    
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
    
    for (const n of g.nodes) {
        assert(n.y + n.h <= g.height, `${n.cat} is drawn below the canvas`);
        assert(n.x + n.w <= g.width, `${n.cat} is drawn past the right edge`);
    }
});

Deno.test("every details has a summary", () => {
    
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    assertEquals(
        h.seen.filter((n) => n.tag === "summary").length,
        h.seen.filter((n) => n.tag === "details").length,
        "a <details> with no <summary> cannot be opened",
    );
});




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
        
        
        
        const h = fakeH();
        renderFixedCatalogue(kind, fixedProps(h));
        const details = h.seen.find((n) => n.tag === "details");
        assert(details, `${name} is not in a <details>`);
        assertEquals(details.props.open, true, `${name} starts closed`);
        
        const text = h.text();
        for (const key of Object.keys(presets)) {
            assert(text.includes(key), `${name} does not list ${key}`);
        }
        
        const summary = h.seen.find((n) => n.tag === "summary");
        assert(summary, `${name} has no <summary>`);
        assert(
            text.includes(`${Object.keys(presets).length} available`),
            `${name} does not say how many it has`,
        );
    });

    Deno.test(`${name} offers nothing to add, remove or edit`, () => {
        
        
        
        
        
        
        
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
        
        
        const inputs = h.seen.filter((n) => n.tag === "input");
        assertEquals(inputs.length, 1, `${name} draws ${inputs.length} inputs`);
        assertEquals(inputs[0].props.placeholder, "Search options…");
    });

    Deno.test(`${name} counts what is in use`, () => {
        
        
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
    
    
    
    assertEquals(resolveCat("projectileOption"), "items");
    assertEquals(resolveCat("excavationOption"), "items");
    
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
    
    
    for (const m of HANDLER_META) {
        assert(HANDLER_TYPE_LABELS[m.type], `${m.type} has no label`);
        assert(HANDLER_TYPE_BLURBS[m.type], `${m.type} has no blurb`);
    }
});
