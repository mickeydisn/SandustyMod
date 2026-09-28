/**
 * The excavation options: the presets, and the profile they are compiled into.
 *
 * These assertions are mostly about the two things that were **wrong** before the
 * split, because both failures were silent:
 *
 *   - As actions, the five presets were offered on `itemAction`, which discards a
 *     process's return. Each one built a correct `ExcavateOptions` object and gave
 *     it to nobody. `handler-classification.test.ts` holds the other half of that
 *     claim — that they are no longer actions at all.
 *   - As bare keys they were constants, so a drill at power 12 did not exist. The
 *     `params` overlay is what makes them a factory rather than a fixed value, and
 *     its *rejection* rule is the part that needs holding: a dropped parameter is
 *     invisible, so it must not be accepted silently.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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
    // A shared literal would change under the next profile: the engine may hold and
    // mutate the payload it was given.
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
    // The contract that separates this from `registerProfile`'s own definition type.
    // `pattern` and `terrainRules` are the author's; a preset has no opinion about
    // the shape of a dig or what sandstone becomes.
    for (const key of excavationOptionKeys()) {
        const built = resolveExcavationOption(key)!({}) as Record<string, unknown>;
        assertEquals(built.pattern, undefined, `${key} must not set a pattern`);
        assertEquals(built.terrainRules, undefined, `${key} must not set terrain rules`);
    }
});

Deno.test("params overlay the defaults, and only where they are declared", () => {
    // The reason these are a factory: a drill at a power of its own.
    const drill = resolveExcavationOption("excavationDrill")!({ power: 12 });
    assertEquals(drill.power, 12);
    assertEquals(drill.options?.drillTierDamage, 25, "untouched keys keep their default");
    // A typo is dropped rather than handed on. A silently-accepted `pwoer` would
    // look configured and dig at 8.
    assertEquals(resolveExcavationOption("excavationDrill")!({ pwoer: 40 }).power, 8);
    // And a value of the wrong type is dropped: a string where a number belongs would
    // reach the engine as-is.
    assertEquals(resolveExcavationOption("excavationDrill")!({ power: "12" }).power, 8);
    // `power` is a declared key everywhere, so it routes to the top level; every
    // other parameter is a flag and routes inside `options`.
    const flag = resolveExcavationOption("excavationDefault")!({ fromGun: true });
    assertEquals(flag.power, 10);
    assertEquals(flag.options, { fromGun: true });
});

Deno.test("a preset with no flags carries no options key at all", () => {
    // `options: {}` is not a neutral value to the engine — it is a key the author did
    // not ask for, and a profile with no flags should have no `options` at all.
    assertEquals(resolveExcavationOption("excavationDefault")!({}), { power: 10 });
});

Deno.test("drillTierDamage is a number, not a switch", () => {
    // The one field among the seven that is not boolean, and therefore the one a
    // generic "all flags are switches" assumption gets wrong.
    const d = resolveExcavationOption("excavationDrill")!({});
    assertEquals(typeof d.options?.drillTierDamage, "number");
    // And the derived param list says so, so the panel renders a number box.
    const tier = excavationOptionParams("excavationDrill").find((p) => p.key === "drillTierDamage");
    assertEquals(tier?.def, 25);
});

Deno.test("the param list is derived by calling, so it cannot drift", () => {
    // Every preset that returns a number or boolean must appear in its own list —
    // this is the invariant a hand-written table would break, and the reason the
    // table is not hand-written.
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
    // A hand-written profile is a first-class thing, not a missing one.
    const entry = { power: 33, options: { fromDrill: true } };
    assertEquals(compileExcavationProfile(entry), {
        patch: { power: 33, options: { fromDrill: true } },
    });
    assertEquals(compileExcavationProfile(undefined), { patch: {} });
});

Deno.test("an option wins over the entry's own power, and the pattern survives", () => {
    // Rule 2 in `compile.ts`: the option owns `power` and `options`; the entry owns
    // everything else. A profile that named a preset and also kept a stale `power`
    // would otherwise have two sources for one number.
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
    // The dig shape is untouched by the option — it is still the entry's.
    assertEquals(entry.pattern, [[1, 1], [1, 1]]);
    assertEquals(entry.terrainRules.length, 1);
});

Deno.test("an unknown option key is reported, and degrades to the stored power", () => {
    // A broken preset must leave a *working* profile, not an unregisterable one —
    // the engine would otherwise never see this profile at all.
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
    // A pre-split profile has no `option` key at all, and nothing is claimed from it.
    assertEquals(excavationOptionOf({ power: 10 }), {});
    assertEquals(excavationOptionOf(undefined), {});
});

Deno.test("the presets are not actions, which is the whole point", async () => {
    // The regression this module exists to prevent: someone adding one of these back
    // to `actions/` because it "looks like a handler". It would resolve, pass a
    // type check, and do nothing at runtime.
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
