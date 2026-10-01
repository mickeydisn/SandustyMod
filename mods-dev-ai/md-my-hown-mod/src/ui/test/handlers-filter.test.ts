
import { assert, assertEquals } from "https:
import { ACTION_DOCS } from "../../handler/actions/index.ts";
import {
    BLOCK_META,
    HANDLER_META,
    handlerMeta,
    handlersOnlyAtSlot,
    type HandlerUsage,
    isOnlyAtSlot,
} from "../../handler/core/handler-registry.ts";
import { canRunAt, needsOf } from "../../handler/core/scope.ts";
import { PROJECTILE_OPTIONS } from "../../handler/projectile-option/index.ts";
import { filterActions, filterProjectileOptions, initialHandlersState } from "../panel/handlers.ts";


const SCHEMA_SRC = Deno.readTextFileSync(
    new URL("../schema.ts", import.meta.url).pathname,
);

const DOCS = ACTION_DOCS;
const NONE: Record<string, HandlerUsage[]> = {};

const keys = (patch: Partial<ReturnType<typeof initialHandlersState>>) =>
    filterActions(HANDLER_META, { ...initialHandlersState(), ...patch }, NONE, DOCS)
        .map((m) => m.key);

const USED: Record<string, HandlerUsage[]> = {
    noop: [{ category: "signals", id: "s1", slot: "signal", key: "noop" }],
};


const usedKeys = (patch: Partial<ReturnType<typeof initialHandlersState>>) =>
    filterActions(HANDLER_META, { ...initialHandlersState(), ...patch }, USED, DOCS)
        .map((m) => m.key);

Deno.test("the unfiltered list is every action, in alphabetical order", () => {
    const all = keys({});
    assertEquals(all.length, HANDLER_META.length);
    
    
    
    
    
    
    
    
    
    
    
    assertEquals([...all].sort((a, b) => a.localeCompare(b)), all, "not sorted");
    
    
    
    
    const byDefault = [...all].sort();
    assert(
        byDefault.join() !== all.join(),
        "case-sensitive and case-insensitive order now agree, so this file can say " +
            "which collation it means without checking",
    );
    
    
    
    
    
    
    
    
    
    assertEquals(all[0], "addVelocity");
    
    for (const key of Object.keys(PROJECTILE_OPTIONS)) {
        assert(!all.includes(key), `${key} is listed as an action again`);
    }
});

Deno.test("each axis on its own actually filters", () => {
    
    
    const all = keys({}).length;
    for (
        const [name, patch] of [
            ["domain", { domain: "energy" }],
            ["effect", { effect: "commits" }],
            
            
            
            
            
            ["need", { need: "commit" }],
            ["callSite", { callSite: "trigger" }],
            ["query", { query: "processor" }],
        ] as const
    ) {
        const n = keys(patch).length;
        assert(n > 0, `${name} matched nothing — the chip would look dead`);
        assert(n < all, `${name} matched everything — the chip would do nothing`);
    }
    
    assert(usedKeys({ onlyUsed: true }).length < all, "onlyUsed did nothing");
});

Deno.test("the axes combine, and an impossible combination is empty, not an error", () => {
    
    
    
    
    
    
    
    
    assertEquals(keys({ callSite: "trigger", need: "commit" }), []);
    assertEquals(keys({ callSite: "trigger", need: "pos" }), []);
    
    const narrow = keys({ domain: "energy", effect: "api" });
    assert(narrow.includes("energyConsumePerRun"), "consume is energy + api");
    assert(!narrow.includes("energyBank"), "bank is energy but only returns");
});

Deno.test("the call-site filter is the scope rule, not the declared slots", () => {
    
    
    const forTrigger = keys({ callSite: "trigger" });
    for (const k of forTrigger) {
        assert(needsOf(k).length === 0, `${k} needs something a trigger never sends`);
    }
    assert(!forTrigger.includes("triggerScan"), "and it reads a position");
    assert(forTrigger.includes("triggerLog"), "but a log needs nothing");
});

Deno.test("search reaches the description and the domain, not just the key", () => {
    
    
    assert(keys({ query: "convert" }).includes("processorConvert"));
    assertEquals(keys({ query: "energy" }).filter((k) => k.startsWith("energy")).length, 7);
    assertEquals(
        keys({ query: "  ENERG  " }).length,
        keys({ query: "energ" }).length,
        "case/space",
    );
});

Deno.test("'in use' shows only what a process really references", () => {
    
    
    
    assertEquals(keys({ onlyUsed: true }), []);
    assertEquals(usedKeys({ onlyUsed: true }), ["noop"]);
    assertEquals(usedKeys({}).length, HANDLER_META.length, "unfiltered is unaffected");
});

Deno.test("an unknown filter value yields nothing rather than everything", () => {
    
    
    assertEquals(keys({ domain: "nonsense" as never }), []);
    assertEquals(keys({ effect: "nonsense" as never }), []);
    assertEquals(keys({ callSite: "nonsense" }), []);
});



Deno.test("Handlers is down to Actions and Processes, and the rest are attached", () => {
    
    
    
    
    
    
    
    
    
    
    
    const group = /key: "handlers",[\s\S]*?categories: (\[[^\]]*\])/.exec(SCHEMA_SRC);
    assert(group, "the handlers menu group is missing from schema.ts");
    
    
    
    assertEquals(
        group[1].replace(/\s+/g, "").replace(/,\]$/, "]"),
        '["action","customProcess"]',
    );
    
    
    
    for (
        const [tab, label] of [
            ["action", "Actions"],
            ["customProcess", "Processes"],
        ]
    ) {
        assert(
            new RegExp(`${tab}: \\{\\s*label: "${label}"`).test(SCHEMA_SRC),
            `the ${tab} tab has no label`,
        );
    }
    
    
    for (
        const [tab, label] of [
            ["projectileOption", "Projectile options"],
            ["excavationOption", "Excavation options"],
            ["upgradeAction", "Upgrade actions"],
        ]
    ) {
        assert(
            new RegExp(`${tab}: \\{\\s*label: "${label}"`).test(SCHEMA_SRC),
            `the ${tab} screen has no label`,
        );
    }
    
    
    
    assert(!/^\s*"?handlers"?:/m.test(SCHEMA_SRC), "the handlers tab is back");
});

Deno.test("the upgrade-only actions are split out, and only those", () => {
    
    
    
    
    
    
    const isolated = handlersOnlyAtSlot("upgrade");
    const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
    assertEquals(isolated.length, 7, "the upgrade-only count changed — recheck the split");
    
    assertEquals(isolated.length + general.length, HANDLER_META.length);
    assertEquals(
        isolated.map((m) => m.key).sort(),
        [
            "techAppendUnlock",
            "techGrantItem",
            "techSetUpgradeLevel",
            "upgradeAdd",
            "upgradeCountLevel",
            "upgradeLog",
            "upgradeScale",
        ],
    );
    
    for (const m of isolated) {
        assertEquals(m.slots, ["upgrade"], `${m.key} is not upgrade-only`);
    }
    
    
    
    
    assert(
        canRunAt("noop", "upgrade"),
        "noop can no longer run at an upgrade — the model changed",
    );
    assert(!isOnlyAtSlot(handlerMeta("noop")!, "upgrade"), "noop leaked into the split");
    assert(general.some((m) => m.key === "noop"), "noop vanished from the general list");
});

Deno.test("neither screen carries an in-panel switcher", () => {
    
    
    
    
    
    const state = initialHandlersState();
    assertEquals(
        Object.keys(state).includes("panel"),
        false,
        "the handler state still has a `panel` — the switcher is coming back",
    );
    
    assert("query" in state, "the shared search box is gone");
    assert("onlyUsed" in state, "the shared in-use toggle is gone");
});

Deno.test("the options filter ignores the action-only axes", () => {
    
    
    
    
    const all = filterProjectileOptions("", false, {});
    assertEquals(all.length, Object.keys(PROJECTILE_OPTIONS).length);
    
    assertEquals(filterProjectileOptions("homing", false, {}).map((o) => o.key), [
        "projectileHoming",
    ]);
    const used = filterProjectileOptions("", true, { projectileFast: 2 });
    assertEquals(used.map((o) => o.key), ["projectileFast"]);
    assert(used[0].params.length > 0, "the options carry their parameters");
});

Deno.test("the split partitions the catalogue with nothing lost or doubled", () => {
    
    
    
    
    const isolated = handlersOnlyAtSlot("upgrade");
    const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
    assertEquals(isolated.length + general.length, HANDLER_META.length);
    
    
    
    const multi = HANDLER_META.filter((m) => m.slots.length > 1);
    for (const m of multi) {
        assert(!isolated.includes(m), `${m.key} is multi-slot but landed in the isolated list`);
        assert(general.includes(m), `${m.key} is multi-slot but is missing from the general list`);
    }
});

Deno.test("a filter that outlived its options is still clearable", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    
    const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
    assertEquals(
        filterActions(general, { ...initialHandlersState(), domain: "tech" }, NONE, DOCS).length,
        0,
        "the Actions list has no tech rows, so the chip must be gone",
    );
    
    
    assert(
        filterActions(general, { ...initialHandlersState(), domain: "energy" }, NONE, DOCS)
            .length > 0,
        "a present domain still filters",
    );
});

Deno.test("the if block is listed, and is not an action", () => {
    
    
    
    const listed = filterActions(
        [...HANDLER_META, BLOCK_META],
        initialHandlersState(),
        NONE,
        DOCS,
    ).map((m) => m.key);
    assert(listed.includes("if"), "the block is not in the list");
    assertEquals(
        HANDLER_META.filter((m) => m.key === "if").length,
        0,
        "a block must not be in the action catalogue",
    );
    assertEquals(BLOCK_META.type, "block");
    assertEquals(BLOCK_META.params.map((p) => p.key), ["var"]);
});

Deno.test("a block drops out as soon as an axis filter is set", () => {
    
    
    
    const withBlock = [...HANDLER_META, BLOCK_META];
    const filtered = (patch: Record<string, unknown>) =>
        filterActions(withBlock, { ...initialHandlersState(), ...patch }, NONE, DOCS)
            .map((m) => m.key);
    assert(filtered({}).includes("if"), "present with no filter");
    for (
        const axis of [
            { need: "pos" },
            { callSite: "signal" },
            { domain: "grid" },
            { effect: "returns" },
        ]
    ) {
        assert(
            !filtered(axis).includes("if"),
            `a block answered the "${Object.keys(axis)[0]}" filter`,
        );
    }
});

Deno.test("the block is still findable by searching for what it does", () => {
    
    
    const found = filterActions(
        [...HANDLER_META, BLOCK_META],
        { ...initialHandlersState(), query: "branches" },
        NONE,
        { ...DOCS, if: "run one list of steps, otherwise run another; both branches compile" },
    ).map((m) => m.key);
    assertEquals(found, ["if"], "searching 'branches' finds the block and nothing else");
});
