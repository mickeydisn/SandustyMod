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
    ProjectileType: {
        Bullet: 1,
        Rocket: 2,
        GrapplingHook: 3,
        Fire: 4,
        Digger: 5,
        Mod: 6,
    },
    ActionType: { Weapon: 1, Building: 2, Tool: 3, Mod: 4 },
};

/**
 * A name the host *does* know for a numeric id, applied only to the test that
 * asks for it. Scoped rather than always-on, because the enum fallback is the
 * path most rows actually take and must be exercised on its own.
 */
let namedDefinitions: Record<string, { name?: string }> = {};

/**
 * Item definitions keyed by their **string** id, which is what the `item:use`
 * hook actually reports — and the game's own translations for those
 * `nameKey`s. `i18n.t` echoes an unknown key back, exactly as the host does.
 */
const ITEM_DEFS: Record<string, { nameKey?: string; name?: string }> = {
    laser: { nameKey: "items|laser|name" },
    drill: { nameKey: "items|drill|name" },
    "md-excavated-all:tool": { nameKey: "mods|excavatedAll|tool|name" },
};

const I18N: Record<string, string> = {
    "items|laser|name": "Laser",
    "items|drill|name": "Drill",
    "mods|excavatedAll|tool|name": "Total Excavator",
};

globalThis.sandkit = {
    api: {
        structures: {
            getDefinitionByType: (t: number) => namedDefinitions[`${t}:definition`],
        },
        items: {
            // Real lookups are by string id; the numeric form is kept so the
            // legacy-row path stays covered.
            getDefinitionById: (id: string | number) =>
                ITEM_DEFS[id as string] ?? namedDefinitions[`${id}:definition`],
        },
        i18n: {
            t: (key: string) => I18N[key] ?? key,
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

/**
 * Item rows are keyed by the **string** id the `item:use` hook reports, so the
 * numeric `ItemId` path above only ever sees rows written before that was true.
 * These pin the path real data actually takes.
 */
Deno.test("a registered item id reads as its game name", () => {
    assertEquals(displayNameFor("items_used", "laser"), "Laser");
    assertEquals(displayNameFor("items_used", "drill"), "Drill");
});

Deno.test("a mod item id resolves through its own nameKey", () => {
    // `<modId>:<localId>` is the id; the mod's registered translation is the
    // label, which is the only way a modded tool ever gets a readable name.
    assertEquals(displayNameFor("items_used", "md-excavated-all:tool"), "Total Excavator");
});

Deno.test("an unregistered item id stays as itself", () => {
    // The owning mod is disabled or the id was never registered. Inventing a
    // name from the id would be a guess; the raw id at least cannot be wrong.
    assertEquals(displayNameFor("items_used", "someGoneMod:tool"), "someGoneMod:tool");
    assertEquals(displayNameFor("items_used", "flashlight"), "flashlight");
});

Deno.test("an untranslated nameKey is not shown as a key", () => {
    // `i18n.t` echoes an unknown key back. Rendering that would put
    // "items|…|name" in the list, which is worse than the id.
    ITEM_DEFS.untranslated = { nameKey: "items|untranslated|name" };
    try {
        assertEquals(displayNameFor("items_used", "untranslated"), "untranslated");
    } finally {
        delete ITEM_DEFS.untranslated;
    }
});

/**
 * Shoot tab.
 *
 * Both projectile categories are keyed by `projectile.type`, which is the
 * numeric `ProjectileType` enum — so both need the same reverse-scan the other
 * numeric categories use, or every row reads as a bare number.
 */
Deno.test("a projectile type reads as its name on both shoot categories", () => {
    for (const cat of ["projectiles_hit", "projectile_fire_structure"]) {
        assertEquals(displayNameFor(cat, "1"), "Bullet", cat);
        assertEquals(displayNameFor(cat, "2"), "Rocket", cat);
        assertEquals(displayNameFor(cat, "3"), "Grappling Hook", cat);
        assertEquals(displayNameFor(cat, "4"), "Fire", cat);
        assertEquals(displayNameFor(cat, "5"), "Digger", cat);
    }
});

Deno.test("an unknown projectile type falls back to its number", () => {
    assertEquals(displayNameFor("projectiles_hit", "99"), "99");
    assertEquals(displayNameFor("projectile_fire_structure", "99"), "99");
});

Deno.test("ItemId is not used to name projectiles", () => {
    // Both enums start at 1 and overlap (Bullet=1 vs Shovel=1). Resolving a
    // projectile through `ItemId` would silently report "Shovel" for a bullet.
    assertEquals(displayNameFor("projectiles_hit", "1"), "Bullet");
    assertEquals(displayNameFor("items_used", "1"), "Shovel");
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

Deno.test("there is a Shoot card covering both projectile counters", () => {
    // The Shoot tab is the only breakdown by projectile type; without a card
    // the two categories would still be reachable, but a new player would have
    // no reason to think the Shoot tab is backed by a Home card too.
    const shoot = defaultCards().find((c) => c.id === "card-shoot");
    assert(shoot, "no card-shoot in the defaults");
    assertEquals(shoot!.items.map((i) => i.category), [
        "projectiles_hit",
        "projectile_fire_structure",
    ]);
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
