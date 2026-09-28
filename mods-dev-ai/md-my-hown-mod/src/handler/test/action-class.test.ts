/**
 * The action **class** — what each action depends on.
 *
 * The class is derived by measurement (`measureActionDeps`), then recorded in
 * `ACTION_CLASSES` so nothing probes at runtime. These tests are what keep the
 * two honest: if a handler starts calling an API, or stops, the recorded class
 * has to change with it or this file fails.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    ACTION_CLASS_BLURBS,
    ACTION_CLASS_LABELS,
    ACTION_CLASSES,
    actionClassOf,
    type ActionDeps,
    classFromDeps,
    measureActionDeps,
    offRuleActions,
} from "../core/action-class.ts";
import { ANY_ACTIONS, MODIFIER_ACTIONS, PROCESSING_ACTIONS } from "../actions/index.ts";

/**
 * Every implemented action, across all three registries.
 *
 * `MODIFIER_ACTIONS` holds the modifier slot and its values are `{ kind, fn }`
 * objects, but they are actions like any other — leaving them out is what made
 * the catalogue read 43 when the real number is 46.
 */
const ALL_KEYS = [
    ...Object.keys(ANY_ACTIONS),
    ...Object.keys(PROCESSING_ACTIONS),
    ...Object.keys(MODIFIER_ACTIONS),
];

Deno.test("every action has a class, and no class names an action that is gone", () => {
    assertEquals(
        ALL_KEYS.filter((k) => !ACTION_CLASSES[k]),
        [],
        "unclassified",
    );
    assertEquals(
        Object.keys(ACTION_CLASSES).filter((k) => !ALL_KEYS.includes(k)),
        [],
        "classified but not implemented",
    );
});

Deno.test("the recorded class still matches what the action actually does", () => {
    // The whole point of recording rather than computing: this is the check that
    // makes the record trustworthy. `classFromDeps` is the ladder; anything that
    // disagrees is a handler that changed behaviour, or a map that drifted.
    const wrong: string[] = [];
    for (const key of ALL_KEYS) {
        const deps = measureActionDeps(key);
        assert(deps, `${key} could not be measured`);
        const derived = classFromDeps(deps);
        if (derived !== ACTION_CLASSES[key]) {
            wrong.push(`${key}: says ${ACTION_CLASSES[key]}, does ${derived}`);
        }
    }
    assertEquals(wrong, [], "recorded class drifted from behaviour");
});

Deno.test("the four classes partition the catalogue with the measured counts", () => {
    // A number per class, so a change in the shape of the catalogue is visible
    // rather than inferred from a diff.
    //
    // History, so the numbers below are readable:
    //   41 → 39: the seven projectile presets left the action catalogue. They
    //     measured as `pure` and are `ProjectileOptionFn`s now.
    //   39 → 41: the `feel/` folder arrived (`toast`, `particles`) and
    //     `upgradeLog` moved out of the loggers' bucket.
    //   41 → 36: the five excavation presets left the same way, for the same reason.
    //   36 → 37: `isElementAtCell` arrived — the first action that exists only
    //     because the process context does, and the first `sense` action filed in the
    //     processing-signature table (`processingSenseActions`). It measures as
    //     `context-bound`, which is the class that is *about* it.
    //   37 → 44: the seven element actions — read, count, count-empty, replace,
    //     create, empty, transform. Every one measures as `context-bound`, which is
    //     the point: the engine hands a processor a **context**, not the
    //     `api.elements` namespace, so the whole family is defined by that single
    //     dependency. `context-bound` going 4 → 11 in one step is the clearest
    //     statement of what the class means.
    //   44 → 51: the seven motion actions — velocity, duration, teleport, particles.
    //     These measure as **`api`**, not `context-bound`, and that is the whole
    //     finding. `commit` has only `create` and `remove` as mutation kinds, so there
    //     is no way to express a velocity in a batched write; the family has to reach
    //     `api.elements.*` instead, and it pays for that with per-cell deferred writes
    //     rather than one transaction. So `api` more than doubles, 9 → 16, and the
    //     element/motion split is exactly the atomic/non-atomic split. The classification
    //     was **measured**, not chosen: the probe caught it, and it was right.
    //   51 → 58 with the `api.grid.mutate` migration, and this is the interesting one,
    //     because it moves `context-bound` in the **opposite** direction from the
    //     motion family and for the opposite reason. The four element *writes* stopped
    //     calling `ctx.commit` and now reach `api.grid.mutate`, so they measure `api`.
    //     The three element *reads* never touched a namespace and are still
    //     `context-bound`.
    //
    //     So `api` went 16 → 20 and `context-bound` 11 → 7, and the interesting part is
    //     what that did to the *meaning* of the class. `context-bound` used to mean
    //     "atomic" — `ctx.commit` was the only batched write a processor had. It now
    //     means "reads its world from the context", which is a much narrower and more
    //     accurate claim. An action can be `api`-bound *and* still depend on the
    //     context, and all four migrated writes do, for their reads. A single class
    //     axis cannot say both things, which is why the **scope** table is checked
    //     separately in `scope.test.ts`: `["pos", "cell"]` vs `["pos"]` is the axis
    //     that actually still distinguishes them.
    const counts: Record<string, number> = {};
    for (const c of Object.values(ACTION_CLASSES)) counts[c] = (counts[c] ?? 0) + 1;
    assertEquals(counts, {
        //   20 → 38 with the structure family, and it is the largest single-family jump
        //     in the table. Eighteen actions, all landing on the **same** class, which is
        //     the least informative result the probe has produced — and the most
        //     predictable one, because `StructureProcessingContext` has no structure
        //     members at all, so there was no version of any of these that could have
        //     measured as `context-bound`. The probe had nothing to catch and correctly
        //     caught nothing.
        //
        //     That makes the family the first real test of whether the probe is honest
        //     about a *uniform* outcome, and it is: 18/18, no stragglers. Compare
        //     `self-sufficient`, which sat at 14 through four families because it is a
        //     claim about reaching for nothing and the original stub actions never grew
        //     out of it.
        //
        //     Then the terrain family added eleven more, all `api` again and with the same
        //     uniformity for the same reason: `api.terrains` is a namespace the processing
        //     context does not reach into, so nothing in it could have measured otherwise.
        //
        //     `api` is now 49 of 80. Worth naming plainly: the class axis has stopped being
        //     a useful discriminator and has become a census of "calls the engine". The
        //     axes that *do* separate the four cell families are the **write path**
        //     (batched vs per-cell) and the **namespace** (`ACTION_APIS`, where terrain is
        //     the only family spanning two). If this table is ever simplified, that is the
        //     finding that would justify it.
        api: 49,
        "context-bound": 7,
        "self-sufficient": 14,
        pure: 10,
    });
    assertEquals(Object.values(ACTION_CLASSES).length, ALL_KEYS.length, "total");
});

Deno.test("only `api` satisfies the rule, and the rest are the work to do", () => {
    // "An action must call one api.* section." Twenty do. The other 35 are the
    // decision Phase 2 exists for, broken out by class so each can be ruled on
    // separately.
    //
    // 28 → 35 with the element family, and the ratio is the interesting part: all
    // seven landed on the **off-rule** side because none reached an `api.*` namespace
    // at all. They were the clearest case yet of an action that is atomic and has no
    // api dependency — `ctx.commit` is not a namespace, so the rule had nothing to say
    // about them, and they were honestly counted as outstanding work.
    //
    // The motion family then did something the rule did not predict: all seven landed
    // on the **on-rule** side, because they call `api.elements` — but they call *many*
    // methods on it (`setVelocityAtCell` over a region is one call per cell). So "one
    // api section" is satisfied and "one api call" is not, a distinction the rule never
    // had to make until now.
    //
    // And the `api.grid.mutate` migration moved the **element family back onto the
    // on-rule side**, 35 → 35 with 35 → 31 off-rule, because four of the seven crossed.
    // That is the rule earning its keep: it detected a real change in what these actions
    // touch, in the same place, without anyone updating it.
    //
    // The structure family then crossed all eighteen at once, and the off-rule count did
    // not move: 31 → 31, on-rule 31 → 38. That is the largest single swing in the table's
    // history and it is worth reading carefully, because a whole family passing a rule
    // at once means the rule is not discriminating. `api` is now 38 of 69 — a census of
    // "calls the engine", not a description of behaviour. The axes that *do* separate
    // the three families are the **write path** (batched vs per-cell) and the **effect**
    // (`ACTION_EFFECTS`), both of which the module docs carry. If this table is ever
    // simplified, that is the finding that would justify it.
    assertEquals(Object.values(ACTION_CLASSES).filter((c) => c === "api").length, 49);
    assertEquals(offRuleActions().length, 31);
    const off = offRuleActions();
    assertEquals(
        off.filter((a) => a.cls === "context-bound").map((a) => a.key).sort(),
        [
            // The three element **reads** and the original `processor*` trio. The four
            // element *writes* used to be on this list and are not any more: reaching
            // `api.grid.mutate` put them on the on-rule side. This is the list that
            // shows the migration most plainly, because these seven are exactly the
            // element family and the four that left are exactly the ones that write.
            "countElements",
            "countEmpty",
            "isElementAtCell",
            "processorConvert",
            "processorLift",
            "processorScan",
            "readElement",
        ],
    );
});

Deno.test("a class implies what the action may reach for", () => {
    // The ladder is a *contract*, not a label: `pure` must not touch the engine,
    // `api` must not need a context. Checked per action so a violation names the
    // handler rather than the class.
    for (const key of ALL_KEYS) {
        const deps = measureActionDeps(key) as ActionDeps;
        const cls = actionClassOf(key);
        if (cls === "pure") {
            assert(
                !deps.api && !deps.ctx && !deps.payload && !deps.extra,
                `${key} is pure but reached for ${JSON.stringify(deps)}`,
            );
        }
        if (cls === "api") {
            assert(deps.api, `${key} is api-bound but never touched api`);
        }
        if (cls === "context-bound") {
            assert(deps.ctx, `${key} is context-bound but never read ctx`);
        }
    }
});

Deno.test("every class has a label and a blurb", () => {
    // A grouping the UI cannot name is a grouping the user cannot use.
    for (const cls of Object.keys(ACTION_CLASS_LABELS)) {
        assert(ACTION_CLASS_BLURBS[cls as never], `${cls} has no blurb`);
    }
    assertEquals(
        Object.keys(ACTION_CLASS_LABELS).sort(),
        Object.keys(ACTION_CLASS_BLURBS).sort(),
    );
});

Deno.test("the probe tells the two registries' signatures apart", () => {
    // A regression guard for the mistake that shaped this module: labelling
    // argument 2 as "ctx" for *both* registries. `ANY_ACTIONS` is
    // `(payload, extra)`, so `energyDefault` reads options and must not be
    // filed as context-bound.
    const anyDeps = measureActionDeps("energyDefault");
    assert(anyDeps?.extra, "energyDefault reads its options");
    assert(!anyDeps?.ctx, "energyDefault must not look context-bound");
    const procDeps = measureActionDeps("processorConvert");
    assert(procDeps?.ctx, "processorConvert really does read ctx");
});
