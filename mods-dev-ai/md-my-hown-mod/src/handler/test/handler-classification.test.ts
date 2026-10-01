
import { assert, assertEquals } from "https:
import {
    ANY_ACTIONS,
    MODIFIER_ACTIONS,
    PROCESSING_ACTIONS,
    resolveAction,
} from "../actions/index.ts";
import { HANDLER_META, type HandlerSlot, itemActionHandlersFor } from "../core/handler-registry.ts";
import { PROJECTILE_OPTIONS, resolveProjectileOption } from "../projectile-option/index.ts";
import { slotsFor } from "../core/scope.ts";


const ACTION_DIRS = [
    "actions/sense",
    "actions/decide",
    "actions/act",
    "actions/remember",
    "actions/feel",
    "actions/connect",
] as const;




const IMPLEMENTED: Record<string, HandlerSlot[]> = {
    
    
    
    
    isElementAtCell: ["processing"],
    
    
    
    
    readElement: ["processing"],
    countElements: ["processing"],
    countEmpty: ["processing"],
    replaceElement: ["processing"],
    createElement: ["processing"],
    emptyCells: ["processing"],
    removeElement: ["processing"],
    transformElement: ["processing"],
    
    
    
    
    
    
    
    getVelocity: ["processing"],
    findFreeCell: ["processing"],
    setVelocity: ["processing"],
    addVelocity: ["processing"],
    setDuration: ["processing"],
    teleportElement: ["processing"],
    toParticle: ["processing"],
    
    
    
    
    
    structureType: ["processing"],
    hasStructure: ["processing"],
    isStructureType: ["processing"],
    isMyType: ["processing"],
    isBlockedByPlayer: ["processing"],
    isLauncher: ["processing"],
    isStructureEnabled: ["processing"],
    countStructures: ["processing"],
    structureData: ["processing"],
    mapSpritesheetValue: ["processing"],
    buildStructure: ["processing"],
    removeStructure: ["processing"],
    removeStructures: ["processing"],
    setStructureEnabled: ["processing"],
    setSpritesheetIndex: ["processing"],
    setSpritesheetByValue: ["processing"],
    setStructureData: ["processing"],
    pushStructure: ["processing"],
    
    
    
    terrainType: ["processing"],
    hasTerrain: ["processing"],
    isTerrainType: ["processing"],
    terrainHitPoints: ["processing"],
    terrainTypeHandle: ["processing"],
    countTerrain: ["processing"],
    createTerrain: ["processing"],
    replaceTerrain: ["processing"],
    removeTerrain: ["processing"],
    damageTerrain: ["processing"],
    setTerrainHitPoints: ["processing"],
    
    
    
    
    readDataField: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    writeDataField: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    bufferRead: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    bufferWrite: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    bufferIncrement: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    noop: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    itemDefault: ["itemAction"],
    processorNoop: ["processing"],
    energyDefault: ["processing"],
    energyBank: ["processing"],
    energyWire: ["processing"],
    energyConductor: ["processing"],
    energyNetwork: ["processing"],
    
    
    
    triggerScan: ["processing"],
    signalLog: ["signal"],
    
    
    signalOutput: ["signal", "processing"],
    
    
    
    compare: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    math: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    
    
    randomInt: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    structureInspect: ["signal"],
    structureReadData: ["signal"],
    structureWriteData: ["signal"],
    triggerLog: ["trigger"],
    triggerTick: ["signal"],
    
    
    
    
    
    
    itemExcavate: ["signal", "processing", "modifier", "itemAction"],
    itemShoot: ["signal", "processing", "modifier", "itemAction"],
    processorLog: ["processing"],
    processorLift: ["processing"],
    processorConvert: ["processing"],
    processorCount: ["processing"],
    
    
    energyGenerateWhileHeld: ["processing"],
    
    
    energyConsumePerRun: ["processing", "signal", "modifier"],
    
    
    
    
    
    techAppendUnlock: ["upgrade"],
    techSetUpgradeLevel: ["upgrade"],
    techGrantItem: ["upgrade"],
    upgradeCountLevel: ["upgrade"],
    upgradeLog: ["upgrade"],
    upgradeScale: ["upgrade"],
    upgradeAdd: ["upgrade"],

    
    
    
    
    
    toast: ["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"],
    particles: ["signal", "processing", "modifier"],

    
    
    
    
    
    
    logArgs: ["modifier"],
    identity: ["modifier"],
    logBuildingPayload: ["modifier"],

    
    
    
    
    
    
    
    
    
    logicAny: ["signal", "processing", "itemAction", "modifier"],
    logicAll: ["signal", "processing", "itemAction", "modifier"],
    logicCount: ["signal", "processing", "itemAction", "modifier"],
    logicSum: ["signal", "processing", "itemAction", "modifier"],
    
    
    
    
    
    
    
    logicForEach: ["processing"],
};


const VOID_SLOTS: HandlerSlot[] = [
    "signal",
    "trigger",
    "processing",
    "upgrade",
    "itemAction",
];

Deno.test("the action catalogue's API binding, measured", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    const API_CALLING: Record<string, string> = {
        energyGenerateWhileHeld: "energy",
        energyConsumePerRun: "energy",
        techAppendUnlock: "tech",
        techSetUpgradeLevel: "upgrades",
        techGrantItem: "player",
        itemExcavate: "grid",
        itemShoot: "projectiles",
        toast: "ui",
        particles: "effects",
        
        
        
        signalOutput: "signals",
        
        
        
        randomInt: "random",
        
        
        
        
        
        structureType: "structures",
        hasStructure: "structures",
        isStructureType: "structures",
        isMyType: "structures",
        isBlockedByPlayer: "structures",
        isLauncher: "structures",
        isStructureEnabled: "structures",
        countStructures: "structures",
        structureData: "structures",
        mapSpritesheetValue: "structures",
        buildStructure: "structures",
        removeStructure: "structures",
        removeStructures: "structures",
        setStructureEnabled: "structures",
        setSpritesheetIndex: "structures",
        setSpritesheetByValue: "structures",
        setStructureData: "structures",
        pushStructure: "structures",
        
        
        
        
        
        
        
        
        
        
        terrainType: "terrains",
        hasTerrain: "terrains",
        isTerrainType: "terrains",
        terrainHitPoints: "terrains",
        terrainTypeHandle: "terrains",
        countTerrain: "terrains",
        createTerrain: "grid",
        replaceTerrain: "grid",
        removeTerrain: "grid",
        damageTerrain: "terrains",
        setTerrainHitPoints: "terrains",
    };
    const touched = new Set<string>();
    const fake: Record<string, unknown> = {};
    for (
        const ns of [
            "energy",
            "tech",
            "upgrades",
            "player",
            "grid",
            "projectiles",
            "ui",
            "effects",
            
            
            
            
            "structures",
            
            
            
            
            "terrains",
            
            
            
            
            "signals",
            
            
            
            
            "random",
        ]
    ) {
        
        
        
        
        
        
        
        
        fake[ns] = new Proxy(function () {}, {
            get: (_t, p) => {
                if (typeof p === "string") touched.add(ns);
                if (p === Symbol.toPrimitive) return undefined;
                if (p === "valueOf" || p === "toString") return () => 1;
                return () => undefined;
            },
        });
    }
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = { api: fake };
    
    
    
    
    
    
    
    
    
    
    
    const REAL_OPTIONS: Record<string, Record<string, unknown>> = {
        techAppendUnlock: { techId: "t1", structures: ["a"] },
        getVelocity: { size: 1 },
    };
    try {
        for (const key of Object.keys(IMPLEMENTED)) {
            const fn = fnFor(key);
            if (!fn) continue;
            probe(fn);
            const valid = REAL_OPTIONS[key];
            if (valid) {
                probe((a, b) => fn(a, b, valid));
            }
        }
    } finally {
        if (had) g.sandkit = prev;
        else delete g.sandkit;
    }
    assertEquals(
        [...touched].sort(),
        Object.values(API_CALLING).filter((v, i, a) => a.indexOf(v) === i).sort(),
        "the set of API namespaces reached for changed",
    );
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(Object.keys(API_CALLING).length, 40);
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(Object.keys(IMPLEMENTED).length, 94);
});

Deno.test("`type` measures neither axis — that is why the split is real", () => {
    
    
    
    const byType = new Map<string, string[]>();
    for (const [key, slots] of Object.entries(IMPLEMENTED)) {
        const meta = HANDLER_META.find((m) => m.key === key);
        if (!meta) continue;
        byType.set(meta.type, [...(byType.get(meta.type) ?? []), ...slots]);
    }
    const cellSpans = new Set(byType.get("cell"));
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(
        [...cellSpans].sort(),
        ["itemAction", "modifier", "processing", "signal"],
        'type:"cell" spans a different set of call sites than the scope rule allows',
    );
    
    assert(byType.has("processor"), "the call-site label went away");
    assert(byType.has("tech"), "the API-ish label went away");
});


const VACUOUS_RETURNS = [
    "energyDefault",
    "energyBank",
    "energyWire",
    "energyConductor",
    "energyNetwork",
    "itemDefault",
    
    
    
    
    
    
    "replaceElement",
    "createElement",
    "emptyCells",
    "removeElement",
    "transformElement",
    
    
    
    
    
    
    
    "setVelocity",
    "addVelocity",
    "setDuration",
    "teleportElement",
    "toParticle",
];


const CONTEXT_READABLE = [
    "isElementAtCell",
    
    
    
    
    
    
    "readElement",
    "countElements",
    "countEmpty",
    
    
    
    
    
    "getVelocity",
    "findFreeCell",
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    "structureType",
    "hasStructure",
    "isStructureType",
    "isMyType",
    "isBlockedByPlayer",
    "isLauncher",
    "isStructureEnabled",
    "countStructures",
    "structureData",
    "mapSpritesheetValue",
    "buildStructure",
    "removeStructure",
    "removeStructures",
    "setStructureEnabled",
    "setSpritesheetIndex",
    "setSpritesheetByValue",
    "setStructureData",
    "pushStructure",
    
    
    
    
    "terrainType",
    "hasTerrain",
    "isTerrainType",
    "terrainHitPoints",
    "terrainTypeHandle",
    "countTerrain",
    "createTerrain",
    "replaceTerrain",
    "removeTerrain",
    "damageTerrain",
    "setTerrainHitPoints",
    
    
    
    
    
    
    
    
    
    
    "readDataField",
    
    
    
    
    
    
    
    
    
    
    
    "bufferRead",
    
    
    
    
    
    
    
    
    
    
    
    "compare",
    
    
    
    
    
    
    "math",
    "randomInt",
    
    
    
    
    
    
    
    "logicAny",
    "logicAll",
    "logicCount",
    "logicSum",
    "logicForEach",
];





function probe(fn: (...a: unknown[]) => unknown): "void" | "value" {
    const realLog = console.log;
    
    console.log = () => {};
    
    const usable = new Proxy(function () {} as object, {
        get: (_t, p) => {
            if (p === Symbol.toPrimitive) return undefined;
            if (p === "valueOf" || p === "toString") return () => 1;
            return usable;
        },
        apply: () => undefined,
    });
    try {
        return fn(usable, usable, usable) === undefined ? "void" : "value";
    } finally {
        console.log = realLog;
    }
}


const fnFor = (key: string): ((...a: unknown[]) => unknown) | undefined =>
    resolveAction(key) as ((...a: unknown[]) => unknown) | undefined;



Deno.test("every declared action key resolves", () => {
    
    
    
    
    
    
    const missing = HANDLER_META
        .map((m) => m.key)
        .filter((k) => typeof resolveAction(k) !== "function");
    assertEquals(missing, [], `unreachable: ${missing.join(", ")}`);

    
    for (const key of ["logArgs", "identity", "logBuildingPayload"]) {
        assertEquals(
            typeof resolveAction(key),
            "function",
            `${key} is a modifier action and must resolve like any other`,
        );
    }
});

Deno.test("the inventory is complete — no handler escaped classification", () => {
    
    
    
    
    
    
    const live = new Set([
        ...Object.keys(ANY_ACTIONS),
        ...Object.keys(PROCESSING_ACTIONS),
        ...Object.keys(MODIFIER_ACTIONS),
    ]);
    const recorded = new Set(Object.keys(IMPLEMENTED));
    assertEquals(
        [...live].filter((k) => !recorded.has(k)),
        [],
        "implemented but not classified",
    );
    assertEquals(
        [...recorded].filter((k) => !live.has(k)),
        [],
        "classified but not implemented",
    );
});

Deno.test("the projectile presets are options, and stay out of the action system", () => {
    
    
    
    
    
    
    
    for (const key of Object.keys(PROJECTILE_OPTIONS)) {
        
        
        
        
        
        assert(
            !Object.hasOwn(ANY_ACTIONS, key),
            `${key} is back in the action registry`,
        );
        assert(
            !Object.hasOwn(PROCESSING_ACTIONS, key),
            `${key} is back in the process registry`,
        );
        assertEquals(
            resolveAction(key),
            undefined,
            `${key} still resolves as an action — a projectile could name it as one`,
        );
        assertEquals(
            HANDLER_META.find((m) => m.key === key),
            undefined,
            `${key} is advertised as a handler`,
        );
        
        assertEquals(typeof resolveProjectileOption(key), "function", `${key} is not an option`);
    }
    
    for (const m of HANDLER_META) {
        assert(!m.slots.includes("projectile" as never), `${m.key} claims the projectile slot`);
    }
});

Deno.test("the inventory's declared slots match the registry table", () => {
    
    
    
    
    for (const [key, slots] of Object.entries(IMPLEMENTED)) {
        const meta = HANDLER_META.find((m) => m.key === key);
        assert(meta, `${key} has no HANDLER_META entry`);
        assertEquals(
            [...(meta.declaredSlots ?? meta.slots)].sort(),
            [...slots].sort(),
            `${key} is slotted differently in the registry`,
        );
    }
});

Deno.test("every slot offered is one the action can actually serve", () => {
    
    
    
    
    
    
    for (const m of HANDLER_META) {
        for (const slot of m.slots) {
            assert(
                slotsFor(m.key).includes(slot as never),
                `${m.key} is offered in "${slot}" but its needs do not include it`,
            );
        }
    }
    assertEquals(
        HANDLER_META.find((m) => m.key === "logicForEach")?.slots,
        ["processing"],
        "a commit-writing walk belongs in one slot only",
    );
});

Deno.test("no declared entry falls back to its hand-written slots", () => {
    
    
    const fellBack = HANDLER_META.filter((m) =>
        [...(m.declaredSlots ?? [])].join() === m.slots.join() &&
        !slotsFor(m.key).length
    );
    assertEquals(fellBack.map((m) => m.key), [], "an action has no derived slots at all");
});

Deno.test("registration compiles a process, so options finally arrive", () => {
    
    
    
    
    
    
    
    
    
    const here = new URL("../../register/", import.meta.url).pathname;
    const src = Deno.readTextFileSync(here + "the-rest.ts");
    const compiles = (src.match(/compileProcess\(/g) ?? []).length;
    
    
    
    
    
    
    
    
    
    assertEquals(
        compiles,
        1,
        "only the input-binding site compiles inline (a bare key, not a process)",
    );
    
    assertEquals(
        (src.match(/compileEntryProcess\(/g) ?? []).length,
        3,
        "processing, signal, trigger must go through compileEntryProcess",
    );
    
    
    
    
    const code = src
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("
        .join("\n");
    assert(
        !/actionRefsOf/.test(code),
        "a registration site still reads the legacy actions array directly",
    );
    assert(
        !/actions:\s*\[/.test(code),
        "a registration site still builds an actions array",
    );
    assert(
        (src.match(/compileProjectile\(/g) ?? []).length === 1,
        "the projectile site no longer compiles an option",
    );
    
    assertEquals(
        (src.match(/resolveAction/g) ?? []).length,
        0,
        "a registration site still resolves a single key",
    );
});

Deno.test("the upgrade slot is wired, which it never was", () => {
    
    
    
    
    
    
    
    const kit = Deno.readTextFileSync(
        new URL("../../packages/registrations.ts", import.meta.url).pathname,
    );
    assert(
        /onUpgrade: compiled\.fn/.test(kit),
        "registerUpgrade no longer passes onUpgrade to the engine",
    );
    
    
    
    
    assert(
        /compileEntryProcess\(def, "itemAction"\)/.test(kit),
        "registerItem no longer compiles through the shared reader",
    );
    
    
    
    
    
    
    
    
    const at = kit.indexOf("export function registerUpgrade(");
    const fn = kit.slice(at, kit.indexOf("export function", at + 1))
        .split("\n")
        .filter((l) => !l.trim().startsWith("
        .join("\n");
    assert(
        !/onUpgradeKey/.test(fn),
        "registerUpgrade strips onUpgradeKey again — the callback would never be set",
    );
});

Deno.test("an item's use action is a compiled process, or nothing at all", () => {
    
    
    
    
    
    const kit = Deno.readTextFileSync(
        new URL("../../packages/mysandkit.ts", import.meta.url).pathname,
    );
    assert(
        /for \(const k of \["actions", "handlerKey", "onUpgradeKey"\]\) delete out\[k\]/.test(
            kit,
        ),
        "the item path no longer clears every key that names a process",
    );
});

Deno.test("every action reads its options from argument 3, not argument 2", () => {
    
    
    
    
    
    
    
    
    const stale: string[] = [];
    for (const dir of ACTION_DIRS) {
        const src = Deno.readTextFileSync(
            new URL(`../${dir}/index.ts`, import.meta.url).pathname,
        );
        for (const m of src.matchAll(/^ {4}(\w+): \(\w+, (\w+)\)/gm)) {
            if (m[2] !== "options") stale.push(`${dir}: ${m[1]}`);
        }
    }
    assertEquals(stale, [], `actions still reading options from argument 2: ${stale.join(", ")}`);
    
    
    
    
    
    const proc = Deno.readTextFileSync(new URL("../core/process.ts", import.meta.url).pathname);
    assert(
        proc.includes("step.fn(payload, ctx, value, context)"),
        "the compiler no longer passes resolved options third",
    );
});

Deno.test("a slot resolves exactly one function — the 1:1 the split removes", () => {
    
    
    
    for (const key of Object.keys(IMPLEMENTED)) {
        assertEquals(
            typeof resolveAction(key),
            "function",
            `${key} does not resolve to a function`,
        );
    }
});

Deno.test("no call site is left where a returned value survives", () => {
    
    
    
    
    
    
    
    
    const returnsIntoVoidSlot = Object.keys(IMPLEMENTED).filter((key) => {
        const fn = fnFor(key);
        if (!fn) return false;
        return VOID_SLOTS.includes(IMPLEMENTED[key][0]) && probe(fn) === "value";
    });
    
    
    
    
    
    
    
    
    
    
    assertEquals(
        returnsIntoVoidSlot.filter((k) => !VACUOUS_RETURNS.includes(k)),
        CONTEXT_READABLE,
        "an unlisted handler returns a value into a void slot",
    );
    
    
    for (const key of CONTEXT_READABLE) {
        const fn = fnFor(key);
        assert(fn, `${key} is gone`);
        assertEquals(probe(fn), "value", `${key} no longer returns a value to bind`);
    }
    
    
    const optionReturning = Object.keys(PROJECTILE_OPTIONS).filter(
        (key) => typeof resolveProjectileOption(key) === "function",
    );
    assertEquals(optionReturning.length, 7, "projectile options stopped existing");
    
    assertEquals(
        Object.keys(PROJECTILE_OPTIONS).filter((k) => k in IMPLEMENTED),
        [],
        "a projectile option is also an action",
    );
});

Deno.test("the vacuous returns are still vacuous", () => {
    
    
    for (const key of VACUOUS_RETURNS) {
        const fn = fnFor(key);
        assert(fn, `${key} is gone`);
        assertEquals(probe(fn), "value", `${key} no longer returns a value`);
        assert(
            VOID_SLOTS.includes(IMPLEMENTED[key][0]),
            `${key} is no longer on a void slot — the merge rule may now apply`,
        );
    }
});

Deno.test("a Consumable resolves no item action", () => {
    
    
    assertEquals(itemActionHandlersFor("Consumable"), []);
    assertEquals(itemActionHandlersFor("consumable"), [], "case-insensitive too");
    assert(itemActionHandlersFor("Tool").length > 0, "but a Tool does get actions");
});

Deno.test("every item action is offered to at least one non-Consumable type", () => {
    
    
    
    const types = ["Weapon", "Building", "Tool", "Mod"];
    for (const m of itemActionHandlersFor("Tool")) {
        assert(
            types.some((t) => itemActionHandlersFor(t).some((x) => x.key === m.key)),
            `${m.key} is unreachable`,
        );
    }
});

Deno.test("every action reads its options from argument 3, not argument 2", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const calls: { append?: unknown; level?: unknown; granted: number } = { granted: 0 };
    const prev = (globalThis as { sandkit?: unknown }).sandkit;
    (globalThis as { sandkit?: unknown }).sandkit = {
        api: {
            tech: {
                conservatory: {
                    appendUnlock: (id: unknown, u: unknown) => {
                        calls.append = [id, u];
                    },
                },
            },
            upgrades: {
                setLevelById: (i: unknown, u: unknown, l: unknown) => {
                    calls.level = [i, u, l];
                },
            },
            player: {
                inventory: {
                    addById: () => {
                        calls.granted++;
                    },
                },
            },
        },
    };
    
    
    const ctx = { definitely: "not the options" };
    try {
        ANY_ACTIONS.techAppendUnlock({ id: "t1" }, ctx, {
            techId: "t1",
            structures: ["a"],
        });
        ANY_ACTIONS.techSetUpgradeLevel({ id: "t1" }, ctx, {
            itemId: "sword",
            upgradeId: "u1",
            level: 3,
        });
        ANY_ACTIONS.techGrantItem({ id: "t1" }, ctx, { itemId: "gem", count: 4 });
    } finally {
        if (prev === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = prev;
    }

    assertEquals(calls.append, ["t1", { structures: ["a"] }], "appendUnlock never fired");
    assertEquals(calls.level, ["sword", "u1", 3], "setLevelById never fired");
    assertEquals(calls.granted, 4, "addById takes one id, so count is a loop");
});
