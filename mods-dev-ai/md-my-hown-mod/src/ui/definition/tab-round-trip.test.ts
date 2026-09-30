/**
 * Every config-owning tab must round-trip through the panel.
 *
 * Found in the game, not by reading the code: a config imported from JSON
 * rendered a Processes screen with an empty Scope select and an empty Program
 * grid, for a process that was perfectly valid on disk.
 *
 * The cause was structural. `entryToForm` and `formToEntry` each dispatch with a
 * `switch (cat)`, and `customProcess` and `buffers` had **no case** — they fell
 * through to `default: break`. The fields still rendered, because those come from
 * `definitionFor(cat).fields`, so the controls were there and simply empty. It
 * looked like an empty config rather than a missing branch.
 *
 * So the test is the one that would have caught it: a tab that owns a config
 * list, driven through entry → form → entry, and checked for loss. Enumerating
 * the catalogue means a *newly added* tab fails this too, rather than waiting to
 * be noticed by eye.
 *
 *   deno test -A src/ui/definition/tab-round-trip.test.ts
 */
// @ts-nocheck — the host stub below is deliberately partial: `api` and `enums`
// are large interfaces and this test only needs storage plus empty read lists.
import { assertEquals } from "jsr:@std/assert";

/**
 * `schema.ts` reaches `api.ts`, which reads the host `sandkit` at import time.
 * This is the same minimal host the other definition tests stand on.
 */
const store: Record<string, unknown> = {};
globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (_m: string, k: string) => store[k],
            set: (_m: string, k: string, v: unknown) => {
                store[k] = v;
            },
            remove: (_m: string, k: string) => {
                delete store[k];
            },
        },
        ui: { toast: () => {} },
        elements: { list: () => [], register: () => {} },
        structures: { list: () => [], recipes: {}, signals: {}, processing: {} },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { CATEGORY_META, entryToForm, formToEntry } = await import("../schema.ts");
const { DEFINITIONS } = await import("./index.ts");
type Tab = import("./types.ts").Tab;

/** Tabs that own a config list — a view has nothing to read or write. */
const OWNED = (Object.keys(CATEGORY_META) as Tab[]).filter(
    (cat) => CATEGORY_META[cat]?.configKey !== undefined,
);

/** A process with every field the definition claims, in the shape JSON holds. */
const PROCESS = {
    id: "demo:tick",
    name: "Demo tick",
    scope: "processing",
    doc: "one line",
    steps: [{ key: "bufferRead", options: { path: "progress" }, as: "result" }],
};

/** A buffer slot, with `default` as a JSON **number** — what an author writes. */
const BUFFER = {
    id: "demo-progress",
    path: "progress",
    type: "number",
    default: 0,
    min: 0,
    max: 50,
};

const CASES: Record<string, Record<string, unknown>> = {
    customProcess: PROCESS,
    buffers: BUFFER,
};

Deno.test("the catalogue and the definition registry agree", () => {
    // A tab that owns config but has no definition would render no fields at all.
    const missing = OWNED.filter((cat) => !DEFINITIONS[cat]);
    assertEquals(missing, [], "these tabs own config but have no definition");
});

Deno.test("every config-owning tab round-trips its entry", () => {
    for (const cat of OWNED) {
        const sample = CASES[cat];
        if (!sample) continue; // covered by the per-tab cases below
        const form = entryToForm(cat, sample);
        const back = formToEntry(cat, form);
        for (const [k, v] of Object.entries(sample)) {
            if (k === "id") continue; // stored namespaced, compared by suffix
            assertEquals(
                back[k],
                v,
                `${cat}: "${k}" did not survive entry → form → entry`,
            );
        }
    }
});

Deno.test("a process keeps its scope and its program", () => {
    const form = entryToForm("customProcess", PROCESS);
    assertEquals(form.scope, "processing", "the Scope select came up empty");
    assertEquals(form.name, "Demo tick");
    assertEquals(
        (form.program__json ?? "").length > 0,
        true,
        "the Program grid came up empty",
    );

    const back = formToEntry("customProcess", form);
    assertEquals(back.scope, "processing", "Save would have dropped the scope");
    assertEquals(back.steps, PROCESS.steps, "Save would have dropped the program");
});

Deno.test("a buffer slot shows a numeric default instead of an empty box", () => {
    // `"default": 0` is a JSON number. Read as a string it becomes `undefined`,
    // and since the field is `required` that surfaces as a validation error on a
    // slot that plainly has a default.
    const form = entryToForm("buffers", BUFFER);
    assertEquals(form.default, "0", "the Default box was empty for default: 0");
    assertEquals(form.min, "0");
    assertEquals(form.max, "50");
});

Deno.test("a buffer slot keeps its default a number across the round trip", () => {
    const back = formToEntry("buffers", entryToForm("buffers", BUFFER));
    assertEquals(back.default, 0, "a number slot came back as a string");
    assertEquals(typeof back.min, "number");
    assertEquals(back.max, 50);
});

Deno.test("a bool slot keeps its default as text", () => {
    const flag = { id: "demo-flag", path: "on", type: "bool", default: "false" };
    const form = entryToForm("buffers", flag);
    assertEquals(form.default, "false");
    const back = formToEntry("buffers", form);
    assertEquals(back.default, "false");
    assertEquals(back.min, undefined, "a bool slot must not keep number bounds");
});
