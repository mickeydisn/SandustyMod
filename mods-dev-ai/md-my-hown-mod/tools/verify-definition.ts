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
const { itemDefinition } = await import(`${ROOT}ui/definition/item.ts`);
const { terrainDefinition } = await import(`${ROOT}ui/definition/terrain.ts`);
const { DEFINITIONS, definitionFor } = await import(`${ROOT}ui/definition/index.ts`);
const S = await import(`${ROOT}ui/schema.ts`);

const failures: string[] = [];
const ok = (cond: boolean, what: string) => {
    if (!cond) failures.push(what);
};

// 1. the registry is what `schema.ts` asks
ok(definitionFor("structures") === structureDefinition, "registry does not serve structures");
ok(definitionFor("elements") === elementDefinition, "registry does not serve elements");
ok(definitionFor("items") === itemDefinition, "registry does not serve items");
ok(definitionFor("terrains") === terrainDefinition, "registry does not serve terrains");
ok(
    Object.keys(DEFINITIONS).length === 4,
    `registry has ${Object.keys(DEFINITIONS).length} entries, expected 4`,
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

const itFields = S.fieldsFor("items");
ok(
    itFields === itemDefinition.fields,
    "fieldsFor did not return the item definition's own list",
);
ok(itFields.some((f: { key: string }) => f.key === "itemType"), "no itemType field");
ok(itFields.some((f: { key: string }) => f.key === "spriteId"), "no spriteId field");

const trFields = S.fieldsFor("terrains");
ok(
    trFields === terrainDefinition.fields,
    "fieldsFor did not return the terrain definition's own list",
);
ok(trFields.some((f: { key: string }) => f.key === "colorHSLOn"), "no colorHSLOn toggle");
ok(trFields.some((f: { key: string }) => f.key === "materialId"), "no materialId field");

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

// 11b. a stored metaColor wider than 24 bits still reads back as a 6-digit hex.
//
// The engine packs a colour into the low 24 bits, but a hand-edited config can
// hold a full 32-bit value (0xff0000ff) or a signed one. Read unmasked, that
// renders as a 7-digit hex, which the `color` field rule rejects — so merely
// opening and saving the entry would be impossible. This is the one place where
// "the value looks wrong to a human" and "the editor bricks the entry" are the
// same bug, so it is asserted rather than left to the mask looking correct.
for (const storedColor of [0x1000000, 0xff0000ff, 0x11223344, -1]) {
    const read = S.entryToForm("elements", { metaColor: storedColor }).metaColor;
    ok(
        /^#[0-9a-f]{6}$/.test(read),
        `metaColor ${storedColor} read back as ${JSON.stringify(read)}, which the ` +
            "colour rule would reject — the entry could not be saved",
    );
}

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

// 15. the item round trip: two controls write one `sprite` object, and
//     `cooldownMs` is stored as `cooldown`
const itStored = {
    id: "md-my-hown-mod:pick",
    name: "Pick",
    itemType: "Tool",
    cooldown: 250,
    energyCost: 3,
    excavationProfileId: "md-my-hown-mod:dig",
    handlerKey: "someToolHandler",
    sprite: { id: "sprites:pick", type: "onehand" },
};
const itBack = S.formToEntry("items", S.entryToForm("items", itStored)) as Record<
    string,
    unknown
>;
ok(itBack.id === itStored.id, `item id → ${itBack.id}`);
ok(itBack.itemType === "Tool", `item itemType → ${itBack.itemType}`);
ok(itBack.cooldown === 250, `item cooldown → ${itBack.cooldown}`);
ok(itBack.energyCost === 3, `item energyCost → ${itBack.energyCost}`);
ok(
    (itBack.excavationProfileId as string) === "md-my-hown-mod:dig",
    `item excavationProfileId → ${itBack.excavationProfileId}`,
);
ok(
    JSON.stringify(itBack.sprite) === JSON.stringify(itStored.sprite),
    `item sprite → ${JSON.stringify(itBack.sprite)}`,
);

// 16. a Consumable never persists a use action — ActionType has no Consumable,
//     so the engine would never call it. The rule is in the save path, not the
//     `when` predicate, because the form still carries the old value.
const consumable = S.formToEntry("items", {
    ...S.entryToForm("items", { ...itStored, itemType: "Consumable" }),
}) as Record<string, unknown>;
ok(
    consumable.handlerKey === undefined,
    `a Consumable persisted a handler: ${consumable.handlerKey}`,
);
// …and the rest of the item is untouched by that rule
ok(
    JSON.stringify(consumable.sprite) === JSON.stringify(itStored.sprite),
    "the Consumable rule disturbed the sprite",
);

// 17. the handler survives a round trip back to a type that can use one, because
//     it is read into the form even while the control is hidden
const backToTool = S.formToEntry("items", {
    ...S.entryToForm("items", { ...itStored, itemType: "Consumable" }),
    itemType: "Tool",
}) as Record<string, unknown>;
ok(
    backToTool.handlerKey === "someToolHandler",
    `switching Consumable → Tool lost the handler: ${backToTool.handlerKey}`,
);

// 18. the item's `when` predicates: each control belongs to one item type only
const newItem = S.newEntryForm("items");
const whenOf = (key: string, form: Record<string, string>) =>
    itFields.find((f: { key: string }) => f.key === key)!.when?.(form) ?? true;
ok(whenOf("excavationProfileId", { ...newItem, itemType: "Tool" }), "no profile on a Tool");
ok(
    !whenOf("excavationProfileId", { ...newItem, itemType: "Weapon" }),
    "a Weapon is offered an excavation profile",
);
ok(whenOf("projectileId", { ...newItem, itemType: "Weapon" }), "no projectile on a Weapon");
ok(
    !whenOf("handlerKey", { ...newItem, itemType: "Consumable" }),
    "a Consumable is offered a use action",
);
ok(whenOf("cooldownMs", { ...newItem, itemType: "Tool" }), "no cooldown on a Tool");
ok(!whenOf("cooldownMs", { ...newItem, itemType: "Mod" }), "a Mod has a cooldown");

// 19. an unmodelled item key still round-trips
const itExtra = S.formToEntry("items", {
    ...S.entryToForm("items", { ...itStored, someEngineKey: 11 }),
}) as Record<string, unknown>;
ok(itExtra.someEngineKey === 11, "an unmodelled item key was dropped on save");

// 20. the terrain round trip: an HSL triple becomes three controls and back, and
//     a `{ elementType, chance }` drop becomes two controls and back
const trStored = {
    id: "md-my-hown-mod:stone",
    name: "Stone",
    nameKey: "terrain.stone",
    hp: 250,
    metaColor: 0x808080,
    colorHSL: [200, 0.4, 0.6],
    excavationRequirements: ["md-my-hown-mod:pick", "md-my-hown-mod:shovel"],
    interactions: [{ kind: "default" }],
    output: { elementType: "md-my-hown-mod:pebble", chance: 0.25 },
    flammable: false,
    materialId: 101,
};
const trBack = S.formToEntry("terrains", S.entryToForm("terrains", trStored)) as Record<
    string,
    unknown
>;
ok(trBack.id === trStored.id, `terrain id → ${trBack.id}`);
ok(trBack.hp === 250, `terrain hp → ${trBack.hp}`);
ok(trBack.metaColor === 0x808080, `terrain metaColor → ${trBack.metaColor}`);
ok(trBack.materialId === 101, `terrain materialId → ${trBack.materialId}`);
ok(
    JSON.stringify(trBack.colorHSL) === JSON.stringify(trStored.colorHSL),
    `terrain colorHSL → ${JSON.stringify(trBack.colorHSL)}`,
);
ok(
    JSON.stringify(trBack.excavationRequirements) ===
        JSON.stringify(trStored.excavationRequirements),
    `terrain excavationRequirements → ${JSON.stringify(trBack.excavationRequirements)}`,
);
ok(
    JSON.stringify(trBack.output) === JSON.stringify(trStored.output),
    `terrain output → ${JSON.stringify(trBack.output)}`,
);

// 21. the HSL toggle is derived from the stored array, not stored beside it, so
//     a terrain can never show the toggle on with no colour behind it
const hslRead = S.entryToForm("terrains", { colorHSL: [10, 0.5, 0.7] });
ok(hslRead.colorHSLOn === "true", "a stored colorHSL did not switch the toggle on");
ok(
    S.entryToForm("terrains", {}).colorHSLOn !== "true",
    "the toggle is on for a terrain with no stored colour",
);

// 22. …and the save path honours it: the three numbers are written only when the
//     toggle is on, so an untouched form cannot emit a 0,0,0 black terrain
const noHsl = S.formToEntry("terrains", {
    ...S.entryToForm("terrains", { colorHSL: [10, 0.5, 0.7] }),
    colorHSLOn: "false",
}) as Record<string, unknown>;
ok(
    !("colorHSL" in noHsl),
    `turning the HSL toggle off left the colour as ${JSON.stringify(noHsl.colorHSL)}`,
);
// a half-filled triple is not written at all — a 1- or 2-tuple is a different
// colour, not a half-specified one
const halfHsl = S.formToEntry("terrains", {
    ...S.entryToForm("terrains", { colorHSL: [10, 0.5, 0.7] }),
    colorHSLLightness: "",
}) as Record<string, unknown>;
ok(
    !("colorHSL" in halfHsl),
    `a partially filled HSL was written as ${JSON.stringify(halfHsl.colorHSL)}`,
);

// 23. a drop chance with no element is not a drop
const chanceOnly = S.formToEntry("terrains", {
    ...S.entryToForm("terrains", { output: { elementType: "md-my-hown-mod:pebble", chance: 0.5 } }),
    outputElement: "",
}) as Record<string, unknown>;
ok(
    !("output" in chanceOnly),
    `a drop chance with no element was written as ${JSON.stringify(chanceOnly.output)}`,
);

// 24. the `fog` decision: a stored key the form has no control for must survive
//     through the passthrough rather than being claimed and dropped
const foggy = S.formToEntry("terrains", {
    ...S.entryToForm("terrains", { ...trStored, fog: true }),
}) as Record<string, unknown>;
ok(foggy.fog === true, "a stored `fog` was dropped — the form does not model it");

// 25. an unmodelled terrain key still round-trips
const trExtra = S.formToEntry("terrains", {
    ...S.entryToForm("terrains", { ...trStored, someEngineKey: 5 }),
}) as Record<string, unknown>;
ok(trExtra.someEngineKey === 5, "an unmodelled terrain key was dropped on save");

if (failures.length === 0) {
    console.log("definition check: all 25 passed");
} else {
    console.error(`definition check: ${failures.length} FAILED`);
    for (const f of failures) console.error(` - ${f}`);
    Deno.exit(1);
}
