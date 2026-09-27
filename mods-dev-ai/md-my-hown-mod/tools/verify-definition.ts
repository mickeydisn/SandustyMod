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

const { structureDefinition } = await import(`${ROOT}ui/definition/core/structure.ts`);
const { elementDefinition } = await import(`${ROOT}ui/definition/core/element.ts`);
const { itemDefinition } = await import(`${ROOT}ui/definition/core/item.ts`);
const { recipeDefinition } = await import(`${ROOT}ui/definition/core/recipe.ts`);
const { contactDefinition } = await import(`${ROOT}ui/definition/core/contact.ts`);
const { behaviorDefinition } = await import(`${ROOT}ui/definition/core/behavior.ts`);
const { signalDefinition } = await import(`${ROOT}ui/definition/core/signal.ts`);
const { projectileDefinition } = await import(`${ROOT}ui/definition/core/projectile.ts`);
const { excavationDefinition } = await import(`${ROOT}ui/definition/core/excavation.ts`);
const { energyDefinition } = await import(`${ROOT}ui/definition/core/energy.ts`);
const { inputDefinition } = await import(`${ROOT}ui/definition/core/input.ts`);
const { interactionDefinition } = await import(`${ROOT}ui/definition/core/interaction.ts`);
const { modifierDefinition } = await import(`${ROOT}ui/definition/core/modifier.ts`);
const { networkDefinition } = await import(`${ROOT}ui/definition/custom/network.ts`);
const { processingDefinition } = await import(`${ROOT}ui/definition/core/processing.ts`);
const { spriteDefinition } = await import(`${ROOT}ui/definition/core/sprite.ts`);
const { triggerDefinition } = await import(`${ROOT}ui/definition/core/trigger.ts`);
const { unlockNodeDefinition } = await import(`${ROOT}ui/definition/custom/unlock-node.ts`);
const { techDefinition } = await import(`${ROOT}ui/definition/core/tech.ts`);
const { upgradeDefinition } = await import(`${ROOT}ui/definition/core/upgrade.ts`);
const { upgradeCategoryDefinition } = await import(`${ROOT}ui/definition/core/upgrade-category.ts`);
const { terrainDefinition } = await import(`${ROOT}ui/definition/core/terrain.ts`);
const { DEFINITIONS, definitionFor } = await import(`${ROOT}ui/definition/index.ts`);
const S = await import(`${ROOT}ui/schema.ts`);

const failures: string[] = [];
const ok = (cond: boolean, what: string) => {
    if (!cond) failures.push(what);
};

// 1. the registry is what `schema.ts` asks
const SERVED = {
    structures: structureDefinition,
    elements: elementDefinition,
    items: itemDefinition,
    terrains: terrainDefinition,
    recipes: recipeDefinition,
    contacts: contactDefinition,
    behaviors: behaviorDefinition,
    signals: signalDefinition,
    projectiles: projectileDefinition,
    excavation: excavationDefinition,
    techs: techDefinition,
    categories: upgradeCategoryDefinition,
    upgrades: upgradeDefinition,
    energy: energyDefinition,
    networks: networkDefinition,
    triggers: triggerDefinition,
    inputs: inputDefinition,
    interactions: interactionDefinition,
    processing: processingDefinition,
    modifiers: modifierDefinition,
    sprites: spriteDefinition,
    unlockNodes: unlockNodeDefinition,
} as const;
for (const [tab, def] of Object.entries(SERVED)) {
    ok(definitionFor(tab as never) === def, `registry does not serve ${tab}`);
}
ok(
    Object.keys(DEFINITIONS).length === Object.keys(SERVED).length,
    `registry has ${Object.keys(DEFINITIONS).length} entries, expected ${
        Object.keys(SERVED).length
    }`,
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

// 26. the recipe round trip. The machine id decides the output *shape*, so each
//     of the three shapes is checked — this is the whole content of a recipe.
const rcList = {
    id: "md-my-hown-mod:iron",
    kind: "smelter",
    input: "md-my-hown-mod:ore",
    outputs: [{ elementType: "md-my-hown-mod:iron", chance: 1 }],
};
const rcBack = S.formToEntry("recipes", S.entryToForm("recipes", rcList)) as Record<
    string,
    unknown
>;
ok(rcBack.kind === "smelter", `recipe kind → ${rcBack.kind}`);
ok(rcBack.input === rcList.input, `recipe input → ${rcBack.input}`);
ok(
    JSON.stringify(rcBack.outputs) === JSON.stringify(rcList.outputs),
    `recipe outputs → ${JSON.stringify(rcBack.outputs)}`,
);
// A list machine must not gain `output`. (`chance` and `minimumDownwardVelocity`
// are *not* asserted absent: the form seeds them from their field defaults, and
// the save path has always written whatever the form holds regardless of the
// machine. That is pre-existing editor behaviour, unchanged here — asserting it
// either way would pin down something this refactor did not decide.)
ok(!("output" in rcBack), `a list recipe gained a single output: ${rcBack.output}`);

// the shaker shape: two lists, no single output
const rcShaker = {
    id: "md-my-hown-mod:sand",
    kind: "shaker",
    input: "md-my-hown-mod:raw",
    outputsAbove: [{ elementType: "md-my-hown-mod:glass", chance: 0.1 }],
    outputsBelow: [{ elementType: "md-my-hown-mod:sand", chance: 0.9 }],
};
const rcShakerBack = S.formToEntry(
    "recipes",
    S.entryToForm("recipes", rcShaker),
) as Record<string, unknown>;
ok(
    JSON.stringify(rcShakerBack.outputsAbove) === JSON.stringify(rcShaker.outputsAbove) &&
        JSON.stringify(rcShakerBack.outputsBelow) === JSON.stringify(rcShaker.outputsBelow),
    `a shaker recipe lost an output list: ${JSON.stringify(rcShakerBack)}`,
);
ok(
    !("outputs" in rcShakerBack),
    "a shaker recipe also wrote the single `outputs` list",
);

// the planterBox shape: one element + a chance, no list
const rcPlanter = {
    id: "md-my-hown-mod:seed",
    kind: "planterBox",
    input: "md-my-hown-mod:seed",
    output: "md-my-hown-mod:plant",
    chance: 0.25,
};
const rcPlanterBack = S.formToEntry(
    "recipes",
    S.entryToForm("recipes", rcPlanter),
) as Record<string, unknown>;
ok(
    rcPlanterBack.output === rcPlanter.output && rcPlanterBack.chance === 0.25,
    `a planterBox recipe lost its single output: ${JSON.stringify(rcPlanterBack)}`,
);
ok(
    !("outputs" in rcPlanterBack),
    "a planterBox recipe also wrote an `outputs` list",
);

// 27. the `outputs` rules, which the definition now owns
const rcBase = { ...S.newEntryForm("recipes"), machine: "smelter" };
ok(
    S.validateForm("recipes", rcBase).outputs === "add at least one output",
    "an empty required outputs list did not say what to do about it",
);
ok(
    !S.validateForm("recipes", {
        ...rcBase,
        outputs: JSON.stringify([{ elementType: "x", chance: 0.5 }]),
    }).outputs,
    "a legal output row was rejected",
);
ok(
    !!S.validateForm("recipes", {
        ...rcBase,
        outputs: JSON.stringify([{ elementType: "", chance: 0.5 }]),
    }).outputs,
    "an output row with no element was accepted",
);
ok(
    !!S.validateForm("recipes", {
        ...rcBase,
        outputs: JSON.stringify([{ elementType: "x", chance: 5 }]),
    }).outputs,
    "an output chance above 1 was accepted",
);
ok(
    !!S.validateForm("recipes", {
        ...rcBase,
        outputs: JSON.stringify(
            Array.from({ length: 256 }, () => ({ elementType: "x", chance: 1 })),
        ),
    }).outputs,
    "a 256-row output list was accepted — the engine caps one at 255",
);

// 28. the contact's null output — the one value that is not a value
const ctStored = {
    id: "md-my-hown-mod:react",
    inputA: "md-my-hown-mod:water",
    inputB: "md-my-hown-mod:fire",
    outputA: null, // consumed, not unset — the engine's "nothing comes out of A"
    outputB: "md-my-hown-mod:steam",
    orientation: "any",
};
const ctBack = S.formToEntry("contacts", S.entryToForm("contacts", ctStored)) as Record<
    string,
    unknown
>;
ok(
    Object.prototype.hasOwnProperty.call(ctBack, "outputA") && ctBack.outputA === null,
    `a consumed input stopped being null: ${JSON.stringify(ctBack.outputA)}`,
);
ok(ctBack.outputB === ctStored.outputB, `contact outputB → ${ctBack.outputB}`);
// …and an *empty* output is still "unset", not null: the two must not collapse
const ctEmpty = S.formToEntry("contacts", {
    ...S.entryToForm("contacts", ctStored),
    outputA: "",
}) as Record<string, unknown>;
ok(
    !("outputA" in ctEmpty),
    `an emptied output was written as ${JSON.stringify(ctEmpty.outputA)}`,
);

// 29. the behaviour's split between named pickers and the raw payload
//
// Compared key-by-key, not with `JSON.stringify`: the round trip *rebuilds*
// `definition` (raw box first, then the named ids), so the key order changes
// even when every value is identical. String comparison would report that as a
// failure and hide the real one.
const sameObject = (a: unknown, b: unknown): boolean => {
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        return a === b;
    }
    const ka = Object.keys(a as Record<string, unknown>).sort();
    const kb = Object.keys(b as Record<string, unknown>).sort();
    return ka.length === kb.length && ka.every((k, i) =>
        k === kb[i] &&
        JSON.stringify((a as Record<string, unknown>)[k]) ===
            JSON.stringify((b as Record<string, unknown>)[k])
    );
};

const bhConveyor = {
    id: "md-my-hown-mod:belt",
    kind: "conveyor",
    definition: { id: "md-my-hown-mod:conveyor", speed: 2 },
};
const bhConveyorBack = S.formToEntry(
    "behaviors",
    S.entryToForm("behaviors", bhConveyor),
) as Record<string, unknown>;
ok(bhConveyorBack.kind === "conveyor", `behaviour kind → ${bhConveyorBack.kind}`);
ok(
    sameObject(bhConveyorBack.definition, bhConveyor.definition),
    `conveyor definition → ${JSON.stringify(bhConveyorBack.definition)}`,
);

const bhLauncher = {
    id: "md-my-hown-mod:thr",
    kind: "launcher",
    definition: {
        upType: "md-my-hown-mod:up",
        leftType: "md-my-hown-mod:left",
        rightType: "md-my-hown-mod:right",
        power: 10,
    },
};
const bhLauncherBack = S.formToEntry(
    "behaviors",
    S.entryToForm("behaviors", bhLauncher),
) as Record<string, unknown>;
ok(
    sameObject(bhLauncherBack.definition, bhLauncher.definition),
    `launcher definition → ${JSON.stringify(bhLauncherBack.definition)}`,
);
// a conveyor must not write the launcher's three keys, even if the form still
// carries them from before a kind switch
const bhSwitched = S.formToEntry("behaviors", {
    ...S.entryToForm("behaviors", bhLauncher),
    kind: "conveyor",
    structureId: "md-my-hown-mod:belt",
}) as Record<string, unknown>;
const bhDef = bhSwitched.definition as Record<string, unknown>;
ok(
    !("upType" in bhDef) && !("leftType" in bhDef) && !("rightType" in bhDef),
    `a conveyor wrote the launcher's keys: ${JSON.stringify(bhDef)}`,
);
ok(bhDef.id === "md-my-hown-mod:belt", `conveyor id → ${bhDef.id}`);

// 30. the excavation round trip, including the rule list that was previously
//     unreachable (the register layer dropped `terrainRules` on the floor and
//     the form had no field for it)
const exStored = {
    id: "md-my-hown-mod:dig",
    power: 25,
    pattern: [[1, 1], [0, 1]],
    terrainRules: [
        { cellType: "md-my-hown-mod:stone", damage: 3, outputElementType: "md-my-hown-mod:chip" },
    ],
    options: { fromDrill: true },
};
const exBack = S.formToEntry("excavation", S.entryToForm("excavation", exStored)) as Record<
    string,
    unknown
>;
ok(exBack.power === 25, `excavation power → ${exBack.power}`);
ok(
    JSON.stringify(exBack.pattern) === JSON.stringify(exStored.pattern),
    `excavation pattern → ${JSON.stringify(exBack.pattern)}`,
);
ok(
    JSON.stringify(exBack.terrainRules) === JSON.stringify(exStored.terrainRules),
    `excavation terrainRules → ${JSON.stringify(exBack.terrainRules)}`,
);
ok(
    JSON.stringify(exBack.options) === JSON.stringify(exStored.options),
    `excavation options → ${JSON.stringify(exBack.options)}`,
);
// an empty rule list is not written at all
const exNoRules = S.formToEntry("excavation", {
    ...S.entryToForm("excavation", exStored),
    terrainRulesJson: "[]",
}) as Record<string, unknown>;
ok(
    !("terrainRules" in exNoRules),
    `an empty rule list was written as ${JSON.stringify(exNoRules.terrainRules)}`,
);

// 31. the profile's own rules — the matrix and the terrain-rule shape
const exForm = S.newEntryForm("excavation");
ok(
    !S.validateForm("excavation", { ...exForm, patternJson: "[[1,1],[0,1]]" }).patternJson,
    "a legal 2×2 dig pattern was rejected",
);
ok(
    !!S.validateForm("excavation", { ...exForm, patternJson: "[[1,1],[0]]" }).patternJson,
    "a ragged dig pattern was accepted",
);
ok(
    !!S.validateForm("excavation", { ...exForm, patternJson: "[[1,2]]" }).patternJson,
    "a dig pattern with a 2 in it was accepted — cells are 0 or 1",
);
ok(
    !!S.validateForm("excavation", { ...exForm, patternJson: "[]" }).patternJson,
    "an empty dig pattern was accepted",
);
ok(
    !!S.validateForm("excavation", { ...exForm, patternJson: "{nope" }).patternJson,
    "unparseable pattern text produced no error",
);
ok(
    !!S.validateForm("excavation", {
        ...exForm,
        terrainRulesJson: JSON.stringify([{ damage: 1 }]),
    }).terrainRulesJson,
    "a terrain rule naming no terrain was accepted — it can never match",
);
ok(
    !S.validateForm("excavation", {
        ...exForm,
        terrainRulesJson: JSON.stringify([{ cellType: "t", damage: 1 }]),
    }).terrainRulesJson,
    "a legal terrain rule was rejected",
);
// an empty required pattern is "required", and must not throw on the way there —
// the definition is asked about the empty value before the generic answer
ok(
    S.validateForm("excavation", exForm).patternJson === "required",
    `an empty required pattern gave ${S.validateForm("excavation", exForm).patternJson}`,
);

// 32. the projectile round trip, and the handler-wins rule
const pjStored = {
    id: "md-my-hown-mod:bolt",
    sprite: { id: "sprites:bolt" },
    getOptionsKey: "someHandler",
    options: { speed: 10 },
};
const pjBack = S.formToEntry("projectiles", S.entryToForm("projectiles", pjStored)) as Record<
    string,
    unknown
>;
ok(
    JSON.stringify(pjBack.sprite) === JSON.stringify(pjStored.sprite),
    `projectile sprite → ${JSON.stringify(pjBack.sprite)}`,
);
ok(pjBack.getOptionsKey === "someHandler", `projectile handler → ${pjBack.getOptionsKey}`);
ok(
    JSON.stringify(pjBack.options) === JSON.stringify(pjStored.options),
    `projectile options → ${JSON.stringify(pjBack.options)}`,
);
// the static options are *hidden* behind a handler but still carried, so
// clearing the handler restores them instead of leaving a projectile bare
const pjFields = S.fieldsFor("projectiles");
const pjWhen = pjFields.find((f: { key: string }) => f.key === "optionsJson")!.when!;
ok(pjWhen({ getOptionsKey: "someHandler" }) === false, "static options show behind a handler");
ok(pjWhen({ getOptionsKey: "" }) === true, "static options are hidden with no handler");
const pjCleared = S.formToEntry("projectiles", {
    ...S.entryToForm("projectiles", pjStored),
    getOptionsKey: "",
}) as Record<string, unknown>;
ok(
    JSON.stringify(pjCleared.options) === JSON.stringify(pjStored.options),
    "clearing the handler lost the static options it was overriding",
);

// 33. the signal round trip
const sgStored = {
    id: "md-my-hown-mod:click",
    kind: "interactables",
    target: "md-my-hown-mod:button",
    handlerKey: "onClick",
};
const sgBack = S.formToEntry("signals", S.entryToForm("signals", sgStored)) as Record<
    string,
    unknown
>;
ok(sgBack.id === sgStored.id, `signal id → ${sgBack.id}`);
ok(sgBack.kind === "interactables", `signal kind → ${sgBack.kind}`);
ok(sgBack.target === sgStored.target, `signal target → ${sgBack.target}`);
ok(sgBack.handlerKey === "onClick", `signal handlerKey → ${sgBack.handlerKey}`);

// 34. the tech round trip, and the two picker/text pairs
const tStored = {
    id: "md-my-hown-mod:t1",
    name: "Automation",
    cost: 250,
    currencyType: "gold",
    branch: "industry",
    parentId: "md-my-hown-mod:t0",
    requires: ["md-my-hown-mod:other"],
    unlocks: {
        structures: ["md-my-hown-mod:conveyor"],
        items: ["md-my-hown-mod:pick"],
    },
};
const tBack = S.formToEntry("techs", S.entryToForm("techs", tStored)) as Record<string, unknown>;
ok(tBack.id === tStored.id, `tech id → ${tBack.id}`);
ok(tBack.cost === 250, `tech cost → ${tBack.cost}`);
ok(tBack.currencyType === "gold", `tech currencyType → ${tBack.currencyType}`);
ok(tBack.branch === "industry", `tech branch → ${tBack.branch}`);
ok(
    sameObject(tBack.unlocks, tStored.unlocks),
    `tech unlocks → ${JSON.stringify(tBack.unlocks)}`,
);
ok(
    JSON.stringify(tBack.requires) === JSON.stringify(tStored.requires),
    `tech requires → ${JSON.stringify(tBack.requires)}`,
);

// A value outside the picker's list must survive as a *value*, not as the
// sentinel. This is the pair's whole reason to exist: `currencyType` is a free
// string in the engine, and a config that used one the picker does not list must
// not be rewritten to `__custom__` on the next save.
const tOddForm = S.entryToForm("techs", {
    ...tStored,
    currencyType: "bits",
    branch: "science",
});
ok(
    tOddForm.currencyType === "__custom__",
    `an unlisted currency did not switch the picker to custom: ${tOddForm.currencyType}`,
);
ok(
    tOddForm.currencyTypeCustom === "bits",
    `the companion box did not receive the value: ${tOddForm.currencyTypeCustom}`,
);
const tOdd = S.formToEntry("techs", tOddForm) as Record<string, unknown>;
ok(tOdd.currencyType === "bits", `an unlisted currency became ${tOdd.currencyType}`);
ok(tOdd.branch === "science", `an unlisted branch became ${tOdd.branch}`);
// an empty unlocks list is not written at all
const tNoUnlocks = S.formToEntry("techs", {
    ...tOddForm,
    unlockStructures: "",
    unlockItems: "",
}) as Record<string, unknown>;
ok(
    !("unlocks" in tNoUnlocks),
    `an empty unlocks was written as ${JSON.stringify(tNoUnlocks.unlocks)}`,
);

// 35. the upgrade-category round trip, and the name-or-nameKey rule
const catForm = S.newEntryForm("categories");
ok(
    !!S.validateForm("categories", catForm).name,
    "a category with neither a name nor a name key was accepted — the engine throws",
);
ok(
    !S.validateForm("categories", { ...catForm, name: "Tools" }).name,
    "a named category was rejected",
);
ok(
    !S.validateForm("categories", { ...catForm, nameKey: "k" }).name,
    "a name-key-only category was rejected — the engine accepts it",
);
const catStored = {
    id: "md-my-hown-mod:cat",
    name: "Tools",
    requirement: "md-my-hown-mod:t1",
};
const catBack = S.formToEntry(
    "categories",
    S.entryToForm("categories", catStored),
) as Record<string, unknown>;
ok(catBack.name === "Tools", `category name → ${catBack.name}`);
// The requirement does **not** survive a save, and never has. Reading puts a
// string requirement into the raw box as bare text; saving parses that box as
// JSON *looking for an object*, and a bare string is not one, so it comes back
// undefined and nothing is written. Verified identical on the pre-refactor
// tree, so this is preserved behaviour rather than a regression — but it means
// the "Requirement (stored only)" control is write-only in practice.
//
// Asserted as-is rather than "fixed" here: changing it would alter what a save
// writes, which is a behaviour decision, not a refactor.
const catFormRead = S.entryToForm("categories", catStored);
ok(
    catFormRead.requirementTechId === "__custom__" &&
        catFormRead.requirementJson === "md-my-hown-mod:t1",
    `the requirement was not shown: ${catFormRead.requirementTechId} / ${catFormRead.requirementJson}`,
);
ok(
    !("requirement" in catBack),
    `a category requirement was persisted as ${JSON.stringify(catBack.requirement)}`,
);
const catObj = S.formToEntry("categories", {
    ...S.entryToForm("categories", { id: "c", name: "N", requirement: { kind: "x" } }),
}) as Record<string, unknown>;
ok(
    JSON.stringify(catObj.requirement) === JSON.stringify({ kind: "x" }),
    `a non-string category requirement → ${JSON.stringify(catObj.requirement)}`,
);

// 36. the upgrade round trip: five controls, one nested object
const upStored = {
    id: "md-my-hown-mod:up",
    itemId: "md-my-hown-mod:drill",
    categoryId: "tools",
    upgrade: { id: "lvl2", nameKey: "up.name", maxLevel: 4, costs: [10, 20, 30, 40] },
    onUpgradeKey: "onUp",
};
const upBack = S.formToEntry("upgrades", S.entryToForm("upgrades", upStored)) as Record<
    string,
    unknown
>;
ok(upBack.itemId === upStored.itemId, `upgrade itemId → ${upBack.itemId}`);
ok(upBack.categoryId === "tools", `upgrade categoryId → ${upBack.categoryId}`);
ok(upBack.onUpgradeKey === "onUp", `upgrade onUpgradeKey → ${upBack.onUpgradeKey}`);
// `oneOff` is *added* to the payload: the field's default is "false" and the
// save writes whatever the form holds. Also pre-existing and unchanged — asserted
// so that any future change to it is deliberate.
ok(
    (upBack.upgrade as { oneOff?: boolean }).oneOff === false,
    `oneOff was not written from the field default: ${JSON.stringify(upBack.upgrade)}`,
);
// the four nested fields themselves round-trip
const upPayload = upBack.upgrade as Record<string, unknown>;
for (const k of ["id", "nameKey", "maxLevel", "costs"]) {
    ok(
        JSON.stringify(upPayload[k]) ===
            JSON.stringify((upStored.upgrade as Record<string, unknown>)[k]),
        `upgrade.${k} → ${JSON.stringify(upPayload[k])}`,
    );
}
// `__custom__` is a picker affordance and must never reach the stored config
const upCustom = S.formToEntry("upgrades", {
    ...S.entryToForm("upgrades", upStored),
    categoryId: "__custom__",
}) as Record<string, unknown>;
ok(
    !("categoryId" in upCustom),
    `__custom__ was persisted as the category: ${JSON.stringify(upCustom.categoryId)}`,
);

// 37. the network round trip — an id and a label, and nothing else
const netBack = S.formToEntry("networks", {
    ...S.entryToForm("networks", { id: "md-my-hown-mod:power", name: "Power grid" }),
}) as Record<string, unknown>;
ok(netBack.name === "Power grid", `network name → ${netBack.name}`);
ok(
    S.passthroughKeys("networks", { id: "md-my-hown-mod:power", name: "Power grid" }).length === 0,
    "a network leaked a passthrough key it owns",
);

// 38. the energy round trip: three controls, one nested `options` object
const enStored = {
    id: "md-my-hown-mod:e",
    structureId: "md-my-hown-mod:battery",
    type: "storage",
    options: { capacity: 500, energyType: "power", priority: 2 },
};
const enBack = S.formToEntry("energy", S.entryToForm("energy", enStored)) as Record<
    string,
    unknown
>;
ok(enBack.structureId === enStored.structureId, `energy structureId → ${enBack.structureId}`);
ok(enBack.type === "storage", `energy type → ${enBack.type}`);
ok(
    JSON.stringify(enBack.options) === JSON.stringify(enStored.options),
    `energy options → ${JSON.stringify(enBack.options)}`,
);
// an entry with no options must not gain an empty one
const enNoOpts = S.formToEntry("energy", {
    ...S.entryToForm("energy", { id: "e", structureId: "s", type: "conductor" }),
    capacity: "",
    energyType: "",
    priority: "",
}) as Record<string, unknown>;
ok(
    !("options" in enNoOpts),
    `an empty options was written as ${JSON.stringify(enNoOpts.options)}`,
);

// 39. the trigger round trip — and `triggerId`, which has no control at all
const trgStored = {
    id: "md-my-hown-mod:t",
    triggerId: "md-my-hown-mod:clock",
    interval: 60,
    sequentialRuns: 2,
    handlerKey: "onTick",
    extra: { mode: "slow" },
};
const trgBack = S.formToEntry("triggers", S.entryToForm("triggers", trgStored)) as Record<
    string,
    unknown
>;
ok(trgBack.interval === 60, `trigger interval → ${trgBack.interval}`);
ok(trgBack.sequentialRuns === 2, `trigger sequentialRuns → ${trgBack.sequentialRuns}`);
ok(trgBack.handlerKey === "onTick", `trigger handlerKey → ${trgBack.handlerKey}`);
ok(
    JSON.stringify(trgBack.extra) === JSON.stringify(trgStored.extra),
    `trigger extra → ${JSON.stringify(trgBack.extra)}`,
);
// `triggerId` has no control, so it rides the passthrough rather than being
// claimed by the form. It used to be in `formCovered`, which meant the
// passthrough skipped it *and* nothing wrote it — so every save deleted it.
ok(
    trgBack.triggerId === trgStored.triggerId,
    `triggerId → ${JSON.stringify(trgBack.triggerId)}`,
);
ok(
    S.passthroughKeys("triggers", trgStored).includes("triggerId"),
    "a stored triggerId is not offered as a passthrough, so nothing can carry it",
);

// 40. the input round trip — an empty key list is not written
const inBindStored = {
    id: "md-my-hown-mod:b",
    displayName: "Toggle",
    category: "Mod controls",
    defaultKeys: ["KeyT", "Control+KeyC"],
    onDownKey: "down",
    onUpKey: "up",
    subsection: { title: "Group" },
};
const inBindBack = S.formToEntry("inputs", S.entryToForm("inputs", inBindStored)) as Record<
    string,
    unknown
>;
ok(inBindBack.displayName === "Toggle", `input displayName → ${inBindBack.displayName}`);
ok(
    JSON.stringify(inBindBack.defaultKeys) === JSON.stringify(inBindStored.defaultKeys),
    `input defaultKeys → ${JSON.stringify(inBindBack.defaultKeys)}`,
);
ok(
    JSON.stringify(inBindBack.subsection) === JSON.stringify(inBindStored.subsection),
    `input subsection → ${JSON.stringify(inBindBack.subsection)}`,
);
const inBindNoKeys = S.formToEntry("inputs", {
    ...S.entryToForm("inputs", inBindStored),
    defaultKeys: "",
}) as Record<string, unknown>;
ok(
    !("defaultKeys" in inBindNoKeys),
    `an unbound binding wrote defaultKeys: ${JSON.stringify(inBindNoKeys.defaultKeys)}`,
);

// 41. processing — the structure type survives as both a string and a number
const prBack = S.formToEntry("processing", {
    ...S.entryToForm("processing", { id: "p", structureType: "md-my-hown-mod:mill" }),
}) as Record<string, unknown>;
ok(
    prBack.structureType === "md-my-hown-mod:mill",
    `processing structureType → ${prBack.structureType}`,
);
const prNum = S.entryToForm("processing", { id: "p", structureType: 7 });
ok(
    prNum.structureType === "7",
    `a numeric structure type was not read: ${prNum.structureType}`,
);

// 42. interactions — an unmodelled descriptor is kept verbatim, not re-composed
// This is the whole point of the tab: re-composing would rewrite a descriptor
// this panel does not fully understand into a shape it does, which is a data
// loss that looks like a successful edit.
const ixOdd = {
    id: "md-my-hown-mod:ix",
    elementId: "md-my-hown-mod:slime",
    interaction: { kind: "structure", structures: ["a"], somethingNew: 42 },
};
const ixBack = S.formToEntry("interactions", S.entryToForm("interactions", ixOdd)) as Record<
    string,
    unknown
>;
ok(
    JSON.stringify(ixBack.interaction) === JSON.stringify(ixOdd.interaction),
    `an unmodelled interaction was rewritten as ${JSON.stringify(ixBack.interaction)}`,
);
// …while a fully-modelled one *is* re-composed from the visible fields
const ixPlain = {
    id: "md-my-hown-mod:ix",
    elementId: "md-my-hown-mod:slime",
    interaction: { kind: "structure", structures: ["a"] },
};
const ixPlainBack = S.formToEntry(
    "interactions",
    S.entryToForm("interactions", ixPlain),
) as Record<string, unknown>;
ok(
    JSON.stringify(ixPlainBack.interaction) === JSON.stringify(ixPlain.interaction),
    `a modelled interaction → ${JSON.stringify(ixPlainBack.interaction)}`,
);

// 43. unlock nodes — the two modes write disjoint field sets
// A node that borrows an engine tech keeps that tech's own definition, so a cost
// typed beside it would be a second source for the same node. A node that is
// "always" writes no research fields at all, so a stale cost cannot survive an
// edit as a competing claim on how a structure becomes available.
const unBorrow = S.formToEntry("unlockNodes", {
    ...S.entryToForm("unlockNodes", {
        id: "md-my-hown-mod:un",
        name: "Borrowed",
        kind: "tech",
        techId: "md-my-hown-mod:eng",
        cost: 999,
    }),
}) as Record<string, unknown>;
ok(unBorrow.techId === "md-my-hown-mod:eng", `borrowed techId → ${unBorrow.techId}`);
ok(
    !("cost" in unBorrow),
    `a borrowed node kept a competing cost: ${JSON.stringify(unBorrow.cost)}`,
);
ok(
    !("currencyType" in unBorrow) && !("branch" in unBorrow),
    "a borrowed node kept research fields it does not own",
);
const unAlways = S.formToEntry("unlockNodes", {
    ...S.entryToForm("unlockNodes", { id: "md-my-hown-mod:un", name: "Free", kind: "always" }),
    kind: "always",
    cost: "500",
}) as Record<string, unknown>;
ok(
    !("cost" in unAlways) && !("requires" in unAlways),
    `an "always" node wrote research fields: ${JSON.stringify(unAlways)}`,
);
// The toggle is only rendered for a tech node, so a form can hold it on an
// "always" node — and must not then attach a tech to it.
const unToggle = S.formToEntry("unlockNodes", {
    ...S.entryToForm("unlockNodes", { id: "md-my-hown-mod:un", name: "Free", kind: "always" }),
    kind: "always",
    useExistingTech: "true",
    techId: "md-my-hown-mod:eng",
}) as Record<string, unknown>;
ok(
    !("techId" in unToggle),
    `an "always" node with a stale toggle borrowed a tech: ${JSON.stringify(unToggle.techId)}`,
);
// a real tech node round-trips its research fields
const unBuild = S.formToEntry("unlockNodes", {
    ...S.entryToForm("unlockNodes", {
        id: "md-my-hown-mod:un",
        name: "Built",
        kind: "tech",
        cost: 250,
        currencyType: "gold",
        branch: "industry",
        parentId: "md-my-hown-mod:root",
        requires: ["md-my-hown-mod:base"],
    }),
}) as Record<string, unknown>;
ok(unBuild.cost === 250, `built node cost → ${unBuild.cost}`);
ok(unBuild.currencyType === "gold", `built node currency → ${unBuild.currencyType}`);
ok(
    JSON.stringify(unBuild.requires) === JSON.stringify(["md-my-hown-mod:base"]),
    `built node requires → ${JSON.stringify(unBuild.requires)}`,
);

// 44. modifiers — an undocumented hook id survives via the companion box
const moBack = S.formToEntry("modifiers", {
    ...S.entryToForm("modifiers", {
        id: "md-my-hown-mod:mo",
        hookId: "element:update",
        kind: "intercept",
        handlerKey: "onUpdate",
        enabled: true,
    }),
}) as Record<string, unknown>;
ok(moBack.hookId === "element:update", `modifier hookId → ${moBack.hookId}`);
ok(moBack.kind === "intercept", `modifier kind → ${moBack.kind}`);
ok(moBack.enabled === true, `modifier enabled → ${moBack.enabled}`);
const moOddForm = S.entryToForm("modifiers", {
    id: "md-my-hown-mod:mo",
    hookId: "notdocumented:thing",
});
ok(
    moOddForm.hookId === "__custom__" && moOddForm.hookCustom === "notdocumented:thing",
    `an undocumented hook did not reach the companion box: ${moOddForm.hookId} / ${moOddForm.hookCustom}`,
);
const moOdd = S.formToEntry("modifiers", moOddForm) as Record<string, unknown>;
ok(moOdd.hookId === "notdocumented:thing", `an undocumented hook became ${moOdd.hookId}`);

// 45. sprites — a path, a flag, and nothing else
const spBack = S.formToEntry("sprites", {
    ...S.entryToForm("sprites", {
        id: "sprites:crusher",
        path: "assets/icons/crusher.png",
        fromMod: true,
    }),
}) as Record<string, unknown>;
ok(spBack.path === "assets/icons/crusher.png", `sprite path → ${spBack.path}`);
ok(spBack.fromMod === true, `sprite fromMod → ${spBack.fromMod}`);
// `source` and `options` are claimed by nobody, so they must pass through
const spExtra = S.formToEntry("sprites", {
    ...S.entryToForm("sprites", {
        id: "sprites:c",
        path: "a.png",
        source: "mod",
        options: { scale: 2 },
    }),
}) as Record<string, unknown>;
ok(
    spExtra.source === "mod" && JSON.stringify(spExtra.options) === '{"scale":2}',
    `a sprite lost an unowned field: ${JSON.stringify(spExtra)}`,
);

// 46. no definition claims a key that nothing handles
//
// `formCovered` is a promise: "this form owns these stored keys". The passthrough
// skips every claimed key, so a key that is claimed but read by neither
// `entryToForm` nor written by `formToEntry` is deleted on the next save — and
// nothing looks wrong, because the entry renders and saves without error.
//
// That is the shape of the bugs this check was written for: a trigger's
// `triggerId` (claimed, no control, silently deleted) and a category's
// `requirement` (claimed, read into a control that could not save it back).
//
// A claimed key counts as handled if any of these holds, because `formCovered`
// means two slightly different things and a probe can only see one:
//
//   - it reaches a control on the way in, or comes back out on the way out;
//   - it IS a control — a claimed key that is also a declared field is owned by
//     construction (an unlock node's `cost`);
//   - it lives inside a composed control — a structure's `dirH` is a checkbox
//     folded into `buildModes[].directions`, and its `shape` is edited through a
//     `shapeJson` box, so neither is a top-level entry key nor a field of the
//     same name. Listed rather than guessed.
const KEYS_INSIDE_A_COMPOSED_CONTROL = new Set([
    "buildModes",
    "spanTiles",
    "dirH",
    "dirV",
    "dirD",
    "shape",
]);

/**
 * Claimed on purpose, with no control, and dropped on purpose.
 *
 * A structure's `draw` is the engine's *callback* field: the host sets it to a
 * function, and `passthroughOf` already refuses to carry functions. `drawKey` is
 * the serialisable spelling — a picker over the built-in draw functions whose own
 * hint says a hand-typed value is ignored by the game. So a `draw` that reaches
 * the JSON store at all is a string the engine does not read, and mapping it
 * onto `drawKey` would be guessing at an intent. Claiming it keeps a dead key
 * from also being carried twice.
 *
 * Listed rather than fixed: this check is about *accidental* orphans, and this is
 * the one claim in the panel that is deliberate.
 */
const CLAIMED_TO_SUPPRESS = new Set(["draw"]);

// The write probe fills every control, with enums and shapes set to legal
// values — a form whose `kind` is "7" legitimately takes no conditional branch,
// which says nothing about whether a key is orphaned.
const PROBE_ENUMS: Record<string, string> = { kind: "tech", type: "storage" };
for (const [tab, def] of Object.entries(DEFINITIONS)) {
    const t = tab as never;
    const controlKeys = new Set(S.fieldsFor(t).map((f) => f.key));
    for (const key of def.formCovered) {
        // read: one distinctive marker, on its own, so attribution is exact
        const marker = `orphan-probe-${key}`;
        const readForm = S.entryToForm(t, { id: "md-my-hown-mod:probe", [key]: marker });
        const isRead = Object.values(readForm).some((v) => String(v).includes(marker));

        // written: a fully-filled form must produce the key in the entry
        const full = S.newEntryForm(t);
        for (const f of S.fieldsFor(t)) {
            if (f.kind === "bool") full[f.key] = "true";
            else if (f.kind === "json") {
                full[f.key] = f.jsonType === "array"
                    ? "[1]"
                    : f.jsonType === "matrix"
                    ? "[[1]]"
                    : "{}";
            } else if (f.kind === "color") full[f.key] = "#ff8800";
            else if (f.kind === "shape") full[f.key] = "1,1,0,0";
            else full[f.key] = PROBE_ENUMS[f.key] ?? "7";
        }
        full.idSuffix = "probe";
        const isWritten = key in (S.formToEntry(t, full) as Record<string, unknown>);

        ok(
            isRead || isWritten || controlKeys.has(key) ||
                KEYS_INSIDE_A_COMPOSED_CONTROL.has(key) || CLAIMED_TO_SUPPRESS.has(key),
            `${tab}.formCovered claims "${key}" but no control owns it and neither ` +
                "direction reads or writes it — the passthrough skips it, so a save deletes it",
        );
    }
}

if (failures.length === 0) {
    console.log("definition check: all 46 passed");
} else {
    console.error(`definition check: ${failures.length} FAILED`);
    for (const f of failures) console.error(` - ${f}`);
    Deno.exit(1);
}
