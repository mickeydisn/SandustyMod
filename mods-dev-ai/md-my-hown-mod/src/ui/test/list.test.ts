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
    brief,
    configIsHidden,
    countByOrigin,
    countByOwner,
    countHiddenRows,
    detailRows,
    type DetailSpec,
    filterRows,
    hiddenFieldOf,
    mergeRows,
    modOf,
    ownerLabel,
    ownerOf,
    ownersOf,
    renderListRow,
    shownBecauseOf,
} from "../panel/list.ts";
import { row, rowDetails, rowSummary } from "../styles.ts";
import type { ListRenderCtx, ListRow } from "../definition/types.ts";

/**
 * A host stand-in, installed before `catalog.ts` is pulled in.
 *
 * `api.ts` reads `sandkit` at module scope, so a dynamic import is the only way
 * to give it a host — the same order the wrapper's own test file uses.
 *
 * The point of the shape: two elements the engine describes (one offering itself
 * in the picker, one saying nothing) and two the engine does not describe at
 * all, which only the mod registry knows about.
 */
globalThis.sandkit = {
    api: {
        elements: {
            getRegisteredTypes: () => [1, 2],
            getDefinitionByType: (t: number) =>
                t === 1
                    ? { id: "sand", nameKey: "sand", density: 1600, visibleInPicker: true }
                    : { id: "void", nameKey: "void", density: 0 },
            getIdByType: (t: number) => (t === 1 ? "sand" : "void"),
        },
    },
    mods: {
        elements: {
            "md:ore": { nameKey: "ore", visibleInPicker: false },
            "md:torch": { nameKey: "torch", visibleInPicker: true },
        },
    },
} as never;

const { discoverElements } = await import("../../catalog.ts");

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
    // The parameter *name* is the thing that must not return. The list has since
    // grown a fifth — `showHidden` — which is not a second *source* filter (it
    // does not ask who owns the row) but an independent third axis: it says
    // whether the object is one you are meant to use at all. So the assertion is
    // that no `origin` returned, and that the parameters are exactly the known
    // set, rather than the old four verbatim.
    const src = Deno.readTextFileSync(new URL("../panel/list.ts", import.meta.url).pathname);
    assert(!/export type OriginFilter/.test(src), "the OriginFilter type came back");
    assert(!/origin: OriginFilter/.test(src), "filterRows takes an origin again");
    const params = /export function filterRows\(([\s\S]*?)\n\):/.exec(src)?.[1] ?? "";
    assertEquals(
        // Comment lines are dropped: a doc comment above a parameter parses as
        // `/** … */` and would read as an extra argument named "Show".
        params
            .split("\n")
            .filter((l) => !l.trim().startsWith("/"))
            // `owner: … = "all"` and `showHidden = false` keep their default; the
            // name is the part under test, so the value is cut at the `=`.
            .map((l) => l.trim().split(/[?:=]/)[0].trim())
            .filter(Boolean),
        ["rows", "text", "searchText", "owner", "showHidden"],
        "filterRows' parameters changed",
    );
});

Deno.test("the hidden filter is independent of the owner filter", () => {
    // A row that is both another mod's *and* hidden needs one rule, not two: it
    // is revealed by the hidden tick alone, and still filtered out by "This mod".
    // The reverse error — treating hidden as an owner — is what the two-parameter
    // shape above exists to prevent.
    const rows: ListRow[] = [
        { id: "a", label: "A", origin: "mod" },
        { id: "b", label: "B", origin: "mod", hidden: true },
        { id: "c", label: "C", origin: "game", hidden: true },
    ];
    assertEquals(filterRows(rows, "", undefined, "all", false).map((r) => r.id), ["a"]);
    assertEquals(filterRows(rows, "", undefined, "all", true).map((r) => r.id), ["a", "b", "c"]);
    assertEquals(filterRows(rows, "", undefined, "own", true).map((r) => r.id), ["a", "b"]);
    assertEquals(countHiddenRows(rows, "own"), 1);
    assertEquals(countHiddenRows(rows, "all"), 2);
});

Deno.test("the categories that have a hidden flag, and what it is called", () => {
    // Elements use `visibleInPicker` — the engine's own field, and *phrased as a
    // positive*, so an element is hidden when it says `false`. Structures and
    // items use `hideFromBuildMenu`, which lives on the **mod registry entry**
    // (`sandkit.mods.structures[id]`) rather than on the engine's
    // `getDefinitionByType` result — that is where `md-admin-structure` reads it,
    // and this mod reuses the same name for items.
    //
    // Terrains have nothing. `isBuilding` means "counts as a built wall", not
    // "kept out of the build menu", so reading it as hidden would hide every
    // plain terrain and show every wall.
    assertEquals(hiddenFieldOf("elements"), "visibleInPicker");
    assertEquals(hiddenFieldOf("structures"), "hideFromBuildMenu");
    assertEquals(hiddenFieldOf("items"), "hideFromBuildMenu");
    assertEquals(hiddenFieldOf("terrains"), undefined);

    const rows = mergeRows(
        [{ id: "t1", isBuilding: true }],
        [],
        "terrains",
    );
    assertEquals(rows[0].hidden, false);
});

Deno.test("an element is hidden when it says visibleInPicker: false", () => {
    // The inversion is the whole point and the easiest thing to get backwards.
    // Read as a plain `=== true`, this would call every ordinary element hidden
    // and leave the list showing nothing until the box is ticked.
    assertEquals(configIsHidden({ visibleInPicker: false }, "elements"), true);
    assertEquals(configIsHidden({ visibleInPicker: true }, "elements"), false);
    // Absent is the engine's own default, so it is *visible*. The engine builds
    // the picker mask from matter type — `visibleInPicker = matterType is not
    // Liquid and not Gas` — and offers everything else unless a
    // `vacuum:element:prepare` modifier says otherwise. Reading absence as
    // hidden inverted that and emptied the list of every solid element.
    assertEquals(configIsHidden({}, "elements"), false);
    // A junk value is not a `false`, so it is not a statement about visibility.
    assertEquals(configIsHidden({ visibleInPicker: "false" }, "elements"), false);

    // The retired `hidden` field still counts, with its own polarity — it was
    // always a direct "yes it is hidden", and flipping it would un-hide every
    // element the flag was ever set on.
    assertEquals(configIsHidden({ hidden: true }, "elements"), true);
    // The live field wins when both are present, which is what makes the two
    // coexisting during a migration safe.
    assertEquals(
        configIsHidden({ hidden: true, visibleInPicker: true }, "elements"),
        false,
    );

    // And it flows through the row, not just the predicate.
    const rows = mergeRows(
        [
            { id: "e1", name: "Ore", visibleInPicker: false },
            { id: "e2", name: "Sand" },
            { id: "e3", name: "Glow", visibleInPicker: true },
        ],
        [],
        "elements",
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assertEquals(byId.e1.hidden, true);
    assertEquals(byId.e2.hidden, false);
    assertEquals(byId.e3.hidden, false);
});

Deno.test("an empty list names the filter that emptied it", () => {
    const rows: ListRow[] = [
        { id: "e1", label: "Ores", origin: "mod" },
        { id: "e2", label: "Slag", origin: "mod", hidden: true },
        { id: "g1", label: "Sand", origin: "game" },
    ];

    // The text filter comes first: it is the only cause the user cannot see.
    assertEquals(
        shownBecauseOf(rows, "own", false, "granite", "Elements"),
        "No elements match “granite” in this view.",
    );

    // No rows of the user's own, but the game's exist — the message must offer
    // the way out rather than implying there is nothing to see at all.
    assertEquals(
        shownBecauseOf([{ id: "g1", label: "Sand", origin: "game" }], "own", false, "", "Elements"),
        "You have no elements in this view. 1 exist — switch the filter to “All” to see them.",
    );

    // The hidden tick is the cause, and it is the one filter that gets a "tick
    // this" instruction rather than a "switch to All". Reachable, and the case
    // where naming the owner filter instead would be a lie: ticking the box does
    // bring the user's own row back.
    assertEquals(
        shownBecauseOf(
            [{ id: "e2", label: "Slag", origin: "mod", hidden: true }],
            "own",
            false,
            "",
            "Elements",
        ),
        "All 1 elements in this view are hidden — tick “hidden” to show them.",
    );
});

Deno.test("the hidden filter and the owner filter do not blame each other", () => {
    // Both can be on and both can contribute. The hidden branch only fires when
    // ticking the box would actually help under the *current* owner filter, so
    // a user narrowed to "This mod" is never told to tick a box that only
    // reveals another mod's objects.
    const rows: ListRow[] = [
        { id: "g1", label: "Sand", origin: "game", hidden: true },
    ];
    assertEquals(
        shownBecauseOf(rows, "own", false, "", "Elements"),
        "All 1 elements here are another mod's and hidden — switch the filter to “All” and tick “hidden”.",
    );

    // A plain other-mod row, with nothing hidden anywhere: "switch to All" is
    // the whole story, so the message must not also ask for the hidden tick.
    assertEquals(
        shownBecauseOf([{ id: "g1", label: "Sand", origin: "game" }], "own", false, "", "Elements"),
        "You have no elements in this view. 1 exist — switch the filter to “All” to see them.",
    );
});

Deno.test("discoverElements reads the mod registry for the flag the engine omits", () => {
    // The engine's `getDefinitionByType` does not return `visibleInPicker` — it
    // is not on the published `ElementDefinition` — so the registry record is
    // the only place the author's own flag can be seen.
    //
    // Tested through the real function against a faked host rather than by
    // reading the engine's type file: the finding is a comment, but the
    // *behaviour* is ours and is what can regress. The host is the module-level
    // stand-in above.
    const rows = discoverElements();
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    // From the engine pass.
    assertEquals(byId.sand.hidden, false);
    // No flag anywhere: the engine's default is visible, so neither does the
    // filter. Absence is not a statement.
    assertEquals(byId.void.hidden, false);
    // Only the registry says so — the whole point of the second pass.
    assertEquals(byId["md:ore"].hidden, true);
    assertEquals(byId["md:torch"].hidden, false);

    // And the filter then behaves, which is what the user sees. Hidden is off by
    // default, so the one flagged element is withheld…
    assertEquals(
        filterRows(rows, "", undefined, "all", false).map((r) => r.id).sort(),
        ["md:torch", "sand", "void"],
    );
    // …and ticking it *adds* the hidden row to the list rather than showing only
    // hidden ones, which is what the chip is for.
    assertEquals(
        filterRows(rows, "", undefined, "all", true).map((r) => r.id).sort(),
        ["md:ore", "md:torch", "sand", "void"],
    );
});

Deno.test("mergeRows reads the hidden flag from the entry that owns it", () => {
    // `e2` says nothing, which is the engine's default, so it stays visible.
    const elements = mergeRows(
        [
            { id: "e1", name: "Ores", visibleInPicker: false },
            { id: "e2", name: "Sand" },
        ],
        [{ id: "e1", label: "Ores" }],
        "elements",
    );
    const byId = Object.fromEntries(elements.map((r) => [r.id, r]));
    assertEquals(byId.e1.hidden, true);
    assertEquals(byId.e2.hidden, false);

    const structures = mergeRows(
        [{ id: "s1", hideFromBuildMenu: true }, { id: "s2" }],
        [],
        "structures",
    );
    const sById = Object.fromEntries(structures.map((r) => [r.id, r]));
    assertEquals(sById.s1.hidden, true);
    assertEquals(sById.s2.hidden, false);

    // Items carry the same flag as structures, so the box works there too.
    const items = mergeRows(
        [{ id: "i1", hideFromBuildMenu: true }, { id: "i2" }],
        [],
        "items",
    );
    const iById = Object.fromEntries(items.map((r) => [r.id, r]));
    assertEquals(iById.i1.hidden, true);
    assertEquals(iById.i2.hidden, false);
});

Deno.test("the briefly-used hiddenFromTheMenu spelling still filters", () => {
    // This mod renamed the flag to `hideFromBuildMenu` and then back again in the
    // same session. A config saved under the interim name must keep behaving as
    // its author intended, rather than quietly becoming unfiltered — that is what
    // HIDDEN_ALIASES is for, and it is only worth having because the mistake
    // happened.
    const rows = mergeRows(
        [{ id: "s1", hiddenFromTheMenu: true }, { id: "s2", hiddenFromTheMenu: false }],
        [],
        "structures",
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assertEquals(byId.s1.hidden, true);
    assertEquals(byId.s2.hidden, false);
});

Deno.test("a detail block shows the curated fields, then everything else", () => {
    // The catch-all is the whole reason this is worth having: a game row now
    // carries the engine's real definition, and a hand-written list of "the
    // fields we know about" is wrong the moment the engine adds one. An unknown
    // field has to appear rather than be dropped for want of a table entry.
    const spec: DetailSpec = {
        fields: [
            { key: "matterType", label: "Matter" },
            { key: "density", label: "Density" },
        ],
        skip: ["elementType"],
    };
    const rows = detailRows(
        { matterType: "Powder", density: 900, elementType: 42, acidDamage: 3 },
        spec,
    );
    // Curated first, in the order asked for, then the leftover alphabetically
    // and humanised — `acidDamage` reads as "Acid Damage", not "acidDamage".
    assertEquals(rows, [
        ["Matter", "Powder"],
        ["Density", "900"],
        ["Acid Damage", "3"],
    ]);
});

Deno.test("a detail block skips a field that has no value", () => {
    // A block of blank rows reads as "there is nothing here", not "these are the
    // fields that apply". A field the object does not have is not a row.
    const spec: DetailSpec = {
        fields: [{ key: "matterType", label: "Matter" }, { key: "density", label: "Density" }],
        skip: [],
    };
    assertEquals(detailRows({ matterType: "Liquid" }, spec), [["Matter", "Liquid"]]);
    assertEquals(detailRows({}, spec), []);
    // `false` is a value, not an absence — a flag that is off is worth showing.
    assertEquals(detailRows({ density: 0 }, spec), [["Density", "0"]]);
});

Deno.test("brief says what a value is, rather than 'set'", () => {
    // The detail is the one place a user checks a value, so a payload printed as
    // "set" is a field they cannot read at all.
    assertEquals(brief(true), "yes");
    assertEquals(brief(false), "no");
    assertEquals(brief(3), "3");
    assertEquals(brief(1.5), "1.50");
    // A short list of primitives is a fact: "horizontal, vertical" beats
    // "2 entries" for a build mode list.
    assertEquals(brief(["horizontal", "vertical"]), "horizontal, vertical");
    assertEquals(brief([]), "none");
    // A long one is a count, because reading it out helps nobody.
    assertEquals(brief([1, 2, 3, 4, 5]), "5 entries");
    // A small record reads out; that is the shape of most engine payloads.
    assertEquals(brief({ field1: 20, field2: 4 }), "field1: 20, field2: 4");
    assertEquals(brief({}), "set");
    // An identifying key wins over the container's shape.
    assertEquals(brief({ id: "md:ore", weight: 3 }), "md:ore");
});

Deno.test("the list and the per-field selector agree about what is hidden", () => {
    // They used to compute this separately — the selector testing the field
    // inline, the list going through `HIDDEN_FIELD` — and drifted, so an object
    // the list called hidden was offered as ordinary in a picker. Both now call
    // `configIsHidden`, and this asserts they still answer the same for a
    // structure saved under either spelling.
    assertEquals(configIsHidden({ hideFromBuildMenu: true }, "structures"), true);
    assertEquals(configIsHidden({ hiddenFromTheMenu: true }, "structures"), true);
    assertEquals(configIsHidden({}, "structures"), false);
    // Elements keep the engine's own field, which the selector also reads
    // directly off a registered definition.
    assertEquals(configIsHidden({ hidden: true }, "elements"), true);
    // And items share the structure spelling.
    assertEquals(configIsHidden({ hideFromBuildMenu: true }, "items"), true);
    // Terrains have no such concept at all.
    assertEquals(configIsHidden({ hidden: true }, "terrains"), false);
});

Deno.test("a game row's hidden flag survives the merge", () => {
    // THE BUG. `discoverElements` reads `def.hidden` off the engine and sets it
    // on the native object, and `mergeRows` then dropped it — so every *game*
    // element came back unflagged and ticking "hidden" revealed nothing. The
    // only rows the filter could ever affect were the mod's own.
    const rows = mergeRows(
        [],
        [
            { id: "g1", label: "Hidden one", hidden: true },
            { id: "g2", label: "Normal one" },
        ],
        "elements",
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assertEquals(byId.g1.hidden, true);
    assertEquals(byId.g2.hidden, false);
    assertEquals(
        filterRows(rows, "", undefined, "all", false).map((r) => r.id),
        ["g2"],
    );
});

Deno.test("a mod entry that omits the flag does not unhide a game object", () => {
    // "Absent" is not a decision. A mod that redeclares an engine object without
    // mentioning the flag has not opted it out of being hidden.
    //
    // Structures, where the field is direct: omitting `hideFromBuildMenu` leaves
    // the registry's own `true` standing.
    const structures = mergeRows(
        [{ id: "s1", name: "Renamed by the mod" }],
        [{ id: "s1", label: "Hidden one", hidden: true }],
        "structures",
    );
    assertEquals(structures[0].hidden, true);

    // An explicit false is a decision, and wins.
    const cleared = mergeRows(
        [{ id: "s1", name: "Renamed", hideFromBuildMenu: false }],
        [{ id: "s1", label: "Hidden one", hidden: true }],
        "structures",
    );
    assertEquals(cleared[0].hidden, false);

    // Elements, where the field is inverted: hiding is `visibleInPicker: false`,
    // so *unhiding* is the one that says `true`. Omitting it leaves the engine's
    // `false` in place, and saying `true` is how a mod makes it visible again.
    //
    // The natives here carry `hidden` rather than a raw `visibleInPicker`,
    // because that is what `discoverElements` hands over: it reads the engine's
    // definition and sets the flag through the same `configIsHidden` the list
    // uses, so a raw definition never reaches `mergeRows`.
    const elements = mergeRows(
        [{ id: "e1", name: "Renamed by the mod" }],
        [{ id: "e1", label: "Hidden one", hidden: true }],
        "elements",
    );
    assertEquals(elements[0].hidden, true);

    const shown = mergeRows(
        [{ id: "e1", name: "Renamed", visibleInPicker: true }],
        [{ id: "e1", label: "Hidden one", hidden: true }],
        "elements",
    );
    assertEquals(shown[0].hidden, false);
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
