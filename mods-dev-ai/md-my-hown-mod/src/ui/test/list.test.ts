// @ts-nocheck
/**
 * The list screen's two rules, tested where they can actually fail.
 *
 * The screen's premise is that the mod's objects and the host's objects are
 * **one list** that differs only in which buttons a row gets. Two things break
 * that premise silently:
 *
 *  1. **A merge that shows one object twice.** A mod that has registered its own
 *     element appears in both sources. Two rows for one object means the user
 *     cannot tell which is the editable one, and the screen stops being a list
 *     of objects and becomes a list of *sources*.
 *  2. **An origin that is wrong.** If a game row is filed as a mod row it gets
 *     an Edit button, and clicking it offers to edit Sand. Nothing throws; the
 *     screen just quietly lies.
 *
 * So these assert the merge and the filter directly rather than walking a
 * rendered tree — the bug is in the data, and testing the data is both cheaper
 * and more precise than looking for it in React output.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import {
    countByOrigin,
    countByOwner,
    filterRows,
    mergeRows,
    modOf,
    ownerLabel,
    ownerOf,
    ownersOf,
    renderListRow,
} from "../panel/list.ts";
import { row, rowDetails, rowSummary } from "../styles.ts";
import type { ListRenderCtx } from "../definition/types.ts";

// ── Merging ──────────────────────────────────────────────────────────────────

Deno.test("an object the mod declares and the game also has is one row, not two", () => {
    const rows = mergeRows(
        [{ id: "mdmy.ore", name: "My Ore", matterType: "powder" }],
        [{ id: "mdmy.ore", label: "My Ore", origin: "game", native: { density: 900 } }],
    );
    assertEquals(rows.length, 1, "the same object appeared twice");
    // `mod` wins, because that is the row the user owns and can act on.
    assertEquals(rows[0].origin, "mod");
    assertEquals(rows[0].entry?.id, "mdmy.ore");
    // …and the engine's own definition survives, so opening the row still shows
    // what was actually registered. Losing it would make the merged row poorer
    // than either source on its own.
    assertEquals(rows[0].native?.density, 900);
});

Deno.test("a mod entry with no name falls back to the host's label", () => {
    const rows = mergeRows(
        [{ id: "mdmy.ore" }],
        [{ id: "mdmy.ore", label: "Registered Ore", origin: "game" }],
    );
    assertEquals(rows[0].label, "Registered Ore");
});

Deno.test("a mod entry with a name keeps it over the host's", () => {
    // The author named it; the config is the thing they will recognise.
    const rows = mergeRows(
        [{ id: "mdmy.ore", name: "Shiny Ore" }],
        [{ id: "mdmy.ore", label: "Registered Ore", origin: "game" }],
    );
    assertEquals(rows[0].label, "Shiny Ore");
});

Deno.test("the mod's own rows sort first, each group alphabetical", () => {
    // Grouping is by *owner*, not by the editable/origin flag.
    //
    // The game rows here are deliberately **unnamespaced** ids. An earlier version
    // of this fixture used `a.game` / `z.game`, which is a good illustration of why
    // the namespace reading has to be literal: `a.game` really does parse as "a mod
    // called `a`", so those two rows sorted into their own third group instead of
    // with the game's — and the test failed because the *fixture* was misleading,
    // not because the sort was wrong.
    const rows = mergeRows(
        [{ id: "b.mine" }, { id: "a.mine" }],
        [
            { id: "Zeta", label: "Zeta", origin: "game" },
            { id: "Alpha", label: "Alpha", origin: "game" },
        ],
    );
    assertEquals(rows.map((r) => r.id), ["a.mine", "b.mine", "Alpha", "Zeta"]);
});

Deno.test("entries without a usable id are dropped, not shown as blank rows", () => {
    const rows = mergeRows([{ name: "No Id" }, { id: "" }, { id: "real" }], []);
    assertEquals(rows.map((r) => r.id), ["real"]);
});

// ── Filtering ────────────────────────────────────────────────────────────────

const MIXED = [
    { id: "Sand", label: "Sand", origin: "game" as const },
    { id: "Water", label: "Water", origin: "game" as const },
    { id: "mdmy.glass", label: "Glass", origin: "mod" as const },
    { id: "mdmy.slime", label: "Slime", origin: "mod" as const },
];

Deno.test("the origin filter separates mine from the game's", () => {
    assertEquals(filterRows(MIXED, "", undefined, "own").map((r) => r.id), [
        "mdmy.glass",
        "mdmy.slime",
    ]);
    assertEquals(filterRows(MIXED, "", undefined, "game").map((r) => r.id), ["Sand", "Water"]);
    assertEquals(filterRows(MIXED, "").length, 4);
});

Deno.test("the origin filter is not fooled by case", () => {
    // A filter that matched case-sensitively would return "everything" for the
    // wrong origin, which looks like a working filter with wrong counts.
    assertEquals(filterRows(MIXED, "", undefined, "OWN").length, 0);
    assertEquals(filterRows(MIXED, "", undefined, "own").length, 2);
});

Deno.test("text matching reaches the id, not just the label", () => {
    // "mdmy." is in the id of both mod rows and in neither label. A label-only
    // filter would return nothing, and the user would conclude the list is
    // broken.
    assertEquals(filterRows(MIXED, "mdmy.").length, 2);
});

Deno.test("text matching is a substring, so a partial id still finds the row", () => {
    // A prefix match would hide `mdmy.glass` from a search for "glass".
    assertEquals(filterRows(MIXED, "glass").map((r) => r.id), ["mdmy.glass"]);
});

Deno.test("text matching ignores case", () => {
    assertEquals(filterRows(MIXED, "SAND").map((r) => r.id), ["Sand"]);
});

Deno.test("text and origin compose rather than overriding each other", () => {
    // The real question a user asks: "my elements that are glass-ish".
    assertEquals(filterRows(MIXED, "g", undefined, "own").map((r) => r.id), ["mdmy.glass"]);
});

Deno.test("a definition's extra search text is matched", () => {
    // Without this, searching "powder" finds nothing even though the row's
    // matter type says powder — the filter only sees the id and the label.
    const rows = [
        { id: "Sand", label: "Sand", origin: "game" as const, native: { matterType: "powder" } },
    ];
    assertEquals(filterRows(rows, "powder").length, 0, "no searchText passed");
    assertEquals(
        filterRows(rows, "powder", (r) => String(r.native?.matterType ?? "")).length,
        1,
    );
});

Deno.test("a filter that matches nothing yields an empty list, not everything", () => {
    // The usual failure of a broken filter is an inverted match — `!includes`
    // rather than `includes` — which shows the whole list for a query matching
    // nothing at all.
    assertEquals(filterRows(MIXED, "zzzz"), []);
});

Deno.test("whitespace-only text is not a filter", () => {
    // A user who typed a space and nothing else should see the list, not zero
    // rows — the substring match would otherwise look for " ".
    assertEquals(filterRows(MIXED, "   ").length, 4);
});

Deno.test("the counts add up to the number of rows", () => {
    // The chips show these numbers, so a count that disagrees with the list is a
    // visible lie even when the list itself is right.
    const rows = mergeRows([{ id: "a" }, { id: "b" }], [{ id: "c", label: "C", origin: "game" }]);
    const counts = countByOrigin(rows);
    assertEquals(counts.mod + counts.game, rows.length);
    assertEquals(counts.mod, 2);
    assertEquals(counts.game, 1);
});

Deno.test("an empty list counts zero of each, and filters to nothing", () => {
    assertEquals(countByOrigin([]), { mod: 0, game: 0 });
    assertEquals(filterRows([], ""), []);
});

// ── Which mod an object came from ────────────────────────────────────────────

const row = (id: string, origin: "mod" | "game" = "game") => ({ id, label: id, origin }) as const;

Deno.test("an id with no dot is the game's, not a mod called that", () => {
    // `Sand` is a built-in. Reading it as a mod called "Sand" would give it a chip
    // of its own that selects exactly one built-in.
    assertEquals(modOf(row("Sand")), { own: false });
    assertEquals(ownerOf(row("Sand")), "game");
});

Deno.test("the prefix before the first dot is the mod", () => {
    assertEquals(modOf(row("otherA.furnace")), { modId: "otherA", own: false });
    assertEquals(ownerOf(row("otherA.furnace")), "mod:otherA");
    // Only the *first* dot — a name may contain more of its own.
    assertEquals(modOf(row("otherA.big.furnace")), { modId: "otherA", own: false });
});

Deno.test("this mod's own short prefix is recognised, not filed as another mod", () => {
    // `MOD_ID` is `md-my-hown-mod` but the config's own ids use `mdmy.`. A check
    // against the package name alone would file every one of the author's own
    // objects under "another mod" — the one error a mod author notices at once.
    assertEquals(ownerOf(row("mdmy.ores", "mod")), "own");
    assertEquals(modOf(row("mdmy.ores")).own, true);
    assertEquals(modOf(row("md-my-hown-mod.thing")).own, true);
});

Deno.test("a row in the mod's config is this mod's regardless of its id", () => {
    // No inference needed, and none done: an entry in this mod's own config is
    // this mod's by definition, even when its id is unnamespaced.
    assertEquals(ownerOf(row("UnnamespacedThing", "mod")), "own");
});

Deno.test("a leading dot is not a mod id", () => {
    // `.thing` would otherwise yield an empty modId and a chip labelled "".
    assertEquals(modOf(row(".thing")), { own: false });
    assertEquals(ownerOf(row(".thing")), "game");
});

Deno.test("the owner chips list this mod, then the game, then other mods", () => {
    const rows = mergeRows(
        [{ id: "mdmy.mine" }],
        [
            { id: "zeta.z", label: "Z", origin: "game" },
            { id: "otherB.b", label: "B", origin: "game" },
            { id: "Built", label: "Built", origin: "game" },
            { id: "otherA.a", label: "A", origin: "game" },
        ],
    );
    assertEquals(ownersOf(rows), ["own", "game", "mod:otherA", "mod:otherB", "mod:zeta"]);
});

Deno.test("no chip is offered for a mod that contributed no rows", () => {
    // The set of installed mods is not knowable ahead of time, so the chips are
    // built from the rows. A chip for an absent mod always filters to nothing.
    assertEquals(ownersOf(mergeRows([], [{ id: "Sand", label: "Sand", origin: "game" }])), [
        "game",
    ]);
});

Deno.test("the rows sort own first, then the game, then other mods", () => {
    const rows = mergeRows(
        [{ id: "mdmy.mine" }],
        [
            { id: "otherA.a", label: "A", origin: "game" },
            { id: "Built", label: "Built", origin: "game" },
        ],
    );
    assertEquals(rows.map((r) => r.id), ["mdmy.mine", "Built", "otherA.a"]);
});

Deno.test("an owner filter narrows to one mod's objects", () => {
    const rows = mergeRows(
        [{ id: "mdmy.mine" }],
        [
            { id: "otherA.a", label: "A", origin: "game" },
            { id: "otherB.b", label: "B", origin: "game" },
            { id: "Built", label: "Built", origin: "game" },
        ],
    );
    assertEquals(filterRows(rows, "", undefined, "mod:otherA").map((r) => r.id), [
        "otherA.a",
    ]);
    assertEquals(filterRows(rows, "", undefined, "own").map((r) => r.id), ["mdmy.mine"]);
    assertEquals(filterRows(rows, "", undefined, "game").map((r) => r.id), ["Built"]);
});

Deno.test("the owner and text filters compose", () => {
    const rows = mergeRows(
        [],
        [
            { id: "otherA.furnace", label: "Furnace", origin: "game" },
            { id: "otherA.press", label: "Press", origin: "game" },
        ],
    );
    assertEquals(filterRows(rows, "fur", undefined, "mod:otherA").map((r) => r.id), [
        "otherA.furnace",
    ]);
});

Deno.test("an unknown owner filter yields nothing, not everything", () => {
    // The failure mode of a broken owner filter is inverted, which shows the whole
    // list when the user asked for one mod's objects.
    const rows = mergeRows([], [{ id: "otherA.a", label: "A", origin: "game" }]);
    assertEquals(filterRows(rows, "", undefined, "mod:nope"), []);
});

Deno.test("the owner counts add up to the number of rows", () => {
    const rows = mergeRows(
        [{ id: "mdmy.mine" }, { id: "mdmy.other" }],
        [
            { id: "otherA.a", label: "A", origin: "game" },
            { id: "otherA.b", label: "B", origin: "game" },
            { id: "Built", label: "Built", origin: "game" },
        ],
    );
    const counts = countByOwner(rows);
    let total = 0;
    for (const n of counts.values()) total += n;
    assertEquals(total, rows.length);
    assertEquals(counts.get("own"), 2);
    assertEquals(counts.get("mod:otherA"), 2);
    assertEquals(counts.get("game"), 1);
});

Deno.test("an owner label says something for every key", () => {
    // A chip labelled "" or "mod:" is worse than no chip, and the label is the
    // only thing between a raw mod id and the user.
    assertEquals(ownerLabel("own"), "This mod");
    assertEquals(ownerLabel("game"), "Game");
    assertEquals(ownerLabel("mod:otherA"), "otherA");
});

Deno.test("the list has one source filter, not two", () => {
    // There used to be both an `origin` filter (All / Yours / Game) and an
    // `owner` filter (This mod / Game / otherA). They were the same choice twice:
    // "Yours" is `own` and "Game" is `game`, and `origin` had no third value to
    // offer. Two arguments for one piece of state is how the two chips end up
    // disagreeing, so the coarser one is gone rather than merely hidden.
    // Read the signature from the source rather than `filterRows.length`:
    // `Function.length` counts only the parameters *before* the first default, so
    // it reports 3 here — and would report 3 again if an `origin` were re-added in
    // that same position. The parameter *name* is the thing that must not return.
    //
    // Matched one-per-line, because a flat `\w+:` also picks up the `row:` inside
    // the `searchText` function *type* and would report a fifth parameter that
    // does not exist.
    const src = Deno.readTextFileSync(new URL("../panel/list.ts", import.meta.url).pathname);
    assert(!/export type OriginFilter/.test(src), "the OriginFilter type came back");
    assert(!/origin: OriginFilter/.test(src), "filterRows takes an origin again");
    const params = /export function filterRows\(([\s\S]*?)\n\):/.exec(src)?.[1] ?? "";
    assertEquals(
        params.split("\n").map((l) => l.trim().split(/[?:]/)[0]).filter(Boolean),
        ["rows", "text", "searchText", "owner"],
        "filterRows' parameters changed",
    );
});

Deno.test("the owner filter still answers what the origin filter used to", () => {
    // The regression to guard: dropping the coarse filter must not lose a
    // capability. "Mine", "the game's" and "another mod's" all still work.
    const rows = mergeRows(
        [{ id: "mdmy.mine" }],
        [
            { id: "Sand", label: "Sand", origin: "game" },
            { id: "otherA.a", label: "A", origin: "game" },
        ],
    );
    assertEquals(filterRows(rows, "", undefined, "own").map((r) => r.id), ["mdmy.mine"]);
    assertEquals(filterRows(rows, "", undefined, "game").map((r) => r.id), ["Sand"]);
    assertEquals(filterRows(rows, "", undefined, "mod:otherA").map((r) => r.id), ["otherA.a"]);
    // And no filter at all still means everything.
    assertEquals(filterRows(rows, "").length, 3);
});

Deno.test("the panel draws no second filter row", () => {
    // The visible half of the same change: the All / Yours / Game chips are gone
    // from `panel.ts`, so the search box and the owner chips are the whole bar.
    const panel = Deno.readTextFileSync(new URL("../panel.ts", import.meta.url).pathname);
    for (const gone of ['chip("all"', 'chip("mod"', 'chip("game"', "listOrigin"]) {
        assert(!panel.includes(gone), `panel.ts still has ${gone}`);
    }
});

Deno.test("the panel no longer draws an 'in the game already' section", () => {
    // That block sat above the list and promised to show what already exists —
    // which the list below it now *is*, rows, counts and filter included.
    //
    // Matched on the *code*, not the prose: the phrase survives in a comment
    // explaining why the block was removed, and a plain `includes` would fail on
    // the very comment that records the fix.
    const panel = Deno.readTextFileSync(new URL("../panel.ts", import.meta.url).pathname);
    const asCode = panel
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
    assert(!asCode.includes("in the game already"), "the section is still rendered");
    assert(!asCode.includes("panelNatives"), "panelNatives is still called");
});

Deno.test("the list screen's 'N in config' count reads the owner tally", () => {
    // It used a second counter (`countByOrigin`) for a number the owner counts
    // already hold. One number, one source.
    const panel = Deno.readTextFileSync(new URL("../panel.ts", import.meta.url).pathname);
    assert(!panel.includes("countByOrigin"), "panel.ts still keeps a second tally");
    assert(panel.includes('ownerCounts.get("own")'), "the header count has no source");
});

// ── The row is the control ───────────────────────────────────────────────────
//
// The row used to be a `div` holding a bar and a separate 10px `▸` button. Two
// things were wrong with that: the button was a tiny target with no hit area, and
// a `div` with a click handler is not focusable, so the detail could not be
// reached from the keyboard at all. Both are properties of the *markup*, so they
// are asserted here against the rendered tree rather than against a style.

/** A React stand-in that records the element tree. */
function tree() {
    const h = (...a: unknown[]) => ({ tag: a[0], props: (a[1] ?? {}) as never, kids: a.slice(2) });
    return h;
}

/** Every element tag in a tree, depth-first. */
function tags(node: unknown, out: string[] = []): string[] {
    if (!node || typeof node !== "object") return out;
    const n = node as { tag?: string; kids?: unknown[] };
    if (n.tag) out.push(n.tag);
    for (const k of n.kids ?? []) tags(k, out);
    return out;
}

const CTX = (over: Partial<ListRenderCtx> = {}): ListRenderCtx =>
    ({
        h: tree(),
        form: {},
        cfg: {} as never,
        setField: () => {},
        // A row with a real stored entry, because `sharedInfo` deliberately
        // returns `null` for a row with nothing to say — a fixture with no data
        // would make "expanding renders a detail" untestable for the wrong reason.
        row: {
            id: "mdmy.thing",
            label: "Thing",
            origin: "mod",
            entry: { id: "mdmy.thing", hp: 5 },
        },
        expanded: false,
        toggle: () => {},
        ...over,
    }) as ListRenderCtx;

Deno.test("a row is a details whose summary is the whole line", () => {
    const node = renderListRow(CTX(), {}) as { tag: string; kids: unknown[] };
    assertEquals(node.tag, "details");
    assertEquals((node.kids[0] as { tag: string }).tag, "summary");
});

Deno.test("a row draws no expander button of its own", () => {
    // The whole line is the target now; a leftover glyph button would be the tiny
    // hard-to-hit control the change was meant to remove.
    const node = renderListRow(CTX(), {}) as { kids: unknown[] };
    const summary = node.kids[0] as { kids: unknown[] };
    assertEquals(tags(summary).filter((t) => t === "button").length, 0);
});

Deno.test("a collapsed row renders no detail, an open one does", () => {
    // Collapsed by default, and not rendered until opened: a list of 200 rows
    // must not build 200 detail blocks nobody can see.
    const count = (n: unknown) => tags(n).length;
    const closed = count(renderListRow(CTX(), {}));
    const open = count(renderListRow(CTX({ expanded: true }), {}));
    assert(open > closed, "expanding a row added nothing to the tree");
});

Deno.test("the row is a column, so the detail sits under the line and not beside it", () => {
    // The layout bug: `S.row` is `display: flex` in the *row* direction, so a
    // detail div placed after the bar was laid out to its right — a narrow column
    // hanging off the edge of the row.
    assertEquals(rowDetails.flexDirection, "column");
    assertEquals(rowDetails.alignItems, "stretch");
    // The flat `S.row` is shared with the handlers panel and must not change.
    assertEquals(row.flexDirection, undefined, "S.row is shared and must stay a row");
});

Deno.test("the summary is a full-width click target, not just the text", () => {
    assertEquals(rowSummary.cursor, "pointer");
    assertEquals(rowSummary.display, "flex");
    assert(rowSummary.padding !== undefined, "the summary has no hit area to click");
    // The native marker is suppressed so the row draws its own, in the right place.
    assertEquals(rowSummary.listStyle, "none");
});

Deno.test("a game row still gets no Edit and no Del", () => {
    const node = renderListRow(CTX({ row: { id: "Sand", label: "Sand", origin: "game" } }), {}) as {
        kids: unknown[];
    };
    const summary = node.kids[0] as { kids: unknown[] };
    assertEquals(tags(summary).filter((t) => t === "button").length, 0);
});

Deno.test("a mod row's buttons do not also toggle the row open", () => {
    // A button inside a `summary` toggles it as well as doing its own job, so
    // without `stopPropagation` pressing Edit would open the row as a side effect.
    const node = renderListRow(
        CTX({ edit: () => {}, remove: () => {} }),
        {},
    ) as { kids: unknown[] };
    const summary = node.kids[0] as { kids: { props: { onClick?: (e: unknown) => void } }[] };
    const buttons = summary.kids.filter((k) => tags(k)[0] === "button");
    assertEquals(buttons.length, 2, "the mod row lost its Edit and Del");
    let stopped = false;
    buttons[0].props.onClick?.({
        stopPropagation: () => {
            stopped = true;
        },
    });
    assert(stopped, "the row buttons do not stop propagation, so Edit also opens the row");
});
