

import { assertEquals } from "jsr:@std/assert";


const registered: Record<string, unknown>[] = [];

const discovered: number[] = [];

const processingRegistrations: { id: string; def: Record<string, unknown> }[] = [];

globalThis.sandkit = {
    api: {
        elements: {
            register: (def: Record<string, unknown>) => {
                registered.push(def);
                return { elementType: 101 };
            },
        },
        structures: {
            register: (def: Record<string, unknown>) => {
                registered.push(def);
                return { structureType: 7 };
            },
            getAvailableTypes: () => new Set<string>(),
            getDefinitionByType: () => undefined,
            processing: {
                register: (
                    id: string,
                    def: Record<string, unknown>,
                ) => {
                    processingRegistrations.push({ id, def });
                },
            },
        },
        discoveries: {
            addElement: (type: number) => void discovered.push(type),
        },
        i18n: { register: () => {} },
    },
};

const { api } = await import("./mysandkit.ts");


function last(): Record<string, unknown> {
    const def = registered.at(-1);
    assertEquals(typeof def, "object", "nothing reached elements.register");
    return def!;
}

Deno.test("no variants means the map colour, not the engine's red", () => {
    registered.length = 0;
    api.elements.register({ id: "t:plain", name: "Plain", metaColor: 0x8ec8ff } as never);

    
    assertEquals(last().colors, { variants: [[142, 200, 255, 255]] });
});

Deno.test("the reported config renders as the map colour, not red", () => {
    registered.length = 0;
    
    api.elements.register({
        id: "md-my-hown-mod:test-1",
        name: "test-1",
        matterType: "powder",
        density: 100,
        flammable: false,
        isTransportable: true,
        isGrabbable: true,
        collectable: false,
        hidden: false,
        visibleInPicker: true,
        metaColor: 0x3366ff,
    } as never);

    const def = last();
    
    
    assertEquals(def.matterType, 8, "matterType did not reach the engine as a number");
    
    assertEquals(def.colors, { variants: [[51, 102, 255, 255]] });
});

Deno.test("declared variants win over the map colour", () => {
    registered.length = 0;
    api.elements.register({
        id: "t:varied",
        metaColor: 0x3366ff,
        colors: { variants: [[1, 2, 3, 4], [5, 6, 7, 8]] },
    } as never);

    assertEquals(last().colors, { variants: [[1, 2, 3, 4], [5, 6, 7, 8]] });
});

Deno.test("a bare array of variants is still accepted", () => {
    registered.length = 0;
    api.elements.register({
        id: "t:bare",
        metaColor: 0x3366ff,
        colors: [[9, 9, 9]],
    } as never);

    assertEquals(last().colors, { variants: [[9, 9, 9]] });
});

Deno.test("an empty variant list is treated as no variants", () => {
    
    
    
    registered.length = 0;
    api.elements.register({
        id: "t:empty",
        metaColor: 0x3366ff,
        colors: { variants: [] },
    } as never);

    assertEquals(last().colors, { variants: [[51, 102, 255, 255]] });
});

Deno.test("other colour-scheme keys survive alongside seeded variants", () => {
    registered.length = 0;
    api.elements.register({
        id: "t:gradient",
        metaColor: 0x3366ff,
        colors: { variantFromDataField1: { rangeMin: 1 }, variants: [] },
    } as never);

    assertEquals(last().colors, {
        variantFromDataField1: { rangeMin: 1 },
        variants: [[51, 102, 255, 255]],
    });
});

Deno.test("no map colour at all still gets a colour", () => {
    
    
    registered.length = 0;
    api.elements.register({ id: "t:bare-nocolour" } as never);

    assertEquals(last().colors, { variants: [[204, 204, 204, 255]] });
});

Deno.test("a registered element is also added to the discovery catalogue", () => {
    registered.length = 0;
    discovered.length = 0;

    api.elements.register({ id: "t:found", metaColor: 0xffffff } as never);
    api.elements.addElementToDiscoveries(101);

    
    
    assertEquals(discovered, [101]);
});













Deno.test("every read the discovery passes need is forwarded", () => {
    
    
    const shape = api as unknown as Record<string, Record<string, unknown>>;
    for (
        const [ns, method] of [
            ["elements", "getRegisteredTypes"],
            ["elements", "getDefinitionByType"],
            ["elements", "getIdByType"],
            ["elements", "getNameByType"],
            ["structures", "getAvailableTypes"],
            ["structures", "getDefinitionByType"],
            ["structures", "getIdByType"],
            ["items", "getRegisteredIds"],
            ["items", "getDefinitionById"],
            ["terrains", "getIdByType"],
            ["terrains", "getDefinitionByType"],
        ]
    ) {
        assertEquals(
            typeof shape[ns]?.[method],
            "function",
            `api.${ns}.${method} is not forwarded by the wrapper`,
        );
    }
});

Deno.test("a read the host does not have is empty, not a throw", () => {
    
    
    
    assertEquals(api.elements.getRegisteredTypes(), []);
    assertEquals(api.structures.getAvailableTypes().size, 0);
    assertEquals(api.items.getRegisteredIds(), []);
    assertEquals(api.elements.getDefinitionByType(0), undefined);
    assertEquals(api.structures.getDefinitionByType("x"), undefined);
});
















Deno.test("processing.register carries structureType inside the definition", async () => {
    processingRegistrations.length = 0;
    const { registerProcessing } = await import("./registrations.ts");

    registerProcessing({
        id: "gen-tick",
        structureType: "md-my-hown-mod:generator",
        intervalMs: 200,
        process: () => {},
    } as never);

    assertEquals(processingRegistrations.length, 1, "nothing reached the engine");
    const [call] = processingRegistrations;
    assertEquals(
        call.def.structureType,
        "md-my-hown-mod:generator",
        "the engine reads definition.structureType; without it the tick never runs",
    );
    assertEquals(call.def.intervalMs, 200);
    assertEquals(typeof call.def.process, "function");
});

Deno.test("processing.register uses the entry's own id, not the structure type", async () => {
    processingRegistrations.length = 0;
    const { registerProcessing } = await import("./registrations.ts");

    registerProcessing({
        id: "gen-tick",
        structureType: "md-my-hown-mod:generator",
        intervalMs: 200,
        process: () => {},
    } as never);

    
    
    assertEquals(processingRegistrations[0].id, "gen-tick");
});

Deno.test("a processing entry with no structureType is refused, not forwarded", async () => {
    processingRegistrations.length = 0;
    const { registerProcessing } = await import("./registrations.ts");

    registerProcessing({ id: "broken", intervalMs: 200, process: () => {} } as never);

    assertEquals(
        processingRegistrations.length,
        0,
        "an entry with no structureType must not reach the engine",
    );
});
