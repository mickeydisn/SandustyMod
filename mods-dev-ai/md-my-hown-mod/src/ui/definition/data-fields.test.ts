/**
 * The **data field** codecs — the element's four numbered slots, and the
 * structure's free object.
 *
 * The two are tested in one file because they are one decision made twice, and
 * the interesting assertions are the ones where they *differ*. A test per codec
 * would have let them drift toward the same shape, which is the mistake the
 * module's own note is about: they are not the same thing and cannot be.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    ELEMENT_DATA_SLOTS,
    type ElementDataField,
    elementFieldsToRecord,
    elementRecordToFields,
    elementSlotKey,
    structureFieldsToRecord,
    structureRecordToFields,
} from "./data-fields.ts";

/** A valid element row, the one most of these start from. */
const slot = (over: Partial<ElementDataField> = {}): ElementDataField => ({
    name: "temperature",
    slot: 2,
    default: 20,
    ...over,
});

// ── element: the four slots ──────────────────────────────────────────────────

Deno.test("there are four element slots, and that is the engine's number", () => {
    // Pinned rather than read from the element list: this is the limit that makes
    // a fifth row impossible, and a test that derived it from the same constant
    // would agree with a wrong constant.
    assertEquals(ELEMENT_DATA_SLOTS, 4);
    assertEquals(elementSlotKey(3), "field3");
});

Deno.test("a list of element fields becomes the engine's fieldN map", () => {
    const { record, problems } = elementFieldsToRecord([
        slot({ name: "temperature", slot: 2, default: 20 }),
        slot({ name: "frozen", slot: 1, default: 0 }),
    ]);
    assertEquals(problems, []);
    // The keys are the engine's, not the author's: `name` never leaves the panel.
    assertEquals(record, { field2: 20, field1: 0 });
});

Deno.test("a slot outside 1–4 is refused, not clamped", () => {
    // Clamping would be the wrong failure: slot 5 silently becoming slot 4 would
    // put a value in a field the author never claimed, and `readDataField` would
    // read back something they did not write.
    for (const bad of [0, 5, -1, 99]) {
        const { record, problems } = elementFieldsToRecord([slot({ slot: bad })]);
        assertEquals(record, {}, `slot ${bad} produced ${JSON.stringify(record)}`);
        assert(problems[0]?.reason.includes("1–4"), `slot ${bad}: ${problems[0]?.reason}`);
    }
});

Deno.test("two names cannot share one slot, and the second says whose it is", () => {
    // The failure this prevents is the quietest one in the whole feature: the
    // engine keeps whichever was written last, and the other row's name still sits
    // in the list looking like its own field.
    const { record, problems } = elementFieldsToRecord([
        slot({ name: "frozen", slot: 1, default: 0 }),
        slot({ name: "wet", slot: 1, default: 1 }),
    ]);
    assertEquals(record, { field1: 0 });
    assert(
        problems[0]?.reason.includes('"frozen"'),
        `no first claimant named: ${problems[0]?.reason}`,
    );
});

Deno.test("a slot's default must be a whole number", () => {
    const frac = elementFieldsToRecord([slot({ default: 0.5 })]);
    assertEquals(frac.record, {});
    assert(frac.problems[0]?.reason.includes("whole number"));
    assertEquals(elementFieldsToRecord([slot({ default: 3 })]).problems, []);
});

Deno.test("a non-numeric default is refused", () => {
    const { record, problems } = elementFieldsToRecord([
        slot({ default: "warm" as unknown as number }),
    ]);
    assertEquals(record, {});
    assert(problems[0]?.reason.includes("must be a number"));
});

Deno.test("the element list reads back from the record, unnamed", () => {
    // The reverse mapping is lossy in one direction only, and saying so is the
    // point: the engine stored a number and no label, so the label comes back
    // empty rather than being invented.
    assertEquals(elementRecordToFields({ field2: 20, field1: 0 }), [
        { name: "", slot: 1, default: 0 },
        { name: "", slot: 2, default: 20 },
    ]);
});

Deno.test("a record with a key that is not a slot contributes no row", () => {
    // `field5` is not a slot and `other` is not one either. Dropping them is
    // better than showing a row the engine cannot address.
    assertEquals(elementRecordToFields({ field1: 1, field5: 5, other: 9 }), [
        { name: "", slot: 1, default: 1 },
    ]);
    assertEquals(elementRecordToFields(null), []);
    assertEquals(elementRecordToFields("nope"), []);
});

Deno.test("an element list round trips through the engine's shape", () => {
    const rows = [slot({ name: "frozen", slot: 1, default: 0 })];
    const { record } = elementFieldsToRecord(rows);
    const back = elementRecordToFields(record);
    assertEquals(back, [{ name: "", slot: 1, default: 0 }]);
    // And back into a record: the same key, the same number. The name is the only
    // thing lost, and it was never stored.
    assertEquals(elementFieldsToRecord(back).record, record);
});

// ── structure: the free object ───────────────────────────────────────────────

Deno.test("a structure list becomes the engine's object, typed", () => {
    const { record, problems } = structureFieldsToRecord([
        { key: "charge", type: "number", default: 0 },
        { key: "on", type: "bool", default: false },
        { key: "label", type: "string", default: "idle" },
    ]);
    assertEquals(problems, []);
    assertEquals(record, { charge: 0, on: false, label: "idle" });
});

Deno.test("a structure seed is coerced to its declared type", () => {
    // The list is stored as JSON, so `"false"` and `false` are the same text. Left
    // alone the engine would store whichever arrived and an `if` on it would
    // behave differently from what the row said.
    const { record } = structureFieldsToRecord([
        { key: "on", type: "bool", default: "false" as never },
        { key: "off", type: "bool", default: "true" as never },
        { key: "n", type: "number", default: "5" as never },
    ]);
    assertEquals(record, { on: false, off: true, n: 5 });
});

Deno.test("a structure row needs a key, because the key is the address", () => {
    // Unlike the element's name, this one *is* stored: `structureData` is called
    // with it. A nameless field cannot be read by anything.
    const { record, problems } = structureFieldsToRecord([
        { key: "  ", type: "number", default: 1 },
    ]);
    assertEquals(record, {});
    assert(problems[0]?.reason.includes("key is required"));
});

Deno.test("two structure rows cannot share a key", () => {
    const { record, problems } = structureFieldsToRecord([
        { key: "charge", type: "number", default: 1 },
        { key: "charge", type: "string", default: "full" },
    ]);
    assertEquals(record, { charge: 1 });
    assert(problems[0]?.reason.includes("declared twice"));
});

Deno.test("a structure key may be any legal name — the engine stores it verbatim", () => {
    // No id pattern here, and that is the difference from every other reference in
    // the panel. `defaultData` is an object the engine deep-clones; inventing a
    // narrower rule would reject keys the engine accepts without complaint.
    const { record, problems } = structureFieldsToRecord([
        { key: "some name with spaces", type: "string", default: "" },
        { key: "CamelCase", type: "number", default: 0 },
    ]);
    assertEquals(problems, []);
    assertEquals(Object.keys(record), ["some name with spaces", "CamelCase"]);
});

Deno.test("a structure list reads back with the type inferred from the value", () => {
    assertEquals(structureRecordToFields({ charge: 5, on: false, label: "x" }), [
        { key: "charge", type: "number", default: 5 },
        { key: "on", type: "bool", default: false },
        { key: "label", type: "string", default: "x" },
    ]);
});

Deno.test("a structure value the list cannot hold stays out of it", () => {
    // `defaultData` legitimately holds shapes a row cannot — a nested object, an
    // array. Typing an object by its runtime value would make it a `string` row
    // whose text is `"[object Object]"`, which would be a lie in the list. The box
    // above is where those stay visible, which is the honest split.
    assertEquals(structureRecordToFields({ nested: { a: 1 } }), []);
    assertEquals(structureRecordToFields([1, 2]), []);
    assertEquals(structureRecordToFields(null), []);
});

Deno.test("a structure list round trips", () => {
    const rows = [
        { key: "charge", type: "number" as const, default: 7 },
        { key: "on", type: "bool" as const, default: true },
    ];
    const { record } = structureFieldsToRecord(rows);
    assertEquals(structureFieldsToRecord(structureRecordToFields(record)).record, record);
});

Deno.test("an unnamed row is a working field", () => {
    // The name is the author's label and never reaches the engine, so requiring one
    // would push people to invent a word purely to get past a gate. The slot is
    // what the process addresses and it is present.
    const { record, problems } = elementFieldsToRecord([slot({ name: "", slot: 3 })]);
    assertEquals(problems, []);
    assertEquals(record, { field3: 20 });
});
