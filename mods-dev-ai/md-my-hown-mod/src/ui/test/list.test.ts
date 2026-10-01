

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



Deno.test("an object the mod declares and the game also has is one row, not two", () => {
    const rows = mergeRows(
        [{ id: "mdmy.ore", name: "My Ore", matterType: "powder" }],
        [{ id: "mdmy.ore", label: "My Ore", origin: "game", native: { density: 900 } }],
    );
    assertEquals(rows.length, 1, "the same object appeared twice");
    
    assertEquals(rows[0].origin, "mod");
    assertEquals(rows[0].entry?.id, "mdmy.ore");
    
    
    
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
    
    const rows = mergeRows(
        [{ id: "mdmy.ore", name: "Shiny Ore" }],
        [{ id: "mdmy.ore", label: "Registered Ore", origin: "game" }],
    );
    assertEquals(rows[0].label, "Shiny Ore");
});

Deno.test("the mod's own rows sort first, each group alphabetical", () => {
    
    
    
    
    
    
    
    
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
    
    
    assertEquals(filterRows(MIXED, "", undefined, "OWN").length, 0);
    assertEquals(filterRows(MIXED, "", undefined, "own").length, 2);
});

Deno.test("text matching reaches the id, not just the label", () => {
    
    
    
    assertEquals(filterRows(MIXED, "mdmy.").length, 2);
});

Deno.test("text matching is a substring, so a partial id still finds the row", () => {
    
    assertEquals(filterRows(MIXED, "glass").map((r) => r.id), ["mdmy.glass"]);
});

Deno.test("text matching ignores case", () => {
    assertEquals(filterRows(MIXED, "SAND").map((r) => r.id), ["Sand"]);
});

Deno.test("text and origin compose rather than overriding each other", () => {
    
    assertEquals(filterRows(MIXED, "g", undefined, "own").map((r) => r.id), ["mdmy.glass"]);
});

Deno.test("a definition's extra search text is matched", () => {
    
    
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
    
    
    
    assertEquals(filterRows(MIXED, "zzzz"), []);
});

Deno.test("whitespace-only text is not a filter", () => {
    
    
    assertEquals(filterRows(MIXED, "   ").length, 4);
});

Deno.test("the counts add up to the number of rows", () => {
    
    
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



const row = (id: string, origin: "mod" | "game" = "game") => ({ id, label: id, origin }) as const;

Deno.test("an id with no dot is the game's, not a mod called that", () => {
    
    
    assertEquals(modOf(row("Sand")), { own: false });
    assertEquals(ownerOf(row("Sand")), "game");
});

Deno.test("the prefix before the first dot is the mod", () => {
    assertEquals(modOf(row("otherA.furnace")), { modId: "otherA", own: false });
    assertEquals(ownerOf(row("otherA.furnace")), "mod:otherA");
    
    assertEquals(modOf(row("otherA.big.furnace")), { modId: "otherA", own: false });
});

Deno.test("this mod's own short prefix is recognised, not filed as another mod", () => {
    
    
    
    assertEquals(ownerOf(row("mdmy.ores", "mod")), "own");
    assertEquals(modOf(row("mdmy.ores")).own, true);
    assertEquals(modOf(row("md-my-hown-mod.thing")).own, true);
});

Deno.test("a row in the mod's config is this mod's regardless of its id", () => {
    
    
    assertEquals(ownerOf(row("UnnamespacedThing", "mod")), "own");
});

Deno.test("a leading dot is not a mod id", () => {
    
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
    
    
    assertEquals(ownerLabel("own"), "This mod");
    assertEquals(ownerLabel("game"), "Game");
    assertEquals(ownerLabel("mod:otherA"), "otherA");
});

Deno.test("the list has one source filter, not two", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const src = Deno.readTextFileSync(new URL("../panel/list.ts", import.meta.url).pathname);
    assert(!/export type OriginFilter/.test(src), "the OriginFilter type came back");
    assert(!/origin: OriginFilter/.test(src), "filterRows takes an origin again");
    const params = /export function filterRows\(([\s\S]*?)\n\):/.exec(src)?.[1] ?? "";
    assertEquals(
        
        
        params
            .split("\n")
            .filter((l) => !l.trim().startsWith("/"))
            
            
            .map((l) => l.trim().split(/[?:=]/)[0].trim())
            .filter(Boolean),
        ["rows", "text", "searchText", "owner", "showHidden"],
        "filterRows' parameters changed",
    );
});

Deno.test("the hidden filter is independent of the owner filter", () => {
    
    
    
    
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
    
    
    
    assertEquals(configIsHidden({ visibleInPicker: false }, "elements"), true);
    assertEquals(configIsHidden({ visibleInPicker: true }, "elements"), false);
    
    
    
    
    
    assertEquals(configIsHidden({}, "elements"), false);
    
    assertEquals(configIsHidden({ visibleInPicker: "false" }, "elements"), false);

    
    
    
    assertEquals(configIsHidden({ hidden: true }, "elements"), false);
    
    assertEquals(
        configIsHidden({ hidden: true, visibleInPicker: true }, "elements"),
        false,
    );

    
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

    
    assertEquals(
        shownBecauseOf(rows, "own", false, "granite", "Elements"),
        "No elements match “granite” in this view.",
    );

    
    
    assertEquals(
        shownBecauseOf([{ id: "g1", label: "Sand", origin: "game" }], "own", false, "", "Elements"),
        "You have no elements in this view. 1 exist — switch the filter to “All” to see them.",
    );

    
    
    
    
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
    
    
    
    
    const rows: ListRow[] = [
        { id: "g1", label: "Sand", origin: "game", hidden: true },
    ];
    assertEquals(
        shownBecauseOf(rows, "own", false, "", "Elements"),
        "All 1 elements here are another mod's and hidden — switch the filter to “All” and tick “hidden”.",
    );

    
    
    assertEquals(
        shownBecauseOf([{ id: "g1", label: "Sand", origin: "game" }], "own", false, "", "Elements"),
        "You have no elements in this view. 1 exist — switch the filter to “All” to see them.",
    );
});

Deno.test("discoverElements reads the mod registry for the flag the engine omits", () => {
    
    
    
    
    
    
    
    
    const rows = discoverElements();
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    
    assertEquals(byId.sand.hidden, false);
    
    
    assertEquals(byId.void.hidden, false);
    
    assertEquals(byId["md:ore"].hidden, true);
    assertEquals(byId["md:torch"].hidden, false);

    
    
    assertEquals(
        filterRows(rows, "", undefined, "all", false).map((r) => r.id).sort(),
        ["md:torch", "sand", "void"],
    );
    
    
    assertEquals(
        filterRows(rows, "", undefined, "all", true).map((r) => r.id).sort(),
        ["md:ore", "md:torch", "sand", "void"],
    );
});

Deno.test("mergeRows reads the hidden flag from the entry that owns it", () => {
    
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

    
    const items = mergeRows(
        [{ id: "i1", hideFromBuildMenu: true }, { id: "i2" }],
        [],
        "items",
    );
    const iById = Object.fromEntries(items.map((r) => [r.id, r]));
    assertEquals(iById.i1.hidden, true);
    assertEquals(iById.i2.hidden, false);
});

Deno.test("the briefly-used hiddenFromTheMenu spelling no longer filters", () => {
    
    
    
    
    
    const rows = mergeRows(
        [{ id: "s1", hiddenFromTheMenu: true }, { id: "s2", hiddenFromTheMenu: false }],
        [],
        "structures",
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assertEquals(byId.s1.hidden, false, "a retired spelling is not a visibility flag");
    
    const live = mergeRows([{ id: "s1", hideFromBuildMenu: true }], [], "structures");
    assertEquals(live[0].hidden, true);
});

Deno.test("a detail block shows the curated fields, then everything else", () => {
    
    
    
    
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
    
    
    assertEquals(rows, [
        ["Matter", "Powder"],
        ["Density", "900"],
        ["Acid Damage", "3"],
    ]);
});

Deno.test("a detail block skips a field that has no value", () => {
    
    
    const spec: DetailSpec = {
        fields: [{ key: "matterType", label: "Matter" }, { key: "density", label: "Density" }],
        skip: [],
    };
    assertEquals(detailRows({ matterType: "Liquid" }, spec), [["Matter", "Liquid"]]);
    assertEquals(detailRows({}, spec), []);
    
    assertEquals(detailRows({ density: 0 }, spec), [["Density", "0"]]);
});

Deno.test("brief says what a value is, rather than 'set'", () => {
    
    
    assertEquals(brief(true), "yes");
    assertEquals(brief(false), "no");
    assertEquals(brief(3), "3");
    assertEquals(brief(1.5), "1.50");
    
    
    assertEquals(brief(["horizontal", "vertical"]), "horizontal, vertical");
    assertEquals(brief([]), "none");
    
    assertEquals(brief([1, 2, 3, 4, 5]), "5 entries");
    
    assertEquals(brief({ field1: 20, field2: 4 }), "field1: 20, field2: 4");
    assertEquals(brief({}), "set");
    
    assertEquals(brief({ id: "md:ore", weight: 3 }), "md:ore");
});

Deno.test("the list and the per-field selector agree about what is hidden", () => {
    
    
    
    
    
    assertEquals(configIsHidden({ hideFromBuildMenu: true }, "structures"), true);
    assertEquals(configIsHidden({}, "structures"), false);
    
    
    assertEquals(configIsHidden({ visibleInPicker: false }, "elements"), true);
    
    assertEquals(configIsHidden({ hideFromBuildMenu: true }, "items"), true);
    
    assertEquals(configIsHidden({ hidden: true }, "terrains"), false);
});

Deno.test("a game row's hidden flag survives the merge", () => {
    
    
    
    
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
    
    
    
    
    
    const structures = mergeRows(
        [{ id: "s1", name: "Renamed by the mod" }],
        [{ id: "s1", label: "Hidden one", hidden: true }],
        "structures",
    );
    assertEquals(structures[0].hidden, true);

    
    const cleared = mergeRows(
        [{ id: "s1", name: "Renamed", hideFromBuildMenu: false }],
        [{ id: "s1", label: "Hidden one", hidden: true }],
        "structures",
    );
    assertEquals(cleared[0].hidden, false);

    
    
    
    
    
    
    
    
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
    
    assertEquals(filterRows(rows, "").length, 3);
});

Deno.test("the panel draws no second filter row", () => {
    
    
    const panel = Deno.readTextFileSync(new URL("../panel.ts", import.meta.url).pathname);
    for (const gone of ['chip("all"', 'chip("mod"', 'chip("game"', "listOrigin"]) {
        assert(!panel.includes(gone), `panel.ts still has ${gone}`);
    }
});

Deno.test("the panel no longer draws an 'in the game already' section", () => {
    
    
    
    
    
    
    const panel = Deno.readTextFileSync(new URL("../panel.ts", import.meta.url).pathname);
    const asCode = panel
        .split("\n")
        .filter((l) => !l.trim().startsWith("
        .join("\n");
    assert(!asCode.includes("in the game already"), "the section is still rendered");
    assert(!asCode.includes("panelNatives"), "panelNatives is still called");
});

Deno.test("the list screen's 'N in config' count reads the owner tally", () => {
    
    
    const panel = Deno.readTextFileSync(new URL("../panel.ts", import.meta.url).pathname);
    assert(!panel.includes("countByOrigin"), "panel.ts still keeps a second tally");
    assert(panel.includes('ownerCounts.get("own")'), "the header count has no source");
});










function tree() {
    const h = (...a: unknown[]) => ({ tag: a[0], props: (a[1] ?? {}) as never, kids: a.slice(2) });
    return h;
}


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
    
    
    const node = renderListRow(CTX(), {}) as { kids: unknown[] };
    const summary = node.kids[0] as { kids: unknown[] };
    assertEquals(tags(summary).filter((t) => t === "button").length, 0);
});

Deno.test("a collapsed row renders no detail, an open one does", () => {
    
    
    const count = (n: unknown) => tags(n).length;
    const closed = count(renderListRow(CTX(), {}));
    const open = count(renderListRow(CTX({ expanded: true }), {}));
    assert(open > closed, "expanding a row added nothing to the tree");
});

Deno.test("the row is a column, so the detail sits under the line and not beside it", () => {
    
    
    
    assertEquals(rowDetails.flexDirection, "column");
    assertEquals(rowDetails.alignItems, "stretch");
    
    assertEquals(row.flexDirection, undefined, "S.row is shared and must stay a row");
});

Deno.test("the summary is a full-width click target, not just the text", () => {
    assertEquals(rowSummary.cursor, "pointer");
    assertEquals(rowSummary.display, "flex");
    assert(rowSummary.padding !== undefined, "the summary has no hit area to click");
    
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
