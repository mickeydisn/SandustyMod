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
} from "./action-class.ts";
import { ANY_HANDLERS, CODE_HANDLERS, PROCESS_HANDLERS } from "./handlers.ts";

/**
 * Every implemented action, across all three registries.
 *
 * `CODE_HANDLERS` holds the modifier slot and its values are `{ kind, fn }`
 * objects, but they are actions like any other — leaving them out is what made
 * the catalogue read 43 when the real number is 46.
 */
const ALL_KEYS = [
    ...Object.keys(ANY_HANDLERS),
    ...Object.keys(PROCESS_HANDLERS),
    ...Object.keys(CODE_HANDLERS),
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
    const counts: Record<string, number> = {};
    for (const c of Object.values(ACTION_CLASSES)) counts[c] = (counts[c] ?? 0) + 1;
    assertEquals(counts, {
        api: 5,
        "context-bound": 3,
        "self-sufficient": 15,
        pure: 23,
    });
    assertEquals(Object.values(ACTION_CLASSES).length, ALL_KEYS.length, "total");
});

Deno.test("only `api` satisfies the rule, and the rest are the work to do", () => {
    // "An action must call one api.* section." Five do. The other 38 are the
    // decision Phase 2 exists for, broken out by class so each can be ruled on
    // separately.
    assertEquals(Object.values(ACTION_CLASSES).filter((c) => c === "api").length, 5);
    assertEquals(offRuleActions().length, 41);
    const off = offRuleActions();
    assertEquals(
        off.filter((a) => a.cls === "context-bound").map((a) => a.key).sort(),
        ["processorConvert", "processorLift", "processorScan"],
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
    // argument 2 as "ctx" for *both* registries. `ANY_HANDLERS` is
    // `(payload, extra)`, so `energyDefault` reads options and must not be
    // filed as context-bound.
    const anyDeps = measureActionDeps("energyDefault");
    assert(anyDeps?.extra, "energyDefault reads its options");
    assert(!anyDeps?.ctx, "energyDefault must not look context-bound");
    const procDeps = measureActionDeps("processorConvert");
    assert(procDeps?.ctx, "processorConvert really does read ctx");
});
