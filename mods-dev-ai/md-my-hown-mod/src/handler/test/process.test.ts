
import { assert, assertEquals } from "https:
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


const hostile = (): unknown =>
    new Proxy({}, {
        get() {
            throw new Error("boom");
        },
    });

Deno.test("options are bound per action, which the engine never did", () => {
    
    
    
    
    
    
    
    
    
    
    
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
    
    
    
    
    
    const failures: ProcessFailure[] = [];
    const ran: string[] = [];
    const { fn } = compileProcess(
        [{ key: "structureInspect" }, { key: "processorCount" }],
        "signal",
        (f) => failures.push(f),
    );
    
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
    
    
    
    assertEquals(
        (Object.keys(CALL_SITE_USES_RETURN) as CallSite[]).filter((s) => CALL_SITE_USES_RETURN[s]),
        [],
    );
    
    assertEquals(
        (Object.keys(CALL_SITE_LABELS) as CallSite[]).includes("projectile" as never),
        false,
        "projectile is a call site again",
    );
});

Deno.test("a projectile option is not an action a process can run", () => {
    
    
    
    
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
    
    
    
    assertEquals(actionRefsOf({ handlerKey: "processorLog" }), []);
    assertEquals(actionRefsOf({ onUpgradeKey: "onLevelUp" }), []);
    
    assertEquals(
        actionRefsOf({ handlerKey: "old", actions: [{ key: "new", options: { a: 1 } }] }),
        [{ key: "new", options: { a: 1 } }],
    );
    
    assertEquals(actionRefsOf(undefined), []);
    assertEquals(actionRefsOf({}), []);
    assertEquals(actionRefsOf({ actions: [] }), []);
    assertEquals(actionRefsOf({ actions: [{}, { key: "" }] }), []);
});

Deno.test("a usage scan reads a process' action list, not one key", () => {
    
    
    
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
    
    
    
    const uses = scanHandlerUsage({
        signals: [{ id: "s1", actions: [{ key: "signalLog" }] }],
    });
    assertEquals(uses.length, 1, "not twice");
    assertEquals(uses[0].key, "signalLog");
    
    
    
    
    
    assertEquals(
        unreachableHandlers({
            signals: [{ id: "s1", actions: [{ key: "createElement" }] }],
        }).length,
        1,
    );
    
    
    assertEquals(scanHandlerUsage({ triggers: [{ id: "t1", handlerKey: "triggerLog" }] }), []);
});

Deno.test("a projectile's option is scanned separately from handler usage", () => {
    
    
    
    
    
    
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
    
    
    
    
    
    
    
    const good = compileProcess([{ key: "processorLog", options: undefined }], "behavior");
    assertEquals(good.skipped, [], "a bare key must not be reported as unknown");
    assertEquals(typeof good.fn, "function");

    
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
    
    
    for (const m of HANDLER_META) {
        if (m.cls === "api") assert(m.api, `${m.key} is api-bound with no namespace`);
        else assert(!m.api, `${m.key} has a namespace but class ${m.cls}`);
    }
});

Deno.test("every call site is named, signed and marked for its return", () => {
    
    
    for (const site of Object.keys(CALL_SITE_LABELS) as CallSite[]) {
        assert(CALL_SITE_SIGNATURES[site], `${site} has no signature`);
        assertEquals(
            typeof CALL_SITE_USES_RETURN[site],
            "boolean",
            `${site} has no return flag`,
        );
    }
    
    
});
