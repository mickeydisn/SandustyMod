/**
 * The reference lists: which ids they offer, and which they refuse to invent.
 *
 * These lists were wrong in a way no type test could catch. The enum maps a
 * *display name* to a *number*, and the config layer wants an **id** — a third
 * thing, handed out only by `getIdByType` / `getDefinitionByType`. The old code
 * stored the display name as the id, so the pickers offered ids the engine
 * cannot resolve. The tests below stand up a fake registry with the shape the
 * real one has, so the distinction is exercised rather than assumed.
 */
// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";

/** The shape `getRegisteredTypes` / `getDefinitionByType` / `getIdByType` have. */
const REGISTRY = {
    Sand: { type: 1, id: "Sand", name: "Sand" },
    Water: { type: 2, id: "Water", name: "Water" },
    // The game keeps internal types around that a recipe should not name.
    ResolvedPointer: { type: 90, id: "_resolved", name: "Resolved", hidden: true },
    InternalHelper: { type: 91, id: "_helper", name: "Helper", hidden: true },
    // No definition reachable — the enum fallback has to cover this one.
    Steam: { type: 3, id: "Steam", name: "Steam", noDefinition: true },
};

// One object under the `config` key, matching `config/store.ts`. Split across
// per-category keys it would read as empty, and every "this mod's own X" test
// would pass vacuously.
const storedConfig = {
    version: 1,
    elements: [{ id: "mdmy.acid", name: "Acid", metaColor: 0x88ff44 }],
    items: [],
    terrains: [{ id: "mdmy.ores", name: "Ore vein" }],
};
const store: Record<string, unknown> = { config: storedConfig };

globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (_m: string, k: string) => store[k],
            set: (_m: string, k: string, v: unknown) => {
                store[k] = v;
            },
            remove: (_m: string, k: string) => {
                delete store[k];
            },
        },
        ui: { toast: () => {} },
        elements: {
            list: () => [],
            register: () => {},
            getRegisteredTypes: () => Object.values(REGISTRY).map((e) => e.type),
            getDefinitionByType: (t: number) => {
                const e = Object.values(REGISTRY).find((x) => x.type === t);
                if (!e || e.noDefinition) return undefined;
                return { id: e.id, name: e.name, hidden: e.hidden, metaColor: 0x336699 };
            },
            getIdByType: (t: number) => Object.values(REGISTRY).find((e) => e.type === t)?.id,
            getNameByType: (t: number) => Object.values(REGISTRY).find((e) => e.type === t)?.name,
        },
        terrains: {
            list: () => [],
            getIdByType: (t: number) => (t === 1 ? "dirt" : t === 2 ? "stone" : undefined),
        },
        structures: {
            list: () => [],
            // `getAvailableTypes()` returns a **Set** of `StructureRef`, and a
            // ref is `StructureType | StructureId` — a number *or* a string id.
            // Both shapes are here because both are real, and the old code
            // handled neither: it unwrapped Sets only after an `Array.isArray`
            // test that a Set fails, and it treated every member as a number.
            getAvailableTypes: () => new Set([7, "mdmy.furnace"]),
            getDefinitionByType: (t: unknown) =>
                t === 7
                    ? { id: "mdmy.furnace", name: "Furnace", category: "production" }
                    : { id: "mdmy.furnace", name: "Furnace", category: "production" },
        },
        // `getRegisteredIds` is the *older* SDK's route; the live declaration omits
        // it, but the item screen is built on it, so it is stood up here. A
        // built-in id is a number, and a built-in definition carries no `name`.
        items: {
            list: () => [],
            getRegisteredIds: () => [2, 8, "mdmy.probe", 999],
            getDefinitionById: (id: unknown) =>
                id === "mdmy.probe" ? { name: "Probe" } : { itemType: "Tool" },
        },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {
        ElementType: { Sand: 1, Water: 2, Steam: 3, ResolvedPointer: 90, InternalHelper: 91 },
        CellType: { Dirt: 1, Stone: 2, Unregistered: 5 },
        // `ItemId` is string-valued: the *value* is the id. The numeric members
        // are the real ones — `SandustryTypes`' ItemId is Shovel=1, Grabber=2,
        // RocketLauncher=8, … and carries no name anywhere — and they are here
        // too so the built-in path is exercised rather than assumed away.
        ItemId: {
            Drill: "drill",
            Saw: "saw",
            mystery: 7,
            Grabber: 2,
            RocketLauncher: 8,
        },
        // A built-in structure type, so the enum pass in `listStructures` has
        // something to emit — and therefore something to tag.
        StructureType: { Furnace: 12, Conveyor: 13 },
    },
};

const { listElements, listItems, listTerrains, listStructures } = await import(
    "../../catalog.ts"
);
const values = (o: { value: string }[]) => o.map((x) => x.value);

// ── elements ─────────────────────────────────────────────────────────────────

Deno.test("element ids come from the registry, not the enum name", () => {
    const v = values(listElements());
    assert(v.includes("Sand"), `Sand missing from ${v.join(", ")}`);
    assert(v.includes("Water"));
    assertEquals(new Set(v).size, v.length, "an element appears twice");
});

Deno.test("no element is offered as a bare type number", () => {
    // The old fallback was `String(type)`, which is not a valid element id.
    for (const v of values(listElements())) {
        assert(!/^\d+$/.test(v), `"${v}" is a type number, not an element id`);
    }
});

Deno.test("no element is offered as a lowercased duplicate", () => {
    // The old enum fallback added e.g. "sand" alongside "Sand", because the
    // "already have it?" guard compared a number against a map keyed by id.
    const v = values(listElements());
    for (const id of v) {
        const lower = id.toLowerCase();
        if (lower !== id && v.includes(lower)) {
            assertEquals(false, true, `"${id}" and "${lower}" are the same element twice`);
        }
    }
});

Deno.test("hidden game elements are not offered", () => {
    const v = values(listElements());
    assert(!v.includes("_resolved"), "a hidden element is in the list");
    assert(!v.includes("_helper"), "a hidden element is in the list");
});

Deno.test("hidden elements can still be asked for", () => {
    // The orphan check needs to see that a mod already pointing at a hidden
    // element resolves, or it would report a false dangling reference.
    const v = values(listElements({ includeHidden: true }));
    assert(v.includes("_resolved"), "includeHidden did not include the hidden element");
});

Deno.test("an element with no readable definition still appears", () => {
    // Steam has no definition object, so only the enum fallback can supply it —
    // and only if the fallback resolves a real id.
    const v = values(listElements());
    assert(v.includes("Steam"), `Steam missing from ${v.join(", ")}`);
});

Deno.test("this mod's configured elements are in the list", () => {
    const v = values(listElements());
    assert(v.includes("mdmy.acid"), "the mod's own element is not offered");
    // And it is labelled as ours, so a game element and one of ours with the
    // same display name stay distinguishable.
    assert(
        listElements().some((o: { value: string; label: string }) =>
            o.value === "mdmy.acid" && o.label.includes("this mod")
        ),
        "the mod's element is not marked",
    );
});

Deno.test("a configured element does not appear twice once registered", () => {
    // It is in the config *and* in the registry; the map is keyed by id, so it
    // must collapse to one entry.
    const v = values(listElements());
    assertEquals(v.filter((x: string) => x === "mdmy.acid").length, 1);
});

Deno.test("the list is sorted by label", () => {
    const labels = listElements().map((x: { label: string }) => x.label);
    assertEquals(labels, [...labels].sort((a, b) => a.localeCompare(b)));
});

// ── terrains ─────────────────────────────────────────────────────────────────

Deno.test("terrain ids are resolved through getIdByType, not guessed", () => {
    const v = values(listTerrains());
    assert(v.includes("dirt"), `dirt missing from ${v.join(", ")}`);
    assert(v.includes("stone"));
    // "Unregistered" has no id from the registry, so it is dropped rather than
    // offered as the number 5, which the config layer cannot round-trip.
    assert(!v.includes("5"), "a bare cell type is being offered as an id");
    assert(
        !v.includes("Unregistered"),
        "a terrain with no resolvable id is being offered anyway",
    );
});

Deno.test("this mod's configured terrains are in the list", () => {
    assert(values(listTerrains()).includes("mdmy.ores"));
});

// ── items ────────────────────────────────────────────────────────────────────

Deno.test("item ids come from the string-valued enum members", () => {
    const v = values(listItems());
    assert(v.includes("drill"), `drill missing from ${v.join(", ")}`);
    assert(v.includes("saw"));
});

Deno.test("no item is offered as a display name or a number", () => {
    // `mystery: 7` is number-valued, so it cannot be an id and is skipped.
    // "Drill" is the display name, not the id.
    const v = values(listItems());
    assert(!v.includes("Drill"), "an enum display name is being offered as an id");
    assert(!v.includes("7"), "a number is being offered as an item id");
});

// ── origin tagging ───────────────────────────────────────────────────────────
//
// Every option must say whose it is, because the list screen's "Yours / Game"
// filter and its Edit/Del buttons both branch on this. An untagged game option is
// filed under the mod by a filter that cannot tell the difference — so every
// built-in reads as the author's own, and a structure row offers to edit the
// engine's own conveyor.

Deno.test("every option says whose it is", () => {
    // `listStructures` and `listItems` both shipped without a `source`, so all of
    // the game's structures and items looked like the mod's own. The stub here
    // has no StructureType enum, so structures are covered by the other three
    // lists and by the per-list assertions below.
    for (
        const [name, list] of [
            ["listElements", listElements()],
            ["listTerrains", listTerrains()],
            ["listItems", listItems()],
            ["listStructures", listStructures()],
        ] as [string, { value: string; source?: string }[]][]
    ) {
        const untagged = list.filter((o) => o.source !== "game" && o.source !== "mod");
        assertEquals(
            untagged.map((o) => o.value),
            [],
            `${name} offers ${untagged.length} option(s) with no source`,
        );
    }
});

Deno.test("a Set of structure refs is unwrapped, numbers and id strings alike", () => {
    // `getAvailableTypes()` hands back a `Set`, which `Array.isArray` rejects —
    // so the old `Array.isArray(raw) ? raw : ...` guard dropped the whole thing
    // and the screen fell back to the enum alone, never seeing a registered
    // structure. Both member shapes are asserted because both are real: a
    // `StructureRef` is `StructureType | StructureId`, a number *or* a string.
    const v = values(listStructures());
    assert(v.includes("mdmy.furnace"), `Set members were dropped: ${v.join(", ")}`);
    // The enum's own types must survive alongside them.
    assert(v.includes("Furnace") || v.includes("Conveyor"), "the enum fallback was lost");
});

Deno.test("a structure id that is already a string is not resolved as a type number", () => {
    // Passing a string where the engine wants a numeric type is a call that
    // throws rather than returning nothing, so the string branch has to skip the
    // resolve. The id still has to appear exactly once.
    const v = values(listStructures());
    assertEquals(v.filter((x) => x === "mdmy.furnace").length, 1);
    assert(!v.includes("7"), "a raw structure type number is being offered as an id");
});

Deno.test("an option from the game's own registry is not filed as the mod's", () => {
    // The mod has one terrain configured; `dirt` and `stone` come from the game.
    // If the game's own ids were tagged `mod`, the "Yours" filter would show two
    // terrains the author never wrote and hide the one they did.
    const byId = new Map(listTerrains().map((o) => [o.value, o]));
    assertEquals(byId.get("dirt")?.source, "game");
    assertEquals(byId.get("stone")?.source, "game");
    assertEquals(byId.get("mdmy.ores")?.source, "mod");
});

Deno.test("a game element is tagged game even when the mod also declares one", () => {
    // `mdmy.acid` is in the stored config. The two sources overlap by id and the
    // mod's entry wins for that id — but `Sand`, which only the registry knows
    // about, must not be swept in with it.
    assertEquals(listElements().find((o) => o.value === "Sand")?.source, "game");
    assertEquals(listElements().find((o) => o.value === "mdmy.acid")?.source, "mod");
});
// ── the item screen's built-ins ──────────────────────────────────────────────
//
// `discoverItems` backs the item list, and a built-in item used to arrive there
// as a bare numeral: `getRegisteredIds` hands back *numbers* (2 = the grabber),
// a `typeof id !== "string"` guard threw every one of them away, and the ones
// that survived had no `name` on the definition to fall back to.

Deno.test("a built-in item is listed, and named", async () => {
    const { discoverItems } = await import("../../catalog.ts");
    const byId = new Map(discoverItems().map((i) => [i.id, i.label]));

    // Not dropped for being a number — that is the whole set of built-ins.
    assertEquals(byId.has("2"), true, "the built-in with id 2 was dropped");
    assertEquals(byId.get("2"), "Grabber");
    // The member name is humanised rather than pasted as `RocketLauncher`.
    assertEquals(byId.get("8"), "Rocket Launcher");
});

Deno.test("a mod item keeps its own name over the enum", async () => {
    const { discoverItems } = await import("../../catalog.ts");
    const byId = new Map(discoverItems().map((i) => [i.id, i.label]));
    assertEquals(byId.get("mdmy.probe"), "Probe");
});

Deno.test("an id no enum member explains falls back to itself", async () => {
    const { discoverItems } = await import("../../catalog.ts");
    const byId = new Map(discoverItems().map((i) => [i.id, i.label]));
    // 999 is not in ItemId. Inventing a name here would be worse than saying
    // "999", which at least cannot be mistaken for a real tool.
    assertEquals(byId.get("999"), "999");
});
