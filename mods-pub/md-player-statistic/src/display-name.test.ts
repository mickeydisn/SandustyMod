/**
 * Numeric structure/item types must read as names, not as bare numbers.
 *
 * `building:placed` and `item:used` report a built-in's runtime type value, so
 * the buffer legitimately holds `"8"`. What the panel must not do is render that
 * number. The enum tables here are the real shapes: `StructureType` and `ItemId`
 * are both name→number with **no** reverse map, which is the whole reason a
 * scan is needed.
 *
 * `@sandmd/ui` reads `sandkit` at module load, so the stub has to be in place
 * before the import — hence the dynamic import below.
 */
// @ts-nocheck: the stub is a partial `sandkit` global with deliberately loose
// shapes; type-checking it would assert against APIs this file never touches.
import { assert, assertEquals } from "jsr:@std/assert@1";

// Selection helpers live in `@sandmd/ui`, whose `api.ts` captures `sandkit.api`
// as it evaluates. That import therefore has to happen *after* the stub below
// and not before it, or `api` binds to an empty object and the definition
// lookups in `displayNameFor` silently return undefined.

const ENUMS = {
    // Trimmed but shape-accurate: numeric, name→value, no reverse map.
    StructureType: { ConveyorLeft: 1, ConveyorRight: 2, Foundation: 11 },
    ItemId: { Shovel: 1, Grabber: 2, GrapplingHook: 4, RocketLauncher: 8, MegaShotgun: 16 },
};

/**
 * A name the host *does* know for a numeric id, applied only to the test that
 * asks for it. Scoped rather than always-on, because the enum fallback is the
 * path most rows actually take and must be exercised on its own.
 */
let namedDefinitions: Record<string, { name?: string }> = {};

globalThis.sandkit = {
    api: {
        structures: {
            getDefinitionByType: (t: number) => namedDefinitions[`${t}:definition`],
        },
        items: {
            getDefinitionById: (id: number) => namedDefinitions[`${id}:definition`],
        },
    },
    enums: ENUMS,
};

const { displayNameFor } = await import("./events.ts");
const { defaultTopIds, resolveSelection, toggleSelection } = await import("@sandmd/ui");

Deno.test("a numeric item type reads as its name", () => {
    // Grabber is ItemId 2. Before this, the row read "2".
    assertEquals(displayNameFor("items_used", "2"), "Grabber");
    assertEquals(displayNameFor("items_used", "8"), "Rocket Launcher");
});

Deno.test("a numeric structure type reads as its name", () => {
    // Humanised, not pasted: the enum member is `ConveyorLeft`.
    assertEquals(displayNameFor("structures_placed", "1"), "Conveyor Left");
    assertEquals(displayNameFor("structures_placed", "11"), "Foundation");
});

Deno.test("every structures_ category resolves, not just placed", () => {
    // The guard is `startsWith("structures_")`, so removed/moved must be covered
    // too — or a demolished conveyor would still show a bare number.
    for (const cat of ["structures_placed", "structures_removed", "structures_moved"]) {
        assertEquals(displayNameFor(cat, "1"), "Conveyor Left", cat);
    }
});

Deno.test("a registered name beats the enum member name", () => {
    namedDefinitions = { "2:definition": { name: "Magnetic Grip" } };
    try {
        // The host may know a real name for a numeric id; when it does, that is
        // the better label and the enum is only a fallback.
        assertEquals(displayNameFor("items_used", "2"), "Magnetic Grip");
    } finally {
        namedDefinitions = {};
    }
});

Deno.test("a mod id is never renamed", () => {
    assertEquals(displayNameFor("structures_placed", "mdmy.furnace"), "mdmy.furnace");
    assertEquals(displayNameFor("items_used", "mdmy.probe"), "mdmy.probe");
});

Deno.test("a number no enum member explains falls back to itself", () => {
    // Inventing a name for 999 would be worse than showing 999, which at least
    // cannot be mistaken for a real tool.
    assertEquals(displayNameFor("items_used", "999"), "999");
    assertEquals(displayNameFor("structures_placed", "999"), "999");
});

Deno.test("terrain is left exactly as stored", () => {
    // Terrain is resolved at record time by `terrainName`, so its keys are
    // already names. Re-running them through here must be a no-op.
    assertEquals(displayNameFor("terrain_destroyed", "Stone"), "Stone");
    assertEquals(displayNameFor("terrain_destroyed", "12"), "12");
});

Deno.test("an unrelated category is not touched", () => {
    assertEquals(displayNameFor("keys_pressed", "KeyW"), "KeyW");
    assertEquals(displayNameFor("distance_walked", "42"), "42");
});

/**
 * Graph series selection.
 *
 * The solo button sets the selection to a single id. These pin the two
 * properties that make that work: the lone id survives resolution, and
 * ticking afterwards widens it again rather than staying stuck on one.
 */
const ROWS = [
    { id: "gold", count: 30 },
    { id: "stone", count: 20 },
    { id: "dirt", count: 10 },
    { id: "sand", count: 5 },
];

Deno.test("a fresh tab defaults to the top 3", () => {
    assertEquals(resolveSelection([], ROWS, 3), ["gold", "stone", "dirt"]);
});

Deno.test("solo survives resolveSelection", () => {
    // This is the whole point of solo: an empty selection would be replaced by
    // the top-3 default, so a lone id must never be dropped back to three.
    assertEquals(resolveSelection(["stone"], ROWS, 3), ["stone"]);
});

Deno.test("ticking after solo widens the selection again", () => {
    const soloed = ["stone"];
    assertEquals(toggleSelection(soloed, "gold", ROWS, 3), ["stone", "gold"]);
});

Deno.test("unticking the soloed row returns to the top-3 default", () => {
    // Consistent with the checkbox's existing behaviour rather than going blank.
    assertEquals(toggleSelection(["stone"], "stone", ROWS, 3), []);
    assertEquals(resolveSelection([], ROWS, 3), defaultTopIds(ROWS, 3));
});

/**
 * The default Home cards.
 *
 * These are the *first* thing a new player sees, and a card is the only view a
 * category gets when no tab shows it — so a card accidentally dropped here is a
 * whole statistic that becomes invisible, with no error anywhere.
 */
globalThis.sandkit.api.storage = {
    get: () => undefined,
    set: () => {},
    remove: () => {},
};

const { defaultCards } = await import("./buffer.ts");

Deno.test("every default card names a real category", async () => {
    const { KPI_CATEGORIES } = await import("./constants.ts");
    const known = new Set(KPI_CATEGORIES.map((c) => c.id));
    for (const card of defaultCards()) {
        for (const item of card.items) {
            // `withoutDeadCategories` would silently drop an unknown one, so this
            // guards against a typo'd category being written here.
            assert(known.has(item.category as never), `${card.id}: ${item.category}`);
        }
    }
});

Deno.test("there is an Items card, and no Loot card", () => {
    const cards = defaultCards();
    const items = cards.find((c) => c.id === "card-items");
    assert(items, "no card-items in the defaults");
    assertEquals(items!.items.map((i) => i.category), ["items_used"]);
    assert(
        !cards.some((c) => c.id === "card-loot"),
        "card-loot is back; it was removed deliberately",
    );
});

Deno.test("card ids stay unique", () => {
    // `state.cards` is edited by index and saved by id, so a duplicate id would
    // make one card unreachable in the editor.
    const ids = defaultCards().map((c) => c.id);
    assertEquals(new Set(ids).size, ids.length, `duplicate card id in ${ids.join(", ")}`);
});

Deno.test("no card is empty", () => {
    for (const card of defaultCards()) {
        assert(card.items.length > 0, `${card.id} has no items`);
    }
});
