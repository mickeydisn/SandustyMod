/**
 * End-to-end check that the definitions actually drive the panel.
 *
 * The unit tests assert the codecs; this asserts the *wiring* — that `schema.ts`
 * and `panel.ts` read each definition rather than keeping their own copy of it.
 * A refactor that moved the code but left a stale duplicate behind would pass
 * every existing test and still show the old behaviour, so these checks are
 * deliberately about identity and delegation, not about output.
 *
 * Run with: deno run -A tools/verify-definition.ts
 */
const ROOT = new URL("../src/", import.meta.url).pathname;

// The catalog reads the host `sandkit` global at import time, so it has to exist
// before any import that reaches it resolves — same stub shape the ui tests use.
const store: Record<string, unknown> = {};
(globalThis as Record<string, unknown>).sandkit = {
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
        elements: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
        structures: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { structureDefinition } = await import(`${ROOT}ui/definition/structure.ts`);
const { elementDefinition } = await import(`${ROOT}ui/definition/element.ts`);
const { DEFINITIONS, definitionFor } = await import(`${ROOT}ui/definition/index.ts`);
const S = await import(`${ROOT}ui/schema.ts`);

const failures: string[] = [];
const ok = (cond: boolean, what: string) => {
    if (!cond) failures.push(what);
};

// 1. the registry is what `schema.ts` asks
ok(definitionFor("structures") === structureDefinition, "registry does not serve structures");
ok(definitionFor("elements") === elementDefinition, "registry does not serve elements");
ok(
    Object.keys(DEFINITIONS).length === 2,
    `registry has ${Object.keys(DEFINITIONS).length} entries, expected 2`,
);

// 2. the schema comes from the definition, by identity — a stale copy in
//    `schema.ts` would be equal in content but not the same array
const fields = S.fieldsFor("structures");
ok(
    fields === structureDefinition.fields,
    "fieldsFor did not return the structure definition's own list",
);
ok(fields.some((f: { key: string }) => f.key === "shapeJson"), "no shapeJson field");
ok(fields.some((f: { key: string }) => f.key === "unlockNode"), "no unlockNode field");

const elFields = S.fieldsFor("elements");
ok(
    elFields === elementDefinition.fields,
    "fieldsFor did not return the element definition's own list",
);
ok(elFields.some((f: { key: string }) => f.key === "colorsJson"), "no colorsJson field");
ok(elFields.some((f: { key: string }) => f.key === "metaColor"), "no metaColor field");

// 3. a new structure is seeded, and starts as a solid block
const form = S.newEntryForm("structures");
ok(
    form.unlockNode === "md-my-hown-mod:unlock.default",
    `a new structure starts on unlockNode=${form.unlockNode}`,
);
const shape = JSON.parse(form.shapeJson) as number[][];
ok(
    shape.length === 4 && shape[0].length === 4 && shape[0][0] === 1,
    "the shape default is not a solid 4×4",
);

// 4. the definition claims its own kinds and nothing else.
//
// `h` must return something truthy: a definition's widget *is* its `h(...)` call,
// so a stub that returns `null` would make every owned kind look unowned.
const node = (tag: string) => ({ tag });
const ctx = (kind: string) =>
    ({
        h: node,
        form,
        cfg: {},
        setField: () => {},
        field: { kind },
        value: "",
        locked: false,
    }) as never;
const renderField = structureDefinition.panel!.renderField!;
ok(renderField(ctx("shape")) !== null, "the definition did not render `shape`");
ok(renderField(ctx("buildModes")) !== null, "the definition did not render `buildModes`");
ok(renderField(ctx("text")) === null, "the definition claimed a generic kind");

// 5. cross-field validation comes from the definition
const spanOnPoint = { ...form, buildModesJson: JSON.stringify([{ type: "single", spanTiles: 3 }]) };
ok(
    !!S.validateForm("structures", spanOnPoint).buildModesJson,
    "spanTiles on a non-line mode was not rejected",
);
const spanOnLine = { ...form, buildModesJson: JSON.stringify([{ type: "line", spanTiles: 3 }]) };
ok(
    !S.validateForm("structures", spanOnLine).buildModesJson,
    "a legal line mode was rejected",
);

// 6. the 4×4 rule is the definition's, not the generic one
ok(
    !!S.validateForm("structures", { ...form, shapeJson: "[[1,1],[0]]" }).shapeJson,
    "a bad shape passed",
);
ok(!S.validateForm("structures", form).shapeJson, "the default shape failed its own rule");

// 7. a full round trip preserves what the engine reads
const stored = {
    id: "md-my-hown-mod:silo",
    name: "Silo",
    order: 3,
    shape: [
        [1, 1, 1, 1],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [1, 1, 1, 1],
    ],
    buildModes: [{ type: "line", spanTiles: 4, directions: ["horizontal"] }],
    unlockNode: "md-my-hown-mod:unlock.default",
    render: { imageName: "sprites:silo" },
    blockGridType: "md-my-hown-mod:silo",
    defaultData: { count: 0 },
    variants: [{ id: "a", angles: [0, 90] }],
    skipCopyData: true,
    linkedClearance: "allOrNothing",
};
const back = S.formToEntry("structures", S.entryToForm("structures", stored)) as Record<
    string,
    unknown
>;
ok(back.id === stored.id, `id round-tripped as ${back.id}`);
ok(back.blockGridType === stored.blockGridType, `blockGridType → ${back.blockGridType}`);
ok(
    JSON.stringify(back.shape) === JSON.stringify(stored.shape),
    `shape → ${JSON.stringify(back.shape)}`,
);
// The mode *list* and each mode's own fields round-trip. `directions` does not,
// and is not expected to: the form has one set of direction checkboxes that
// drives every mode, so a stored `["horizontal"]` is rewritten to whatever the
// boxes say. That is the documented behaviour of the editor, unchanged by this
// refactor — asserted here so a future change to it is a deliberate one.
const modes = back.buildModes as { type: string; spanTiles?: number }[];
ok(
    JSON.stringify(modes?.map((m) => ({ type: m.type, spanTiles: m.spanTiles }))) ===
        JSON.stringify(stored.buildModes.map((m) => ({ type: m.type, spanTiles: m.spanTiles }))),
    `buildModes → ${JSON.stringify(back.buildModes)}`,
);
ok(
    (back.render as { imageName: string }).imageName === "sprites:silo",
    `render → ${JSON.stringify(back.render)}`,
);
ok(
    JSON.stringify(back.defaultData) === JSON.stringify(stored.defaultData),
    `defaultData → ${JSON.stringify(back.defaultData)}`,
);
ok(
    JSON.stringify(back.variants) === JSON.stringify(stored.variants),
    `variants → ${JSON.stringify(back.variants)}`,
);
ok(back.skipCopyData === true, `skipCopyData → ${back.skipCopyData}`);

// 8. every build mode survives — the bug the repeating list was written for
const multi = { id: "x", buildModes: [{ type: "line", spanTiles: 2 }, { type: "single" }] };
const multiBack = S.formToEntry(
    "structures",
    S.entryToForm("structures", multi),
) as Record<string, unknown>;
ok(
    (multiBack.buildModes as unknown[]).length === 2,
    "a second build mode was dropped on save",
);

// 9. a key the form has no control for still round-trips
const withExtra = S.formToEntry(
    "structures",
    S.entryToForm("structures", { ...stored, someEngineKey: 42 }),
) as Record<string, unknown>;
ok(withExtra.someEngineKey === 42, "an unmodelled engine key was dropped on save");

// 10. clearing a field removes the key rather than persisting a blank
const cleared = S.formToEntry("structures", {
    ...S.entryToForm("structures", stored),
    blockGridType: "",
}) as Record<string, unknown>;
ok(
    !("blockGridType" in cleared),
    `a cleared field persisted as ${JSON.stringify(cleared.blockGridType)}`,
);

// 11. the element round trip: the two shapes the form flattens and re-nests
const elForm = S.newEntryForm("elements");
const elStored = {
    id: "md-my-hown-mod:goo",
    name: "Goo",
    matterType: "liquid",
    density: 400,
    durationRandom: { min: 2, max: 8 },
    metaColor: 0xff8800,
    colors: { variants: [[255, 0, 0, 255], [0, 128, 255, 200]] },
    flammable: true,
    isGrabbable: false,
    collectable: true,
};
const elBack = S.formToEntry("elements", S.entryToForm("elements", elStored)) as Record<
    string,
    unknown
>;
ok(elBack.id === elStored.id, `element id → ${elBack.id}`);
ok(elBack.matterType === "liquid", `element matterType → ${elBack.matterType}`);
// the packed colour is the part that cannot be compared as a string
ok(elBack.metaColor === 0xff8800, `element metaColor → ${elBack.metaColor}`);
// the form holds a flat `[[r,g,b,a]]`; the engine wants it wrapped
ok(
    JSON.stringify(elBack.colors) === JSON.stringify(elStored.colors),
    `element colors → ${JSON.stringify(elBack.colors)}`,
);
ok(
    JSON.stringify(elBack.durationRandom) === JSON.stringify(elStored.durationRandom),
    `element durationRandom → ${JSON.stringify(elBack.durationRandom)}`,
);
ok(elBack.flammable === true, `element flammable → ${elBack.flammable}`);

// 12. the element's cross-field rule — the one `validateForm` used to special-case
ok(
    !!S.validateForm("elements", {
        ...elForm,
        duration: "10",
        durationRandomMin: "8",
        durationRandomMax: "2",
    }).durationRandomMax,
    "a lifetime max below the min was not rejected",
);
ok(
    !S.validateForm("elements", {
        ...elForm,
        duration: "10",
        durationRandomMin: "2",
        durationRandomMax: "8",
    }).durationRandomMax,
    "a legal lifetime range was rejected",
);

// 13. a bare `colors` array — what a hand-written config may hold — is read and
//     re-wrapped rather than dropped
const bareColors = S.formToEntry("elements", {
    ...S.entryToForm("elements", { colors: [[1, 2, 3, 4]] }),
}) as Record<string, unknown>;
ok(
    JSON.stringify(bareColors.colors) === JSON.stringify({ variants: [[1, 2, 3, 4]] }),
    `a bare colors array → ${JSON.stringify(bareColors.colors)}`,
);

// 14. an unmodelled element key still round-trips
const elExtra = S.formToEntry("elements", {
    ...S.entryToForm("elements", { ...elStored, someEngineKey: 7 }),
}) as Record<string, unknown>;
ok(elExtra.someEngineKey === 7, "an unmodelled element key was dropped on save");

if (failures.length === 0) {
    console.log("definition check: all 14 passed");
} else {
    console.error(`definition check: ${failures.length} FAILED`);
    for (const f of failures) console.error(` - ${f}`);
    Deno.exit(1);
}
