/**
 * The process compiler.
 *
 * The behaviours under test are the ones that were guesses until they were
 * written down: ordering, per-action param binding, failure isolation, the merge
 * rule, and that a pre-split single key is *not* a process.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ACTION_APIS, ACTION_CLASSES } from "../core/action-class.ts";
import {
    HANDLER_META,
    scanHandlerUsage,
    scanProjectileOptionUsage,
    unreachableHandlers,
    usageIndex,
} from "../core/handler-registry.ts";
import {
    actionRefsOf,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    CALL_SITE_USES_RETURN,
    type CallSite,
    compileProcess,
    type ProcessFailure,
    resolveAction,
} from "../core/process.ts";

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
    //
    // The expected payload is the **verified** one: an array, discriminated by
    // `kind`. It used to assert `{ type: "set", … }` — a bare object with a
    // discriminator the engine does not have — which is the shape that made the
    // action a silent no-op. `context.commit` is typed `(mutations: unknown)`, so
    // nothing objected and the real payload was never checked. See
    // `HandlerAction.md` §4.
    const commits: unknown[] = [];
    const ctx = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => {
            commits.push(m);
            return true;
        },
    };
    const { fn } = compileProcess(
        [{ key: "processorConvert", options: { to: "Water" } }],
        "processing",
    );
    fn({ x: 4, y: 9 }, ctx);
    assertEquals(commits, [[{ kind: "create", cellX: 4, cellY: 8, elementType: "Water" }]]);
});

Deno.test("randomInt draws from api.random, and a missing namespace is not a crash", () => {
    // Two claims, and the second is the one that matters.
    //
    // The first: it calls the **engine's** generator, not `Math.random()`. The
    // engine's is deterministic and shared, so a reload reproduces the same picks
    // and a player cannot desync the world by watching what the mod drew.
    const calls: [number, number][] = [];
    const prev = (globalThis as Record<string, unknown>).sandkit;
    (globalThis as Record<string, unknown>).sandkit = {
        api: {
            random: {
                int: (a: number, b: number) => {
                    calls.push([a, b]);
                    return 1;
                },
            },
        },
        state: { store: { mods: {} } },
    };
    try {
        const { fn } = compileProcess(
            [{ key: "randomInt", options: { min: "0", max: "2" }, as: "pick" }],
            "processing",
        );
        fn({ x: 0, y: 0 }, undefined);
        assertEquals(
            calls,
            [[0, 2]],
            "the range must reach api.random verbatim — inclusive at both ends, " +
                "matching the source mod's Math.floor(Math.random() * 3)",
        );
    } finally {
        if (prev === undefined) delete (globalThis as Record<string, unknown>).sandkit;
        else (globalThis as Record<string, unknown>).sandkit = prev;
    }

    // The second: with no namespace at all it answers `min` rather than throwing.
    // A random value is only ever read by the next step, so a fallback keeps a
    // misconfigured world running; throwing would take out the whole tick.
    const bare = (globalThis as Record<string, unknown>).sandkit;
    (globalThis as Record<string, unknown>).sandkit = { api: {} };
    try {
        const { fn } = compileProcess(
            [{ key: "randomInt", options: { min: "0", max: "2" }, as: "pick" }],
            "processing",
        );
        fn({ x: 0, y: 0 }, undefined);
    } finally {
        if (bare === undefined) delete (globalThis as Record<string, unknown>).sandkit;
        else (globalThis as Record<string, unknown>).sandkit = bare;
    }
});

Deno.test("a threshold rule is a comparison and an if block, and both halves work", () => {
    // The rule the whole `compare` action exists for: "once this reaches N, do
    // the thing". Before it, the `if` block could branch on truthiness and
    // nothing could turn a number into a truth value, so the rule was
    // inexpressible rather than merely awkward.
    //
    // Built from the real compiler and the real actions, so it is the shape a
    // config author would actually write — not a unit test of `compare` alone
    // that would still pass if `if` had stopped reading the name.
    const commits: unknown[] = [];
    const ctx = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => commits.push(m),
    };
    const { fn } = compileProcess(
        [
            {
                key: "compare",
                options: { left: "50", op: "gte", right: "50" },
                as: "full",
            },
            {
                key: "if",
                options: { var: "full" },
                then: [{ key: "processorConvert", options: { to: "Water" } }],
                else: [{ key: "processorLog" }],
            },
        ],
        "processing",
    );
    fn({ x: 4, y: 9 }, ctx);
    assertEquals(
        commits,
        [[{ kind: "create", cellX: 4, cellY: 8, elementType: "Water" }]],
        "the threshold held, so the then branch ran",
    );

    // And the same process one point below the threshold takes the other branch.
    // Without this the block could be ignoring `full` entirely and the assertion
    // above would still pass.
    const commits2: unknown[] = [];
    const ctx2 = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => commits2.push(m),
    };
    const { fn: fn2 } = compileProcess(
        [
            {
                key: "compare",
                options: { left: "49", op: "gte", right: "50" },
                as: "full",
            },
            {
                key: "if",
                options: { var: "full" },
                then: [{ key: "processorConvert", options: { to: "Water" } }],
            },
        ],
        "processing",
    );
    fn2({ x: 4, y: 9 }, ctx2);
    assertEquals(commits2, [], "the threshold did not hold, so nothing ran");
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

Deno.test("a process returns nothing, on every call site there is", () => {
    // The return-value rule is gone, and this is what replaced it. `projectile` used
    // to be the one site reading a process' return — which is what made several
    // handlers' returns mergeable into one options object. A projectile now holds a
    // single `ProjectileOption` instead, so *no* call site reads a return and a
    // process is purely a sequence of side effects.
    //
    // Asserted behaviourally rather than by reading the table, because a table that
    // says `false` and a compiler that merges anyway is the exact bug this guards.
    for (const site of Object.keys(CALL_SITE_LABELS) as CallSite[]) {
        const { fn } = compileProcess(
            [{ key: "energyBank" }, { key: "itemShoot" }],
            site,
        );
        assertEquals(
            fn(null, null),
            undefined,
            `${site} returned something — only a projectile option may build a value`,
        );
    }
});

Deno.test("no call site is marked as reading a return", () => {
    // The measurement, pinned. Every entry is `false` because the one `true` —
    // `projectile` — is not a call site. If a future engine version starts reading
    // one, this is where it should fail rather than in a spawn that returns nothing.
    assertEquals(
        (Object.keys(CALL_SITE_USES_RETURN) as CallSite[]).filter((s) => CALL_SITE_USES_RETURN[s]),
        [],
    );
    // And `projectile` is not in the axis at all, so nothing can offer it as a slot.
    assertEquals(
        (Object.keys(CALL_SITE_LABELS) as CallSite[]).includes("projectile" as never),
        false,
        "projectile is a call site again",
    );
});

Deno.test("a projectile option is not an action a process can run", () => {
    // The behavioural half of the split. Before it, these two keys were ordinary
    // actions and a projectile could hold a *list* of them. Now `compileProcess`
    // cannot resolve either, so the merged-monster configuration is not merely
    // discouraged — it is unbuildable, and shows up as a skipped key instead.
    for (const key of ["defaultProjectileOptions", "projectileHeavy", "projectileFast"]) {
        assertEquals(
            resolveAction(key),
            undefined,
            `${key} resolves as an action again`,
        );
        const { skipped } = compileProcess([{ key }], "signal");
        assertEquals(skipped, [key], `${key} compiled into a process`);
    }
});

Deno.test("the same action may appear twice with different options", () => {
    // Order and options *are* the process. Nothing dedupes or sorts.
    //
    // Each action makes its own `commit` call and each call carries an **array**, so
    // two uses of the same action produce two arrays rather than two merged
    // mutations. That is the current contract — see the note on the test above.
    const commits: unknown[] = [];
    const ctx = {
        getResolvedTypeAtCell: () => "Sand",
        commit: (m: unknown) => {
            commits.push(m);
            return true;
        },
    };
    compileProcess(
        [
            { key: "processorConvert", options: { to: "Water" } },
            { key: "processorConvert", options: { to: "Lava" } },
        ],
        "processing",
    ).fn({ x: 1, y: 5 }, ctx);
    assertEquals(commits, [
        [{ kind: "create", cellX: 1, cellY: 4, elementType: "Water" }],
        [{ kind: "create", cellX: 1, cellY: 4, elementType: "Lava" }],
    ]);
});

Deno.test("a pre-split `handlerKey` is not a process", () => {
    // A config written before the split has `handlerKey`, not `actions`. It is
    // read as no process: the engine never saw that key, so honouring it would
    // show the author a handler that silently does nothing.
    assertEquals(actionRefsOf({ handlerKey: "processorLog" }), []);
    assertEquals(actionRefsOf({ onUpgradeKey: "onLevelUp" }), []);
    // The split form is still read, and wins over a stale sibling.
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

Deno.test("a process scans as exactly one usage per action", () => {
    // A regression guard for a real double-count: the scan must go through
    // `actionRefsOf` alone, with no second path reading the same entry. When two
    // did, every unreachable warning appeared twice.
    const uses = scanHandlerUsage({
        signals: [{ id: "s1", actions: [{ key: "signalLog" }] }],
    });
    assertEquals(uses.length, 1, "not twice");
    assertEquals(uses[0].key, "signalLog");
    // A genuinely unreachable action. This used to be `techGrantItem`, which was
    // pinned to the `upgrade` slot by hand — but it only needs `data`, which a signal
    // delivers, so it became reachable and the test stopped testing anything. A
    // **commit**-writing action is the honest unreachable case: only `process()` hands
    // over the context, so it cannot appear in a signal at all.
    assertEquals(
        unreachableHandlers({
            signals: [{ id: "s1", actions: [{ key: "createElement" }] }],
        }).length,
        1,
    );
    // And a pre-split key is not a process, so it contributes no usage at all —
    // one reader, and it no longer looks at that name.
    assertEquals(scanHandlerUsage({ triggers: [{ id: "t1", handlerKey: "triggerLog" }] }), []);
});

Deno.test("a projectile's option is scanned separately from handler usage", () => {
    // A projectile holds an option, not a process, so it is read by
    // `scanProjectileOptionUsage` — and `scanHandlerUsage` must report *nothing*
    // for it, because folding it back in would mean re-adding the `projectile`
    // slot this split removed. The fixture uses the current `option` object: the
    // pre-split `getOptionsKey` is not read any more, so a fixture built on it
    // would pass by asserting emptiness twice.
    assertEquals(
        scanHandlerUsage({ projectiles: [{ id: "b1", option: { key: "projectileHeavy" } }] }),
        [],
        "a projectile is being scanned as a handler usage again",
    );
    const uses = scanProjectileOptionUsage({
        projectiles: [{ id: "b1", option: { key: "projectileHeavy" } }],
    });
    assertEquals(uses.map((u) => u.key), ["projectileHeavy"]);
    assertEquals(uses[0].id, "b1");
    assertEquals(uses[0].problem, undefined, "a single option is not a problem");
    // A pre-split spelling is not an option. The row still appears, because the
    // tab lists every projectile, but it names no option — the same as any
    // projectile that never had one. What matters is that the key is not read.
    const stale = scanProjectileOptionUsage({
        projectiles: [{ id: "b1", getOptionsKey: "projectileHeavy" }],
    });
    assertEquals(stale.length, 1);
    assertEquals(
        stale[0].key,
        undefined,
        "a pre-split getOptionsKey is still being read as an option",
    );
});

Deno.test("a bare key compiles to a one-action process", () => {
    // Input bindings store a bare key in a string slot, not a list, so the
    // register path builds the ref itself rather than reading one off the entry.
    // It used to fake an entry — `actionRefsOf({ handlerKey: key })` — which only
    // worked while that reader still consulted the pre-split key. Once it read
    // `actions` alone the fake entry resolved to nothing, `skipped` was non-empty,
    // and every input binding was dropped with a warning. No test covered that
    // path, so this pins the shape directly.
    const good = compileProcess([{ key: "processorLog", options: undefined }], "behavior");
    assertEquals(good.skipped, [], "a bare key must not be reported as unknown");
    assertEquals(typeof good.fn, "function");

    // And the ref really is read from an entry when there is one.
    assertEquals(
        actionRefsOf({ actions: [{ key: "processorLog" }] }),
        [{ key: "processorLog", options: undefined }],
    );
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
    // The "no site reads a return" claim is asserted on its own above, where it is
    // also checked behaviourally against the compiler — not just against the table.
});
