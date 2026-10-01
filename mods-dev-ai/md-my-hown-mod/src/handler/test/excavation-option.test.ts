
import { assert, assertEquals } from "https:
import {
    compileExcavationProfile,
    EXCAVATION_OPTIONS,
    excavationOptionKeys,
    excavationOptionOf,
    excavationOptionParams,
    resolveExcavationOption,
} from "../excavation-option/index.ts";

Deno.test("the five presets are the only options, and every one resolves", () => {
    assertEquals(excavationOptionKeys().sort(), [
        "excavationCrusher",
        "excavationDefault",
        "excavationDrill",
        "excavationGun",
        "excavationShatter",
    ]);
    for (const key of excavationOptionKeys()) {
        assert(typeof resolveExcavationOption(key) === "function", `${key} does not resolve`);
    }
    assertEquals(resolveExcavationOption("nope"), undefined);
});

Deno.test("each preset returns its own values, and a fresh object each call", () => {
    
    
    const a = resolveExcavationOption("excavationDrill")!({});
    const b = resolveExcavationOption("excavationDrill")!({});
    assertEquals(a, b, "same input must build the same value");
    assert(a !== b, "each call must return a fresh object");

    assertEquals(resolveExcavationOption("excavationDefault")!({}), { power: 10 });
    assertEquals(resolveExcavationOption("excavationCrusher")!({}), {
        power: 24,
        options: { fromRocketExplosion: true, forceRemoveAll: false },
    });
    assertEquals(resolveExcavationOption("excavationShatter")!({}), {
        power: 16,
        options: { useLiteralOutVelocity: true },
    });
});

Deno.test("the option supplies power and flags, and never the dig shape", () => {
    
    
    
    for (const key of excavationOptionKeys()) {
        const built = resolveExcavationOption(key)!({}) as Record<string, unknown>;
        assertEquals(built.pattern, undefined, `${key} must not set a pattern`);
        assertEquals(built.terrainRules, undefined, `${key} must not set terrain rules`);
    }
});

Deno.test("params overlay the defaults, and only where they are declared", () => {
    
    const drill = resolveExcavationOption("excavationDrill")!({ power: 12 });
    assertEquals(drill.power, 12);
    assertEquals(drill.options?.drillTierDamage, 25, "untouched keys keep their default");
    
    
    assertEquals(resolveExcavationOption("excavationDrill")!({ pwoer: 40 }).power, 8);
    
    
    assertEquals(resolveExcavationOption("excavationDrill")!({ power: "12" }).power, 8);
    
    
    const flag = resolveExcavationOption("excavationDefault")!({ fromGun: true });
    assertEquals(flag.power, 10);
    assertEquals(flag.options, { fromGun: true });
});

Deno.test("a preset with no flags carries no options key at all", () => {
    
    
    assertEquals(resolveExcavationOption("excavationDefault")!({}), { power: 10 });
});

Deno.test("drillTierDamage is a number, not a switch", () => {
    
    
    const d = resolveExcavationOption("excavationDrill")!({});
    assertEquals(typeof d.options?.drillTierDamage, "number");
    
    const tier = excavationOptionParams("excavationDrill").find((p) => p.key === "drillTierDamage");
    assertEquals(tier?.def, 25);
});

Deno.test("the param list is derived by calling, so it cannot drift", () => {
    
    
    
    for (const key of excavationOptionKeys()) {
        const built = resolveExcavationOption(key)!({});
        const params = excavationOptionParams(key);
        assert(params.length > 0, `${key} derived no params`);
        for (const p of params) {
            const value = p.key === "power" ? built.power : built.options?.[p.key];
            assertEquals(typeof value, typeof p.def, `${key}.${p.key} type drifted`);
        }
    }
    assertEquals(excavationOptionParams("nope"), []);
});

Deno.test("a profile with no option uses its own power and options", () => {
    
    const entry = { power: 33, options: { fromDrill: true } };
    assertEquals(compileExcavationProfile(entry), {
        patch: { power: 33, options: { fromDrill: true } },
    });
    assertEquals(compileExcavationProfile(undefined), { patch: {} });
});

Deno.test("an option wins over the entry's own power, and the pattern survives", () => {
    
    
    
    const entry = {
        power: 2,
        options: { fromGun: true },
        pattern: [[1, 1], [1, 1]],
        terrainRules: [{ cellType: "stone" }],
    };
    const { patch, key, problem } = compileExcavationProfile({
        ...entry,
        option: { key: "excavationCrusher" },
    });
    assertEquals(patch.power, 24);
    assertEquals(patch.options, { fromRocketExplosion: true, forceRemoveAll: false });
    assertEquals(key, "excavationCrusher");
    assertEquals(problem, undefined);
    
    assertEquals(entry.pattern, [[1, 1], [1, 1]]);
    assertEquals(entry.terrainRules.length, 1);
});

Deno.test("an unknown option key is reported, and degrades to the stored power", () => {
    
    
    const problems: string[] = [];
    const { patch, key, problem } = compileExcavationProfile(
        { power: 7, option: { key: "excationDril" } },
        (f) => problems.push(String((f.error as Error).message)),
    );
    assertEquals(patch.power, 7, "must fall back to the stored power");
    assertEquals(key, "excationDril");
    assertEquals(typeof problem, "string");
    assertEquals(problems.length, 1, "the author is told, not silently");
});

Deno.test("params round-trip through the stored shape", () => {
    const entry = { power: 10, option: { key: "excavationDrill", params: { power: 12 } } };
    const { ref } = excavationOptionOf(entry);
    assertEquals(ref?.key, "excavationDrill");
    assertEquals(ref?.params, { power: 12 });
    assertEquals(compileExcavationProfile(entry).patch.power, 12);
    
    assertEquals(excavationOptionOf({ power: 10 }), {});
    assertEquals(excavationOptionOf(undefined), {});
});

Deno.test("the presets are not actions, which is the whole point", async () => {
    
    
    
    const keys = excavationOptionKeys();
    assertEquals(
        Object.keys(EXCAVATION_OPTIONS).filter((k) => !keys.includes(k)),
        [],
    );
    const A = await import("../actions/index.ts");
    for (const key of keys) {
        assertEquals(A.resolveAction(key), undefined, `${key} is an action again`);
    }
});
