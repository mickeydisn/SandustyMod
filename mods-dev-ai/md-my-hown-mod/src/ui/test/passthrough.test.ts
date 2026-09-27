// @ts-nocheck
/**
 * Pins the `advancedJson` contract.
 *
 * ## What this is
 *
 * ## The box, and why it is conditional */
import { assert, assertEquals } from "jsr:@std/assert";

// The host global has to exist before schema.ts is pulled in, so this import is
// dynamic rather than hoisted. Same stub shape as schema_roundtrip.test.ts.
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
        // the engine reads this; the form has no control for it
        someFutureEngineField: { nested: [1, 2, 3] },
    };
    const form = entryToForm("terrains", entry);
    const back = formToEntry("terrains", form) as Record<string, unknown>;
    assertEquals(back.someFutureEngineField, { nested: [1, 2, 3] });
});

Deno.test("the passthrough box is populated, not left empty", () => {
    // If this regresses to an empty string, the mechanism still "works" for
    // nothing and the round-trip is silently broken.
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
    // `id` is the primary key, not an extra field.
    assertEquals(passthroughKeys("terrains", { id: "md-my-hown-mod:t" }), []);
});

Deno.test("form fields win over the passthrough box", () => {
    // The box is merged first on purpose: a stale value inside it must never
    // override something the form actually controls.
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
    // Handlers are resolved to functions at apply time. Serialising one would
    // produce `{}` at best and a crash at worst.
    const keys = passthroughKeys("modifiers", {
        id: "md-my-hown-mod:m",
        handlerKey: "h",
        someCallback: () => 1,
    });
    assert(!keys.includes("someCallback"), "a function was carried as JSON");
});

Deno.test("an edit keeps a field it cannot show, with nothing on screen", () => {
    // The whole point of the change, stated as a test. The passthrough box is
    // gone from every form, so the only evidence that this still works is a
    // round-trip through a form that has no control for the field — which is
    // exactly the case where a regression would be invisible in the UI and
    // would only show up as an entry quietly losing a setting.
    const stored = {
        id: "md-my-hown-mod:t",
        nameKey: "mods|x|name",
        hp: 10,
        // Three shapes the engine might plausibly send, none of which the form
        // has a control for.
        aFlag: true,
        aTable: [{ k: 1 }, { k: 2 }],
        aNested: { deep: { deeper: [1, { two: 3 }] } },
    };
    const form = entryToForm("terrains", stored);
    // Confirm the premise: the form genuinely cannot show these.
    const shown = new Set(fieldsFor("terrains").map((f) => f.key));
    for (const key of ["aFlag", "aTable", "aNested"]) {
        assert(!shown.has(key), `${key} is a real field now — the premise is stale`);
    }
    // Edit something the form *does* own, as a user would.
    form.hp = "25";
    const back = formToEntry("terrains", form) as Record<string, unknown>;
    assertEquals(back.hp, 25, "the edit itself did not land");
    for (const key of ["aFlag", "aTable", "aNested"]) {
        assertEquals(back[key], stored[key], `${key} was lost by an unrelated edit`);
    }
});

Deno.test("the passthrough box shows only when there is something to carry", () => {
    // The rule the user asked for, in both directions. A box with nothing in it
    // looks like a field you are meant to fill in; a box that never appears at
    // all leaves you unable to tell "nothing hidden" from "my fields are gone".
    // So: present when it has content, absent when it does not — including its
    // "Advanced" heading, which would otherwise be stranded and empty.
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
    // The other half of the request, and the reason the box is worth having.
    const form = entryToForm("terrains", {
        id: "md-my-hown-mod:t",
        nameKey: "k",
        zeta: 1,
        alpha: 2,
    });
    assertEquals(passthroughKeysOf(form.advancedJson), ["alpha", "zeta"]);
});

Deno.test("a passthrough that is not a JSON object carries nothing", () => {
    // `""` is what a form saves for "not set", and a hand-edited file could hold
    // an array or a bare string. Neither has keys, so the box stays hidden —
    // and a parse failure must not throw, because `when` runs on every render.
    for (const raw of [undefined, "", "   ", "not json", "[]", '"a string"', "42", "null"]) {
        assertEquals(passthroughKeysOf(raw), [], `"${raw}" was read as carrying keys`);
    }
});

Deno.test("an entry with nothing hidden shows no passthrough, but is unaffected", () => {
    // The common case, and the one the old UI got wrong: it showed a box and a
    // "nothing to carry" message for every entry, which is noise that made the
    // entries that *did* carry something look ordinary.
    const form = formDefaults("structures");
    const sections = sectionsFor("structures", form);
    assert(!sections.some((s) => s.title === "Advanced"), "a new entry shows an Advanced section");
    // And it is genuinely empty, not hidden-because-broken.
    const entry = formToEntry("structures", { ...form, idSuffix: "s" }) as Record<string, unknown>;
    for (const k of Object.keys(entry)) {
        if (k === "id") continue;
        assert(k !== "advancedJson", "the passthrough was written despite carrying nothing");
    }
});

Deno.test("the raw requirement box is not a passthrough, and stays", () => {
    // The one "Advanced" field that is deliberate, pinned so a later pass does
    // not sweep it up with the others. It appears only once the user has chosen
    // a custom requirement shape, and it is the only way to express one.
    const f = fieldsFor("categories").find((x) => x.key === "requirementJson");
    assert(f, "the raw requirement field is gone — custom requirements cannot be expressed");
    assert(!/does not show/i.test(f.label), "it is mislabelled as a passthrough");
});
