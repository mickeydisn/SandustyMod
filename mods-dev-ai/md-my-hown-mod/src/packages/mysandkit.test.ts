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

globalThis.sandkit = {
    api: {
        elements: {
            register: (def: Record<string, unknown>) => {
                registered.push(def);
                return { elementType: 101 };
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
