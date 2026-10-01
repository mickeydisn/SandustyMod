
import { assert, assertEquals } from "https:
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
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const counts: Record<string, number> = {};
    for (const c of Object.values(ACTION_CLASSES)) counts[c] = (counts[c] ?? 0) + 1;
    assertEquals(counts, {
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        api: 62,
        "context-bound": 3,
        
        
        
        
        
        
        
        
        
        
        
        
        "self-sufficient": 19,
        pure: 10,
    });
    assertEquals(Object.values(ACTION_CLASSES).length, ALL_KEYS.length, "total");
});

Deno.test("only `api` satisfies the rule, and the rest are the work to do", () => {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(Object.values(ACTION_CLASSES).filter((c) => c === "api").length, 62);
    
    
    
    
    
    
    
    
    
    
    
    
    
    assertEquals(offRuleActions().length, 32);
    const off = offRuleActions();
    assertEquals(
        off.filter((a) => a.cls === "context-bound").map((a) => a.key).sort(),
        [
            
            
            
            
            
            "isElementAtCell",
            "processorConvert",
            "processorLift",
        ],
    );
});

Deno.test("a class implies what the action may reach for", () => {
    
    
    
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
    
    for (const cls of Object.keys(ACTION_CLASS_LABELS)) {
        assert(ACTION_CLASS_BLURBS[cls as never], `${cls} has no blurb`);
    }
    assertEquals(
        Object.keys(ACTION_CLASS_LABELS).sort(),
        Object.keys(ACTION_CLASS_BLURBS).sort(),
    );
});

Deno.test("the probe tells the two registries' signatures apart", () => {
    
    
    
    
    const anyDeps = measureActionDeps("energyDefault");
    assert(anyDeps?.extra, "energyDefault reads its options");
    assert(!anyDeps?.ctx, "energyDefault must not look context-bound");
    const procDeps = measureActionDeps("processorConvert");
    assert(procDeps?.ctx, "processorConvert really does read ctx");
});
