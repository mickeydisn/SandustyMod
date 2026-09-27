/**
 * The `actions` field: a process as a form field.
 *
 * The thing worth pinning is the **round trip**: a process must survive an edit
 * byte for byte, order and options included. There is no longer a second stored
 * shape to migrate from — a pre-split `handlerKey` is read as no process, and
 * `a pre-split key is not a process` below says so.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { actionRefsOf } from "../../hooks/process.ts";
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
        // Deliberately the same action again: a list may repeat one.
        { key: "processorConvert", options: { to: "Lava" } },
    ];
    const text = formatActionRefs(refs);
    assertEquals(parseActionRefs(text), refs, "order and options survive");
});

Deno.test("a pre-split `handlerKey` loads as no process", () => {
    // A config written before the split has no `actions`. It reads as an empty
    // process: the engine never saw that key, so an author shown a one-action
    // list would see a handler that does not run.
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
    // The rule from `parseBuildModes`: an unparseable value must not be
    // "helpfully" coerced, or the author's text is silently replaced.
    assertEquals(parseActionRefs("{not json"), []);
    assertEquals(parseActionRefs(""), []);
    assertEquals(parseActionRefs("   "), []);
    assertEquals(parseActionRefs("42"), [], "a number is not a process");
});

Deno.test("the forgiving shapes a hand-written config may use", () => {
    // A bare string is a one-action process; so is a bare string in the list.
    assertEquals(parseActionRefs('"processorLog"'), [{ key: "processorLog" }]);
    assertEquals(parseActionRefs('["a", "b"]'), [{ key: "a" }, { key: "b" }]);
    // Junk entries are dropped, the good ones kept — one typo should not cost the
    // author the rest of the process.
    assertEquals(parseActionRefs('[{"key":"a"}, null, {}, {"key":""}, {"key":"b"}]'), [
        { key: "a" },
        { key: "b" },
    ]);
    // A non-object `options` is dropped rather than stored as a lie.
    assertEquals(parseActionRefs('[{"key":"a","options":7}]'), [{ key: "a" }]);
});

Deno.test("the field owns only the key it writes", () => {
    // `formCovered` is what keeps the passthrough from re-adding a key the form
    // has already written. The pre-split `handlerKey` / `onUpgradeKey` are
    // deliberately *not* claimed: nothing reads them any more, so stripping
    // them would delete an author's key over an edit that never looked at it.
    assertEquals([...ACTIONS_COVERED], [ACTIONS_STORE_KEY]);
    const f = actionListField("Structure process");
    assertEquals(f.key, ACTIONS_FORM_KEY);
    assertEquals(f.kind, "actionList");
    assert(f.hint?.includes("ordered list of actions"), "the hint must say what it is");
    assert(f.hint?.includes("Structure process"), "the hint must name the call site");
});

Deno.test("a pre-split key is not a process", () => {
    // The engine never read `handlerKey`, so honouring it would show a process
    // in the panel that does not run. An empty list is the honest answer, and the
    // raw key is left for the passthrough to carry rather than deleted.
    assertEquals(actionRefsOf({ handlerKey: "onHit" }), []);
    assertEquals(actionRefsOf({ onUpgradeKey: "onLevelUp" }), []);
    // And the split shape is still read.
    assertEquals(actionRefsOf({ actions: [{ key: "onHit", options: { a: 1 } }] }), [
        { key: "onHit", options: { a: 1 } },
    ]);
    // An `actions` array wins over a stale sibling rather than being ignored.
    assertEquals(
        actionRefsOf({ handlerKey: "onHit", actions: [{ key: "onTick" }] }),
        [{ key: "onTick", options: undefined }],
    );
});

Deno.test("a definition can add its own `when` without this knowing about it", () => {
    // The item tab's is the Consumable rule, which is the one cross-field rule in
    // the seven and belongs to the item, not to the shared field.
    const when = (f: Record<string, string>) => f.itemType !== "Consumable";
    const f = actionListField("Item use", { when });
    assertEquals(f.when, when);
    assertEquals(f.when?.({ itemType: "Consumable" }), false);
    assertEquals(f.when?.({ itemType: "Tool" }), true);
});

Deno.test("an empty list writes as an empty string, not `[]`", () => {
    // So a cleared process reads as "not set" the same way every other empty
    // control does, instead of persisting an empty array the engine would see.
    assertEquals(formatActionRefs([]), "");
});
