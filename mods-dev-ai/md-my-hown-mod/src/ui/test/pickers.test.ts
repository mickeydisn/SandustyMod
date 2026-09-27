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
        // A small live registry, so `listElements` has real ids to read and the
        // native-list tests have something to count. Without this the stub
        // returns an empty list and every "is the source tagged" assertion
        // passes vacuously.
        elements: {
            list: () => [],
            register: () => {},
            getRegisteredTypes: () => [1, 2],
            getDefinitionByType: (t: number) =>
                t === 1
                    ? { id: "Sand", name: "Sand" }
                    : t === 2
                    ? { id: "Water", name: "Water" }
                    : undefined,
            getIdByType: (t: number) => (t === 1 ? "Sand" : t === 2 ? "Water" : undefined),
            getNameByType: (t: number) => (t === 1 ? "Sand" : t === 2 ? "Water" : undefined),
        },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { MENU_GROUPS, CATEGORY_META, fieldsFor, formToEntry } = await import("../schema.ts");
const {
    listLinkedClearance,
    listMaterialIds,
    listEnergyNetworkOpts,
    listElements,
} = await import("../../catalog.ts");

type FieldSpec = import("../schema.ts").FieldSpec;

const tabsOf = (key: string) => MENU_GROUPS.find((g) => g.key === key)?.categories ?? [];
const field = (tab: string, key: string): FieldSpec | undefined =>
    fieldsFor(tab as never).find((f) => f.key === key);
const values = (o: { value: string }[]) => o.map((x) => x.value);

const { usageOf, unknownDrawKeys } = await import("../panel/draws.ts");
const { renderDraws } = await import("../panel/draws.ts");
const { DRAW_FUNCTIONS, listDrawFunctions, listUpgradeCategoryIds } = await import(
    "../../catalog.ts"
);
const { UPSERT, REMOVE } = await import("../panel.ts");
const { PANEL_NATIVES: natives } = await import("../../catalog.ts");

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

Deno.test("the menu is the ten groups, in the order that was asked for", () => {
    assertEquals(
        MENU_GROUPS.map((g) => g.key),
        [
            "content",
            "extend",
            "production",
            "tech",
            "actions",
            "energy",
            "assets",
            "handlers",
            "help",
            "data",
        ],
    );
});

Deno.test("the dissolved groups stay dissolved", () => {
    // `Systems` was a grab-bag and `Hooks` held a single screen. Their screens
    // moved under Extend and Actions; the group names must not creep back.
    assert(!MENU_GROUPS.some((g) => g.key === "systems"), "the Systems group is back");
    assert(!MENU_GROUPS.some((g) => g.key === "hooks"), "the Hooks group is back");
    assert(!MENU_GROUPS.some((g) => g.label === "Assets & hooks"), "the merged group is back");
});

Deno.test("the screens sit in the groups that were asked for, in order", () => {
    // `behaviors` started under Content, next to the structures it names, because
    // `api.structureBehaviors` takes structure ids. That was reasoning about what
    // the feature *references* rather than what it *is* — a menu should be
    // arranged by the second. A conveyor is an existing structure that now moves
    // things, which is precisely "Add to what the game already does", so it moved
    // to Extend. `interactions` also lives there now, and is the Tooltips screen.
    assertEquals(tabsOf("content"), [
        "terrains",
        "elements",
        "structures",
        "items",
    ]);
    assertEquals(tabsOf("extend"), [
        "interactions",
        "behaviors",
        "excavation",
        "projectiles",
        "signals",
    ]);
    assertEquals(tabsOf("production"), ["contacts", "recipes"]);
    // `unlockNodes` comes first under Tech: it is what a structure names, and the
    // tech screen is where its *result* is configured. Reading a structure's gate
    // and then the research step behind it should not mean crossing the group.
    assertEquals(tabsOf("tech"), ["unlockNodes", "techs", "categories", "upgrades"]);
    assertEquals(tabsOf("actions"), ["triggers", "inputs", "processing", "modifiers"]);
    assertEquals(tabsOf("energy"), ["networks", "energy"]);
    assertEquals(tabsOf("assets"), ["sprites", "draws"]);
    assertEquals(tabsOf("handlers"), ["handlers"]);
    assertEquals(tabsOf("help"), ["help"], "Help must be the graph, and only the graph");
    assertEquals(tabsOf("data"), ["map", "json"]);
});

Deno.test("Sprites and Custom draw are listed apart, not merged", () => {
    // They are different things that happen to both be visual: an image the mod
    // loads, and a function that paints a structure. One screen would hide one
    // of them.
    assertEquals(tabsOf("assets"), ["sprites", "draws"]);
    assert(tabsOf("assets").includes("sprites"));
    assert(tabsOf("assets").includes("draws"));
});

Deno.test("Help holds the graph and nothing else", () => {
    assertEquals(tabsOf("help"), ["help"]);
    assertEquals(CATEGORY_META.help.label, "Graph");
});

Deno.test("every tab appears in exactly one group", () => {
    // A tab in two groups renders twice; a tab in none is unreachable.
    const all = MENU_GROUPS.flatMap((g) => g.categories);
    assertEquals(new Set(all).size, all.length, "a tab is listed in two groups");
    for (const key of Object.keys(CATEGORY_META)) {
        assert(all.includes(key as never), `${key} is not in any group`);
    }
});

// ── every saveable screen can actually save ──────────────────────────────────

Deno.test("every screen with a config key can be saved and deleted", () => {
    // A tab with a `configKey` and no upsert is a screen that lists, accepts a
    // form, validates it, and then silently does nothing on save: `saveForm`
    // returns early when the dispatch has no entry. Two screens were in exactly
    // that state — upgrade categories and input bindings — and neither the type
    // system nor the suite could see it, because the fault is a *missing* table
    // entry rather than a wrong one.
    const missingSave: string[] = [];
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        if (!CATEGORY_META[cat].configKey) continue;
        if (!UPSERT[cat]) missingSave.push(`${cat} (upsert)`);
        if (!REMOVE[cat]) missingSave.push(`${cat} (remove)`);
    }
    assertEquals(missingSave, [], `screens that cannot be saved: ${missingSave.join(", ")}`);
});

Deno.test("the dispatch tables have no entry for a screen without storage", () => {
    // The other direction: a handler for a tab that stores nothing is dead code
    // that reads as if the screen were wired.
    const stray: string[] = [];
    for (const cat of Object.keys(UPSERT)) {
        if (!CATEGORY_META[cat as keyof typeof CATEGORY_META]?.configKey) stray.push(String(cat));
    }
    assertEquals(stray, [], `dispatch entries with nothing to store: ${stray.join(", ")}`);
});

Deno.test("every saveable screen has form fields", () => {
    // A configKey with no field list would render a form with nothing on it.
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        if (!CATEGORY_META[cat].configKey) continue;
        assert(fieldsFor(cat).length > 0, `${cat} stores entries but has no fields`);
    }
});

Deno.test("group hints say what the group is for", () => {
    for (const g of MENU_GROUPS) {
        assert(g.hint.length > 0, `${g.key} has no hint`);
        // A hint that just repeats the label tells the reader nothing.
        assert(g.hint.toLowerCase() !== g.label.toLowerCase(), `${g.key} hint is its label`);
    }
});
// ── the native list under a reference field ──────────────────────────────────

Deno.test("every reference list says where its options came from", () => {
    // The native box renders from `source`. A list that omits it produces a
    // field with no summary at all, and the user is back to opening the
    // dropdown to find out whether the list is even complete.
    const list = listElements();
    assert(list.length > 0, "no elements to check");
    for (const o of list) {
        assert(
            o.source === "game" || o.source === "mod",
            `${o.value} has no source, so it will not appear in any native list`,
        );
    }
});

Deno.test("the native list separates the game's elements from ours", () => {
    store.config = {
        version: 1,
        elements: [{ id: "mdmy.acid", name: "Acid" }],
    };
    try {
        const list = listElements();
        const game = list.filter((o) => o.source === "game");
        const mine = list.filter((o) => o.source === "mod");
        assert(game.some((o) => o.value === "Sand"), "a game element is not marked as the game's");
        assertEquals(mine.map((o) => o.value), ["mdmy.acid"]);
    } finally {
        delete store.config;
    }
});

Deno.test("an entry we made stays marked as ours even once it is registered", () => {
    // Ours goes into the game registry on apply, so after the first apply the
    // same element comes back from *both* sources. It must still be counted
    // once, as ours — the mod's own list is the more useful of the two facts.
    store.config = { version: 1, elements: [{ id: "Sand", name: "Our Sand" }] };
    try {
        const sand = listElements().filter((o) => o.value === "Sand");
        assertEquals(sand.length, 1, "the element is listed twice");
        assertEquals(sand[0].source, "mod");
    } finally {
        delete store.config;
    }
});

Deno.test("an option with no source renders no box rather than a wrong count", () => {
    // A hand-written option list (a fixed role list, say) has no origins. The
    // box must stay silent instead of claiming "0 in the game".
    const handWritten = fieldsFor("energy")
        .flatMap((f) => (Array.isArray(f.options) ? f.options : []));
    for (const o of handWritten) {
        assertEquals(
            o.source,
            undefined,
            `"${o.value}" claims an origin it cannot know — a hand-written list has none`,
        );
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

// ── the two view-only screens ────────────────────────────────────────────────

Deno.test("draws reports which structures use each draw function", () => {
    const cfg = {
        structures: [
            { id: "a", drawKey: "outline" },
            { id: "b", drawKey: "outline" },
            { id: "c" },
            { id: "d", drawKey: "hidden" },
        ],
    };
    assertEquals(usageOf(cfg, "outline"), ["a", "b"]);
    assertEquals(usageOf(cfg, "hidden"), ["d"]);
    // A structure that names nothing uses nothing. Counting it would report a
    // "default" the config never asked for.
    assertEquals(usageOf(cfg, "default"), []);
});

Deno.test("draws flags a key this build does not know", () => {
    // The case worth catching: a typo'd or stale draw key leaves a structure
    // silently drawing the old way. The counts above only add up for keys we
    // recognise, so the unknown ones have to be named outright.
    assertEquals(unknownDrawKeys({ structures: [{ id: "a", drawKey: "outline" }] }), []);
    assertEquals(unknownDrawKeys({ structures: [{ id: "a", drawKey: "glowww" }] }), ["glowww"]);
    // No structures at all is not a finding.
    assertEquals(unknownDrawKeys({}), []);
    assertEquals(unknownDrawKeys({ structures: [{ id: "a" }] }), []);
});

Deno.test("every draw key the picker offers is one the draws screen explains", () => {
    // The picker and the catalogue are two places that can drift. If the picker
    // offers a key the screen cannot explain, the user picked a mystery.
    const picker = listDrawFunctions();
    for (const o of picker) {
        const d = DRAW_FUNCTIONS.find((x) => x.key === o.value);
        assert(d, `the picker offers "${o.value}" but DRAW_FUNCTIONS has no entry`);
        assert(o.label.includes(d.doc), `"${o.value}" is listed without its explanation`);
    }
    for (const d of DRAW_FUNCTIONS) {
        assert(
            picker.some((o) => o.value === d.key),
            `DRAW_FUNCTIONS has "${d.key}" but the picker cannot select it`,
        );
    }
});

Deno.test("the Tooltips screen is the interactions screen, under Extend", () => {
    // The engine's own word for this feature is "tooltip interactions" —
    // `terrains.d.ts` says "Tooltip interactions shown for this terrain", and
    // `InteractionStructureMetadata` is documented as "optional *tooltip*
    // metadata". The old label, "Element ↔ structure", named one of the seven
    // kinds and so misdescribed the other six.
    assertEquals(CATEGORY_META.interactions.label, "Tooltips");
    const extend = MENU_GROUPS.find((g) => g.key === "extend");
    assert(extend, "the Extend group is gone");
    assert(extend.categories.includes("interactions"), "Tooltips is not under Extend");
    // And it is not also hiding under Content, which is where it used to be.
    for (const g of MENU_GROUPS) {
        if (g.key === "extend") continue;
        assert(
            !g.categories.includes("interactions"),
            `${g.label} also lists Tooltips — it must appear in exactly one group`,
        );
    }
});

Deno.test("there is one screen named Tooltips, not two", () => {
    // There used to be a view-only "Tooltips" tab collecting tooltip text from
    // other screens, sitting alongside the real editor. Two screens with the
    // same name is worse than neither: whichever one you meant, you had a
    // fifty-fifty guess.
    const named = Object.entries(CATEGORY_META)
        .filter(([, m]) => m.label === "Tooltips")
        .map(([k]) => k);
    assertEquals(named, ["interactions"], `Tooltips appears on: ${named.join(", ")}`);
});

Deno.test("the view-only Custom draw screen owns no storage and no fields", () => {
    // It explains the draw functions and reports which structures use them. A
    // configKey here would mean the panel rendered a list and a form, and
    // "+ New" would create entries the engine never reads — unlike Tooltips,
    // which has a real editor to merge into, because an interaction is data.
    assertEquals(
        CATEGORY_META.draws.configKey,
        undefined,
        "Custom draw must not own storage — it is a view over other screens",
    );
    assertEquals(fieldsFor("draws"), [], "Custom draw must not have form fields");
    assert(!UPSERT.draws, "Custom draw must not have a save handler");
});

Deno.test("the Custom draw screen renders headlessly", () => {
    // The screen tests cover json/handlers/help/map. This one was added later
    // and was blank in the panel until then; the regression worth guarding is
    // "falls through to the generic list and renders nothing".
    const seen: string[] = [];
    const h = (tag: string, _props: unknown, ..._kids: unknown[]) => {
        seen.push(String(tag));
        return { tag };
    };
    const cfg = { structures: [{ id: "s1", drawKey: "outline" }] };
    const out = renderDraws({ h: h as never, cfg, onGoTo: () => {} });
    assert(out, "the draw screen rendered nothing");
    assert(seen.includes("button"), "no jump buttons — the rows go nowhere");
    assert(seen.length > 10, "suspiciously little output");
});

Deno.test("no select is left with an empty or missing list", () => {
    // An empty `options` array is a picker that shows nothing. It reads as a
    // broken control rather than as "there is nothing to pick yet", so it has
    // to fail here rather than in front of someone mid-build.
    const empty: string[] = [];
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        for (const f of fieldsFor(cat as never)) {
            if (f.kind !== "select" && f.kind !== "multiselect") continue;
            if (Array.isArray(f.options) && f.options.length === 0) empty.push(`${cat}.${f.key}`);
        }
    }
    assertEquals(empty, [], `pickers with nothing to pick: ${empty.join(", ")}`);
});

Deno.test("a select's list is either live or deliberately closed", () => {
    // The two kinds of list, and the point of telling them apart: a *live* list
    // reads the game or the config and must be a function, so it re-reads when
    // the config changes. A *closed* list is a fixed set the engine defines —
    // a build mode, an energy role, a behaviour kind — and being a literal is
    // correct, because there is nothing to read.
    //
    // What is not fine is a literal list of ids. That is a snapshot of
    // something live, and it will go stale the moment the game or the config
    // moves, with nothing to notice.
    const SNAPSHOT = /^(md-my-hown-mod:|mdmy\.)/;
    const bad: string[] = [];
    let live = 0;
    let closed = 0;
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        for (const f of fieldsFor(cat as never)) {
            if (f.kind !== "select" && f.kind !== "multiselect") continue;
            if (typeof f.options === "function") {
                live++;
                continue;
            }
            closed++;
            for (const o of f.options ?? []) {
                if (SNAPSHOT.test(o.value)) bad.push(`${cat}.${f.key} → ${o.value}`);
            }
        }
    }
    assertEquals(
        bad,
        [],
        `closed lists must hold the engine's own values, never mod ids:\n${bad.join("\n")}`,
    );
    // Sanity: both kinds exist, so the test above is not passing vacuously.
    assert(live > 20, `only ${live} live lists — is the audit still looking at the right thing?`);
    assert(closed > 0, "no closed lists at all — the audit is not checking anything");
});

// ── the free-text audit, as an invariant rather than a one-time sweep ─────────

/**
 * The `text` fields that are *allowed* to be free, and why.
 *
 * The rule the audit enforces is not "no text fields" — plenty of fields really
 * are free strings, and pretending otherwise would mean inventing broken
 * pickers for things the engine takes as arbitrary text. The rule is that a
 * reference-like field must be a picker, and a field that is genuinely free must
 * say so here, in one place, with a reason.
 *
 * Keyed `screen.key`. Adding a new free text box to a screen therefore fails
 * this test until somebody has decided whether it is a reference — which is the
 * whole point. A silent text box is how an id typo reaches the engine.
 */
const ALLOWED_FREE_TEXT: Record<string, string> = {
    // Names and labels. Free by definition.
    "name": "a display name, not a reference",
    "nameKey": "an i18n key; the game looks it up in a translation table we cannot read",
    "description": "free prose shown to the player in the tooltip body",
    "descriptionKey": "an i18n key, the translatable form of the line above",
    "notes": "a note to yourself; the engine never reads this field at all",
    "displayName": "a plain label in the settings list, grouped by the field below",
    "displayNameKey": "an i18n key for that settings label",
    "itemNameKey": "an i18n key for the item's name in the upgrade list",
    "upgradeNameKey": "an i18n key for the upgrade level's own name",
    "tipTextKey": "an i18n key for the element's hover text",
    // Not a reference.
    "idSuffix": "the mod builds the id from this; it is a name we are making up",
    "upgradeId": "the upgrade's own id within its item, not a pointer at anything",
    "category": "a settings heading; the game groups by string equality, " +
        "not by a registered category",
    // Escape hatches for values the picker cannot enumerate. Each of these only
    // appears when its paired select is set to `__custom__`.
    "currencyTypeCustom": "only shown when currencyType is `__custom__`; the " +
        "currency ids are a free string in the engine with no list API",
    "branchCustom": "only shown when branch is `__custom__`; same, no list API",
    "hookCustom": "only shown when hookId is `__custom__`; hooks are " +
        "namespace:verb strings with no registry",
    // Genuinely unknowable.
    "entities": "there is no entity registry to enumerate — the engine has no " +
        "list call for entity types, so a picker would be a guess",
};

Deno.test("every text field is a picker, or is on the free-text list", () => {
    // The audit. A reference-like field left as a text box is how a typo'd id
    // reaches the engine and fails silently in-game, so this fails loudly here
    // instead.
    const strays: string[] = [];
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        for (const f of fieldsFor(cat as never)) {
            if (f.kind !== "text") continue;
            if (!(f.key in ALLOWED_FREE_TEXT)) {
                strays.push(`${cat}.${f.key}`);
            }
        }
    }
    assertEquals(
        strays,
        [],
        `text fields with no decision recorded: ${strays.join(", ")}\n` +
            "Either it references something and needs a picker, or it is free and " +
            "belongs in ALLOWED_FREE_TEXT with a reason.",
    );
});

Deno.test("the free-text list has no entries for fields that no longer exist", () => {
    // The other direction. A stale entry would let a field be reintroduced as
    // free text without anybody looking at it again.
    const live = new Set<string>();
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        for (const f of fieldsFor(cat as never)) live.add(f.key);
    }
    const stale = Object.keys(ALLOWED_FREE_TEXT).filter((k) => !live.has(k));
    assertEquals(
        stale,
        [],
        `ALLOWED_FREE_TEXT lists fields that do not exist: ${stale.join(", ")}`,
    );
});

Deno.test("every free-text exemption is a real reason, not a shrug", () => {
    for (const [key, why] of Object.entries(ALLOWED_FREE_TEXT)) {
        assert(why.length > 20, `"${key}" is exempt with the reason "${why}" — say more`);
    }
});

Deno.test("a free-text field that names a category is a reference, not a label", () => {
    // The one that actually bit. `upgrades.categoryId` was a text box whose own
    // hint said it "must match a category registered with
    // api.upgrades.registerCategory" — an instruction to go and look the id up
    // somewhere else. It is a picker now.
    assertEquals(field("upgrades", "categoryId")?.kind, "select");
    const opts = listUpgradeCategoryIds();
    // `tools` is the default every upgrade lands in when the field is left alone,
    // so a picker that omitted it would send people hunting for it.
    assert(
        opts.some((o) => o.value === "tools"),
        "the default category is not offered",
    );
    assert(
        opts.some((o) => o.value === "__custom__"),
        "a game category we cannot enumerate needs a documented way in",
    );
});

Deno.test("the category picker never writes its escape hatch into the config", () => {
    // `__custom__` is a UI affordance, not an id. Writing it out would register
    // an upgrade under a category literally named `__custom__`, which would
    // fail at runtime in a way nothing in the panel could explain.
    const entry = formToEntry("upgrades", {
        idSuffix: "u1",
        itemId: "anItem",
        categoryId: "__custom__",
        upgradeId: "lvl1",
        maxLevel: "3",
    });
    assertEquals(
        (entry as { categoryId?: string }).categoryId,
        undefined,
        "the escape hatch leaked into the config",
    );
    // And a real category still round-trips.
    const ok = formToEntry("upgrades", {
        idSuffix: "u1",
        itemId: "anItem",
        categoryId: "tools",
        upgradeId: "lvl1",
        maxLevel: "3",
    });
    assertEquals((ok as { categoryId?: string }).categoryId, "tools");
});

// ── "what already exists", at the top of the panel ───────────────────────────

Deno.test("only screens with something to enumerate get a native summary", () => {
    // A recipe, a trigger or a signal is something the *mod* defines — there is
    // nothing in the game to list before you have written one. Offering the
    // section there would mean a box that opens onto "nothing", which is worse
    // than no box: it implies the game might have some.
    const PANEL_NATIVES = natives;
    for (const key of Object.keys(PANEL_NATIVES)) {
        assert(CATEGORY_META[key as keyof typeof CATEGORY_META], `${key} is not a real screen`);
    }
    for (const key of ["recipes", "triggers", "signals", "techs", "modifiers"]) {
        assert(
            !PANEL_NATIVES[key as keyof typeof PANEL_NATIVES],
            `${key} has no in-game registry, so it must not claim a native list`,
        );
    }
    // And the five that do have one are the ones that can be referenced by id.
    for (const key of ["elements", "structures", "items", "terrains", "sprites"]) {
        assert(PANEL_NATIVES[key as keyof typeof PANEL_NATIVES], `${key} should list what exists`);
    }
});

Deno.test("every panel native list actually returns something", () => {
    // A registered list that comes back empty is a silent no-op: the section
    // simply never renders and nobody finds out why. Under the test stub only
    // elements and terrains are populated, so this checks the wiring rather than
    // the count.
    const PANEL_NATIVES = natives;
    for (const [key, list] of Object.entries(PANEL_NATIVES)) {
        const opts = list();
        assert(Array.isArray(opts), `${key} did not return a list`);
        if (opts.length) {
            for (const o of opts) {
                assert(o.value, `${key} listed an option with no id`);
            }
        }
    }
    // The stub registers two elements, so the elements panel must have something
    // to show. This is the check that would fail if `PANEL_NATIVES` pointed at
    // the wrong function.
    assert(
        PANEL_NATIVES.elements!().length > 0,
        "the elements panel has a live list but it came back empty",
    );
});

Deno.test("a panel native list counts the game and this mod separately", () => {
    // The summary has to distinguish them, because the two answer different
    // questions: "what does the game have" and "what have I already made".
    store.config = { version: 1, elements: [{ id: "mdmy.acid", name: "Acid" }] };
    try {
        const PANEL_NATIVES = natives;
        const opts = PANEL_NATIVES.elements!();
        const game = opts.filter((o) => o.source === "game");
        const mine = opts.filter((o) => o.source === "mod");
        assert(game.length > 0, "the game's own elements are not counted");
        assertEquals(mine.map((o) => o.value), ["mdmy.acid"]);
        // Every option must be attributed to one side or the other, or the
        // summary's two numbers would not add up to the total it displays.
        assertEquals(game.length + mine.length, opts.length);
    } finally {
        delete store.config;
    }
});
