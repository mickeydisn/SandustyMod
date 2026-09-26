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
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {
        ElementType: { Sand: 1, Water: 2, Steam: 3, ResolvedPointer: 90, InternalHelper: 91 },
        CellType: { Dirt: 1, Stone: 2, Unregistered: 5 },
        // `ItemId` is string-valued: the *value* is the id.
        ItemId: { Drill: "drill", Saw: "saw", mystery: 7 },
    },
};

const { listElements, listItems, listTerrains } = await import("../../catalog.ts");
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
