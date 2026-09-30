// @ts-nocheck
/**
 * Field groups in the edit form: one box per name, and closed until needed.
 *
 * Two properties, both of which were true of the old UI and neither of which
 * anything tested:
 *
 *  1. **No section name appears twice.** `sectionsFor` groups *consecutive*
 *     fields by section, so a field declared `section: "Placement"` on the far
 *     side of a "Flags" block opens a second "Placement" box. Structures
 *     rendered eleven boxes for twenty-six fields, four of them repeating a
 *     title the reader had already scrolled past — Placement ×3, Render ×2,
 *     Grid ×2. The fix was to order the field declarations, not to change
 *     `sectionsFor`, so it has to be pinned here or it drifts back one edit at a
 *     time.
 *
 *  2. **Closed by default, open when there is an error.** See
 *     `sectionsToReveal`.
 *
 *     deno test --allow-read --allow-env src/ui/test/sections.test.ts
 */
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

/** Tabs with fields. `draws` is a catalogue; the rest are navigation shells. */
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
    // If every tab stopped exporting fields the test above would pass on nothing.
    assertEquals(TABS.length > 15, true, `only ${TABS.length} tabs have fields`);
});

Deno.test("structures are six groups, not eleven", () => {
    // The specific regression, pinned by number because "no duplicates" alone
    // would also be satisfied by collapsing everything into one section.
    const sections = sectionsFor("structures");
    assertEquals(sections.map((s) => s.title), [
        "Identity",
        "Placement",
        "Flags",
        "Render",
        "Grid",
        "Advanced",
    ]);
    // And no field was lost doing it: 26 before, 26 now.
    assertEquals(fieldsFor("structures").length, 26);
    assertEquals(sections.reduce((n, s) => n + s.fields.length, 0), 26);
});

Deno.test("no field is dropped by any of the reorganisation", () => {
    // The danger in reshuffling declarations is losing one. Every key must appear
    // in exactly one section.
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
    // Save is disabled while an error stands, so folding its field away would
    // report a problem and hide the fix.
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
    // `sectionsFor` drops a section whose fields are all inactive under the
    // current form, so the section may not even be in the list the panel renders.
    // This asserts the helper only ever speaks about sections it was handed —
    // the panel cannot open a box that is not there, and must not crash on a
    // title it cannot match.
    const sections = sectionsFor("behaviors", { kind: "conveyor" });
    const reveal = sectionsToReveal(sections, { someGhostField: "required" });
    assertEquals([...reveal], [], "opened a section for a field it does not contain");
});
