

import { assert, assertEquals } from "jsr:@std/assert";


const REGISTRY = {
    Sand: { type: 1, id: "Sand", name: "Sand" },
    Water: { type: 2, id: "Water", name: "Water" },
    
    ResolvedPointer: { type: 90, id: "_resolved", name: "Resolved", hidden: true },
    InternalHelper: { type: 91, id: "_helper", name: "Helper", hidden: true },
    
    Steam: { type: 3, id: "Steam", name: "Steam", noDefinition: true },
};




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
            
            
            
            
            
            getAvailableTypes: () => new Set([7, "mdmy.furnace"]),
            getDefinitionByType: (t: unknown) =>
                t === 7
                    ? { id: "mdmy.furnace", name: "Furnace", category: "production" }
                    : { id: "mdmy.furnace", name: "Furnace", category: "production" },
        },
        
        
        
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
        
        
        
        
        ItemId: {
            Drill: "drill",
            Saw: "saw",
            mystery: 7,
            Grabber: 2,
            RocketLauncher: 8,
        },
        
        
        StructureType: { Furnace: 12, Conveyor: 13 },
    },
};

const { listElements, listItems, listTerrains, listStructures } = await import(
    "../../catalog.ts"
);
const values = (o: { value: string }[]) => o.map((x) => x.value);



Deno.test("element ids come from the registry, not the enum name", () => {
    const v = values(listElements());
    assert(v.includes("Sand"), `Sand missing from ${v.join(", ")}`);
    assert(v.includes("Water"));
    assertEquals(new Set(v).size, v.length, "an element appears twice");
});

Deno.test("no element is offered as a bare type number", () => {
    
    for (const v of values(listElements())) {
        assert(!/^\d+$/.test(v), `"${v}" is a type number, not an element id`);
    }
});

Deno.test("no element is offered as a lowercased duplicate", () => {
    
    
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
    
    
    const v = values(listElements({ includeHidden: true }));
    assert(v.includes("_resolved"), "includeHidden did not include the hidden element");
});

Deno.test("an element with no readable definition still appears", () => {
    
    
    const v = values(listElements());
    assert(v.includes("Steam"), `Steam missing from ${v.join(", ")}`);
});

Deno.test("this mod's configured elements are in the list", () => {
    const v = values(listElements());
    assert(v.includes("mdmy.acid"), "the mod's own element is not offered");
    
    
    assert(
        listElements().some((o: { value: string; label: string }) =>
            o.value === "mdmy.acid" && o.label.includes("this mod")
        ),
        "the mod's element is not marked",
    );
});

Deno.test("a configured element does not appear twice once registered", () => {
    
    
    const v = values(listElements());
    assertEquals(v.filter((x: string) => x === "mdmy.acid").length, 1);
});

Deno.test("the list is sorted by label", () => {
    const labels = listElements().map((x: { label: string }) => x.label);
    assertEquals(labels, [...labels].sort((a, b) => a.localeCompare(b)));
});



Deno.test("terrain ids are resolved through getIdByType, not guessed", () => {
    const v = values(listTerrains());
    assert(v.includes("dirt"), `dirt missing from ${v.join(", ")}`);
    assert(v.includes("stone"));
    
    
    assert(!v.includes("5"), "a bare cell type is being offered as an id");
    assert(
        !v.includes("Unregistered"),
        "a terrain with no resolvable id is being offered anyway",
    );
});

Deno.test("this mod's configured terrains are in the list", () => {
    assert(values(listTerrains()).includes("mdmy.ores"));
});



Deno.test("item ids come from the string-valued enum members", () => {
    const v = values(listItems());
    assert(v.includes("drill"), `drill missing from ${v.join(", ")}`);
    assert(v.includes("saw"));
});

Deno.test("no item is offered as a display name or a number", () => {
    
    
    const v = values(listItems());
    assert(!v.includes("Drill"), "an enum display name is being offered as an id");
    assert(!v.includes("7"), "a number is being offered as an item id");
});









Deno.test("every option says whose it is", () => {
    
    
    
    
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
    
    
    
    
    
    const v = values(listStructures());
    assert(v.includes("mdmy.furnace"), `Set members were dropped: ${v.join(", ")}`);
    
    assert(v.includes("Furnace") || v.includes("Conveyor"), "the enum fallback was lost");
});

Deno.test("a structure id that is already a string is not resolved as a type number", () => {
    
    
    
    const v = values(listStructures());
    assertEquals(v.filter((x) => x === "mdmy.furnace").length, 1);
    assert(!v.includes("7"), "a raw structure type number is being offered as an id");
});

Deno.test("an option from the game's own registry is not filed as the mod's", () => {
    
    
    
    const byId = new Map(listTerrains().map((o) => [o.value, o]));
    assertEquals(byId.get("dirt")?.source, "game");
    assertEquals(byId.get("stone")?.source, "game");
    assertEquals(byId.get("mdmy.ores")?.source, "mod");
});

Deno.test("a game element is tagged game even when the mod also declares one", () => {
    
    
    
    assertEquals(listElements().find((o) => o.value === "Sand")?.source, "game");
    assertEquals(listElements().find((o) => o.value === "mdmy.acid")?.source, "mod");
});







Deno.test("a built-in item is listed, and named", async () => {
    const { discoverItems } = await import("../../catalog.ts");
    const byId = new Map(discoverItems().map((i) => [i.id, i.label]));

    
    assertEquals(byId.has("2"), true, "the built-in with id 2 was dropped");
    assertEquals(byId.get("2"), "Grabber");
    
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
    
    
    assertEquals(byId.get("999"), "999");
});
