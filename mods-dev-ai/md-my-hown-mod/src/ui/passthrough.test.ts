// @ts-nocheck
/**
 * Pins the `advancedJson` contract.
 *
 * The user asked whether the passthrough box could just be removed. It cannot:
 * it is the only thing standing between an edit and silent data loss. This test
 * exists so that answer stays true, and so the mechanism is explicit about what
 * it is for.
 *
 * The mechanism: `FORM_COVERED` lists the keys each form owns. Everything else on
 * a stored entry is carried through an edit verbatim, so a field the engine
 * understands but this panel has no control for survives a round-trip.
 */
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

const { entryToForm, formToEntry, passthroughKeys } = await import("./schema.ts");

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
