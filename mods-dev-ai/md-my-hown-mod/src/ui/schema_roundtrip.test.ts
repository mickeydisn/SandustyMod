/**
 * Round-trip test for the schema mapping layer.
 *   deno run -A src/ui/schema_roundtrip.test.ts
 * Stubs the host sandkit surface so the pure form⇄entry logic can run headless.
 */
// @ts-nocheck
const store: Record<string, unknown> = {};
globalThis.sandkit = {
    api: {
        // NOTE: the real host signature is (modId, key) / (modId, key, value) —
        // it namespaces per mod. The stub must match, or every test that reads
        // stored config silently sees an empty one and passes vacuously.
        storage: {
            ensure: () => {},
            get: (_modId: string, k: string) => store[k],
            set: (_modId: string, k: string, v: unknown) => {
                store[k] = v;
            },
            remove: (_modId: string, k: string) => {
                delete store[k];
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

const { entryToForm, formToEntry, formDefaults, validateForm, fieldsFor, normalizeShape, resolveAutoFill, autoGraphicsKey, MENU_GROUPS, parseBuildModes } =
    await import("./schema.ts");
const { searchLibraryAssets, listLibraryAssets } = await import("../catalog.ts");

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
        // `shape` is intentionally normalised to a 4×4 0/1 grid, so compare the
        // round-tripped value against its normalised form rather than the raw input.
        const want = k === "shape" ? normalizeShape(v) : v;
        const same = JSON.stringify(got) === JSON.stringify(want);
        check(`${cat}.${k}`, same, `expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
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
    // Shapes are normalised to a 4×4 grid of 0/1 (see normalizeShape), so a
    // 2×2 fixture must come back padded rather than preserved verbatim.
    shape: [[1, 0], [1, 1]],
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

// The engine throws `TypeError("Structure build mode spanTiles is only valid for
// line modes.")`, so the form must not be able to produce that pairing.
{
    const f = formDefaults("structures");
    f.idSuffix = "conveyor";
    // The build modes are a list now, so the rule is checked per row.
    f.buildModesJson = JSON.stringify([{ type: "rectangle", spanTiles: 3 }]);
    check(
        "a span on a non-line mode is rejected (the engine throws)",
        !!validateForm("structures", f).buildModesJson,
    );

    f.buildModesJson = JSON.stringify([{ type: "line", spanTiles: 3 }]);
    check(
        "a span on a line mode is allowed",
        !validateForm("structures", f).buildModesJson,
    );

    // A second mode must survive the round trip. It used not to: the form
    // collapsed buildModes to [0], so a line mode added alongside a single
    // mode was dropped on save without a word.
    const two: Record<string, string> = { ...f, buildModesJson: JSON.stringify([{ type: "single" }, { type: "line", spanTiles: 4 }]) };
    const entry = formToEntry("structures", two) as { buildModes?: unknown };
    check(
        "a second build mode survives the round trip",
        Array.isArray(entry.buildModes) && entry.buildModes.length === 2,
        JSON.stringify(entry.buildModes),
    );

    // spanTiles off a line mode would make the engine throw on register, so
    // the parser drops it rather than letting it reach the game.
    const stripped = parseBuildModes(JSON.stringify([{ type: "rectangle", spanTiles: 3 }]));
    check(
        "spanTiles is stripped from a non-line mode",
        stripped[0]?.spanTiles === undefined,
        JSON.stringify(stripped),
    );
    check(
        "directions are written onto every mode",
        parseBuildModes(JSON.stringify([{ type: "single" }, { type: "line" }]), ["horizontal"]).every((m) =>
            Array.isArray(m.directions) && m.directions.length === 1
        ),
    );
    check(
        "an unparseable list yields nothing rather than guessing",
        parseBuildModes("not json").length === 0,
    );
}

roundTrip("structures", {
    id: "md-my-hown-mod:mdmy.structure.press",
    name: "Press",
    description: "Presses things",
    descriptionKey: "mods|example|press|desc",
    descriptionParams: { force: 12 },
    linkedClearance: "allOrNothing",
    rejectWhenBlocked: true,
    tooltipHover: {
        type: "custom",
        dataFieldMessage: { messageKey: "mods|example|pressTip", fields: [] },
    },
    variants: [{ id: "mdmy.structure.press", angles: [0, 90] }],
    blockGridType: "mdmy.structure.press",
    skipCopyData: true,
    defaultData: { throughput: 2 },
    // `draw` is a function on the engine side and cannot live in JSON, so the
    // stored form is a key that apply.ts swaps for the real function. The old
    // fixture wrote a `{ kind: "ghost" }` object, which the engine would have
    // treated as a non-function and silently stopped drawing for.

    drawKey: "hidden",
    shape: [[1]],
});

// `colorHSL` is a [number, number, number] tuple, so the form uses three
// number controls gated by a toggle. Without the gate an untouched form would
// emit 0,0,0 and paint every terrain black.
{
    const f = formDefaults("terrains");
    f.idSuffix = "ore";
    f.name = "Ore";
    const clean = formToEntry("terrains", f);
    check(
        "terrains.colorHSL omitted when the toggle is off",
        clean.colorHSL === undefined,
        JSON.stringify(clean),
    );

    f.colorHSLOn = "true";
    f.colorHSLHue = "210";
    f.colorHSLSaturation = "0.5";
    f.colorHSLLightness = "0.4";
    const hsl = formToEntry("terrains", f).colorHSL;
    check(
        "terrains.colorHSL written as a 3-tuple when enabled",
        JSON.stringify(hsl) === JSON.stringify([210, 0.5, 0.4]),
        JSON.stringify(hsl),
    );
}

roundTrip("terrains", {
    id: "md-my-hown-mod:mdmy.terrain.ore",
    name: "Ore",
    nameKey: "mods|example|terrain|ore",
    hp: 250,
    materialId: 12,
    colorHSL: [210, 0.5, 0.4],
    excavationRequirements: ["mdmy.item.drill"],
    interactions: [{ kind: "info", text: "Hard rock" }],
    flammable: false,
});

roundTrip("inputs", {
    id: "md-my-hown-mod:ToggleMode",
    displayName: "Toggle mode",
    displayNameKey: "mods|example|toggle",
    category: "Mod controls",
    defaultKeys: ["Control+KeyC", "KeyO"],
    onDownKey: "handlers.toggleMode",
    onUpKey: "handlers.releaseMode",
    subsection: { titleKey: "mods|example|controlsTitle" },
});

roundTrip("structures", {
    id: "md-my-hown-mod:mdmy.structure.belt",
    name: "Belt",
    blockGridType: "mdmy.structure.belt",
    skipCopyData: true,
    defaultData: { throughput: 2 },
    drawKey: "hidden",
    shape: [[1]],
});

roundTrip("categories", {
    id: "md-my-hown-mod:tools",
    name: "Tools",
    nameKey: "mods|example|tools|name",
    requirement: { techId: "mdmy.tech.t1" },
});

// The engine guard is `if (!t.id || !t.name && !t.nameKey) throw`, so a
// category with neither must not be submittable. Before this tab existed the
// only way to create one was hand-editing JSON, so the throw was unavoidable.
{
    const f = formDefaults("categories");
    f.idSuffix = "tools";
    const errs = validateForm("categories", f);
    check("categories.name required without a name key", !!errs.name, JSON.stringify(errs));

    f.nameKey = "mods|example|tools|name";
    const ok = validateForm("categories", f);
    check("categories.name key alone is enough", !ok.name && !ok.nameKey, JSON.stringify(ok));
}

roundTrip("energy", {
    id: "md-my-hown-mod:mdmy.energy.solar",
    structureId: "mdmy.structure.panel",
    type: "storage",
    options: { capacity: 5000, energyType: "power", priority: 10 },
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

roundTrip("sprites", {
    id: "sprites:icon-alien",
    path: listLibraryAssets()[0]?.path,
    fromMod: true,
});

roundTrip("interactions", {
    id: "md-my-hown-mod:mdmy.interaction.axe",
    elementId: "mdmy.element.rock",
    interaction: { tool: "axe", action: "break" },
});

roundTrip("processing", {
    id: "md-my-hown-mod:mdmy.process.crusher",
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
    // advancedJson is a real free-JSON field. colorsJson used to be tested here
    // too, but it is a swatch list now, so it cannot hold malformed text at all.
    form.advancedJson = "{not json";
    const errs = validateForm("elements", form);
    check("malformed JSON rejected", !!errs.advancedJson, JSON.stringify(errs));
    check("malformed JSON rejected", !!errs.advancedJson, JSON.stringify(errs));
}
{
    // The colour-variant list, against the exact tuples a shipping mod stores
    // (`__scraped-mods/workshop/3790149867`).
    const sh = await import("./schema.ts");
    const raw = JSON.stringify([
        [153, 207, 184, 255],
        [239, 240, 197, 200],
    ]);
    check(
        "variants decode to hex swatches",
        JSON.stringify(sh.variantsToHexList(raw)) ===
            JSON.stringify(["#99cfb8ff", "#eff0c5c8"]),
        JSON.stringify(sh.variantsToHexList(raw)),
    );
    check(
        "variants survive a round trip through hex",
        JSON.stringify(sh.hexListToVariants(sh.variantsToHexList(raw))) ===
            JSON.stringify([[153, 207, 184, 255], [239, 240, 197, 200]]),
    );
    check(
        "the { variants: [...] } wrapper form is accepted too",
        sh.variantsToHexList(JSON.stringify({ variants: [[1, 2, 3, 4]] }))[0] === "#01020304",
    );
    check(
        "a 3-tuple defaults to opaque rather than being dropped",
        // The engine docs say [r,g,b,a], but a hand-written 3 is a natural
        // mistake and dropping the whole row loses the colour silently.
        sh.variantsToHexList("[[10,20,30]]")[0] === "#0a141eff",
    );
    check(
        "out-of-range channels are clamped, not wrapped",
        sh.variantsToHexList("[[300, -5, 128, 999]]")[0] === "#ff0080ff",
    );
    check(
        "a malformed row is skipped, not rendered as black",
        sh.variantsToHexList('[[1,2],"x",[9,9,9,9]]').length === 1,
    );
    check("unparseable variants yield no swatches", sh.variantsToHexList("{nope").length === 0);
    check("empty yields no swatches", sh.variantsToHexList(undefined).length === 0);
    check(
        "a new variant is seeded from the map colour",
        sh.seedVariantFromMapColor("#123456") === "#123456ff",
    );
    check(
        "seeding without a map colour still offers a usable swatch",
        /^#[0-9a-f]{8}$/.test(sh.seedVariantFromMapColor(undefined)),
        sh.seedVariantFromMapColor(undefined),
    );
    check(
        "a nonsense map colour does not become a nonsense swatch",
        /^#[0-9a-f]{8}$/.test(sh.seedVariantFromMapColor("notacolor")),
    );
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

console.log("── bundled asset library picker ──");
{
    const all = listLibraryAssets();
    check("library is populated", all.length > 0, `${all.length} icons`);
    check(
        "library paths are mod-relative assets",
        all.every((a) => a.path.startsWith("assets/icons/")),
        all[0]?.path,
    );
    check(
        "library entries have sizes",
        all.every((a) => Array.isArray(a.sizes) && a.sizes.length > 0),
    );
    check(
        "library is sorted by name",
        all.every((a, i) => i === 0 || all[i - 1].name.localeCompare(a.name) <= 0),
    );
}
{
    // Search is a case-insensitive substring match. Uses a real asset picked from
    // the catalog so the test does not depend on any particular icon existing.
    const sample = listLibraryAssets()[0];
    check("catalog has a sample asset", !!sample?.name, "catalog empty");
    const upper = sample.name.toUpperCase();
    const hit = searchLibraryAssets(upper);
    check("search is case-insensitive", hit.some((a) => a.name === sample.name), JSON.stringify(hit.map((a) => a.name)));
    const none = searchLibraryAssets("zzz-no-such-icon-zzz");
    check("search misses return empty", none.length === 0, `${none.length}`);
    check("empty query returns all", searchLibraryAssets("").length === listLibraryAssets().length);
    check("query is trimmed", searchLibraryAssets(`  ${sample.name}  `).length > 0);
}
{
    // A picked asset must validate as a library field…
    const asset = listLibraryAssets()[0];
    const form = formDefaults("sprites");
    form.idSuffix = autoGraphicsKey(asset.name).replace("sprites:", "");
    form.path = asset.path;
    const errs = validateForm("sprites", form);
    check("picked asset validates", !errs.path, JSON.stringify(errs));
}
{
    // …and a hand-typed / imported path must be rejected.
    const form = formDefaults("sprites");
    form.idSuffix = "some-asset";
    form.path = "assets/icons/does-not-exist-2x2.png";
    const errs = validateForm("sprites", form);
    check("unknown asset path rejected", !!errs.path, JSON.stringify(errs));
    form.path = "../../etc/passwd";
    check("path traversal rejected", !!validateForm("sprites", form).path);
}
{
    // Missing path is still "required".
    const form = formDefaults("sprites");
    form.idSuffix = "some-asset";
    form.path = "";
    check("empty asset path rejected", !!validateForm("sprites", form).path);
}
{
    // autoGraphicsKey derives the engine graphics key from the asset name.
    check(
        "autoGraphicsKey namespaces",
        autoGraphicsKey("my-icon") === "sprites:my-icon",
        autoGraphicsKey("my-icon"),
    );
}
{
    // resolveAutoFill: fill when empty, replace our own previous value, never
    // clobber a hand-typed one.
    check("fills empty field", resolveAutoFill("", undefined, "sprites:a") === "sprites:a");
    check("fills undefined field", resolveAutoFill(undefined, undefined, "sprites:a") === "sprites:a");
    check(
        "replaces previous auto value",
        resolveAutoFill("sprites:a", "sprites:a", "sprites:b") === "sprites:b",
    );
    check(
        "preserves hand-typed value",
        resolveAutoFill("sprites:custom", "sprites:a", "sprites:b") === null,
    );
    check(
        "preserves hand-typed value with no prior auto",
        resolveAutoFill("sprites:custom", undefined, "sprites:b") === null,
    );
}
{
    // The sprite form must actually expose a library field bound to the graphics key.
    const pathField = fieldsFor("sprites").find((f) => f.key === "path");
    check("sprite path is a library field", pathField?.kind === "library", pathField?.kind);
    check("library field auto-fills the graphics key", pathField?.autoKey === "idSuffix", pathField?.autoKey);
}

console.log("── excavation terrain rules ──");
{
    const back = roundTrip("excavation", {
        id: "md-my-hown-mod:mdmy.excavation.drill",
        power: 10,
        pattern: [[1, 1, 1]],
        options: { fromDrill: true },
        terrainRules: [{ cellType: "dune", outputElementType: "sand", damage: 5 }],
    });
    check("terrainRules round-trips", Array.isArray(back.back.terrainRules), JSON.stringify(back.back.terrainRules));
    const f = fieldsFor("excavation").find((x) => x.key === "terrainRulesJson");
    check("terrainRules field exists", f?.kind === "terrainRules", f?.kind);

    const form = formDefaults("excavation");
    form.idSuffix = "drill";
    form.terrainRulesJson = JSON.stringify([{ damage: 5 }]);
    check("rule without a terrain is rejected", !!validateForm("excavation", form).terrainRulesJson);
    form.terrainRulesJson = JSON.stringify([{ cellType: "dune", damage: "abc" }]);
    check("non-numeric damage rejected", !!validateForm("excavation", form).terrainRulesJson);
    form.terrainRulesJson = JSON.stringify([{ cellType: "dune", damage: 5 }]);
    check("valid rule accepted", !validateForm("excavation", form).terrainRulesJson);
    form.terrainRulesJson = JSON.stringify([]);
    check("empty rule list accepted", !validateForm("excavation", form).terrainRulesJson);
    // An empty list must not create a spurious empty array in storage.
    const empty = formToEntry("excavation", form);
    check("empty rules are not stored", empty.terrainRules === undefined, JSON.stringify(empty.terrainRules));
}

console.log("── upgrades use the NESTED definition shape ──");
{
    const back = roundTrip("upgrades", {
        id: "md-my-hown-mod:mdmy.upgrade.wrench2",
        itemId: "mdmy.item.wrench",
        categoryId: "tools",
        upgrade: { id: "lvl2", maxLevel: 3, costs: [100, 250, 500], oneOff: true },
    });
    const u = back.back.upgrade;
    check("upgrade is nested under `upgrade`", u && typeof u === "object", JSON.stringify(back.back.upgrade));
    check("upgrade.id round-trips", u?.id === "lvl2", JSON.stringify(u));
    check("upgrade.costs round-trips", JSON.stringify(u?.costs) === "[100,250,500]", JSON.stringify(u?.costs));
    check("upgrade.oneOff round-trips", u?.oneOff === true, JSON.stringify(u?.oneOff));
    check("no flat upgradeJson leaks", back.back.upgradeJson === undefined);

    const keys = fieldsFor("upgrades").map((f) => f.key);
    for (const k of ["upgradeId", "maxLevel", "costsJson", "oneOff"]) {
        check(`upgrades exposes ${k}`, keys.includes(k));
    }
    check("upgrades dropped the JSON blob field", !keys.includes("upgradeJson"));

    const form = formDefaults("upgrades");
    form.idSuffix = "x";
    form.costsJson = "{not an array}";
    check("non-array costs rejected", !!validateForm("upgrades", form).costsJson);
    form.costsJson = "[1, 2, 3]";
    check("array costs accepted", !validateForm("upgrades", form).costsJson);
}

console.log("── tech unlocks are declarative ──");
{
    const back = roundTrip("techs", {
        id: "md-my-hown-mod:mdmy.tech.tier1",
        name: "Tier 1",
        cost: 100,
        unlocks: { structures: ["mdmy.structure.a"], items: ["mdmy.item.b"] },
        requires: ["mdmy.tech.base"],
    });
    check(
        "unlocks round-trip",
        JSON.stringify(back.back.unlocks) ===
            JSON.stringify({ structures: ["mdmy.structure.a"], items: ["mdmy.item.b"] }),
        JSON.stringify(back.back.unlocks),
    );
    check(
        "requires round-trip",
        JSON.stringify(back.back.requires) === '["mdmy.tech.base"]',
        JSON.stringify(back.back.requires),
    );
    const form = formDefaults("techs");
    form.idSuffix = "t";
    form.unlockStructures = "a, b ,c";
    form.unlockItems = "";
    const e = formToEntry("techs", form);
    check(
        "comma list becomes an array",
        JSON.stringify(e.unlocks?.structures) === '["a","b","c"]',
        JSON.stringify(e.unlocks),
    );
    check("empty list is omitted", e.unlocks?.items === undefined, JSON.stringify(e.unlocks));
}

console.log("── item fields are type-aware ──");
{
    const isActiveFor = (itemType, key) => {
        const f = fieldsFor("items").find((x) => x.key === key);
        return typeof f?.when === "function" ? f.when({ itemType }) : true;
    };
    check("Tool sees the excavation profile", isActiveFor("Tool", "excavationProfileId"));
    check("Weapon hides the excavation profile", !isActiveFor("Weapon", "excavationProfileId"));
    check("Weapon sees a projectile", isActiveFor("Weapon", "projectileId"));
    check("Tool hides the projectile", !isActiveFor("Tool", "projectileId"));
    check("Consumable hides cooldown", !isActiveFor("Consumable", "cooldownMs"));
    check("Tool keeps cooldown", isActiveFor("Tool", "cooldownMs"));

    const typeField = fieldsFor("items").find((f) => f.key === "itemType");
    const vals = typeField.options.map((o) => o.value);
    for (const v of ["Weapon", "Tool", "Consumable", "Mod"]) {
        check(`itemType offers ${v}`, vals.includes(v));
    }
    const back = roundTrip("items", {
        id: "md-my-hown-mod:mdmy.item.gun",
        name: "Gun",
        itemType: "Weapon",
        projectileId: "mdmy.proj.bolt",
        // `sprite.type` has a form default ("onehand"), so it materialises on save
        // even when the stored entry omits it — the sprite id must still survive.
        sprite: { id: "sprites:bolt", type: "onehand" },
    });
    check(
        "weapon projectileId round-trips",
        back.back.projectileId === "mdmy.proj.bolt",
        String(back.back.projectileId),
    );
    check("weapon sprite id round-trips", back.back.sprite?.id === "sprites:bolt", JSON.stringify(back.back.sprite));
}

console.log("── handler pickers are domain-scoped and described ──");
{
    const H = await import("../hooks/handlers.ts");
    (globalThis).__mdHandlers = {
        ANY_HANDLERS: H.ANY_HANDLERS,
        PROCESS_HANDLERS: H.PROCESS_HANDLERS,
        ANY_HANDLER_DOCS: H.ANY_HANDLER_DOCS,
        PROCESS_HANDLER_DOCS: H.PROCESS_HANDLER_DOCS,
    };
    const cat = await import("../catalog.ts");
    const pickers = [
        ["signal", cat.listSignalHandlerKeys, "signalLog"],
        ["trigger", cat.listTriggerHandlerKeys, "triggerLog"],
        ["projectile", cat.listProjectileHandlerKeys, "projectileFast"],
        ["upgrade", cat.listUpgradeHandlerKeys, "upgradeScale"],
    ];
    for (const [name, fn, expectSome] of pickers) {
        const opts = fn();
        check(`${name} picker is non-empty`, opts.length > 0, `${opts.length}`);
        check(
            `${name} picker offers ${expectSome}`,
            opts.some((o) => o.value === expectSome),
            JSON.stringify(opts.map((o) => o.value)),
        );
        check(
            `${name} picker keys all exist`,
            opts.every((o) => o.value in H.ANY_HANDLERS),
            JSON.stringify(opts.map((o) => o.value)),
        );
        check(`${name} picker labels carry a description`, opts.every((o) => o.label.includes("—")), opts[0]?.label);
    }
    const proc = cat.listDescribedProcessorKeys();
    check("processor picker non-empty", proc.length > 0, `${proc.length}`);
    check("processor picker keys all exist", proc.every((o) => o.value in H.PROCESS_HANDLERS));
    check("processor picker labels described", proc.every((o) => o.label.includes("—")), proc[0]?.label);
    check("handlerDoc returns text", !!cat.handlerDoc("signalLog"), String(cat.handlerDoc("signalLog")));
    check("handlerDoc unknown is undefined", cat.handlerDoc("nope") === undefined);

    for (const c of ["signals", "triggers", "processing"]) {
        check(`${c} has a handlerKey`, !!fieldsFor(c).find((f) => f.key === "handlerKey"));
    }
    check("projectiles expose getOptionsKey", !!fieldsFor("projectiles").find((f) => f.key === "getOptionsKey"));
}

console.log("── no fabricated engine fields (6.1) ──");
{
    // `unlockedBy` was exposed as a structure field but exists in NO sandkit
    // .d.ts. Guard against that class of invention recurring.
    check("structures dropped unlockedBy", !fieldsFor("structures").some((f) => f.key === "unlockedBy"));
    const round = roundTrip("structures", {
        id: "md-my-hown-mod:mdmy.structure.crusher",
        name: "Crusher",
        categoryKey: "production",
        alwaysUnlocked: true,
    });
    check("unlockedBy never reappears on save", round.back.unlockedBy === undefined, JSON.stringify(round.back.unlockedBy));
    check("alwaysUnlocked still round-trips", round.back.alwaysUnlocked === true, JSON.stringify(round.back.alwaysUnlocked));
    // and the JSON schema hints no longer advertise it
    const { FIELD_HELP } = await import("../constants.ts");
    check(
        "field help omits unlockedBy",
        !JSON.stringify(FIELD_HELP.structures).includes("unlockedBy"),
        JSON.stringify(FIELD_HELP.structures),
    );
}

console.log("── typed handler registry (9.1 / 9.5 / 9.6) ──");
{
    const reg = await import("../hooks/handler-registry.ts");
    const hooks = await import("../hooks/handlers.ts");

    // Every callable reachable from JSON must be described exactly once.
    const real = [
        ...Object.keys(hooks.ANY_HANDLERS),
        ...Object.keys(hooks.PROCESS_HANDLERS),
        ...Object.keys(hooks.CODE_HANDLERS),
    ];
    const known = reg.HANDLER_META.map((m) => m.key);
    const missing = real.filter((k) => !known.includes(k));
    const phantom = known.filter((k) => !real.includes(k));
    const dupes = known.filter((k, i) => known.indexOf(k) !== i);
    check("no handler missing from the registry", missing.length === 0, missing.join(" "));
    check("no phantom handler in the registry", phantom.length === 0, phantom.join(" "));
    check("no duplicate registry rows", dupes.length === 0, dupes.join(" "));

    // 9.3 — every handler reads a documented description.
    const docs = hooks.allHandlerDocs();
    const undoc = known.filter((k) => !docs[k]);
    check("every handler is documented", undoc.length === 0, undoc.join(" "));

    // 7.3 / 9.6 — no consumable handler ships.
    check("itemConsume is gone (ActionType has no Consumable)", !("itemConsume" in hooks.ANY_HANDLERS));
    check("itemConsume is not in the registry", !known.includes("itemConsume"));

    // Every slot is non-empty, and the old hand-kept lists are reproduced.
    const slots = ["signal", "trigger", "processing", "projectile", "upgrade", "modifier", "itemAction"] as const;
    for (const s of slots) {
        check(`slot "${s}" offers handlers`, reg.handlersForSlot(s).length > 0);
    }
    const keys = (s: typeof slots[number]) => reg.handlersForSlot(s).map((m) => m.key);
    const sameSet = (a: string[], b: string[]) => a.slice().sort().join() === b.slice().sort().join();
    check(
        "signal slot matches the old hardcoded list",
        sameSet(keys("signal"), ["signalLog", "structureInspect", "structureReadData", "structureWriteData", "noop"]),
        keys("signal").join(" "),
    );
    check(
        "projectile slot matches the old hardcoded list",
        sameSet(keys("projectile"), [
            "defaultProjectileOptions",
            "projectileHeavy",
            "projectileFast",
            "projectileHoming",
            "projectileShotgun",
            "projectileExcavate",
            "projectileTerrain",
            "noop",
        ]),
        keys("projectile").join(" "),
    );
    check("triggerScan stays a trigger handler", keys("trigger").includes("triggerScan"));
    // processing resolves through resolveAnyHandler, which spans ANY + PROCESS +
    // CODE handlers, so the real invariant is "every offered key resolves".
    const unresolved = keys("processing").filter((k) => !hooks.resolveAnyHandler(k));
    check("every processing-slot handler resolves to a function", unresolved.length === 0, unresolved.join(" "));

    // 9.5 — a type can never be offered in a slot it cannot serve.
    const mismatch = reg.HANDLER_META.filter((m) => m.slots.length === 0);
    check("every handler declares at least one slot", mismatch.length === 0, mismatch.map((m) => m.key).join(" "));
    const techInSignal = keys("signal").filter((k) => reg.handlerMeta(k)?.type === "tech");
    check("no tech handler leaks into the signal slot", techInSignal.length === 0, techInSignal.join(" "));
    const projInProcessing = keys("processing").filter((k) => reg.handlerMeta(k)?.type === "projectile");
    check("no projectile handler leaks into processing", projInProcessing.length === 0, projInProcessing.join(" "));

    // 9.3 — parameter validation.
    const write = reg.handlerMeta("structureWriteData")!;
    check("both required params reported when missing", reg.validateHandlerParams(write, {}).length === 2, JSON.stringify(reg.validateHandlerParams(write, {})));
    check("valid params produce no errors", reg.validateHandlerParams(write, { field: "charge", value: "5" }).length === 0);
    const drill = reg.handlerMeta("excavationDrill")!;
    check("int constraint enforced", reg.validateHandlerParams(drill, { drillTierDamage: "2.5" }).length === 1, JSON.stringify(reg.validateHandlerParams(drill, { drillTierDamage: "2.5" })));
    check("min constraint enforced", reg.validateHandlerParams(drill, { power: "-1" }).length === 1);
    check("nan rejected", reg.validateHandlerParams(drill, { power: "abc" }).length === 1);
    const opts = reg.buildHandlerOptions(drill, { power: "8", drillTierDamage: "25" });
    check("options are typed, not strings", opts.power === 8 && opts.drillTierDamage === 25, JSON.stringify(opts));
    check("blank options are dropped", Object.keys(reg.buildHandlerOptions(drill, { power: "" })).length === 0);

    // 9.5 — reachability scan over a stored config.
    const cfg = {
        signals: [{ id: "s1", handlerKey: "structureWriteData" }],
        triggers: [{ id: "t1", handlerKey: "techGrantItem" }], // tech handler in a trigger slot
        items: [{ id: "i1", handlerKey: "itemShoot" }],
    };
    const bad = reg.unreachableHandlers(cfg);
    check("mismatched slot is flagged unreachable", bad.length === 1, JSON.stringify(bad));
    check("the flagged one is the tech handler", bad[0]?.key === "techGrantItem", JSON.stringify(bad));
    const idx = reg.usageIndex(cfg);
    check("usage index maps handler -> entries", idx.structureWriteData?.[0]?.id === "s1", JSON.stringify(idx));
    check("usage index covers item actions", idx.itemShoot?.[0]?.id === "i1", JSON.stringify(idx));

    // 9.4 — scopes are declared for every handler.
    check(
        "every handler declares a scope",
        reg.HANDLER_META.every((m) => !!reg.HANDLER_SCOPE_LABELS[m.scope]),
    );
    check("scope labels cover all scopes", reg.HANDLER_SCOPES.every((s) => !!reg.HANDLER_SCOPE_LABELS[s]));
}

console.log("── handlers tab is reachable and wired (9.2) ──");
{
    const sch = await import("./schema.ts");
    const hp = await import("./handlers-panel.ts");
    const reg = await import("../hooks/handler-registry.ts");

    check("handlers is a known tab", "handlers" in sch.CATEGORY_META);
    check("handlers is in a menu group", sch.MENU_GROUPS.some((g) => g.categories.includes("handlers")));
    check("handlers has no config key (it is a browser)", sch.CATEGORY_META.handlers.configKey === undefined);
    check("handlers has no entry form", sch.fieldsFor("handlers").length === 0);
    check("every group category has metadata", sch.MENU_GROUPS.every((g) => g.categories.every((c) => !!sch.CATEGORY_META[c])));
    check("initial tab state is collapsed", hp.initialHandlersState().open === null);

    // defaultParams seeds the form from declared defaults.
    const drill = reg.handlerMeta("excavationDrill")!;
    check("defaultParams uses declared defaults", hp.defaultParams(drill).power === "8", JSON.stringify(hp.defaultParams(drill)));
    check("defaultParams omits params with no default", hp.defaultParams(reg.handlerMeta("structureWriteData")!).field === undefined);

    // The tab renders against a config, groups by type, and shows a warning.
    const el = (t: string, p: unknown, ...c: unknown[]) => ({ t, p, c });
    const node = hp.renderHandlersTab({
        h: el as never,
        cfg: {
            signals: [{ id: "s1", handlerKey: "structureWriteData" }],
            triggers: [{ id: "t1", handlerKey: "techGrantItem" }],
        },
        state: hp.initialHandlersState(),
        setState: () => {},
        onGoTo: () => {},
        onCopy: () => {},
    }) as { t: string; c: unknown[] };
    const flat = JSON.stringify(node);
    check("handlers tab renders its title", flat.includes("Handlers"));
    check("handlers tab renders every type group", reg.allHandlerTypes().every((ty) => flat.includes(reg.HANDLER_TYPE_LABELS[ty])));
    check("handlers tab surfaces the unreachable reference", flat.includes("unusable handler reference"));
    check("handlers tab names the offending handler", flat.includes("techGrantItem"));
}

console.log("── item use actions are type-gated (7.4 / 9.7) ──");
{
    const reg = await import("../hooks/handler-registry.ts");
    const cat = await import("../catalog.ts");
    const hooks = await import("../hooks/handlers.ts");
    const sch = await import("./schema.ts");

    // ActionType has no Consumable, so no handler may be offered for one.
    check("Consumable offers no use action", reg.itemActionHandlersFor("Consumable").length === 0);
    check("catalog returns none for Consumable", cat.listItemActionHandlerKeys("Consumable").length === 0);
    check("catalog returns none for lowercase consumable", cat.listItemActionHandlerKeys("consumable").length === 0);
    check("Tool offers a use action", cat.listItemActionHandlerKeys("Tool").length > 0);
    check("Weapon offers a use action", cat.listItemActionHandlerKeys("Weapon").length > 0);
    check("Mod offers a use action", cat.listItemActionHandlerKeys("Mod").length > 0);

    // Each type only sees handlers it can actually dispatch to.
    const toolKeys = cat.listItemActionHandlerKeys("Tool").map((o) => o.value);
    const weaponKeys = cat.listItemActionHandlerKeys("Weapon").map((o) => o.value);
    const modKeys = cat.listItemActionHandlerKeys("Mod").map((o) => o.value);
    check("Tool sees the excavate action", toolKeys.includes("itemExcavate"), toolKeys.join(" "));
    check("Tool never sees the shoot action", !toolKeys.includes("itemShoot"), toolKeys.join(" "));
    check("Weapon sees the shoot action", weaponKeys.includes("itemShoot"), weaponKeys.join(" "));
    check("Weapon never sees the excavate action", !weaponKeys.includes("itemExcavate"), weaponKeys.join(" "));
    check("Mod never sees the dig presets", !modKeys.includes("excavationCrusher"), modKeys.join(" "));
    check("noop is available to every type", toolKeys.includes("noop") && weaponKeys.includes("noop") && modKeys.includes("noop"));
    check("every offered key resolves to a function", [...toolKeys, ...weaponKeys, ...modKeys].every((k) => !!hooks.resolveAnyHandler(k)));

    // The picker is form-aware: options follow the itemType field.
    const field = sch.fieldsFor("items").find((f) => f.key === "handlerKey")!;
    check("item handlerKey field exists", !!field);
    check("field is hidden for Consumable", field.when?.({ itemType: "Consumable" }) === false);
    check("field is shown for Tool", field.when?.({ itemType: "Tool" }) === true);
    check("field is hidden when no type chosen", field.when?.({}) === false);
    const toolOpts = sch.resolveOptions(field, { itemType: "Tool" }).map((o) => o.value);
    const weaponOpts = sch.resolveOptions(field, { itemType: "Weapon" }).map((o) => o.value);
    check("options differ by item type", toolOpts.join() !== weaponOpts.join());
    check("options follow the form's itemType", !toolOpts.includes("itemShoot") && weaponOpts.includes("itemShoot"));

    // Round-trip: the key survives entry → form → entry.
    const rt = roundTrip("items", {
        id: "md-my-hown-mod:mdmy.item.pick",
        name: "Pick",
        itemType: "Tool",
        handlerKey: "itemExcavate",
        sprite: { id: "sprites:pick", type: "onehand" },
    });
    check("item handlerKey round-trips", rt.back.handlerKey === "itemExcavate", JSON.stringify(rt.back.handlerKey));

    // A Consumable must never persist one, even if the form hands us one.
    const consumed = formToEntry("items", {
        idSuffix: "juice",
        name: "Juice",
        itemType: "Consumable",
        handlerKey: "itemShoot",
        spriteId: "sprites:juice",
    });
    check("consumable never stores a handler", consumed.handlerKey === undefined, JSON.stringify(consumed.handlerKey));
}

console.log("── tech fields are selectors, not free text (Phase 8) ──");
{
    const sch = await import("./schema.ts");
    const cat = await import("../catalog.ts");
    const f = (k: string) => sch.fieldsFor("techs").find((x) => x.key === k)!;

    // 8.1 / 8.2 — currency + branch are pickers with a custom escape hatch.
    for (const k of ["currencyType", "branch"]) check(`${k} is a select`, f(k).kind === "select");
    check("currencyType has a custom box", f("currencyTypeCustom").kind === "text");
    check("branch has a custom box", f("branchCustom").kind === "text");
    check("currency custom box only shows for __custom__", f("currencyTypeCustom").when?.({ currencyType: "__custom__" }) === true);
    check("currency custom box hidden otherwise", f("currencyTypeCustom").when?.({ currencyType: "gold" }) === false);
    check("branch custom box only shows for __custom__", f("branchCustom").when?.({ branch: "__custom__" }) === true);

    // The fabricated hardcoded currency/branch names are gone; options are
    // derived from the config, and "gold" survives (the one id the .d.ts names).
    const curs = cat.listCurrencyTypes().map((o) => o.value);
    const brs = cat.listTechBranches().map((o) => o.value);
    check("gold is offered", curs.includes("gold"), curs.join(" "));
    check("no invented currency names remain", !curs.some((c) => ["auralite", "artifact", "ticket"].includes(c)), curs.join(" "));
    check("currency offers a custom escape", curs.includes("__custom__"));
    check("branch offers a custom escape", brs.includes("__custom__"));
    check("no invented branch names remain", !brs.includes("alien") && !brs.includes("refining"), brs.join(" "));

    // 8.3 / 8.4 — requires + parentId are multi-selects over configured techs.
    check("requires is a multiselect", f("requires").kind === "multiselect");
    check("parentId is a select", f("parentId").kind === "select");
    check("unlockStructures is a multiselect", f("unlockStructures").kind === "multiselect");
    check("unlockItems is a multiselect", f("unlockItems").kind === "multiselect");

    // multiselect round-trips as a real string[]
    const rt = roundTrip("techs", {
        id: "md-my-hown-mod:mdmy.tech.tier2",
        name: "Tier 2",
        cost: 250,
        requires: ["md-my-hown-mod:mdmy.tech.tier1"],
        unlocks: { structures: ["md-my-hown-mod:mdmy.structure.crusher"] },
    });
    check("requires round-trips as an array", Array.isArray(rt.back.requires) && rt.back.requires[0].endsWith("tier1"), JSON.stringify(rt.back.requires));
    check("unlocks.structures round-trips", rt.back.unlocks?.structures?.[0]?.endsWith("crusher") === true, JSON.stringify(rt.back.unlocks));

    // A tech can never require itself: the picker excludes the edited node.
    // Seed the store first, otherwise the list is empty and the check is vacuous.
    const seed = (techs: unknown[]) => {
        store.config = { ...(store.config ?? {}), techs };
    };
    seed([
        { id: "md-my-hown-mod:mdmy.tech.tier1", name: "Tier 1", branch: "industry", currencyType: "gold" },
        { id: "md-my-hown-mod:mdmy.tech.tier2", name: "Tier 2" },
    ]);
    const allIds = cat.listTechIds().map((o) => o.value);
    check("tech list is populated from the config", allIds.length === 2, allIds.join(" "));
    // The form carries the id suffix, not the ":tail" — use the realistic value.
    const ids = cat.listTechIds("mdmy.tech.tier2").map((o) => o.value);
    check("self is excluded from the tech list", !ids.some((i) => i.endsWith("mdmy.tech.tier2")), ids.join(" "));
    check("other nodes remain selectable", ids.some((i) => i.endsWith("mdmy.tech.tier1")), ids.join(" "));

    // Branch + currency options come from the config just seeded.
    check("branch options derive from the config", cat.listTechBranches().map((o) => o.value).includes("industry"), cat.listTechBranches().map((o) => o.value).join(" "));
    seed([{ id: "md-my-hown-mod:mdmy.tech.c", name: "C", currencyType: "weirdcoin" }]);
    check("currency options derive from the config", cat.listCurrencyTypes().map((o) => o.value).includes("weirdcoin"), cat.listCurrencyTypes().map((o) => o.value).join(" "));

    // Guard the over-exclusion trap: a sibling whose id merely *starts* with the
    // excluded tail must stay selectable.
    seed([
        { id: "md-my-hown-mod:mdmy.tech.tier2", name: "Tier 2" },
        { id: "md-my-hown-mod:mdmy.tech.tier2b", name: "Tier 2b" },
    ]);
    const siblings = cat.listTechIds("mdmy.tech.tier2").map((o) => o.value);
    check("a similarly-named sibling is not over-excluded", siblings.some((i) => i.endsWith("mdmy.tech.tier2b")), siblings.join(" "));
    check("self is still excluded alongside a sibling", !siblings.some((i) => i === "md-my-hown-mod:mdmy.tech.tier2"), siblings.join(" "));
    seed([]);

    // Free-text customs survive a round trip through the companion box.
    const cur = roundTrip("techs", {
        id: "md-my-hown-mod:mdmy.tech.custom",
        name: "Custom",
        cost: 10,
        currencyType: "weirdcoin",
        branch: "weirdbranch",
    });
    check("unknown currency is preserved, not dropped", cur.back.currencyType === "weirdcoin", JSON.stringify(cur.back.currencyType));
    check("unknown branch is preserved, not dropped", cur.back.branch === "weirdbranch", JSON.stringify(cur.back.branch));
    check("unknown currency lands in the custom box", cur.form.currencyType === "__custom__" && cur.form.currencyTypeCustom === "weirdcoin", JSON.stringify(cur.form));
    check("known currency stays on the picker", (() => {
        const g = roundTrip("techs", { id: "md-my-hown-mod:mdmy.tech.g", name: "G", cost: 1, currencyType: "gold" });
        return g.form.currencyType === "gold" && g.form.currencyTypeCustom === "";
    })());

    // Setting __custom__ with an empty box clears the value rather than storing
    // the literal sentinel.
    const cleared = formToEntry("techs", {
        idSuffix: "c",
        name: "C",
        cost: "1",
        currencyType: "__custom__",
        currencyTypeCustom: "",
    });
    check("empty custom box stores nothing", cleared.currencyType === undefined, JSON.stringify(cleared.currencyType));
}

console.log("── asset previews are real 16×16 pixels (Phase 10) ──");
{
    const cat = await import("../catalog.ts");
    const styles = await import("./styles.ts");
    const assets = cat.listLibraryAssets();
    check("library is populated", assets.length > 0, String(assets.length));

    // Every entry must carry a usable preview, or the tile renders blank.
    const noPreview = assets.filter((a) => !a.preview?.startsWith("data:image/png;base64,"));
    check("every asset has a PNG data URL preview", noPreview.length === 0, noPreview.map((a) => a.name).join(" "));

    // The declared pixel size must match the real PNG header, and be 16×16.
    const decode = (d: string) => {
        const bin = atob(d.replace(/^data:image\/png;base64,/, ""));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return {
            sig: [137, 80, 78, 71, 13, 10, 26, 10].every((v, k) => bytes[k] === v),
            w: new DataView(bytes.buffer).getUint32(16),
            h: new DataView(bytes.buffer).getUint32(20),
        };
    };
    const badSig = assets.filter((a) => !decode(a.preview).sig);
    check("every preview is a real PNG", badSig.length === 0, badSig.map((a) => a.name).join(" "));
    const badSize = assets.filter((a) => {
        const d = decode(a.preview);
        return d.w !== a.previewW || d.h !== a.previewH;
    });
    check("declared preview size matches the PNG header", badSize.length === 0, badSize.map((a) => a.name).join(" "));
    const not16 = assets.filter((a) => a.previewW !== 16 || a.previewH !== 16);
    check("every icon previews at 16×16", not16.length === 0, not16.map((a) => `${a.name} ${a.previewW}x${a.previewH}`).join(" "));

    // Nearest-neighbour is what keeps the art crisp when scaled up.
    check("sprite scaling is pixelated", styles.spritePixel.imageRendering === "pixelated", String(styles.spritePixel.imageRendering));

    // Searching still works with the heavier entries.
    check("search still matches by name", cat.searchLibraryAssets("alien").some((a) => a.name === "icon-alien"));
    check("search carries previews through", cat.searchLibraryAssets("alien").every((a) => !!a.preview));
}

console.log("── re-applying an edit actually reaches the engine ──");
{
    const apply = await import("../register/apply.ts");
    const calls: { fn: string; a: unknown[] }[] = [];
    const rec = (name: string) => (...a: unknown[]) => {
        calls.push({ fn: name, a });
    };
    // Swap in a fake api surface for the namespaces updateEntry touches.
    const apiNs = (await import("../packages/mysandkit.ts")).api as unknown as Record<string, Record<string, unknown>>;
    const saved: Record<string, Record<string, unknown>> = {};
    for (const ns of ["elements", "structures", "items", "tech", "terrains", "upgrades"]) {
        saved[ns] = apiNs[ns];
        apiNs[ns] = { updateDefinition: rec(ns) };
    }
    try {
        for (const cat of ["elements", "structures", "items", "techs", "terrains", "upgrades"]) {
            const ok = apply.updateEntry(cat, "md-my-hown-mod:x", { id: "md-my-hown-mod:x", name: "New name" });
            check(`${cat} update is accepted`, ok === true);
        }
        check("every category reached the engine", calls.length === 6, JSON.stringify(calls.map((c) => c.fn)));

        // The id must not be duplicated into the partial — the engine keys on it.
        const el = calls.find((c) => c.fn === "elements")!;
        check("id is passed as the key", el.a[0] === "md-my-hown-mod:x", JSON.stringify(el.a[0]));
        check("id is stripped from the partial", !(el.a[1] as Record<string, unknown>).id, JSON.stringify(el.a[1]));
        check("edited fields are sent", (el.a[1] as Record<string, unknown>).name === "New name");

        // Upgrades are keyed by (itemId, nested upgradeId).
        calls.length = 0;
        apply.updateEntry("upgrades", "md-my-hown-mod:u", {
            id: "md-my-hown-mod:u",
            itemId: "md-my-hown-mod:item",
            upgrade: { id: "power" },
            name: "n",
        });
        const up = calls[0];
        check("upgrades pass itemId first", up?.a[0] === "md-my-hown-mod:item", JSON.stringify(up?.a));
        check("upgrades pass the nested upgrade id second", up?.a[1] === "power", JSON.stringify(up?.a));

        // A category with no in-place update must not claim success.
        calls.length = 0;
        const okRecipes = apply.updateEntry("recipes", "md-my-hown-mod:r", { id: "md-my-hown-mod:r" });
        check("a non-updatable category reports failure", okRecipes === false);
        check("a non-updatable category does not call the engine", calls.length === 0);
    } finally {
        for (const ns of Object.keys(saved)) apiNs[ns] = saved[ns];
    }
}

console.log("── handler registry is documented and API-verified ──");
{
    const { ANY_HANDLERS, ANY_HANDLER_DOCS, CODE_HANDLERS, PROCESS_HANDLERS, PROCESS_HANDLER_DOCS } =
        await import("../hooks/handlers.ts");

    // Every generic callback must be documented, or the UI shows a bare key.
    for (const key of Object.keys(ANY_HANDLERS)) {
        check(`ANY_HANDLERS doc: ${key}`, !!ANY_HANDLER_DOCS[key], "missing from ANY_HANDLER_DOCS");
    }
    // …and the docs must not describe handlers that no longer exist.
    for (const key of Object.keys(ANY_HANDLER_DOCS)) {
        check(`ANY_HANDLER_DOCS live: ${key}`, key in ANY_HANDLERS, "no such handler");
    }
    for (const key of Object.keys(PROCESS_HANDLERS)) {
        check(`PROCESS_HANDLERS doc: ${key}`, !!PROCESS_HANDLER_DOCS[key], "missing from PROCESS_HANDLER_DOCS");
    }
    for (const key of Object.keys(PROCESS_HANDLER_DOCS)) {
        check(`PROCESS_HANDLER_DOCS live: ${key}`, key in PROCESS_HANDLERS, "no such handler");
    }

    // Handlers that used non-existent engine APIs must be gone for good.
    const removed = [
        "techUnlockStructure", // called api.tech.unlock — does not exist
        "techGrantUpgrade", // called api.upgrades.apply — does not exist
        "energyGenerator", // producer role is not part of registerType
        "energyConsumer", // consumer role is not part of registerType
        "energyFromTool", // replaced by energyGenerateWhileHeld
        "energyFromProcessor", // replaced by energyConsumePerRun
    ];
    for (const key of removed) {
        check(`removed: ${key}`, !(key in ANY_HANDLERS), "still registered");
    }

    // The verified replacements must exist.
    for (const key of ["techAppendUnlock", "techSetUpgradeLevel", "energyConductor"]) {
        check(`added: ${key}`, key in ANY_HANDLERS, "missing");
    }

    // `commit(mutations)` takes ONE argument, not (x, y, type).
    const commits: unknown[][] = [];
    const ctx = {
        getResolvedTypeAtCell: () => 7,
        commit: (...args: unknown[]) => commits.push(args),
    };
    PROCESS_HANDLERS.processorLift?.({ x: 1, y: 2 }, ctx);
    check("processorLift commit arity", commits[0]?.length === 1, `args=${commits[0]?.length}`);
    commits.length = 0;
    PROCESS_HANDLERS.processorConvert?.({ x: 1, y: 2 }, ctx, { to: 9 });
    check("processorConvert commit arity", commits[0]?.length === 1, `args=${commits[0]?.length}`);

    // drillTierDamage is a number (0–1000), not a boolean flag.
    const drill = ANY_HANDLERS.excavationDrill?.();
    check("drillTierDamage is numeric", typeof drill?.drillTierDamage === "number", String(drill?.drillTierDamage));

    // Energy handlers must only emit documented registerType options.
    const allowed = new Set(["capacity", "energyType"]);
    for (const key of ["energyDefault", "energyBank", "energyWire", "energyConductor", "energyNetwork"]) {
        const out = ANY_HANDLERS[key]?.({} as never, {}) as Record<string, unknown> | undefined;
        const bad = Object.keys(out ?? {}).filter((k) => !allowed.has(k));
        check(`energy opts documented: ${key}`, bad.length === 0, `undocumented: ${bad.join(", ")}`);
    }

    // Modifiers keep their own registry + keys.
    check("CODE_HANDLERS non-empty", Object.keys(CODE_HANDLERS).length > 0);
}

console.log("── schema matches the real engine contracts ──");
{
    const keysOf = (cat) => fieldsFor(cat).map((f) => f.key);
    const optValues = (cat, key) => {
        const f = fieldsFor(cat).find((x) => x.key === key);
        return typeof f?.options === "function" ? f.options() : (f?.options ?? []).map((o) => o.value);
    };

    // energy: only conductor/storage are legal registerType roles.
    const roles = optValues("energy", "type");
    check("energy roles are conductor/storage", roles.length === 2 && roles.includes("conductor") && roles.includes("storage"), JSON.stringify(roles));
    check("energy has no producer role", !roles.includes("producer"));
    check("energy has no consumer role", !roles.includes("consumer"));
    check("energy exposes capacity", keysOf("energy").includes("capacity"));
    check("energy exposes network (energyType)", keysOf("energy").includes("energyType"));
    check("energy drops excludeFromNetwork", !keysOf("energy").includes("excludeFromNetwork"));

    // terrains: `fog` is not a documented terrain property.
    check("terrain has no fog field", !keysOf("terrains").includes("fog"));
    check("terrain still exposes flammable", keysOf("terrains").includes("flammable"));

    // processing: keyed by structureType only — no instance mode exists.
    const p = keysOf("processing");
    check("processing has no mode field", !p.includes("mode"));
    check("processing has no structureId field", !p.includes("structureId"));
    check("processing keys on structureType", p.includes("structureType"));
    check("processing has intervalMs", p.includes("intervalMs"));
    check("processing has handlerKey", p.includes("handlerKey"));

    // sprites: the path is a library field, and there is no hand-typed pattern.
    const spritePath = fieldsFor("sprites").find((f) => f.key === "path");
    check("sprite path is library kind", spritePath?.kind === "library");
    check("sprite path has no manual pattern", !spritePath?.pattern);

    // the World/Tech split: research must not sit under World any more.
    const groups = MENU_GROUPS.map((g) => ({ key: g.key, cats: g.categories }));
    const techGroup = groups.find((g) => g.key === "tech");
    check("there is a Tech group", !!techGroup);
    check("Tech group holds techs+upgrades", techGroup?.cats.includes("techs") && techGroup?.cats.includes("upgrades"));
    const worldGroup = groups.find((g) => g.key === "world");
    check("World no longer holds techs", !worldGroup?.cats.includes("techs"));
    check("World no longer holds upgrades", !worldGroup?.cats.includes("upgrades"));
    // every category must still live in exactly one group
    const allCats = groups.flatMap((g) => g.cats);
    check("no category is orphaned", new Set(allCats).size === allCats.length, JSON.stringify(allCats));
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


console.log("── hover tooltip is a structured editor, not a JSON box ──");
{
    // The documented shape, taken from two shipping mods
    // (`__scraped-mods/workshop/3784291891`, `3792792689`).
    const f = formDefaults("structures");
    f.idSuffix = "reader";
    f.tooltipMessageKey = "structures|reader|status";
    f.tooltipField = "2";
    f.tooltipParam = "summary";
    f.tooltipFallback = "idle";
    const entry = formToEntry("structures", f) as {
        tooltipHover?: Record<string, unknown>;
    };
    check(
        "a hover tooltip is composed from the controls",
        entry.tooltipHover?.type === "custom" &&
            JSON.stringify(entry.tooltipHover) ===
                JSON.stringify({
                    type: "custom",
                    dataFieldMessage: {
                        messageKey: "structures|reader|status",
                        fields: [{ field: 2, param: "summary", fallback: "idle" }],
                    },
                }),
        JSON.stringify(entry.tooltipHover),
    );

    // `Number("")` is 0, and data field 0 does not exist, so the tooltip would
    // be bound to nothing and silently never render.
    const blank = formDefaults("structures");
    blank.idSuffix = "reader";
    blank.tooltipMessageKey = "structures|reader|status";
    blank.tooltipField = "";
    const blankEntry = formToEntry("structures", blank) as {
        tooltipHover?: { dataFieldMessage?: { fields?: unknown[] } };
    };
    check(
        "a blank data field number is not written as field 0",
        blankEntry.tooltipHover?.dataFieldMessage?.fields?.[0] as Record<string, unknown>
            ? (blankEntry.tooltipHover.dataFieldMessage.fields[0] as Record<string, unknown>)
                  .field === undefined
            : false,
        JSON.stringify(blankEntry.tooltipHover),
    );

    const none = formDefaults("structures");
    none.idSuffix = "reader";
    const noneEntry = formToEntry("structures", none) as { tooltipHover?: unknown };
    check("no message key means no tooltip at all", noneEntry.tooltipHover === undefined);

    // An unrepresentable stored object (valueLabels, two field rows) must
    // survive rather than be rebuilt into something the author did not write.
    const exotic = entryToForm("structures", {
        id: "md-my-hown-mod:mdmy.structure.reader",
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                messageKey: "structures|reader|status",
                fields: [
                    { field: "mode", param: "mode", valueLabels: { in: "In", out: "Out" } },
                    { field: "channel", param: "channel" },
                ],
            },
        },
    } as never);
    const exoticBack = formToEntry("structures", exotic) as {
        tooltipHover?: { dataFieldMessage?: { fields?: unknown[] } };
    };
    check(
        "a tooltip the controls cannot express survives a save",
        exoticBack.tooltipHover?.dataFieldMessage?.fields?.length === 2,
        JSON.stringify(exoticBack.tooltipHover),
    );
}

console.log("── an upgrade category's requirement is a pass-through, labelled as one ──");
{
    const f = formDefaults("categories");
    f.idSuffix = "power";
    f.name = "Power";
    f.requirementTechId = "mdmy.tech.tier2";
    const entry = formToEntry("categories", f) as { requirement?: unknown };
    check("a tech requirement is stored as a plain id", entry.requirement === "mdmy.tech.tier2",
        JSON.stringify(entry.requirement));

    // A non-string requirement (a hand-edited config, or one from before the
    // picker existed) falls back to the raw box rather than being dropped.
    const legacy = entryToForm("categories", {
        id: "md-my-hown-mod:mdmy.upgradeCategory.power",
        name: "Power",
        requirement: { techId: "mdmy.tech.tier2" },
    } as never);
    const legacyBack = formToEntry("categories", legacy) as { requirement?: unknown };
    check(
        "an object requirement is kept verbatim",
        JSON.stringify(legacyBack.requirement) === JSON.stringify({ techId: "mdmy.tech.tier2" }),
        JSON.stringify(legacyBack.requirement),
    );
    check("the raw box is shown for an object requirement", legacy.requirementTechId === "__custom__",
        legacy.requirementTechId);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) Deno.exit(1);
