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

const { renderHelp } = await import("./help-panel.ts");
const { RELATIONS } = await import("./relations.ts");
const { renderConfigMap } = await import("./config-map.ts");
const { HANDLER_META, HANDLER_TYPE_BLURBS, HANDLER_TYPE_LABELS } = await import(
    "../hooks/handler-registry.ts"
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
    h.text = () => {
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
        walk(seen);
        return parts.join(" ");
    };
    return h;
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
    assert(h.seen.length > 50, `only ${h.seen.length} elements — suspiciously few`);
});

Deno.test("the help screen renders on a populated config", () => {
    const h = fakeH();
    renderHelp({ h, cfg: POPULATED, onGoTo: noop, onCopy: noop });
    assert(h.seen.length > 50, `only ${h.seen.length} elements`);
});

Deno.test("the help screen says there is nothing broken when there is nothing", () => {
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
    assert(h.text().includes("No broken references"), "the clean report is missing");
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
    // The field tables were removed deliberately. This pins that decision, so
    // they cannot quietly come back as a second, drifting source of truth.
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    const text = h.text();
    assert(
        !text.includes("The objects, and their fields"),
        "the per-object field tables are back",
    );
    assert(text.includes("How the objects relate"), "the relation section is missing");
    assert(text.includes("Each row is one field"), "the per-field edge rule is unstated");
});

Deno.test("the help screen draws an svg and one row per field", () => {
    const h = fakeH();
    renderHelp({ h, cfg: {}, onGoTo: noop, onCopy: noop });
    assert(h.seen.some((n) => n.tag === "svg"), "no svg layer for the arrows");
    assert(
        h.seen.filter((n) => n.tag === "path").length > 10,
        "no arrows drawn",
    );
    // One arrow per declared relation, so the arrow count tracks the table. If
    // these drift apart the graph is either cluttered or silently missing edges.
    assertEquals(
        h.seen.filter((n) => n.tag === "path").length,
        RELATIONS.length,
        "arrow count does not match the relation table",
    );
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

