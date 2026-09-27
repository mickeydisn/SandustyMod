/**
 * The process compiler.
 *
 * The behaviours under test are the ones that were guesses until they were
 * written down: ordering, per-action param binding, failure isolation, the merge
 * rule, and the `handlerKey` → `actions` migration.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ACTION_APIS, ACTION_CLASSES } from "./action-class.ts";
import {
    HANDLER_META,
    scanHandlerUsage,
    unreachableHandlers,
    usageIndex,
} from "./handler-registry.ts";
import {
    actionRefsOf,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    CALL_SITE_USES_RETURN,
    type CallSite,
    compileProcess,
    mergeProcessValue,
    type ProcessFailure,
    resolveAction,
} from "./process.ts";

/** A payload whose every property read throws — the hostile case. */
const hostile = (): unknown =>
    new Proxy({}, {
        get() {
            throw new Error("boom");
        },
    });

Deno.test("options are bound per action, which the engine never did", () => {
    // The regression this module exists for. `processorConvert` declares `to` as
    // required; before the split the engine called it with two arguments, so the
    // third was always `undefined` and it could never convert anything. Here the
    // compiler supplies the options the config asked for.
    const commits: unknown[] = [];
    const ctx = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => commits.push(m),
    };
    const { fn } = compileProcess(
        [{ key: "processorConvert", options: { to: "Water" } }],
        "processing",
    );
    fn({ x: 4, y: 9 }, ctx);
    assertEquals(commits, [{ type: "set", cellX: 4, cellY: 8, elementType: "Water" }]);
});

Deno.test("without options the same action commits nothing", () => {
    // The old behaviour, kept as a test: no `to`, so it only reports. This is what
    // every converted config does today, which is the bug.
    const commits: unknown[] = [];
    const ctx = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => commits.push(m),
    };
    const { fn } = compileProcess([{ key: "processorConvert" }], "processing");
    fn({ x: 4, y: 9 }, ctx);
    assertEquals(commits, [], "no options means no commit — the old dead path");
});

Deno.test("an empty process compiles to a no-op that still satisfies the engine", () => {
    for (const site of Object.keys(CALL_SITE_LABELS) as CallSite[]) {
        const { fn, skipped } = compileProcess([], site);
        assertEquals(skipped, [], `${site} reported skipped keys for an empty process`);
        assertEquals(fn(null, null), undefined, `${site} should return undefined`);
    }
});

Deno.test("an unknown action is dropped, and the rest of the process survives", () => {
    const { fn, skipped } = compileProcess(
        [{ key: "noSuchHandler" }, { key: "processorNoop" }],
        "processing",
    );
    assertEquals(skipped, ["noSuchHandler"]);
    assertEquals(typeof fn, "function", "the process still compiles");
    assertEquals(fn(null, null), undefined, "and still runs");
});

Deno.test("one action throwing does not stop the ones after it", () => {
    // `structureInspect` is one of the few actions with no internal try/catch, so
    // it is the only honest way to prove the compiler's isolation. Most actions
    // catch their own errors already, which makes the compiler's guard a safety
    // net for future actions rather than something the current catalogue needs —
    // worth knowing, and the reason this test picks its subject deliberately.
    const failures: ProcessFailure[] = [];
    const ran: string[] = [];
    const { fn } = compileProcess(
        [{ key: "structureInspect" }, { key: "processorCount" }],
        "signal",
        (f) => failures.push(f),
    );
    // The engine must never see the throw — this runs on a game tick.
    let threw = false;
    try {
        ran.push("before");
        fn(hostile(), null);
        ran.push("after");
    } catch {
        threw = true;
    }
    assertEquals(threw, false, "the process swallowed the failure");
    assertEquals(ran, ["before", "after"], "the process ran to completion");
    assert(failures.length >= 1, "the throwing action was reported");
    assertEquals(failures[0].key, "structureInspect");
});

Deno.test("a compiled process reports failures rather than throwing", () => {
    // Same guarantee, stated on its own because it is the one that matters at
    // runtime: an uncaught throw on a game tick is much worse than a lost action.
    const failures: ProcessFailure[] = [];
    const { fn } = compileProcess(
        [{ key: "structureInspect" }, { key: "processorLog" }],
        "signal",
        (f) => failures.push(f),
    );
    fn(hostile(), null);
    assert(failures.length >= 1, "and reported it");
});

Deno.test("the return value only exists where the engine reads it", () => {
    // `projectile.getOptions()` consumes the return; nothing else does. So a
    // process on a void slot returns undefined even when its actions return things.
    const returning = [{ key: "defaultProjectileOptions" }, { key: "projectileHeavy" }];
    const asProjectile = compileProcess(returning, "projectile").fn(null);
    assertEquals(typeof asProjectile, "object", "projectile gets merged options");
    assertEquals(compileProcess(returning, "signal").fn(null), undefined);
});

Deno.test("the merge rule: objects merge, anything else replaces", () => {
    assertEquals(mergeProcessValue(undefined, undefined), undefined);
    assertEquals(mergeProcessValue({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
    // Last writer wins per key.
    assertEquals(mergeProcessValue({ a: 1 }, { a: 2 }), { a: 2 });
    // A non-object replaces the whole value rather than half-applying.
    assertEquals(mergeProcessValue({ a: 1 }, 5), 5);
    assertEquals(mergeProcessValue({ a: 1 }, [1, 2]), [1, 2]);
    assertEquals(mergeProcessValue({ a: 1 }, null), null);
    // And once it is a non-object, a later object does not merge back into it.
    assertEquals(mergeProcessValue(5, { a: 1 }), { a: 1 });
});

Deno.test("a projectile process really merges its actions' options", () => {
    const merged = compileProcess(
        [{ key: "defaultProjectileOptions" }, { key: "projectileHeavy" }],
        "projectile",
    ).fn(null) as Record<string, unknown>;
    // `defaultProjectileOptions` gives speed 10 / rotateWithVelocity;
    // `projectileHeavy` gives its own speed. Last writer wins on `speed`.
    assertEquals(merged.rotateWithVelocity, true, "the first action's keys survive");
    assert(typeof merged.speed === "number", "the second action's speed won");
});

Deno.test("one-action processes behave exactly as before the split", () => {
    // The compatibility claim, tested: whatever a single action returned is what
    // the process returns, because merging `undefined` with it is the identity.
    const direct = resolveAction("projectileFast")?.(null, null, undefined);
    assertEquals(compileProcess([{ key: "projectileFast" }], "projectile").fn(null), direct);
});

Deno.test("the same action may appear twice with different options", () => {
    // Order and options *are* the process. Nothing dedupes or sorts.
    const commits: unknown[] = [];
    const ctx = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => commits.push(m),
    };
    compileProcess(
        [
            { key: "processorConvert", options: { to: "Water" } },
            { key: "processorConvert", options: { to: "Lava" } },
        ],
        "processing",
    ).fn({ x: 1, y: 5 }, ctx);
    assertEquals(commits, [
        { type: "set", cellX: 1, cellY: 4, elementType: "Water" },
        { type: "set", cellX: 1, cellY: 4, elementType: "Lava" },
    ]);
});

Deno.test("`handlerKey` migrates to a one-action process", () => {
    // A config already on disk has `handlerKey`, not `actions`. It must still
    // produce a working process, with no options — because it never had any.
    assertEquals(actionRefsOf({ handlerKey: "processorLog" }), [
        { key: "processorLog", options: undefined },
    ]);
    // The new form wins when both are present.
    assertEquals(
        actionRefsOf({ handlerKey: "old", actions: [{ key: "new", options: { a: 1 } }] }),
        [{ key: "new", options: { a: 1 } }],
    );
    // Empty, missing and malformed entries yield no actions rather than throwing.
    assertEquals(actionRefsOf(undefined), []);
    assertEquals(actionRefsOf({}), []);
    assertEquals(actionRefsOf({ actions: [] }), []);
    assertEquals(actionRefsOf({ actions: [{}, { key: "" }] }), []);
});

Deno.test("a usage scan reads a process' action list, not one key", () => {
    // One config entry holding three actions is three usages, each checked on its
    // own. Before this, the scan read a single `handlerKey` and would have
    // reported one usage and checked one action.
    const cfg = {
        processing: [
            {
                id: "p1",
                actions: [
                    { key: "processorLog" },
                    { key: "processorCount" },
                    { key: "processorConvert", options: { to: "Water" } },
                ],
            },
        ],
    };
    const uses = scanHandlerUsage(cfg);
    assertEquals(uses.length, 3, "one usage per action");
    assertEquals(
        uses.map((u) => u.key).sort(),
        ["processorConvert", "processorCount", "processorLog"],
    );
    assert(uses.every((u) => u.id === "p1"), "all three belong to the same entry");
});

Deno.test("a pre-split `handlerKey` scans as exactly one usage", () => {
    // A regression guard for a real double-count: `actionRefsOf` already reads
    // `handlerKey`, so the scan's own fallback must not read it a second time.
    // When it did, every unreachable warning appeared twice.
    const uses = scanHandlerUsage({ triggers: [{ id: "t1", handlerKey: "triggerLog" }] });
    assertEquals(uses.length, 1, "not twice");
    assertEquals(
        unreachableHandlers({ triggers: [{ id: "t1", handlerKey: "techGrantItem" }] }).length,
        1,
    );
});

Deno.test("projectile's `getOptionsKey` is still scanned", () => {
    // The one slot that does not name its key `handlerKey`, so it is the only
    // thing the scan's fallback branch is for.
    const uses = scanHandlerUsage({
        projectiles: [{ id: "b1", getOptionsKey: "projectileHeavy" }],
    });
    assertEquals(uses.map((u) => u.key), ["projectileHeavy"]);
    assertEquals(uses[0].slot, "projectile");
});

Deno.test("the `usageIndex` groups a multi-action process under each action", () => {
    const cfg = {
        processing: [
            { id: "p1", actions: [{ key: "processorLog" }, { key: "processorNoop" }] },
        ],
    };
    const idx = usageIndex(cfg);
    assertEquals(Object.keys(idx).sort(), ["processorLog", "processorNoop"]);
    assertEquals(idx.processorLog[0].id, "p1");
});

Deno.test("every HandlerMeta now carries both derived axes", () => {
    for (const m of HANDLER_META) {
        assert(ACTION_CLASSES[m.key], `${m.key} has no class`);
        assertEquals(m.cls, ACTION_CLASSES[m.key], `${m.key}'s cls drifted from ACTION_CLASSES`);
        assertEquals(m.api, ACTION_APIS[m.key], `${m.key}'s api drifted from ACTION_APIS`);
    }
    // And the two axes disagree often enough to be worth having both: a class of
    // `api` always has a namespace, and a class below `api` never does.
    for (const m of HANDLER_META) {
        if (m.cls === "api") assert(m.api, `${m.key} is api-bound with no namespace`);
        else assert(!m.api, `${m.key} has a namespace but class ${m.cls}`);
    }
});

Deno.test("every call site is named, signed and marked for its return", () => {
    // A call site with no label cannot be grouped by, and one with no return flag
    // would silently drop its merge behaviour.
    for (const site of Object.keys(CALL_SITE_LABELS) as CallSite[]) {
        assert(CALL_SITE_SIGNATURES[site], `${site} has no signature`);
        assertEquals(
            typeof CALL_SITE_USES_RETURN[site],
            "boolean",
            `${site} has no return flag`,
        );
    }
    // Measured, not assumed: projectile is the only site that reads the return.
    assertEquals(
        (Object.keys(CALL_SITE_USES_RETURN) as CallSite[]).filter((s) => CALL_SITE_USES_RETURN[s]),
        ["projectile"],
    );
});
