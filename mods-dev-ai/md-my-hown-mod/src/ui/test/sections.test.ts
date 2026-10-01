

import { assertEquals } from "jsr:@std/assert";

globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        sprites: { list: () => [] },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        elements: { list: () => [] },
        items: { list: () => [] },
        input: {},
        actions: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { fieldsFor, sectionsFor, sectionsToReveal, CATEGORY_META } = await import(
    "../schema.ts"
);


const TABS = Object.keys(CATEGORY_META).filter((t) => fieldsFor(t).length > 0);

Deno.test("no tab renders the same section title twice", () => {
    const split: string[] = [];
    for (const tab of TABS) {
        const titles = sectionsFor(tab).map((s) => s.title);
        for (const title of new Set(titles)) {
            if (titles.filter((t) => t === title).length > 1) {
                split.push(`${tab}: "${title}" ×${titles.filter((t) => t === title).length}`);
            }
        }
    }
    assertEquals(split, [], "sections split by an interleaved field");
});

Deno.test("a tab with no fields at all is not an accident", () => {
    
    assertEquals(TABS.length > 15, true, `only ${TABS.length} tabs have fields`);
});

Deno.test("structures are six groups, not eleven", () => {
    
    
    const sections = sectionsFor("structures");
    assertEquals(sections.map((s) => s.title), [
        "Identity",
        "Placement",
        "Flags",
        "Render",
        "Grid",
        "Advanced",
    ]);
    
    assertEquals(fieldsFor("structures").length, 26);
    assertEquals(sections.reduce((n, s) => n + s.fields.length, 0), 26);
});

Deno.test("no field is dropped by any of the reorganisation", () => {
    
    
    for (const tab of TABS) {
        const keys = sectionsFor(tab).flatMap((s) => s.fields.map((f) => f.key));
        assertEquals(
            keys.length,
            new Set(keys).size,
            `${tab}: a field is listed in two sections`,
        );
        assertEquals(
            keys.sort(),
            fieldsFor(tab).map((f) => f.key).sort(),
            `${tab}: section fields do not match the declared fields`,
        );
    }
});

Deno.test("a section with no error stays closed", () => {
    const sections = sectionsFor("structures");
    assertEquals([...sectionsToReveal(sections, {})], [], "a clean form opened something");
});

Deno.test("a section holding an error is forced open", () => {
    
    
    const sections = sectionsFor("structures");
    const shape = sections.find((s) => s.title === "Placement")!;
    const target = shape.fields[0];
    const errors = { [target.key]: "required" };
    assertEquals([...sectionsToReveal(sections, errors)], ["Placement"]);
});

Deno.test("only the offending section opens, not all of them", () => {
    const sections = sectionsFor("structures");
    const render = sections.find((s) => s.title === "Render")!;
    const errors = { [render.fields[0].key]: "bad" };
    assertEquals([...sectionsToReveal(sections, errors)], ["Render"]);
});

Deno.test("an error on a hidden field still opens its section", () => {
    
    
    
    
    
    const sections = sectionsFor("behaviors", { kind: "conveyor" });
    const reveal = sectionsToReveal(sections, { someGhostField: "required" });
    assertEquals([...reveal], [], "opened a section for a field it does not contain");
});
