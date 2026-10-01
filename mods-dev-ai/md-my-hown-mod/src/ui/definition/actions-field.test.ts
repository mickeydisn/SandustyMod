
import { assert, assertEquals } from "https:
import { actionRefsOf } from "../../handler/core/process.ts";
import {
    actionListField,
    actionRefsToForm,
    ACTIONS_COVERED,
    ACTIONS_FORM_KEY,
    ACTIONS_STORE_KEY,
    formatActionRefs,
    parseActionRefs,
} from "./actions-field.ts";

Deno.test("a process round-trips through the form, order and options intact", () => {
    const refs = [
        { key: "processorLog" },
        { key: "processorConvert", options: { to: "Water" } },
        { key: "processorCount" },
        
        { key: "processorConvert", options: { to: "Lava" } },
    ];
    const text = formatActionRefs(refs);
    assertEquals(parseActionRefs(text), refs, "order and options survive");
});

Deno.test("a pre-split `handlerKey` loads as no process", () => {
    
    
    
    const entry = { id: "p1", structureType: "machine", handlerKey: "processorConvert" };
    assertEquals(parseActionRefs(actionRefsToForm(entry)), []);
});

Deno.test("the new form wins when a config somehow has both shapes", () => {
    const entry = { handlerKey: "old", actions: [{ key: "new", options: { a: 1 } }] };
    assertEquals(
        actionRefsToForm(entry),
        '[\n  {\n    "key": "new",\n    "options": {\n      "a": 1\n    }\n  }\n]',
    );
});

Deno.test("an entry with no process at all reads as empty, not as an error", () => {
    assertEquals(actionRefsToForm(undefined), "");
    assertEquals(actionRefsToForm({}), "");
    assertEquals(actionRefsToForm({ actions: [] }), "");
    assertEquals(actionRefsToForm({ handlerKey: "" }), "");
});

Deno.test("bad JSON yields no actions and leaves the text for the field to report", () => {
    
    
    assertEquals(parseActionRefs("{not json"), []);
    assertEquals(parseActionRefs(""), []);
    assertEquals(parseActionRefs("   "), []);
    assertEquals(parseActionRefs("42"), [], "a number is not a process");
});

Deno.test("the forgiving shapes a hand-written config may use", () => {
    
    assertEquals(parseActionRefs('"processorLog"'), [{ key: "processorLog" }]);
    assertEquals(parseActionRefs('["a", "b"]'), [{ key: "a" }, { key: "b" }]);
    
    
    assertEquals(parseActionRefs('[{"key":"a"}, null, {}, {"key":""}, {"key":"b"}]'), [
        { key: "a" },
        { key: "b" },
    ]);
    
    assertEquals(parseActionRefs('[{"key":"a","options":7}]'), [{ key: "a" }]);
});

Deno.test("the field owns only the key it writes", () => {
    
    
    
    
    assertEquals([...ACTIONS_COVERED], [ACTIONS_STORE_KEY]);
    const f = actionListField("Structure process");
    assertEquals(f.key, ACTIONS_FORM_KEY);
    assertEquals(f.kind, "actionList");
    assert(f.hint?.includes("ordered list of actions"), "the hint must say what it is");
    assert(f.hint?.includes("Structure process"), "the hint must name the call site");
});

Deno.test("a pre-split key is not a process", () => {
    
    
    
    assertEquals(actionRefsOf({ handlerKey: "onHit" }), []);
    assertEquals(actionRefsOf({ onUpgradeKey: "onLevelUp" }), []);
    
    assertEquals(actionRefsOf({ actions: [{ key: "onHit", options: { a: 1 } }] }), [
        { key: "onHit", options: { a: 1 } },
    ]);
    
    assertEquals(
        actionRefsOf({ handlerKey: "onHit", actions: [{ key: "onTick" }] }),
        [{ key: "onTick", options: undefined }],
    );
});

Deno.test("a definition can add its own `when` without this knowing about it", () => {
    
    
    const when = (f: Record<string, string>) => f.itemType !== "Consumable";
    const f = actionListField("Item use", { when });
    assertEquals(f.when, when);
    assertEquals(f.when?.({ itemType: "Consumable" }), false);
    assertEquals(f.when?.({ itemType: "Tool" }), true);
});

Deno.test("an empty list writes as an empty string, not `[]`", () => {
    
    
    assertEquals(formatActionRefs([]), "");
});
