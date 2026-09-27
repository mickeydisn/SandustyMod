/**
 * The `actions` field: a process as a form field.
 *
 * The two things worth pinning are the **migration** (a `handlerKey` already on
 * disk must keep working) and the **round trip** (a process must survive an edit
 * byte for byte, order and options included).
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ACTIONS_LEGACY_KEYS } from "../../hooks/process.ts";
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

Deno.test("a pre-split `handlerKey` loads as a one-action process", () => {
    // The migration, read side. A config already on disk has no `actions`.
    const entry = { id: "p1", structureType: "machine", handlerKey: "processorConvert" };
    assertEquals(parseActionRefs(actionRefsToForm(entry)), [{ key: "processorConvert" }]);
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

Deno.test("the field owns both the new key and the legacy one it replaces", () => {
    // `formCovered` is what stops the passthrough re-adding `handlerKey` on save.
    // Missing `handlerKey` from this list is how a migrated process would end up
    // holding both shapes at once.
    assertEquals(
        [...ACTIONS_COVERED].sort(),
        [ACTIONS_STORE_KEY, ...ACTIONS_LEGACY_KEYS].sort(),
    );
    const f = actionListField("Structure process");
    assertEquals(f.key, ACTIONS_FORM_KEY);
    assertEquals(f.kind, "actionList");
    assert(f.hint?.includes("ordered list of actions"), "the hint must say what it is");
    assert(f.hint?.includes("Structure process"), "the hint must name the call site");
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
