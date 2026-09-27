/**
 * The Handlers panel's filter.
 *
 * The three axes are independent, and the failure mode for independent axes is a
 * filter that quietly matches everything — a chip that looks selected and changes
 * nothing. That is invisible by clicking around and obvious in a test, so the
 * property being pinned here is simply "each axis, alone, changes the result".
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { allHandlerDocs } from "../../hooks/handlers.ts";
import { HANDLER_META, type HandlerUsage } from "../../hooks/handler-registry.ts";
import { needsOf } from "../../hooks/scope.ts";
import { filterActions, initialHandlersState } from "../handlers-panel.ts";

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
    assertEquals(all[0], "defaultProjectileOptions");
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
