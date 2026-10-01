// @ts-nocheck
/**
 * What an element definition looks like by the time the engine sees it.
 *   deno test -A src/packages/mysandkit.test.ts
 *
 * The claim under test: an element defined with no colour variants still arrives
 * with colours, and those colours are the map colour.
 *
 * This is not a preference. The engine's `register` is guarded —
 * `t.colors && scheme.colors.add(type, t.colors)` (bundel.js/46781.js:1290) — so
 * a definition without `colors` never gets a colour-scheme entry, and the
 * renderer then falls through to its own literal default, `[255, 0, 0, 255]`
 * (bundel.js/26508.js:114-117). A perfectly ordinary element therefore renders
 * bright red, and nothing anywhere reports an error.
 */
import { assertEquals } from "jsr:@std/assert";

/** Everything `register` was handed, in call order. */
const registered: Record<string, unknown>[] = [];
/** Types handed to the discovery catalogue. */
const discovered: number[] = [];
/** Every `processing.register(id, definition)` call, in order. */
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

/** The last definition the engine was handed. */
function last(): Record<string, unknown> {
    const def = registered.at(-1);
    assertEquals(typeof def, "object", "nothing reached elements.register");
    return def!;
}

Deno.test("no variants means the map colour, not the engine's red", () => {
    registered.length = 0;
    api.elements.register({ id: "t:plain", name: "Plain", metaColor: 0x8ec8ff } as never);

    // 0x8ec8ff unpacked to r,g,b — the one variant, derived from the map colour.
    assertEquals(last().colors, { variants: [[142, 200, 255, 255]] });
});

Deno.test("the reported config renders as the map colour, not red", () => {
    registered.length = 0;
    // The shape stored by the mod's own panel, as reported for md-my-hown-mod:test-1.
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
    // Powder is 8. A string matterType would leave the physics table lookup
    // `ce["powder"]` → undefined → no update function → an inert element.
    assertEquals(def.matterType, 8, "matterType did not reach the engine as a number");
    // The whole point: colours exist, so `register` applies them.
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
    // `variants: []` is what the panel writes when the last swatch is removed.
    // Length zero is not a colour, so it must fall back rather than ship an
    // empty array the renderer would index straight past the end of.
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
    // Never red, and never `undefined` — an element with no colour anywhere
    // should look like an unfinished grey rather than an engine error red.
    registered.length = 0;
    api.elements.register({ id: "t:bare-nocolour" } as never);

    assertEquals(last().colors, { variants: [[204, 204, 204, 255]] });
});

Deno.test("a registered element is also added to the discovery catalogue", () => {
    registered.length = 0;
    discovered.length = 0;

    api.elements.register({ id: "t:found", metaColor: 0xffffff } as never);
    api.elements.addElementToDiscoveries(101);

    // Registering simulates; discovering catalogues. astro-seeds does both
    // (`src/main/register.ts:15-27`).
    assertEquals(discovered, [101]);
});

// ── The read/enumerate half ───────────────────────────────────────────────────
//
// The registration path above has been exercised all along. The *read* path was
// written and worked on for hours while returning `undefined` every time: this
// wrapper re-exported `register` and `updateDefinition` but not
// `getRegisteredTypes` and friends, and every caller reached them through `?.`.
// "The host does not have it" and "we forgot to forward it" are then identical —
// an empty list screen, nothing thrown.
//
// The reference mods (`md-admin-element`, `md-admin-structure`) call these same
// methods on the host `sandkit.api` directly and work, so the host has them.

Deno.test("every read the discovery passes need is forwarded", () => {
    // One per `discover*` in catalog.ts. A new enumeration call added there
    // without a counterpart here is exactly the bug that emptied the lists.
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
    // This fake host has none of the read methods, which is exactly the shape of
    // an older build. Every one of these runs on a render path, so they must
    // degrade to "nothing found" rather than take the panel down.
    assertEquals(api.elements.getRegisteredTypes(), []);
    assertEquals(api.structures.getAvailableTypes().size, 0);
    assertEquals(api.items.getRegisteredIds(), []);
    assertEquals(api.elements.getDefinitionByType(0), undefined);
    assertEquals(api.structures.getDefinitionByType("x"), undefined);
});

// ── processing.register ───────────────────────────────────────────────────────
// Found in the game, not by reading the code. The live log said:
//
//   [md-my-hown-mod] processing gen-tick: program from artefact-generator-tick
//   [md-my-hown-mod] structures.processing.register failed
//       Error: Structure "undefined" must be registered before its processing.
//
// The engine signature is `register(id, definition)`, and the id is only a label
// for the registration — the engine reads `definition.structureType`. The old
// call was `register(structureType, rest)` with `structureType` destructured
// *out* of `rest`, so the definition arrived with no `structureType` and the
// whole tick silently never ran.
//
// These assert the **definition**, not merely that register was called: a stub
// that only counts calls cannot see this class of bug at all.
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

    // Two entries can target the same structure type; keying the registration by
    // the structure type would make the second one collide with the first.
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
