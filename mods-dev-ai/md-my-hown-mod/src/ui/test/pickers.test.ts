
import { assert, assertEquals } from "jsr:@std/assert";






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
const { ATTACHED, attachedTo, parentOf } = await import("../panel/attach.ts");



Deno.test("there is no World group any more", () => {
    assert(!MENU_GROUPS.some((g) => g.key === "world"), "the World group is back");
    assert(!MENU_GROUPS.some((g) => g.label === "World"));
});

Deno.test("terrains live under Content", () => {
    assert(tabsOf("content").includes("terrains"));
    
    const owners = MENU_GROUPS.filter((g) => g.categories.includes("terrains"));
    assertEquals(owners.map((g) => g.key), ["content"]);
});

Deno.test("the menu is the nine groups, in the order that was asked for", () => {
    assertEquals(
        MENU_GROUPS.map((g) => g.key),
        [
            "content",
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
    
    
    
    
    for (const key of ["systems", "hooks", "extend"]) {
        assert(!MENU_GROUPS.some((g) => g.key === key), `the ${key} group is back`);
    }
    assert(!MENU_GROUPS.some((g) => g.label === "Assets & hooks"), "the merged group is back");
    assert(!MENU_GROUPS.some((g) => g.label === "Extend"), "the Extend group is back");
});

Deno.test("the screens sit in the groups that were asked for, in order", () => {
    
    
    
    
    
    
    assertEquals(tabsOf("content"), [
        "terrains",
        "elements",
        "structures",
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        "items",
        "buffers",
    ]);
    assertEquals(tabsOf("production"), ["contacts", "recipes"]);
    
    
    
    
    
    assertEquals(tabsOf("tech"), ["techs", "upgrades"]);
    assertEquals(tabsOf("actions"), ["triggers", "inputs", "processing", "modifiers"]);
    assertEquals(tabsOf("energy"), ["networks", "energy"]);
    assertEquals(tabsOf("assets"), ["sprites", "spriteEditor", "draws"]);
    
    
    
    
    assertEquals(tabsOf("handlers"), ["action", "customProcess"]);
    assertEquals(tabsOf("help"), ["help"], "Help must be the graph, and only the graph");
    assertEquals(tabsOf("data"), ["map", "json"]);
});

Deno.test("the qualifying lists hang off the thing they qualify", () => {
    
    
    
    
    
    assertEquals(attachedTo("elements"), ["interactions"]);
    
    
    
    assertEquals(attachedTo("structures"), ["placementConfigs", "behaviors", "signals"]);
    
    
    assertEquals(attachedTo("items"), [
        "excavation",
        "projectiles",
        "excavationOption",
        "projectileOption",
    ]);
    
    
    
    assertEquals(attachedTo("techs"), ["unlockNodes"]);
    assertEquals(attachedTo("upgrades"), ["categories", "upgradeAction"]);
    
    
    for (const cat of ["terrains", "recipes", "sprites", "contacts", "triggers"]) {
        assertEquals(attachedTo(cat as never), [], `${cat} should have nothing attached`);
    }
    
    
    
    
    
    for (const cat of ["excavationOption", "projectileOption"] as const) {
        assert(
            !CATEGORY_META[cat].configKey,
            `${cat} became a stored list — it now needs a form and a save path`,
        );
        assertEquals(fieldsFor(cat).length, 0, `${cat} must not have an entry form`);
    }
    
    
    for (const [parent, children] of Object.entries(ATTACHED)) {
        for (const child of children) {
            assert(CATEGORY_META[child], `${child} is attached but is not a screen`);
            assertEquals(parentOf(child as never), parent as never, `${child} → ${parent}`);
        }
    }
});

Deno.test("every tab is either in one group or attached to one", () => {
    
    
    
    const all = MENU_GROUPS.flatMap((g) => g.categories);
    assertEquals(new Set(all).size, all.length, "a tab is listed in two groups");
    const attached = Object.values(ATTACHED).flat();
    for (const key of Object.keys(CATEGORY_META)) {
        const inGroup = all.includes(key as never);
        const isAttached = attached.includes(key as never);
        assert(
            inGroup !== isAttached,
            `${key} is ${inGroup ? "in a group" : "not in one"} and ${
                isAttached ? "attached" : "not attached"
            } — it must be exactly one or the other`,
        );
    }
});

Deno.test("Sprites and Custom draw are listed apart, not merged", () => {
    
    
    
    assertEquals(tabsOf("assets"), ["sprites", "spriteEditor", "draws"]);
    assert(tabsOf("assets").includes("sprites"));
    assert(tabsOf("assets").includes("draws"));
});

Deno.test("Help holds the graph and nothing else", () => {
    assertEquals(tabsOf("help"), ["help"]);
    assertEquals(CATEGORY_META.help.label, "Graph");
});



Deno.test("every screen with a config key can be saved and deleted", () => {
    
    
    
    
    
    
    const missingSave: string[] = [];
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        if (!CATEGORY_META[cat].configKey) continue;
        if (!UPSERT[cat]) missingSave.push(`${cat} (upsert)`);
        if (!REMOVE[cat]) missingSave.push(`${cat} (remove)`);
    }
    assertEquals(missingSave, [], `screens that cannot be saved: ${missingSave.join(", ")}`);
});

Deno.test("the dispatch tables have no entry for a screen without storage", () => {
    
    
    const stray: string[] = [];
    for (const cat of Object.keys(UPSERT)) {
        if (!CATEGORY_META[cat as keyof typeof CATEGORY_META]?.configKey) stray.push(String(cat));
    }
    assertEquals(stray, [], `dispatch entries with nothing to store: ${stray.join(", ")}`);
});

Deno.test("every saveable screen has form fields", () => {
    
    for (const cat of Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]) {
        if (!CATEGORY_META[cat].configKey) continue;
        assert(fieldsFor(cat).length > 0, `${cat} stores entries but has no fields`);
    }
});

Deno.test("group hints say what the group is for", () => {
    for (const g of MENU_GROUPS) {
        assert(g.hint.length > 0, `${g.key} has no hint`);
        
        assert(g.hint.toLowerCase() !== g.label.toLowerCase(), `${g.key} hint is its label`);
    }
});


Deno.test("every reference list says where its options came from", () => {
    
    
    
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



Deno.test("linkedClearance is a select, not a text box", () => {
    assertEquals(field("structures", "linkedClearance")?.kind, "select");
});

Deno.test("linkedClearance offers exactly the two states the engine knows", () => {
    
    
    const opts = listLinkedClearance();
    assertEquals(opts.map((o) => o.value), ["", "allOrNothing"]);
});

Deno.test("materialId is a select, not a free number", () => {
    assertEquals(field("terrains", "materialId")?.kind, "select");
});

Deno.test("materialId offers only values the engine accepts", () => {
    
    for (const o of listMaterialIds()) {
        if (o.value === "") continue;
        const n = Number(o.value);
        assert(Number.isInteger(n), `${o.value} is not an integer`);
        assert(n > 100 && n < 150, `${o.value} is outside 101-149 and the engine would throw`);
    }
});

Deno.test("materialId leads with the engine's own next-free id", () => {
    const opts = listMaterialIds();
    
    assertEquals(opts[0].value, "");
    assert(opts[1].value === "101", `expected 101 as next-free, got ${opts[1].value}`);
    assert(opts[1].label.includes("next free"));
});

Deno.test("no multiselect falls back to free text", () => {
    
    
    
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
    
    
    assertEquals(usageOf(cfg, "default"), []);
});

Deno.test("draws flags a key this build does not know", () => {
    
    
    
    assertEquals(unknownDrawKeys({ structures: [{ id: "a", drawKey: "outline" }] }), []);
    assertEquals(unknownDrawKeys({ structures: [{ id: "a", drawKey: "glowww" }] }), ["glowww"]);
    
    assertEquals(unknownDrawKeys({}), []);
    assertEquals(unknownDrawKeys({ structures: [{ id: "a" }] }), []);
});

Deno.test("every draw key the picker offers is one the draws screen explains", () => {
    
    
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

Deno.test("the Tooltips screen is the interactions screen, under Elements", () => {
    
    
    
    
    
    assertEquals(CATEGORY_META.interactions.label, "Tooltips");
    
    
    const inMenu = MENU_GROUPS.filter((g) => g.categories.includes("interactions"));
    assertEquals(inMenu, [], "Tooltips must not be a menu chip again");
    assertEquals(attachedTo("elements"), ["interactions"], "Tooltips is not under Elements");
});

Deno.test("there is one screen named Tooltips, not two", () => {
    
    
    
    
    const named = Object.entries(CATEGORY_META)
        .filter(([, m]) => m.label === "Tooltips")
        .map(([k]) => k);
    assertEquals(named, ["interactions"], `Tooltips appears on: ${named.join(", ")}`);
});

Deno.test("the view-only Custom draw screen owns no storage and no fields", () => {
    
    
    
    
    assertEquals(
        CATEGORY_META.draws.configKey,
        undefined,
        "Custom draw must not own storage — it is a view over other screens",
    );
    assertEquals(fieldsFor("draws"), [], "Custom draw must not have form fields");
    assert(!UPSERT.draws, "Custom draw must not have a save handler");
});

Deno.test("the Custom draw screen renders headlessly", () => {
    
    
    
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
    
    assert(live > 20, `only ${live} live lists — is the audit still looking at the right thing?`);
    assert(closed > 0, "no closed lists at all — the audit is not checking anything");
});




const ALLOWED_FREE_TEXT: Record<string, string> = {
    
    "name": "a display name, not a reference",
    "nameKey": "an i18n key; the game looks it up in a translation table we cannot read",
    "description": "free prose shown to the player in the tooltip body",
    "descriptionKey": "an i18n key, the translatable form of the line above",
    
    
    
    "doc": "free prose about a process, shown in its list; the engine never reads it",
    "notes": "a note to yourself; the engine never reads this field at all",
    "displayName": "a plain label in the settings list, grouped by the field below",
    "displayNameKey": "an i18n key for that settings label",
    "itemNameKey": "an i18n key for the item's name in the upgrade list",
    "upgradeNameKey": "an i18n key for the upgrade level's own name",
    "tipTextKey": "an i18n key for the element's hover text",
    
    "idSuffix": "the mod builds the id from this; it is a name we are making up",
    "upgradeId": "the upgrade's own id within its item, not a pointer at anything",
    "category": "a settings heading; the game groups by string equality, " +
        "not by a registered category",
    
    
    "currencyTypeCustom": "only shown when currencyType is `__custom__`; the " +
        "currency ids are a free string in the engine with no list API",
    "branchCustom": "only shown when branch is `__custom__`; same, no list API",
    "hookCustom": "only shown when hookId is `__custom__`; hooks are " +
        "namespace:verb strings with no registry",
    
    "entities": "there is no entity registry to enumerate — the engine has no " +
        "list call for entity types, so a picker would be a guess",
    "runTickSharedBufferKey": "a shared-buffer key, which the mod invents when " +
        "it calls api.shared.buffers.ensure(key) — a buffer is created by naming " +
        "it, so there is no list of existing keys to pick from",
    
    
    
    
    
    "path": "an address inside the shared record; created by naming it, so there " +
        "is no list of existing paths to pick from",
    
    
    
    
    "default": "the value a slot starts at; constrained by `type`, not a reference",
};

Deno.test("every text field is a picker, or is on the free-text list", () => {
    
    
    
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
    
    
    
    
    assertEquals(field("upgrades", "categoryId")?.kind, "select");
    const opts = listUpgradeCategoryIds();
    
    
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
    
    const ok = formToEntry("upgrades", {
        idSuffix: "u1",
        itemId: "anItem",
        categoryId: "tools",
        upgradeId: "lvl1",
        maxLevel: "3",
    });
    assertEquals((ok as { categoryId?: string }).categoryId, "tools");
});



Deno.test("only screens with something to enumerate get a native summary", () => {
    
    
    
    
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
    
    for (const key of ["elements", "structures", "items", "terrains", "sprites"]) {
        assert(PANEL_NATIVES[key as keyof typeof PANEL_NATIVES], `${key} should list what exists`);
    }
});

Deno.test("every panel native list actually returns something", () => {
    
    
    
    
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
    
    
    
    assert(
        PANEL_NATIVES.elements!().length > 0,
        "the elements panel has a live list but it came back empty",
    );
});

Deno.test("a panel native list counts the game and this mod separately", () => {
    
    
    store.config = { version: 1, elements: [{ id: "mdmy.acid", name: "Acid" }] };
    try {
        const PANEL_NATIVES = natives;
        const opts = PANEL_NATIVES.elements!();
        const game = opts.filter((o) => o.source === "game");
        const mine = opts.filter((o) => o.source === "mod");
        assert(game.length > 0, "the game's own elements are not counted");
        assertEquals(mine.map((o) => o.value), ["mdmy.acid"]);
        
        
        assertEquals(game.length + mine.length, opts.length);
    } finally {
        delete store.config;
    }
});
