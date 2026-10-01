
import { assert, assertEquals } from "https:
import { HANDLER_META } from "../core/handler-registry.ts";
import { resolveAction } from "../core/process.ts";




import { ACTION_CLASSES } from "../core/action-class.ts";
import {
    ACTION_DOMAIN_BLURBS,
    ACTION_DOMAIN_LABELS,
    ACTION_DOMAINS,
    ACTION_EFFECT_BLURBS,
    ACTION_EFFECT_LABELS,
    ACTION_EFFECTS,
    isVacuousReturn,
    VALID_OPTIONS,
} from "../core/action-class.ts";
import {
    ACTION_SCOPE,
    CALL_SITE_SCOPE,
    canRunAt,
    needsOf,
    SCOPE_NEEDS,
    type ScopeNeed,
    scopeSatisfies,
    slotsFor,
} from "../core/scope.ts";




const READ_STUB = "probe-read";
const OPTION_STUB = "probe-option";

function probe(into: Set<string>, prefix = "", stub: string = OPTION_STUB): unknown {
    return new Proxy(function () {} as object, {
        get(_t, prop) {
            if (typeof prop === "symbol") {
                
                
                
                
                
                
                if (prop === Symbol.toPrimitive) return undefined;
                return () => stub;
            }
            const path = `${prefix}${String(prop)}`;
            into.add(path);
            if (prop === "valueOf" || prop === "toString") return () => 1;
            return probe(into, `${path}.`, stub);
        },
        apply: () => stub,
        set: () => true,
    });
}


function apiProbe(into: Set<string>): unknown {
    return probe(into, "api.", READ_STUB);
}


function measureNeeds(key: string): ScopeNeed[] {
    const fn = resolveAction(key);
    if (!fn) return [];
    const payload = new Set<string>();
    const ctx = new Set<string>();
    
    
    const withoutCtx = new Set<string>();
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    
    
    
    
    
    const options = probe(new Set(), "options.");
    
    
    
    
    
    
    
    const prevSandkit = (globalThis as { sandkit?: unknown }).sandkit;
    
    
    
    
    
    const valid = VALID_OPTIONS[key];
    try {
        
        (globalThis as { sandkit?: unknown }).sandkit = apiProbe(new Set());
        try {
            fn(probe(payload), probe(ctx), options);
        } catch {
            
            
        }
        if (valid) {
            try {
                fn(probe(payload), probe(ctx), valid);
            } catch {
                
            }
        }
        
        (globalThis as { sandkit?: unknown }).sandkit = apiProbe(withoutCtx);
        try {
            fn(probe(new Set()), null, options);
        } catch {
            
        }
        if (valid) {
            try {
                fn(probe(new Set()), null, valid);
            } catch {
                
            }
        }
    } finally {
        console.log = log;
        console.warn = warn;
        if (prevSandkit === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = prevSandkit;
    }
    const top = new Set([...payload].map((p) => p.split(".")[0]));
    const needs: ScopeNeed[] = [];
    if (top.has("x") || top.has("y")) needs.push("pos");
    if (top.has("data")) needs.push("data");
    
    
    if (ctx.size > 0) {
        const stillReadsAmbiently = [...AMBIENT_CELL_READS].some((p) =>
            [...withoutCtx].some((seen) => seen.endsWith(`.${p}`))
        );
        needs.push(stillReadsAmbiently ? "read" : "commit");
    }
    return needs;
}


const AMBIENT_CELL_READS = [
    "getResolvedTypeAtCell",
    "isCellEmptyAtCell",
    "getDataAtCell",
];

Deno.test("ACTION_SCOPE matches what the actions actually read", () => {
    
    
    const drift: string[] = [];
    for (const key of Object.keys(ACTION_SCOPE)) {
        const measured = measureNeeds(key).sort();
        const declared = [...needsOf(key)].sort();
        if (measured.join("+") !== declared.join("+")) {
            drift.push(`${key}: measured [${measured}] but ACTION_SCOPE says [${declared}]`);
        }
    }
    assertEquals(drift, [], `scope drift:\n  ${drift.join("\n  ")}`);
});

Deno.test("every registered action has a scope entry", () => {
    
    
    
    const missing = HANDLER_META.map((m) => m.key).filter((k) => !(k in ACTION_SCOPE));
    assertEquals(missing, [], `no scope recorded: ${missing.join(", ")}`);
});



Deno.test("an action may run only where its needs are delivered", () => {
    
    
    assert(canRunAt("processorConvert", "processing"), "needs a commit");
    assert(!canRunAt("processorConvert", "signal"), "a signal has no commit()");
    assert(
        !canRunAt("processorConvert", "itemAction"),
        "nor does an item use — but it does have a position now, see the test below",
    );
    assert(canRunAt("structureReadData", "signal"), "a structure has .data");
    assert(!canRunAt("structureReadData", "trigger"), "a trigger gets nothing at all");
    
    
    
    assert(canRunAt("noop", "signal"), "needs nothing, so it fits any call site");
    assert(!canRunAt("noop", "projectile"), "projectile is not a call site at all");
});

Deno.test("an item use has a position, and the cell families come with it", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(CALL_SITE_SCOPE.itemAction, {
        pos: true,
        data: true,
        read: true,
        commit: false,
        ret: false,
    });
    for (const key of ["itemExcavate", "itemShoot", "createTerrain", "buildStructure"]) {
        assert(canRunAt(key, "itemAction"), `${key} should run from a hotbar tool`);
    }
    
    for (const key of ["readElement", "countElements", "countEmpty", "isElementAtCell"]) {
        assert(canRunAt(key, "itemAction"), `${key} reads ambiently, so an item can ask too`);
    }
});

Deno.test("only a commit needs the context; a read is ambient", () => {
    
    
    
    
    
    
    
    
    
    
    const wantsCommit = Object.entries(ACTION_SCOPE)
        .filter(([, n]) => n.includes("commit"))
        .map(([k]) => k)
        .sort();
    assertEquals(wantsCommit, [
        "createElement",
        "emptyCells",
        "logicForEach",
        "processorConvert",
        "processorLift",
        "replaceElement",
        "transformElement",
    ]);
    for (const key of wantsCommit) {
        assertEquals(
            slotsFor(key),
            ["processing"],
            `${key} writes through ctx.commit, which only process() delivers`,
        );
    }

    
    
    
    
    
    
    
    
    
    
    
    const wantsRead = Object.entries(ACTION_SCOPE)
        .filter(([, n]) => n.includes("read"))
        .map(([k]) => k)
        .sort();
    assertEquals(wantsRead, [
        "countElements",
        "countEmpty",
        "isElementAtCell",
        "logicAll",
        "logicAny",
        "logicCount",
        "logicSum",
        "readElement",
        
        
        
        
        "removeElement",
    ]);
    for (const key of wantsRead) {
        const sites = slotsFor(key);
        assert(
            sites.includes("processing") && sites.includes("itemAction") &&
                sites.includes("signal"),
            `${key} reads ambiently, so it should not be locked to one slot: ${sites.join(", ")}`,
        );
    }
});

Deno.test("no action is offered a call site that delivers less than it needs", () => {
    
    
    
    
    for (const m of HANDLER_META) {
        for (const slot of m.slots) {
            assert(
                canRunAt(m.key, slot),
                `${m.key} is offered in "${slot}", which delivers less than it reads`,
            );
        }
    }
});

Deno.test("a trigger delivers nothing, so only the needless actions fit there", () => {
    
    
    
    assertEquals(CALL_SITE_SCOPE.trigger, {
        pos: false,
        data: false,
        read: true,
        commit: false,
        ret: false,
    });
    assert(slotsFor("noop").includes("trigger"));
    for (const key of Object.keys(ACTION_SCOPE)) {
        if (needsOf(key).length === 0) continue;
        assert(!canRunAt(key, "trigger"), `${key} needs something a trigger never sends`);
    }
});

Deno.test("scopeSatisfies is the subset relation, and it is total", () => {
    const all: ScopeNeed[] = ["pos", "data", "read", "commit"];
    assert(
        scopeSatisfies({ pos: true, data: true, read: true, commit: true, ret: false }, all),
    );
    
    
    
    assert(
        !scopeSatisfies({ pos: true, data: true, read: true, commit: false, ret: false }, all),
    );
    assert(
        scopeSatisfies({ pos: true, data: true, read: false, commit: false, ret: false }, [
            "pos",
            "data",
        ]),
    );
    
    
    assert(
        scopeSatisfies({ pos: false, data: false, read: false, commit: false, ret: true }, []),
    );
    assert(!canRunAt("noop", "not-a-call-site"), "an unknown site satisfies nothing");
    assertEquals(SCOPE_NEEDS.length, 4, "four needs is the whole vocabulary");
});



Deno.test("every action has exactly one effect and one domain", () => {
    
    
    
    const keys = HANDLER_META.map((m) => m.key);
    const noEffect = keys.filter((k) => !ACTION_EFFECTS[k]);
    const noDomain = keys.filter((k) => !ACTION_DOMAINS[k]);
    assertEquals(noEffect, [], `no effect recorded: ${noEffect.join(", ")}`);
    assertEquals(noDomain, [], `no domain recorded: ${noDomain.join(", ")}`);
});

Deno.test("the effect vocabulary is closed and fully labelled", () => {
    
    
    const used = new Set(Object.values(ACTION_EFFECTS));
    for (const e of used) {
        assert(ACTION_EFFECT_LABELS[e], `effect "${e}" has no label`);
        assert(ACTION_EFFECT_BLURBS[e], `effect "${e}" has no blurb`);
    }
    for (const d of new Set(Object.values(ACTION_DOMAINS))) {
        assert(ACTION_DOMAIN_LABELS[d], `domain "${d}" has no label`);
        assert(ACTION_DOMAIN_BLURBS[d], `domain "${d}" has no blurb`);
    }
    assertEquals(used.size, 6, "six effects, all of them reachable");
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(Object.keys(ACTION_DOMAIN_LABELS).length, 11, "eleven domains");
});

Deno.test("only actions that change the grid are filed as committing", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    for (const [key, effect] of Object.entries(ACTION_EFFECTS)) {
        if (effect !== "commits") continue;
        const viaContext = needsOf(key).includes("commit");
        const viaApi = ACTION_CLASSES[key] === "api";
        assert(
            viaContext || viaApi,
            `${key} claims to commit but neither reads the context nor reaches the api, ` +
                "so it cannot change anything",
        );
    }
    assertEquals(
        Object.entries(ACTION_EFFECTS).filter(([, e]) => e === "commits").map(([k]) => k).sort(),
        [
            
            
            
            "addVelocity",
            "createElement",
            "emptyCells",
            "processorConvert",
            "processorLift",
            "removeElement",
            "replaceElement",
            "setDuration",
            "setVelocity",
            "teleportElement",
            "toParticle",
            "transformElement",
            
            
            
            
            
            "writeDataField",
        ],
        "the three sense element actions only read, so they are not committers",
    );
});

Deno.test("a value returned where the engine ignores it is flagged, not hidden", () => {
    
    
    
    
    
    
    
    assert(isVacuousReturn("energyBank", false), "processing discards it");
    
    
    
    
    assert(!isVacuousReturn("processorConvert", false), "not a returns action at all");
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(
        Object.keys(ACTION_EFFECTS).filter((k) => isVacuousReturn(k, false)).length,
        10,
        "10 return a value and no slot reads it",
    );
    
    
    assertEquals(
        Object.keys(ACTION_EFFECTS).filter((k) => k.startsWith("projectile")),
        [],
        "a projectile option was filed as an action effect",
    );
});
