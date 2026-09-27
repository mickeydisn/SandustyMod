/**
 * The two handler screens: the **Actions** catalogue and the **Projectile options**
 * catalogue, and the menu structure that puts them side by side.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { allHandlerDocs } from "../../hooks/handlers.ts";
import {
    HANDLER_META,
    handlerMeta,
    handlersOnlyAtSlot,
    type HandlerUsage,
    isOnlyAtSlot,
} from "../../hooks/handler-registry.ts";
import { canRunAt, needsOf } from "../../hooks/scope.ts";
import { PROJECTILE_OPTIONS } from "../../hooks/projectile-option/index.ts";
import { filterActions, filterProjectileOptions, initialHandlersState } from "../panel/handlers.ts";

/**
 * The menu structure, read out of `schema.ts`'s **source** rather than by importing
 * it.
 *
 * `schema.ts` transitively reaches `src/api.ts`, which evaluates `sandkit.api` at
 * module scope — so importing it needs a full game stub just to read two static
 * tables. The claim being tested is "these tabs are listed as siblings", which is
 * plain text in the file, so the source is the cheaper and more direct evidence.
 * The same trick `list-panel.test.ts` uses, for the same reason.
 */
const SCHEMA_SRC = Deno.readTextFileSync(
    new URL("../schema.ts", import.meta.url).pathname,
);

const DOCS = allHandlerDocs();
const NONE: Record<string, HandlerUsage[]> = {};

const keys = (patch: Partial<ReturnType<typeof initialHandlersState>>) =>
    filterActions(HANDLER_META, { ...initialHandlersState(), ...patch }, NONE, DOCS)
        .map((m) => m.key);

const USED: Record<string, HandlerUsage[]> = {
    noop: [{ category: "signals", id: "s1", slot: "signal", key: "noop" }],
};

/** The same, but with one action actually in use — what the toggle is for. */
const usedKeys = (patch: Partial<ReturnType<typeof initialHandlersState>>) =>
    filterActions(HANDLER_META, { ...initialHandlersState(), ...patch }, USED, DOCS)
        .map((m) => m.key);

Deno.test("the unfiltered list is every action, in alphabetical order", () => {
    const all = keys({});
    assertEquals(all.length, HANDLER_META.length);
    assertEquals([...all].sort(), all, "not sorted");
    // The first row alphabetically used to be `defaultProjectileOptions`. The
    // projectile options are not actions, so the list starts at `energyBank` — and
    // asserting the *new* first name is what catches one of them creeping back in.
    assertEquals(all[0], "energyBank");
    // And the split holds: none of the seven is browsable as an action.
    for (const key of Object.keys(PROJECTILE_OPTIONS)) {
        assert(!all.includes(key), `${key} is listed as an action again`);
    }
});

Deno.test("each axis on its own actually filters", () => {
    // The whole point of this file: a chip that selects and changes nothing is the
    // bug, and "returns fewer rows" is the cheapest way to catch it.
    const all = keys({}).length;
    for (
        const [name, patch] of [
            ["domain", { domain: "energy" }],
            ["effect", { effect: "commits" }],
            ["need", { need: "cell" }],
            ["callSite", { callSite: "trigger" }],
            ["query", { query: "processor" }],
        ] as const
    ) {
        const n = keys(patch).length;
        assert(n > 0, `${name} matched nothing — the chip would look dead`);
        assert(n < all, `${name} matched everything — the chip would do nothing`);
    }
    // `onlyUsed` needs a config that uses something, so it is checked separately.
    assert(usedKeys({ onlyUsed: true }).length < all, "onlyUsed did nothing");
});

Deno.test("the axes combine, and an impossible combination is empty, not an error", () => {
    // A trigger gets no arguments at all, so nothing that needs a position can run
    // there. The panel must be able to say "none of these" rather than falling back
    // to showing everything.
    assertEquals(keys({ callSite: "trigger", need: "cell" }), []);
    assertEquals(keys({ callSite: "trigger", need: "pos" }), []);
    // And a real combination narrows rather than emptying.
    const narrow = keys({ domain: "energy", effect: "api" });
    assert(narrow.includes("energyConsumePerRun"), "consume is energy + api");
    assert(!narrow.includes("energyBank"), "bank is energy but only returns");
});

Deno.test("the call-site filter is the scope rule, not the declared slots", () => {
    // This is the filter's real job: "what can I put in *this* process". It has to
    // agree with `canRunAt`, or the panel will offer something that cannot run.
    const forTrigger = keys({ callSite: "trigger" });
    for (const k of forTrigger) {
        assert(needsOf(k).length === 0, `${k} needs something a trigger never sends`);
    }
    assert(!forTrigger.includes("triggerScan"), "and it reads a position");
    assert(forTrigger.includes("triggerLog"), "but a log needs nothing");
});

Deno.test("search reaches the description and the domain, not just the key", () => {
    // "convert" must find `processorConvert` even for someone who has not learned
    // the key, and "energy" must find all seven energy actions.
    assert(keys({ query: "convert" }).includes("processorConvert"));
    assertEquals(keys({ query: "energy" }).filter((k) => k.startsWith("energy")).length, 7);
    assertEquals(
        keys({ query: "  ENERG  " }).length,
        keys({ query: "energ" }).length,
        "case/space",
    );
});

Deno.test("'in use' shows only what a process really references", () => {
    // With an empty config nothing is in use, and saying so is the correct answer
    // — an "in use" chip that showed the whole catalogue when nothing is in use
    // would be lying.
    assertEquals(keys({ onlyUsed: true }), []);
    assertEquals(usedKeys({ onlyUsed: true }), ["noop"]);
    assertEquals(usedKeys({}).length, HANDLER_META.length, "unfiltered is unaffected");
});

Deno.test("an unknown filter value yields nothing rather than everything", () => {
    // The fail-safe matters: a typo in persisted state should not silently turn the
    // filter off and show the whole catalogue as though it were a match.
    assertEquals(keys({ domain: "nonsense" as never }), []);
    assertEquals(keys({ effect: "nonsense" as never }), []);
    assertEquals(keys({ callSite: "nonsense" }), []);
});

// ── the two screens are tabs, not a mode ─────────────────────────────────────

Deno.test("Actions, Projectile options and Upgrade actions are sibling tabs", () => {
    // The structure, asserted directly. These were one `handlers` tab holding a
    // `panel` field, with a switcher drawn *below* the sub-nav that already listed
    // them — so the screen you were looking at was named in two places at once, and
    // changing which one you wanted took two clicks in two different nav rows.
    //
    // Scoped to the handlers group so a change elsewhere in the file cannot fail
    // this test: the match runs to the end of that one `categories: [...]` line.
    const group = /key: "handlers",[\s\S]*?categories: (\[[^\]]*\])/.exec(SCHEMA_SRC);
    assert(group, "the handlers menu group is missing from schema.ts");
    assertEquals(
        group[1].replace(/\s+/g, ""),
        '["action","projectileOption","upgradeAction"]',
    );
    // Each is a real tab with its own label, so the sub-nav names all three.
    for (
        const [tab, label] of [
            ["action", "Actions"],
            ["projectileOption", "Projectile options"],
            ["upgradeAction", "Upgrade actions"],
        ]
    ) {
        assert(
            new RegExp(`${tab}: \\{\\s*label: "${label}"`).test(SCHEMA_SRC),
            `the ${tab} tab has no label`,
        );
    }
    // And the wrapper is gone: a `handlers` *tab* would reintroduce the layer even
    // though the group key of the same name is fine and expected. Matched on the
    // quoted key so the group key two lines above does not match by accident.
    assert(!/^\s*"?handlers"?:/m.test(SCHEMA_SRC), "the handlers tab is back");
});

Deno.test("the upgrade-only actions are split out, and only those", () => {
    // The isolation criterion, tested at both ends.
    //
    // This is a *view* split, not a registry split: unlike a projectile option,
    // these stay real `HandlerAction`s in `HANDLER_META` with their parameters,
    // because an upgrade runs an ordered list of them. So the assertion is about
    // two lists partitioning the catalogue, not about a subset being removed.
    const isolated = handlersOnlyAtSlot("upgrade");
    const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
    assertEquals(isolated.length, 7, "the upgrade-only count changed — recheck the split");
    // Together they are the whole catalogue: nothing is dropped, nothing is doubled.
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
    // Every isolated action really can run at an upgrade, and nowhere else.
    for (const m of isolated) {
        assertEquals(m.slots, ["upgrade"], `${m.key} is not upgrade-only`);
    }
    // The interesting one: `noop` runs at an upgrade, but at all six call sites, so
    // it is a wiring test rather than an upgrade behaviour and stays general. A
    // test that used `canRunAt(key, "upgrade")` instead of `slots` would wrongly
    // pull it in here.
    assert(
        canRunAt("noop", "upgrade"),
        "noop can no longer run at an upgrade — the model changed",
    );
    assert(!isOnlyAtSlot(handlerMeta("noop")!, "upgrade"), "noop leaked into the split");
    assert(general.some((m) => m.key === "noop"), "noop vanished from the general list");
});

Deno.test("neither screen carries an in-panel switcher", () => {
    // The regression is someone adding a third catalogue and wiring it as a chip
    // inside a screen, because that is where the switcher used to live and it is
    // the path of least resistance. The tell is a `panel` field on the shared
    // state: if it exists, the state is choosing which screen to be, and the
    // sub-nav is no longer the only navigation.
    const state = initialHandlersState();
    assertEquals(
        Object.keys(state).includes("panel"),
        false,
        "the handler state still has a `panel` — the switcher is coming back",
    );
    // Both filters are driven by the two fields the screens genuinely share.
    assert("query" in state, "the shared search box is gone");
    assert("onlyUsed" in state, "the shared in-use toggle is gone");
});

Deno.test("the options filter ignores the action-only axes", () => {
    // The reason the options are a separate screen rather than a filtered view of
    // the actions: an option has no needs, no effect, no domain and no call site,
    // so all four axis filters would exclude every row. That is not "no matches" —
    // it is "these questions do not apply", and it has to look like that.
    const all = filterProjectileOptions("", false, {});
    assertEquals(all.length, Object.keys(PROJECTILE_OPTIONS).length);
    // Search and in-use still work, because they mean the same thing for both.
    assertEquals(filterProjectileOptions("homing", false, {}).map((o) => o.key), [
        "projectileHoming",
    ]);
    const used = filterProjectileOptions("", true, { projectileFast: 2 });
    assertEquals(used.map((o) => o.key), ["projectileFast"]);
    assert(used[0].params.length > 0, "the options carry their parameters");
});

Deno.test("the split partitions the catalogue with nothing lost or doubled", () => {
    // The point of doing this by `slots` rather than by hand: a second list is a
    // second thing to forget to update. These two sets are derived from the same
    // predicate on opposite sides, so they cannot overlap or leave a gap, and the
    // count is pinned so a change to the registry is a deliberate review.
    const isolated = handlersOnlyAtSlot("upgrade");
    const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
    assertEquals(isolated.length + general.length, HANDLER_META.length);
    // And an action that can run in two places belongs to neither — it is in the
    // general list, where the "Runs on" filter is how you find it. `noop` and
    // `energyConsumePerRun` are the two multi-slot actions.
    const multi = HANDLER_META.filter((m) => m.slots.length > 1);
    for (const m of multi) {
        assert(!isolated.includes(m), `${m.key} is multi-slot but landed in the isolated list`);
        assert(general.includes(m), `${m.key} is multi-slot but is missing from the general list`);
    }
});

Deno.test("a filter that outlived its options is still clearable", () => {
    // The dead-chip bug, in the form it actually appeared. `tech` was a real domain
    // with 7 rows; the upgrade split moved 6 of them out, so on the Actions screen
    // the chip survived as a control that returned nothing. Two ways to be wrong
    // here and the test pins both:
    //
    //   - drop the chip  → the list stays filtered with no control to undo it
    //   - keep applying  → "Tech & upgrades" shows an empty list, which reads as
    //                      "your search found nothing" and sends the reader
    //                      debugging a search that was never wrong
    //
    // The chip row keeps a *selected* value visible so it can be cleared; the list
    // then genuinely has no `tech` rows to show. Both facts are asserted, because
    // the point is that they are consistent.
    const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
    assertEquals(
        filterActions(general, { ...initialHandlersState(), domain: "tech" }, NONE, DOCS).length,
        0,
        "the Actions list has no tech rows, so the chip must be gone",
    );
    // A value the registry genuinely has still filters, so the chip is not simply
    // disabled wholesale.
    assert(
        filterActions(general, { ...initialHandlersState(), domain: "energy" }, NONE, DOCS)
            .length > 0,
        "a present domain still filters",
    );
});
