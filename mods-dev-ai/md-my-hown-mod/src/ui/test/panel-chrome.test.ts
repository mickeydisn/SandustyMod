// @ts-nocheck: the `sandkit` shim below has no declared type, and without it the
// dynamic imports that follow resolve to `any` — which is why every sibling test
// does the same.
/**
 * How the panel's frame looks: the textarea, the list headings, and which tab
 * a list is reached through.
 *
 * These are the three things a reader notices before they notice anything else,
 * and none of them was asserted anywhere.
 *
 *     deno test --allow-read --allow-env src/ui/test/panel-chrome.test.ts
 */
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

/** Every tab the menu offers as a chip of its own, across all groups. */
const CHIPS = new Set(MENU_GROUPS.flatMap((g) => g.categories));

/**
 * Every tab drawn as a list under some parent.
 *
 * `Object.values`, not `Object.keys` — the children are the values, and `.flat()`
 * on an array of strings hands the strings straight back, so `keys` here would
 * list the *parents* and flag every chip that happens to have children.
 */
const ATTACHED_TABS = Object.values(ATTACHED).flat();

// ── the textarea ─────────────────────────────────────────────────────────────

Deno.test("a textarea fills the column it is in", () => {
    // A `<textarea>` has an intrinsic width of roughly 20 characters and, unlike
    // an `<input>` beside it in the same grid cell, does not stretch. Every JSON
    // box in the panel rendered at that intrinsic width — half the row, and half
    // the form on a `wide` field.
    assertEquals(S.textarea.width, "100%");
});

Deno.test("the textarea does not overflow once it is full width", () => {
    // `input` sets `padding: 5px 8px` and no box-sizing, so a bare
    // `width: 100%` would be 16px wider than its grid cell and push the
    // neighbouring field along. Trading one layout bug for a quieter one is not a
    // fix, so the two have to travel together.
    assertEquals(S.textarea.boxSizing, "border-box");
    assertEquals(
        S.input.boxSizing,
        undefined,
        "input gained a box-sizing; re-check the padding arithmetic above",
    );
});

// ── list headings ────────────────────────────────────────────────────────────

Deno.test("a list heading is the same size as the screen's own title", () => {
    // The reported one: a screen with several lists drew one big title followed
    // by small grey ones, so the small ones read as captions of the list above.
    // They are peers. `listHeadingRow` must therefore *derive* from `screenTitle`
    // rather than restate its numbers, or the two drift the next time either is
    // tuned.
    for (const prop of ["fontSize", "fontWeight", "letterSpacing"]) {
        assertEquals(
            S.listHeadingRow[prop],
            S.screenTitle[prop],
            `a list heading is ${S.listHeadingRow[prop]} where the screen title is ` +
                `${S.screenTitle[prop]} — same size means all three, not two`,
        );
    }
    // And it is a row, because it carries a count beside the title.
    assertEquals(S.listHeadingRow.display, "flex");
});

Deno.test("the collapsible field groups stay quiet", () => {
    // The counterweight: a disclosure inside a form is not a list, and giving
    // every group heading the list's size would make a 26-field structure form
    // read as a wall of shouting. This fails if someone "fixes" it that way.
    assertEquals(S.sectionTitle.fontSize < S.screenTitle.fontSize, true);
});
// ── where a list is reached from ──────────────────────────────────────────────

Deno.test("an attached list is not also a menu chip", () => {
    // `placementConfigs` was both: a top-level Content chip *and* attached under
    // Structures. Two entries, two screens — the chip opened a bare list, the
    // attachment opened it under its parent — and neither was obviously the one
    // the other meant.
    const strays = ATTACHED_TABS.filter((t) => CHIPS.has(t));
    assertEquals(strays, [], "an attached tab still has a chip of its own");
});

Deno.test("placement fields is reached through Structures", () => {
    // The specific move. It was Content › Placement fields › Placement fields — a
    // screen whose title named itself.
    assertEquals(parentOf("placementConfigs"), "structures");
    assertEquals(attachedTo("structures"), ["placementConfigs", "behaviors", "signals"]);
});

Deno.test("every tab with a definition is reachable from the menu", () => {
    // The real orphan check. Walking `MENU_GROUPS` can only ever re-find the tabs
    // the menu already lists, so it proves nothing — an `ENTRY` whose tab was
    // dropped from every group, or whose parent quietly lost it, stays invisible
    // until someone tries to open it. Walking the *definitions* instead makes
    // an unreachable tab a failure here rather than a dead screen in game.
    const children = new Set(ATTACHED_TABS);
    const unreachable = Object.keys(CATEGORY_META)
        .filter((tab) => !CHIPS.has(tab) && !children.has(tab));
    assertEquals(unreachable, [], "a tab has a definition but no route to its screen");
});

Deno.test("an attached list hangs off a chip that exists", () => {
    // `parentOf` is a reverse lookup over `ATTACHED`, so it will happily answer
    // for a parent that is not in the menu — the child would render under a
    // screen that nothing links to.
    for (const parent of Object.keys(ATTACHED)) {
        assertEquals(CHIPS.has(parent), true, `\`${parent}\` has lists but no chip`);
    }
});

// ── titles ───────────────────────────────────────────────────────────────────

Deno.test("a tab does not repeat the group it is reached through", () => {
    // Reported for Energy: the chip above already says "Energy", so
    // "Energy › Energy networks" said the word twice and read as two different
    // kinds of thing.
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
    // The label is screen text. `configKey` is what saved worlds are keyed by,
    // so dropping "Energy" from the label must not touch it — that would orphan
    // every existing entry.
    assertEquals(CATEGORY_META.networks.configKey, "energyNetworks");
    assertEquals(CATEGORY_META.energy.configKey, "energyTypes");
});

/** Fails when two of `tabs` share a title — they are drawn on one screen. */
function assertDistinctTitles(where: string, tabs: readonly string[]) {
    const labels = tabs.map((t) => CATEGORY_META[t]?.label).filter(Boolean);
    const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
    assertEquals(dupes, [], `the ${where} screen shows "${dupes[0] ?? ""}" twice`);
}

Deno.test("no two lists on one screen share a title", () => {
    // Two lists answering to the same name is the ambiguity the grouping exists
    // to prevent. Both shapes have to be checked: the chips in a group, and the
    // lists attached under one parent — which are peers on a single screen and
    // were never compared against each other.
    for (const g of MENU_GROUPS) assertDistinctTitles(g.label, g.categories);
    for (const [parent, children] of Object.entries(ATTACHED)) {
        assertDistinctTitles(parent, children);
    }
});

Deno.test("an attached list is not titled after the list it hangs off", () => {
    // The original placement bug, stated as a rule. `placementConfigs` was a
    // **Content** chip of its own *and* drawn under `structures`, so the route to
    // it read Content → Placement fields → Placement fields — a screen whose
    // title named itself, and the only clue that two entries meant one thing.
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
