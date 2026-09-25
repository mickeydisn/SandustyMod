/**
 * Round-trip test for the schema mapping layer.
 *   deno run -A src/ui/schema_roundtrip.test.ts
 * Stubs the host sandkit surface so the pure form⇄entry logic can run headless.
 */
// @ts-nocheck
const store: Record<string, unknown> = {};
globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (k: string) => store[k],
            set: (k: string, v: unknown) => {
                store[k] = v;
            },
        },
        ui: { toast: () => {} },
        elements: { list: () => [], register: () => {} },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { entryToForm, formToEntry, formDefaults, validateForm, fieldsFor } = await import(
    "./schema.ts"
);

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail = "") {
    if (cond) {
        pass++;
    } else {
        fail++;
        console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
    }
}

/** entry → form → entry, asserting no field is lost. */
function roundTrip(cat: string, entry: Record<string, unknown>) {
    const form = entryToForm(cat, entry);
    const back = formToEntry(cat, form);
    for (const [k, v] of Object.entries(entry)) {
        const got = back[k];
        const same = JSON.stringify(got) === JSON.stringify(v);
        check(`${cat}.${k}`, same, `expected ${JSON.stringify(v)} got ${JSON.stringify(got)}`);
    }
    return { form, back };
}

console.log("── entry → form → entry ──");

roundTrip("elements", {
    id: "md-my-hown-mod:mdmy.element.gel",
    name: "Gel",
    matterType: "Liquid",
    density: 1200,
    duration: 3.5,
    metaColor: 0xff8ad4,
    colors: { variants: [[255, 138, 212, 255]] },
    flammable: true,
});

roundTrip("structures", {
    id: "md-my-hown-mod:mdmy.structure.crusher",
    name: "Crusher",
    categoryKey: "production",
    order: 5,
    buildModes: [{ type: "line", directions: ["horizontal", "vertical"], spanTiles: 4 }],
    shape: [[1, 0], [1, 1]],
    unlockedBy: "mdmy.tech.tier1",
    render: { imageName: "sprites:crusher" },
    disallowPick: true,
});

roundTrip("items", {
    id: "md-my-hown-mod:mdmy.item.wrench",
    name: "Wrench",
    itemType: "Tool",
    cooldown: 250,
    energyCost: 5,
    sprite: { id: "sprites:wrench", type: "onehand" },
});

roundTrip("recipes", {
    id: "md-my-hown-mod:mdmy.recipe.glass",
    kind: "smelter",
    input: "mdmy.element.sand",
    output: "mdmy.element.glass",
    chance: 0.5,
    outputs: [{ elementType: "mdmy.element.glass", chance: 1 }],
    minimumDownwardVelocity: 2,
});

roundTrip("contacts", {
    id: "md-my-hown-mod:mdmy.contact.acid",
    inputA: "mdmy.element.acid",
    inputB: "mdmy.element.metal",
    outputA: null, // consumed
    outputB: "mdmy.element.gas",
    orientation: "vertical",
});

roundTrip("terrains", {
    id: "md-my-hown-mod:mdmy.terrain.rock",
    name: "Rock",
    hp: 500,
    metaColor: 0x808080,
    output: { elementType: "mdmy.element.rubble", chance: 0.25 },
    flammable: false,
    fog: true,
});

roundTrip("techs", {
    id: "md-my-hown-mod:mdmy.tech.tier1",
    name: "Tier 1",
    cost: 100,
    currencyType: "research",
    branch: "materials",
    requires: ["mdmy.tech.base", "mdmy.tech.other"],
});

roundTrip("upgrades", {
    id: "md-my-hown-mod:mdmy.upgrade.wrench2",
    itemId: "mdmy.item.wrench",
    categoryId: "tools",
    upgrade: { id: "lvl2", maxLevel: 3, costs: [100, 250, 500], oneOff: true },
});

roundTrip("energy", {
    id: "md-my-hown-mod:mdmy.energy.solar",
    structureId: "mdmy.structure.panel",
    type: "producer",
    options: { priority: 10, excludeFromNetwork: true },
});

roundTrip("excavation", {
    id: "md-my-hown-mod:mdmy.excavation.drill",
    power: 10,
    pattern: [[1, 1, 1]],
    options: { radius: 3 },
});

roundTrip("triggers", {
    id: "md-my-hown-mod:mdmy.trigger.tick",
    interval: 60,
    sequentialRuns: 1,
    handlerKey: "onTick",
    extra: { mode: "fast" },
});

roundTrip("sprites", { id: "sprites:crusher", path: "assets/crusher.png", fromMod: true });

roundTrip("interactions", {
    id: "md-my-hown-mod:mdmy.interaction.axe",
    elementId: "mdmy.element.rock",
    interaction: { tool: "axe", action: "break" },
});

roundTrip("processing", {
    id: "md-my-hown-mod:mdmy.process.crusher",
    mode: "register",
    structureType: "mdmy.structure.crusher",
    intervalMs: 100,
    handlerKey: "processorLog",
});

roundTrip("signals", {
    id: "md-my-hown-mod:mdmy.signal.button",
    kind: "interactables",
    target: "mdmy.structure.button",
    handlerKey: "logArgs",
});

roundTrip("behaviors", {
    id: "md-my-hown-mod:mdmy.behavior.belt",
    kind: "conveyor",
    definition: { speed: 2, filter: "mdmy.element.glass" },
});

roundTrip("projectiles", {
    id: "md-my-hown-mod:mdmy.proj.bolt",
    sprite: { id: "sprites:bolt" },
    getOptionsKey: "boltOptions",
    options: { damage: 10 },
});

console.log("── unknown fields are preserved ──");
{
    const { back } = roundTrip("modifiers", {
        id: "md-my-hown-mod:mdmy.mod.speed",
        hookId: "onTick",
        kind: "modify",
        handlerKey: "logArgs",
        notes: "test",
    });
    check("modifiers.hookId", back.hookId === "onTick", String(back.hookId));
}
{
    // A field the form does not know must survive Edit→Save untouched.
    const form = entryToForm("structures", {
        id: "md-my-hown-mod:mdmy.structure.x",
        name: "X",
        blockGridType: "mdmy.x.block",
        rejectWhenBlocked: true,
    });
    const back = formToEntry("structures", form);
    check("passthrough.blockGridType", back.blockGridType === "mdmy.x.block", String(back.blockGridType));
    check(
        "passthrough.rejectWhenBlocked",
        back.rejectWhenBlocked === true,
        String(back.rejectWhenBlocked),
    );
}
{
    // Code callbacks must never be written into JSON storage.
    const form = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.fn",
        kind: "conveyor",
        draw: () => {},
    });
    const back = formToEntry("behaviors", form);
    check("no function in entry", typeof back.draw !== "function", typeof back.draw);
}

console.log("── validation blocks bad input ──");
{
    const form = formDefaults("elements");
    form.idSuffix = "";
    const errs = validateForm("elements", form);
    check("empty id is rejected", !!errs.idSuffix, JSON.stringify(errs));
}
{
    const form = formDefaults("elements");
    form.idSuffix = "Bad_ID!";
    const errs = validateForm("elements", form);
    check("bad id charset is rejected", !!errs.idSuffix, JSON.stringify(errs));
}
{
    const form = formDefaults("elements");
    form.idSuffix = "good";
    form.density = "99999999";
    const errs = validateForm("elements", form);
    check("out-of-range density rejected", !!errs.density, JSON.stringify(errs));
}
{
    const form = formDefaults("elements");
    form.idSuffix = "good";
    form.colorsJson = "{not json";
    const errs = validateForm("elements", form);
    check("malformed JSON rejected", !!errs.colorsJson, JSON.stringify(errs));
}
{
    const form = formDefaults("elements");
    form.idSuffix = "good";
    form.metaColor = "notacolor";
    const errs = validateForm("elements", form);
    check("bad color rejected", !!errs.metaColor, JSON.stringify(errs));
}
{
    const form = formDefaults("modifiers");
    form.idSuffix = "good";
    form.hookId = "";
    const errs = validateForm("modifiers", form);
    check("required hookId rejected when empty", !!errs.hookId, JSON.stringify(errs));
}
{
    const form = formDefaults("modifiers");
    form.idSuffix = "good";
    form.hookId = "__custom__";
    form.hookCustom = "custom:hook";
    const errs = validateForm("modifiers", form);
    check("custom hook accepted", !errs.hookId && !errs.hookCustom, JSON.stringify(errs));
}

console.log("── every category exposes fields ──");
for (
    const cat of [
        "elements",
        "structures",
        "items",
        "recipes",
        "contacts",
        "terrains",
        "techs",
        "modifiers",
    ]
) {
    const fields = fieldsFor(cat);
    check(`${cat} has fields`, fields.length > 0, `${fields.length}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) Deno.exit(1);
