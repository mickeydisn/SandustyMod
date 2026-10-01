

import { assert, assertEquals } from "jsr:@std/assert";



globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        elements: { list: () => [] },
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const {
    entryToForm,
    formToEntry,
    formDefaults,
    passthroughKeys,
    passthroughKeysOf,
    fieldsFor,
    sectionsFor,
} = await import("../schema.ts");

Deno.test("an unknown field survives an edit untouched", () => {
    const entry = {
        id: "md-my-hown-mod:test",
        nameKey: "mods|test|name",
        hp: 10,
        
        someFutureEngineField: { nested: [1, 2, 3] },
    };
    const form = entryToForm("terrains", entry);
    const back = formToEntry("terrains", form) as Record<string, unknown>;
    assertEquals(back.someFutureEngineField, { nested: [1, 2, 3] });
});

Deno.test("the passthrough box is populated, not left empty", () => {
    
    
    const form = entryToForm("terrains", {
        id: "md-my-hown-mod:t",
        nameKey: "k",
        somethingElse: 7,
    });
    assert(form.advancedJson, "advancedJson was not populated");
    assertEquals(JSON.parse(form.advancedJson), { somethingElse: 7 });
});

Deno.test("passthroughKeys names exactly what is carried", () => {
    const keys = passthroughKeys("terrains", {
        id: "md-my-hown-mod:t",
        nameKey: "k",
        zeta: 1,
        alpha: 2,
    });
    assertEquals(keys, ["alpha", "zeta"]);
});

Deno.test("id is never treated as a passthrough field", () => {
    
    assertEquals(passthroughKeys("terrains", { id: "md-my-hown-mod:t" }), []);
});

Deno.test("form fields win over the passthrough box", () => {
    
    
    const form = {
        idSuffix: "t",
        name: "Real name",
        advancedJson: JSON.stringify({ name: "Stale name", extra: 1 }),
    };
    const entry = formToEntry("terrains", form) as Record<string, unknown>;
    assertEquals(entry.name, "Real name");
    assertEquals(entry.extra, 1);
});

Deno.test("function values are never round-tripped into JSON", () => {
    
    
    const keys = passthroughKeys("modifiers", {
        id: "md-my-hown-mod:m",
        handlerKey: "h",
        someCallback: () => 1,
    });
    assert(!keys.includes("someCallback"), "a function was carried as JSON");
});

Deno.test("an edit keeps a field it cannot show, with nothing on screen", () => {
    
    
    
    
    
    const stored = {
        id: "md-my-hown-mod:t",
        nameKey: "mods|x|name",
        hp: 10,
        
        
        aFlag: true,
        aTable: [{ k: 1 }, { k: 2 }],
        aNested: { deep: { deeper: [1, { two: 3 }] } },
    };
    const form = entryToForm("terrains", stored);
    
    const shown = new Set(fieldsFor("terrains").map((f) => f.key));
    for (const key of ["aFlag", "aTable", "aNested"]) {
        assert(!shown.has(key), `${key} is a real field now — the premise is stale`);
    }
    
    form.hp = "25";
    const back = formToEntry("terrains", form) as Record<string, unknown>;
    assertEquals(back.hp, 25, "the edit itself did not land");
    for (const key of ["aFlag", "aTable", "aNested"]) {
        assertEquals(back[key], stored[key], `${key} was lost by an unrelated edit`);
    }
});

Deno.test("the passthrough box shows only when there is something to carry", () => {
    
    
    
    
    
    const empty = sectionsFor("terrains", { idSuffix: "t" });
    assert(
        !empty.some((s) => s.title === "Advanced"),
        `an empty Advanced section is showing: ${empty.map((s) => s.title).join(", ")}`,
    );

    const form = entryToForm("terrains", {
        id: "md-my-hown-mod:t",
        nameKey: "k",
        someFutureEngineField: 7,
    });
    const full = sectionsFor("terrains", form);
    const advanced = full.find((s) => s.title === "Advanced");
    assert(advanced, "the Advanced section is missing although a field is carried");
    assertEquals(
        advanced.fields.map((f) => f.key),
        ["advancedJson"],
        "the Advanced section shows something other than the passthrough",
    );
});

Deno.test("the passthrough lists the keys it is carrying", () => {
    
    const form = entryToForm("terrains", {
        id: "md-my-hown-mod:t",
        nameKey: "k",
        zeta: 1,
        alpha: 2,
    });
    assertEquals(passthroughKeysOf(form.advancedJson), ["alpha", "zeta"]);
});

Deno.test("a passthrough that is not a JSON object carries nothing", () => {
    
    
    
    for (const raw of [undefined, "", "   ", "not json", "[]", '"a string"', "42", "null"]) {
        assertEquals(passthroughKeysOf(raw), [], `"${raw}" was read as carrying keys`);
    }
});

Deno.test("an entry with nothing hidden shows no passthrough, but is unaffected", () => {
    
    
    
    const form = formDefaults("structures");
    const sections = sectionsFor("structures", form);
    assert(!sections.some((s) => s.title === "Advanced"), "a new entry shows an Advanced section");
    
    const entry = formToEntry("structures", { ...form, idSuffix: "s" }) as Record<string, unknown>;
    for (const k of Object.keys(entry)) {
        if (k === "id") continue;
        assert(k !== "advancedJson", "the passthrough was written despite carrying nothing");
    }
});

Deno.test("the raw requirement box is not a passthrough, and stays", () => {
    
    
    
    const f = fieldsFor("categories").find((x) => x.key === "requirementJson");
    assert(f, "the raw requirement field is gone — custom requirements cannot be expressed");
    assert(!/does not show/i.test(f.label), "it is mislabelled as a passthrough");
});
