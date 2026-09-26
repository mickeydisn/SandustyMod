/**
 * The two rules this pass set out to fix:
 *
 *  1. no `World` group, and `Assets & hooks` split three ways;
 *  2. a field whose value is a closed set is a picker, never a text box.
 *
 * The menu assertions read the real `MENU_GROUPS`; the picker assertions read
 * the real field specs and call the real catalog, because "is this a select" is
 * exactly the kind of thing that regresses by someone adding one more field.
 */
import { assert, assertEquals } from "jsr:@std/assert";

// The catalog reads the host `sandkit` global at import time, so it has to
// exist before any import that reaches it resolves. Same stub shape as the
// other UI tests, including the (modId, key) storage signature — a stub with
// the wrong arity makes every stored-config read return undefined, and the
// tests below would then pass vacuously.
const store: Record<string, unknown> = {};
(globalThis as Record<string, unknown>).sandkit = {
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
        elements: { list: () => [], register: () => {} },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { MENU_GROUPS, CATEGORY_META, fieldsFor } = await import("./schema.ts");
const { listLinkedClearance, listMaterialIds } = await import("../catalog.ts");

type FieldSpec = import("./schema.ts").FieldSpec;

const tabsOf = (key: string) => MENU_GROUPS.find((g) => g.key === key)?.categories ?? [];
const field = (tab: string, key: string): FieldSpec | undefined =>
    fieldsFor(tab as never).find((f) => f.key === key);

// ── 1. menu structure ────────────────────────────────────────────────────────

Deno.test("there is no World group any more", () => {
    assert(!MENU_GROUPS.some((g) => g.key === "world"), "the World group is back");
    assert(!MENU_GROUPS.some((g) => g.label === "World"));
});

Deno.test("terrains live under Content", () => {
    assert(tabsOf("content").includes("terrains"));
    // and nowhere else, so the tab is not listed twice
    const owners = MENU_GROUPS.filter((g) => g.categories.includes("terrains"));
    assertEquals(owners.map((g) => g.key), ["content"]);
});

Deno.test("Assets, Handlers and Hooks are three separate groups", () => {
    assertEquals(tabsOf("assets"), ["sprites"]);
    assertEquals(tabsOf("handlers"), ["handlers"]);
    assertEquals(tabsOf("hooks"), ["modifiers"]);
    assert(
        !MENU_GROUPS.some((g) => g.label === "Assets & hooks"),
        "the merged group is back",
    );
});

Deno.test("every tab appears in exactly one group", () => {
    // A tab in two groups renders twice; a tab in none is unreachable.
    const all = MENU_GROUPS.flatMap((g) => g.categories);
    assertEquals(new Set(all).size, all.length, "a tab is listed in two groups");
    for (const key of Object.keys(CATEGORY_META)) {
        assert(all.includes(key as never), `${key} is not in any group`);
    }
});

Deno.test("group hints say what the group is for", () => {
    for (const g of MENU_GROUPS) {
        assert(g.hint.length > 0, `${g.key} has no hint`);
        // A hint that just repeats the label tells the reader nothing.
        assert(g.hint.toLowerCase() !== g.label.toLowerCase(), `${g.key} hint is its label`);
    }
});

// ── 2. closed sets are pickers ───────────────────────────────────────────────

Deno.test("linkedClearance is a select, not a text box", () => {
    assertEquals(field("structures", "linkedClearance")?.kind, "select");
});

Deno.test("linkedClearance offers exactly the two states the engine knows", () => {
    // `=== "allOrNothing"` is the only comparison in the whole bundle, so any
    // third option would be a value the engine treats as "not all or nothing".
    const opts = listLinkedClearance();
    assertEquals(opts.map((o) => o.value), ["", "allOrNothing"]);
});

Deno.test("materialId is a select, not a free number", () => {
    assertEquals(field("terrains", "materialId")?.kind, "select");
});

Deno.test("materialId offers only values the engine accepts", () => {
    // obstacleBreakpoint is 100 and the ceiling is 150, so 101..149 or nothing.
    for (const o of listMaterialIds()) {
        if (o.value === "") continue;
        const n = Number(o.value);
        assert(Number.isInteger(n), `${o.value} is not an integer`);
        assert(n > 100 && n < 150, `${o.value} is outside 101-149 and the engine would throw`);
    }
});

Deno.test("materialId leads with the engine's own next-free id", () => {
    const opts = listMaterialIds();
    // First is the "leave empty" escape; second is the recommendation.
    assertEquals(opts[0].value, "");
    assert(opts[1].value === "101", `expected 101 as next-free, got ${opts[1].value}`);
    assert(opts[1].label.includes("next free"));
});

Deno.test("no multiselect falls back to free text", () => {
    // The panel used to render a comma-separated input when the option list was
    // empty. Reference fields must not accept typed ids, so every one of them
    // needs a way to say "nothing to show yet".
    const missing: string[] = [];
    for (const tab of Object.keys(CATEGORY_META)) {
        for (const f of fieldsFor(tab as never)) {
            if (f.kind !== "multiselect") continue;
            if (!f.emptyHint) missing.push(`${tab}.${f.key}`);
        }
    }
    assertEquals(missing, [], `multiselects without an empty state: ${missing.join(", ")}`);
});

Deno.test("requires explains what to create when the list is empty", () => {
    assert(
        (field("techs", "requires")?.emptyHint ?? "").length > 0,
        "techs.requires has no empty state",
    );
});
