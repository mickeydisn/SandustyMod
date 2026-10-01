import { assertEquals } from "jsr:@std/assert@1";
import type { Opt } from "../../../../catalog.ts";
import {
    applyChoice,
    classifyId,
    countByOwner,
    countHidden,
    filterByOwner,
    filterByText,
    filterHidden,
    orphans,
    otherMods,
    toSelectorItems,
} from "./selector-state.ts";

const o = (value: string, extra: Partial<Opt> = {}): Opt => ({
    value,
    label: value,
    ...extra,
});


const MIX: Opt[] = [
    o("mdmy.ores", { source: "mod", color: "#ff8800" }),
    o("mdmy.sand", { source: "mod" }),
    o("Sand", { source: "game" }),
    o("Furnace", { source: "game" }),
    o("othermod.anvil", { source: "game" }),
];

Deno.test("classifyId reads this mod's own prefix", () => {
    assertEquals(classifyId("mdmy.ores"), { own: true, modId: "mdmy" });
});

Deno.test("an unnamespaced id is the game's, never a mod called Sand", () => {
    
    assertEquals(classifyId("Sand"), { own: false });
});

Deno.test("another mod's id is attributed to that mod", () => {
    assertEquals(classifyId("othermod.anvil"), { own: false, modId: "othermod" });
});

Deno.test("a leading dot is not a namespace", () => {
    assertEquals(classifyId(".leading"), { own: false });
});

Deno.test("a mod entry is own even under an unnamespaced id", () => {
    
    const items = toSelectorItems([o("slab", { source: "mod" })]);
    assertEquals(items[0].own, true);
});

Deno.test("the default filter is this mod only", () => {
    assertEquals(
        filterByOwner(toSelectorItems(MIX), "own").map((i) => i.value),
        ["mdmy.ores", "mdmy.sand"],
    );
});

Deno.test("the game filter keeps built-ins and drops other mods", () => {
    assertEquals(
        filterByOwner(toSelectorItems(MIX), "game").map((i) => i.value),
        ["Sand", "Furnace"],
    );
});

Deno.test("the all filter keeps every owner", () => {
    assertEquals(filterByOwner(toSelectorItems(MIX), "all").length, 5);
});

Deno.test("counts partition the list so the chips can never lie", () => {
    const c = countByOwner(toSelectorItems(MIX));
    assertEquals(c, { own: 2, game: 2, all: 5 });
});

Deno.test("search is substring over id and label", () => {
    const items = toSelectorItems([o("mdmy.ores", { label: "Red Ore" })]);
    
    assertEquals(filterByText(items, "ores").map((i) => i.value), ["mdmy.ores"]);
    assertEquals(filterByText(items, "red").map((i) => i.value), ["mdmy.ores"]);
    assertEquals(filterByText(items, "zzz").length, 0);
});

Deno.test("an empty search keeps everything", () => {
    assertEquals(filterByText(toSelectorItems(MIX), "   ").length, 5);
});

Deno.test("a single choice replaces rather than accumulates", () => {
    assertEquals(applyChoice(["mdmy.sand"], "mdmy.ores", false, []), ["mdmy.ores"]);
});

Deno.test("a multiple choice toggles off when already chosen", () => {
    const order = ["mdmy.ores", "mdmy.sand"];
    assertEquals(applyChoice(["mdmy.ores"], "mdmy.ores", true, order), []);
});

Deno.test("a multiple choice keeps catalogue order, not click order", () => {
    const order = ["mdmy.ores", "mdmy.sand"];
    
    assertEquals(applyChoice(["mdmy.sand"], "mdmy.ores", true, order), [
        "mdmy.ores",
        "mdmy.sand",
    ]);
});

Deno.test("a value the catalogue dropped is reported, not hidden", () => {
    const items = toSelectorItems(MIX);
    assertEquals(orphans(["Sand", "gone.anvil"], items), ["gone.anvil"]);
});

Deno.test("the none sentinel is not an orphan", () => {
    assertEquals(orphans(["__none__"], toSelectorItems(MIX)), []);
});

Deno.test("other mods are listed once, alphabetically", () => {
    const items = toSelectorItems([
        ...MIX,
        o("zeta.mod", { source: "game" }),
        o("alpha.mod", { source: "game" }),
        o("zeta.mod2", { source: "game" }),
    ]);
    assertEquals(otherMods(items), ["alpha", "othermod", "zeta"]);
});

Deno.test("swatch colour survives the mapping", () => {
    assertEquals(toSelectorItems([o("mdmy.ores", { color: "#ff8800" })])[0].color, "#ff8800");
});









const HIDDEN: Opt[] = [
    o("Sand", { source: "game" }),
    o("InternalPtr", { source: "game", hidden: true }),
    o("mdmy.ores", { source: "mod" }),
    o("mdmy.secret", { source: "mod", hidden: true }),
];

Deno.test("hidden objects are carried, not dropped", () => {
    
    assertEquals(toSelectorItems(HIDDEN).length, 4);
    assertEquals(toSelectorItems(HIDDEN).filter((i) => i.hidden).length, 2);
});

Deno.test("hidden objects are filtered out by default", () => {
    assertEquals(
        filterHidden(toSelectorItems(HIDDEN), false).map((i) => i.value),
        ["Sand", "mdmy.ores"],
    );
});

Deno.test("ticking the box brings them all back", () => {
    assertEquals(filterHidden(toSelectorItems(HIDDEN), true).length, 4);
});

Deno.test("the hidden count is what the checkbox says", () => {
    assertEquals(countHidden(toSelectorItems(HIDDEN)), 2);
});

Deno.test("an option with no flag is not hidden", () => {
    
    assertEquals(toSelectorItems([o("Sand")])[0].hidden, false);
});

Deno.test("the mod's own hidden element is filtered by the same rule", () => {
    
    
    const own = toSelectorItems(HIDDEN).filter((i) => i.own);
    assertEquals(filterHidden(own, false).map((i) => i.value), ["mdmy.ores"]);
});

Deno.test("hidden filtering is independent of the owner filter", () => {
    const items = toSelectorItems(HIDDEN);
    assertEquals(
        filterHidden(filterByOwner(items, "all"), false).map((i) => i.value),
        ["Sand", "mdmy.ores"],
    );
});
