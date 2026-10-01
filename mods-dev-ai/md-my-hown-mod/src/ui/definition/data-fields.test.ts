
import { assert, assertEquals } from "https:
import {
    ELEMENT_DATA_SLOTS,
    type ElementDataField,
    elementFieldsToRecord,
    elementRecordToFields,
    elementSlotKey,
    structureFieldsToRecord,
    structureRecordToFields,
} from "./data-fields.ts";


const slot = (over: Partial<ElementDataField> = {}): ElementDataField => ({
    name: "temperature",
    slot: 2,
    default: 20,
    ...over,
});



Deno.test("there are four element slots, and that is the engine's number", () => {
    
    
    
    assertEquals(ELEMENT_DATA_SLOTS, 4);
    assertEquals(elementSlotKey(3), "field3");
});

Deno.test("a list of element fields becomes the engine's fieldN map", () => {
    const { record, problems } = elementFieldsToRecord([
        slot({ name: "temperature", slot: 2, default: 20 }),
        slot({ name: "frozen", slot: 1, default: 0 }),
    ]);
    assertEquals(problems, []);
    
    assertEquals(record, { field2: 20, field1: 0 });
});

Deno.test("a slot outside 1–4 is refused, not clamped", () => {
    
    
    
    for (const bad of [0, 5, -1, 99]) {
        const { record, problems } = elementFieldsToRecord([slot({ slot: bad })]);
        assertEquals(record, {}, `slot ${bad} produced ${JSON.stringify(record)}`);
        assert(problems[0]?.reason.includes("1–4"), `slot ${bad}: ${problems[0]?.reason}`);
    }
});

Deno.test("two names cannot share one slot, and the second says whose it is", () => {
    
    
    
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
    
    
    
    assertEquals(elementRecordToFields({ field2: 20, field1: 0 }), [
        { name: "", slot: 1, default: 0 },
        { name: "", slot: 2, default: 20 },
    ]);
});

Deno.test("a record with a key that is not a slot contributes no row", () => {
    
    
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
    
    
    assertEquals(elementFieldsToRecord(back).record, record);
});



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
    
    
    
    const { record } = structureFieldsToRecord([
        { key: "on", type: "bool", default: "false" as never },
        { key: "off", type: "bool", default: "true" as never },
        { key: "n", type: "number", default: "5" as never },
    ]);
    assertEquals(record, { on: false, off: true, n: 5 });
});

Deno.test("a structure row needs a key, because the key is the address", () => {
    
    
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
    
    
    
    const { record, problems } = elementFieldsToRecord([slot({ name: "", slot: 3 })]);
    assertEquals(problems, []);
    assertEquals(record, { field3: 20 });
});
