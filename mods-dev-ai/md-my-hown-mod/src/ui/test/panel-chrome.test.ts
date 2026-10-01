



import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";

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

const { CATEGORY_META, MENU_GROUPS } = await import("../schema.ts");
const { ATTACHED, attachedTo, parentOf } = await import("../panel/attach.ts");
const S = await import("../styles.ts");


const CHIPS = new Set(MENU_GROUPS.flatMap((g) => g.categories));


const ATTACHED_TABS = Object.values(ATTACHED).flat();



Deno.test("a textarea fills the column it is in", () => {
    
    
    
    
    assertEquals(S.textarea.width, "100%");
});

Deno.test("the textarea does not overflow once it is full width", () => {
    
    
    
    
    assertEquals(S.textarea.boxSizing, "border-box");
    assertEquals(
        S.input.boxSizing,
        undefined,
        "input gained a box-sizing; re-check the padding arithmetic above",
    );
});



Deno.test("a list heading is the same size as the screen's own title", () => {
    
    
    
    
    
    for (const prop of ["fontSize", "fontWeight", "letterSpacing"]) {
        assertEquals(
            S.listHeadingRow[prop],
            S.screenTitle[prop],
            `a list heading is ${S.listHeadingRow[prop]} where the screen title is ` +
                `${S.screenTitle[prop]} — same size means all three, not two`,
        );
    }
    
    assertEquals(S.listHeadingRow.display, "flex");
});

Deno.test("the collapsible field groups stay quiet", () => {
    
    
    
    assertEquals(S.sectionTitle.fontSize < S.screenTitle.fontSize, true);
});


Deno.test("an attached list is not also a menu chip", () => {
    
    
    
    
    const strays = ATTACHED_TABS.filter((t) => CHIPS.has(t));
    assertEquals(strays, [], "an attached tab still has a chip of its own");
});

Deno.test("placement fields is reached through Structures", () => {
    
    
    assertEquals(parentOf("placementConfigs"), "structures");
    assertEquals(attachedTo("structures"), ["placementConfigs", "behaviors", "signals"]);
});

Deno.test("every tab with a definition is reachable from the menu", () => {
    
    
    
    
    
    const children = new Set(ATTACHED_TABS);
    const unreachable = Object.keys(CATEGORY_META)
        .filter((tab) => !CHIPS.has(tab) && !children.has(tab));
    assertEquals(unreachable, [], "a tab has a definition but no route to its screen");
});

Deno.test("an attached list hangs off a chip that exists", () => {
    
    
    
    for (const parent of Object.keys(ATTACHED)) {
        assertEquals(CHIPS.has(parent), true, `\`${parent}\` has lists but no chip`);
    }
});



Deno.test("a tab does not repeat the group it is reached through", () => {
    
    
    
    const energy = MENU_GROUPS.find((g) => g.key === "energy");
    for (const tab of energy.categories) {
        const label = CATEGORY_META[tab].label.toLowerCase();
        assertEquals(
            label.startsWith(energy.label.toLowerCase()),
            false,
            `"${CATEGORY_META[tab].label}" repeats the group name "${energy.label}"`,
        );
    }
});

Deno.test("the config keys keep their prefix even when the label drops it", () => {
    
    
    
    assertEquals(CATEGORY_META.networks.configKey, "energyNetworks");
    assertEquals(CATEGORY_META.energy.configKey, "energyTypes");
});


function assertDistinctTitles(where: string, tabs: readonly string[]) {
    const labels = tabs.map((t) => CATEGORY_META[t]?.label).filter(Boolean);
    const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
    assertEquals(dupes, [], `the ${where} screen shows "${dupes[0] ?? ""}" twice`);
}

Deno.test("no two lists on one screen share a title", () => {
    
    
    
    
    for (const g of MENU_GROUPS) assertDistinctTitles(g.label, g.categories);
    for (const [parent, children] of Object.entries(ATTACHED)) {
        assertDistinctTitles(parent, children);
    }
});

Deno.test("an attached list is not titled after the list it hangs off", () => {
    
    
    
    
    for (const [parent, children] of Object.entries(ATTACHED)) {
        const own = CATEGORY_META[parent]?.label;
        for (const child of children) {
            assertNotEquals(
                CATEGORY_META[child]?.label,
                own,
                `\`${child}\` is titled exactly like the \`${parent}\` it is drawn under`,
            );
        }
    }
});
