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
    //     separately in `scope.test.ts`: `["pos", "commit"]` vs `["pos"]` is the axis
    //     that actually still distinguishes them.
    //   58 → 58 with the ambient cell read, and it completes the migration the line
    //     above describes. `readElement`, `countElements` and `countEmpty` were the
    //     last three readers that reached **no** namespace; `cellReaders` now falls
    //     back to `api.elements.getResolvedTypeAtCell` / `api.grid.isCellEmptyAtCell`
    //     when the engine hands over no context, so they measure `api` too.
    //     `context-bound` 7 → 3, and the three that remain
    //     (`isElementAtCell`, `processorLift`, `processorConvert`) are the ones whose
    //     dependency really is the context object and nothing else.
    //   `self-sufficient` 14 → 17 with the three buffer actions. They land there
    //     rather than under a shared-memory class, and the reason is worth
    //     recording: the probe watches property access *during* the call, and a
    //     buffer action only calls methods on a handle it was handed — the
    //     `api.shared.buffers` lookup happened at construction, before the action
    //     ran. So they measure as "uses only its own options", which is exactly
    //     what the class is supposed to mean. The `total` moved 84 → 87 because
    //     three actions were genuinely added, not because any axis shifted.
    //   `api` 57 → 59 with `readDataField` and `writeDataField`, the element data
    //     slots, and only that class moves. They resolve `hostNs("elements")` the
    //     same way the motion family does, so the probe sees the namespace — and
    //     the reason it is worth saying is that the *first* draft of these two
    //     measured `self-sufficient`: the `hostNs` call sat **after** the slot
    //     validation, so an action that rejected a bad slot returned before ever
    //     reaching it. Moving the lookup above the checks is what makes the
    //     measurement true, and the ordering is now load-bearing rather than
    //     incidental.
    //
    //     The total is unchanged, which is the point worth recording: no action was
    //     added or removed. What changed is that the class axis now agrees with what
    //     the code does — the readers genuinely call the engine now, and the scope
    //     table's `read` need (ambient) is what lets them run in a slot that hands
    //     over no `StructureProcessingContext` at all, including an item use.
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
        //   79 → 84 with the logic family — five range walks, all `api` and all five
        //     in the same class again. The uniformity has a single cause: they reuse
        //     the element family's own `cellReaders` and `writeCells`, so they reach
        //     `api.elements` / `api.terrains` / `api.grid.mutate` through the same
        //     ambient namespaces every other cell action does.
        //
        //     `api` is now 57 of 84. Worth naming plainly: the class axis has stopped
        //     being a useful discriminator and has become a census of "calls the
        //     engine". The axes that *do* separate the five cell families are the
        //     **write path** (batched vs per-cell), the **namespace** (`ACTION_APIS`,
        //     where terrain is the only family spanning two) and the **scope**
        //     (`scope.ts`, the only one that still splits a family in two). If this
        //     table is ever simplified, that is the finding that would justify it.
        api: 59,
        "context-bound": 3,
        "self-sufficient": 17,
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
    //
    // 52 → 57, and all five that crossed are the logic family's walks — `logicAny`,
    // `logicAll`, `logicCount`, `logicSum` and `logicForEach`. They reuse the element
    // family's `cellReaders` and `writeCells`, so they call the same ambient
    // namespaces the single-cell actions do.
    //
    // The off-rule count moves 28 → 27, and it is worth being precise about why it
    // fell by one rather than five. Five actions left the off-rule side, but
    // `processorScan` also left the *catalogue* when the logic family replaced it —
    // and it was `context-bound`, which is the only class on this list. So the
    // context-bound set drops from four to three (`isElementAtCell`, `processorLift`,
    // `processorConvert`) and those three are genuinely the actions whose dependency
    // is the context object and nothing else.
    //
    // ...and then 27 → 30 with the three buffer actions, which land on the off-rule
    // side by the same reasoning recorded in the class table: a buffer action reads
    // only the options it was handed, so it satisfies the "call the engine" rule no
    // more than `structureWriteData` does, even though what it touches is shared
    // memory rather than one structure's bag. Putting them in `api` would have
    // satisfied this assertion and told a lie.
    //
    // ...and the off-rule count then **stays at 30**, because the two data-slot
    // actions measure `api` and so join the on-rule side. That is the whole of what
    // they are: `getDataFieldAtCell` and `setDataFieldAtCell` are engine calls, and
    // an action that reaches one satisfies the rule legitimately. The `api` count
    // moving while this one holds is the pair of numbers worth reading together —
    // it is what "the catalogue grew" looks like when the growth is on the same
    // side of the rule as everything else it grew alongside.
    assertEquals(Object.values(ACTION_CLASSES).filter((c) => c === "api").length, 59);
    assertEquals(offRuleActions().length, 30);
    const off = offRuleActions();
    assertEquals(
        off.filter((a) => a.cls === "context-bound").map((a) => a.key).sort(),
        [
            // The `processor*` quartet, and only those. Both element families have now
            // migrated off this list: the four **writes** when they moved to
            // `api.grid.mutate`, and the three **reads** when they gained the ambient
            // fallback. What is left is the set that genuinely cannot reach the engine
            // any other way, which is the honest remainder rather than a backlog.
            "isElementAtCell",
            "processorConvert",
            "processorLift",
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
