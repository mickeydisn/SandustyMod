

const store: Record<string, unknown> = {};
globalThis.sandkit = {
    api: {
        
        
        
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

const {
    entryToForm,
    formToEntry,
    formDefaults,
    validateForm,
    fieldsFor,
    sectionsFor,
    normalizeShape,
    resolveAutoFill,
    autoGraphicsKey,
    MENU_GROUPS,
    CATEGORY_META,
    parseBuildModes,
} = await import("../schema.ts");
const { ATTACHED } = await import("../panel/attach.ts");
const { searchLibraryAssets, listLibraryAssets } = await import("../../catalog.ts");
const { parseActionRefs } = await import("../definition/actions-field.ts");

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


function roundTrip(cat: string, entry: Record<string, unknown>) {
    const form = entryToForm(cat, entry);
    const back = formToEntry(cat, form);
    for (const [k, v] of Object.entries(entry)) {
        const got = back[k];
        
        
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
    
    
    
    flammable: {
        outputElementId: "md-my-hown-mod:mdmy.element.ash",
        outputChance: 0.5,
        fireInheritsDuration: true,
        duration: [0.05, 0.3],
    },
    
    
    collectable: { value: 2 },
    
    
    
    
    defaultDataFields: { field1: 0, field2: 20, field4: 7 },
});

{
    
    
    
    
    const { form } = roundTrip("elements", { defaultDataFields: { field2: 20 } });
    const rows = JSON.parse(form.dataFieldsJson as string);
    check(
        "elements.dataFieldsJson round trips to one unnamed row",
        rows.length === 1 && rows[0].slot === 2 && rows[0].default === 20,
        JSON.stringify(rows),
    );
    check(
        "elements.dataFieldsJson row name is empty, not invented",
        rows[0].name === "",
        JSON.stringify(rows[0]),
    );
}

roundTrip("structures", {
    id: "md-my-hown-mod:mdmy.structure.crusher",
    name: "Crusher",
    categoryKey: "production",
    order: 5,
    buildModes: [{ type: "line", directions: ["horizontal", "vertical"], spanTiles: 4 }],
    
    
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
    outputA: null, 
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



{
    const f = formDefaults("structures");
    f.idSuffix = "conveyor";
    
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

    
    
    
    const two: Record<string, string> = {
        ...f,
        buildModesJson: JSON.stringify([{ type: "single" }, { type: "line", spanTiles: 4 }]),
    };
    const entry = formToEntry("structures", two) as { buildModes?: unknown };
    check(
        "a second build mode survives the round trip",
        Array.isArray(entry.buildModes) && entry.buildModes.length === 2,
        JSON.stringify(entry.buildModes),
    );

    
    
    
    
    

    const listOnly = formToEntry("structures", {
        ...f,
        dataFieldsJson: JSON.stringify([
            { key: "charge", type: "number", default: 5 },
            { key: "on", type: "bool", default: "true" },
        ]),
    }) as { defaultData?: unknown };
    check(
        "the data list alone writes the engine's object, coerced",
        JSON.stringify(listOnly.defaultData) === JSON.stringify({ charge: 5, on: true }),
        JSON.stringify(listOnly.defaultData),
    );

    
    
    
    const both = formToEntry("structures", {
        ...f,
        dataFieldsJson: JSON.stringify([{ key: "charge", type: "number", default: 5 }]),
        defaultDataJson: JSON.stringify({ charge: 999, other: 1 }),
    }) as { defaultData?: unknown };
    check(
        "an incomplete list does not overwrite the box",
        JSON.stringify(both.defaultData) === JSON.stringify({ charge: 999, other: 1 }),
        JSON.stringify(both.defaultData),
    );

    
    
    const complete = formToEntry("structures", {
        ...f,
        dataFieldsJson: JSON.stringify([{ key: "charge", type: "bool", default: "true" }]),
        defaultDataJson: JSON.stringify({ charge: "false" }),
    }) as { defaultData?: unknown };
    check(
        "a complete list is used, and coerces its own row",
        JSON.stringify(complete.defaultData) === JSON.stringify({ charge: true }),
        JSON.stringify(complete.defaultData),
    );

    
    
    const boxOnly = formToEntry("structures", {
        ...f,
        dataFieldsJson: "",
        defaultDataJson: JSON.stringify({ nested: { a: 1 } }),
    }) as { defaultData?: unknown };
    check(
        "a blank list leaves the box to write",
        JSON.stringify(boxOnly.defaultData) === JSON.stringify({ nested: { a: 1 } }),
        JSON.stringify(boxOnly.defaultData),
    );

    
    
    const neither = formToEntry("structures", {
        ...f,
        dataFieldsJson: "",
        defaultDataJson: "",
    }) as { defaultData?: unknown };
    check("neither filled removes defaultData", !("defaultData" in neither));

    
    
    
    const mixed = roundTrip("structures", { defaultData: { charge: 1, nested: { a: 1 } } });
    const mixedRows = JSON.parse(mixed.form.dataFieldsJson as string);
    check(
        "a nested value produces no list row",
        mixedRows.length === 1 && mixedRows[0].key === "charge",
        JSON.stringify(mixedRows),
    );
    check(
        "the box still holds the nested value",
        JSON.parse(mixed.form.defaultDataJson as string).nested?.a === 1,
        String(mixed.form.defaultDataJson),
    );

    const badRows = {
        ...f,
        dataFieldsJson: JSON.stringify([{ key: "", type: "number", default: 1 }]),
    };
    check(
        "a data row with no key blocks the save",
        !!validateForm("structures", badRows).dataFieldsJson,
    );

    
    
    const stripped = parseBuildModes(JSON.stringify([{ type: "rectangle", spanTiles: 3 }]));
    check(
        "spanTiles is stripped from a non-line mode",
        stripped[0]?.spanTiles === undefined,
        JSON.stringify(stripped),
    );
    check(
        "directions are written onto every mode",
        parseBuildModes(JSON.stringify([{ type: "single" }, { type: "line" }]), ["horizontal"])
            .every((m) => Array.isArray(m.directions) && m.directions.length === 1),
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
    
    
    
    

    drawKey: "hidden",
    shape: [[1]],
});




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
    
    
    actions: [
        { key: "triggerLog" },
        { key: "triggerScan" },
        { key: "triggerLog", options: { mode: "fast" } },
    ],
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
    
    
    
    actions: [{ key: "processorConvert", options: { to: "mdmy.element.glass" } }],
});

roundTrip("signals", {
    id: "md-my-hown-mod:mdmy.signal.button",
    kind: "interactables",
    target: "mdmy.structure.button",
    actions: [{ key: "structureInspect" }],
});

roundTrip("behaviors", {
    id: "md-my-hown-mod:mdmy.behavior.belt",
    kind: "conveyor",
    definition: { speed: 2, filter: "mdmy.element.glass" },
});

roundTrip("projectiles", {
    id: "md-my-hown-mod:mdmy.proj.bolt",
    sprite: { id: "sprites:bolt" },
    
    
    
    option: { key: "projectileHeavy" },
    options: { damage: 10 },
});

console.log("── a pre-split handlerKey is no longer a process ──");
{
    
    
    
    const before = {
        id: "md-my-hown-mod:mdmy.signal.legacy",
        kind: "interactables",
        target: "mdmy.structure.button",
        handlerKey: "structureWriteData",
    };
    const form = entryToForm("signals", before);
    
    check(
        "a pre-split handlerKey reads as no process",
        parseActionRefs(form.actionsJson).length === 0,
        form.actionsJson ?? "(absent)",
    );
    const back = formToEntry("signals", form);
    
    check(
        "and no process is created",
        back.actions === undefined,
        JSON.stringify(back.actions),
    );
    
    
    
    check(
        "the stale key is left untouched",
        back.handlerKey === "structureWriteData",
        String(back.handlerKey),
    );
    
    check(
        "the rest of the entry survives",
        back.kind === "interactables" && back.target === "mdmy.structure.button",
    );
}

console.log("── unknown fields are preserved ──");
{
    const rt = roundTrip("modifiers", {
        id: "md-my-hown-mod:mdmy.mod.speed",
        hookId: "onTick",
        kind: "modify",
        
        actions: [{ key: "logArgs" }],
        notes: "test",
    });
}
{
    
    const form = entryToForm("structures", {
        id: "md-my-hown-mod:mdmy.structure.x",
        name: "X",
        blockGridType: "mdmy.x.block",
        rejectWhenBlocked: true,
    });
    const back = formToEntry("structures", form);
    check(
        "passthrough.blockGridType",
        back.blockGridType === "mdmy.x.block",
        String(back.blockGridType),
    );
    check(
        "passthrough.rejectWhenBlocked",
        back.rejectWhenBlocked === true,
        String(back.rejectWhenBlocked),
    );
}
{
    
    const form = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.fn",
        kind: "conveyor",
        draw: () => {},
    });
    const back = formToEntry("behaviors", form);
    check("no function in entry", typeof back.draw !== "function", typeof back.draw);
}

console.log("── a behaviour's structure ids live in the definition, edited as pickers ──");
{
    
    
    
    const conveyor = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.belt",
        kind: "conveyor",
        definition: { id: "md-my-hown-mod:mdmy.structure.belt", speed: 2 },
    });
    check(
        "conveyor picks up its structure",
        conveyor.structureId === "md-my-hown-mod:mdmy.structure.belt",
        String(conveyor.structureId),
    );
    const backConveyor = formToEntry("behaviors", conveyor) as {
        definition?: Record<string, unknown>;
    };
    check(
        "conveyor keeps the structure",
        backConveyor.definition?.id === "md-my-hown-mod:mdmy.structure.belt",
        JSON.stringify(backConveyor.definition),
    );
    
    check(
        "conveyor keeps the rest of the payload",
        backConveyor.definition?.speed === 2,
        JSON.stringify(backConveyor.definition),
    );

    const launcher = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.aim",
        kind: "launcher",
        definition: {
            upType: "md-my-hown-mod:mdmy.structure.up",
            leftType: "md-my-hown-mod:mdmy.structure.left",
            rightType: "md-my-hown-mod:mdmy.structure.right",
            velocity: [0, -1],
        },
    });
    const backLauncher = formToEntry("behaviors", launcher) as {
        definition?: Record<string, unknown>;
    };
    for (const k of ["upType", "leftType", "rightType"]) {
        check(
            `launcher keeps ${k}`,
            backLauncher.definition?.[k] ===
                `md-my-hown-mod:mdmy.structure.${k.replace("Type", "")}`,
            JSON.stringify(backLauncher.definition),
        );
    }
    check(
        "launcher keeps the rest of the payload",
        Array.isArray(backLauncher.definition?.velocity),
        JSON.stringify(backLauncher.definition),
    );
}
{
    
    
    
    const controls = fieldsFor("behaviors").map((f) => f.key);
    for (
        const [opt, control] of [
            ["structureId", "structureId"],
            ["transportOffset", "transportOffset"],
            ["velocity", "conveyorVelocity"],
            ["maxTransportDistance", "maxTransportDistance"],
            ["transportHeight", "transportHeight"],
            ["runWith", "runWith"],
            ["skipQueued", "skipQueued"],
            ["upType", "upType"],
            ["leftType", "leftType"],
            ["rightType", "rightType"],
            ["softDropVelocity", "softDropVelocity"],
            ["runTickSharedBufferKey", "runTickSharedBufferKey"],
        ] as const
    ) {
        check(
            `conveyor/launcher option ${opt} has a control`,
            controls.includes(control),
            controls.join(","),
        );
    }
    
    
    
    check(
        "the launcher velocity has its own control",
        controls.includes("launcherVelocity"),
        controls.join(","),
    );
    
    
    check(
        "runWith is a picker, not a text box",
        fieldsFor("behaviors").find((f) => f.key === "runWith")?.kind === "select",
        "runWith is not a select",
    );
}
{
    const full = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.belt",
        kind: "conveyor",
        definition: {
            id: "md-my-hown-mod:mdmy.structure.belt",
            transportOffset: { x: 0, y: -1 },
            velocity: { x: 1, y: 0 },
            maxTransportDistance: 4,
            transportHeight: 2,
            runWith: "left",
            skipQueued: true,
        },
    });
    check("conveyor reads its run direction", full.runWith === "left", String(full.runWith));
    check(
        "conveyor reads a max distance",
        full.maxTransportDistance === "4",
        String(full.maxTransportDistance),
    );
    check("conveyor reads skipQueued", full.skipQueued === "true", String(full.skipQueued));
    const back = formToEntry("behaviors", full) as { definition?: Record<string, unknown> };
    
    
    
    check(
        "a conveyor's velocity stays a {x,y} object",
        JSON.stringify(back.definition?.velocity) === '{"x":1,"y":0}',
        JSON.stringify(back.definition),
    );
    for (
        const [k, want] of [
            ["transportOffset", { x: 0, y: -1 }],
            ["maxTransportDistance", 4],
            ["transportHeight", 2],
            ["runWith", "left"],
            ["skipQueued", true],
        ] as const
    ) {
        check(
            `conveyor keeps ${k}`,
            JSON.stringify(back.definition?.[k]) === JSON.stringify(want),
            JSON.stringify(back.definition),
        );
    }

    const lForm = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.aim",
        kind: "launcher",
        definition: {
            upType: "md-my-hown-mod:mdmy.structure.up",
            leftType: "md-my-hown-mod:mdmy.structure.left",
            rightType: "md-my-hown-mod:mdmy.structure.right",
            velocity: [0, -2],
            softDropVelocity: 0.5,
            runTickSharedBufferKey: "mdmy.launcher.ticks",
        },
    });
    check(
        "launcher reads its soft drop velocity",
        lForm.softDropVelocity === "0.5",
        String(lForm.softDropVelocity),
    );
    const lBack = formToEntry("behaviors", lForm) as {
        definition?: Record<string, unknown>;
    };
    
    check(
        "a launcher's velocity stays a [x,y] tuple",
        JSON.stringify(lBack.definition?.velocity) === "[0,-2]",
        JSON.stringify(lBack.definition),
    );
    check(
        "launcher keeps softDropVelocity",
        lBack.definition?.softDropVelocity === 0.5,
        JSON.stringify(lBack.definition),
    );
    check(
        "launcher keeps the run-tick buffer key",
        lBack.definition?.runTickSharedBufferKey === "mdmy.launcher.ticks",
        JSON.stringify(lBack.definition),
    );
}
{
    
    
    
    
    const withBool = (skipQueued?: boolean) =>
        formToEntry("behaviors", {
            kind: "conveyor",
            structureId: "md-my-hown-mod:mdmy.structure.belt",
            ...entryToForm("behaviors", {
                id: "md-my-hown-mod:mdmy.behavior.belt",
                kind: "conveyor",
                definition: {
                    id: "md-my-hown-mod:mdmy.structure.belt",
                    ...(skipQueued === undefined ? {} : { skipQueued }),
                },
            }),
        }) as { definition?: Record<string, unknown> };

    const absent = withBool();
    check(
        "an absent bool is not invented",
        absent.definition?.skipQueued === undefined,
        JSON.stringify(absent.definition),
    );
    check(
        "an absent bool adds no other option either",
        Object.keys(absent.definition ?? {}).join(",") === "id",
        JSON.stringify(absent.definition),
    );
    const yes = withBool(true);
    check(
        "a true bool is written",
        yes.definition?.skipQueued === true,
        JSON.stringify(yes.definition),
    );
    
    
    const no = withBool(false);
    check(
        "an explicit false survives a save",
        no.definition?.skipQueued === false,
        JSON.stringify(no.definition),
    );
}
{
    
    
    const zero = formToEntry("behaviors", {
        kind: "launcher",
        upType: "md-my-hown-mod:mdmy.structure.up",
        leftType: "md-my-hown-mod:mdmy.structure.left",
        rightType: "md-my-hown-mod:mdmy.structure.right",
        softDropVelocity: "0",
    }) as { definition?: Record<string, unknown> };
    check(
        "a zero soft-drop velocity is not dropped",
        zero.definition?.softDropVelocity === 0,
        JSON.stringify(zero.definition),
    );
    
    
    const switched = formToEntry("behaviors", {
        kind: "conveyor",
        structureId: "md-my-hown-mod:mdmy.structure.belt",
        upType: "md-my-hown-mod:mdmy.structure.up",
        leftType: "md-my-hown-mod:mdmy.structure.left",
        rightType: "md-my-hown-mod:mdmy.structure.right",
    }) as { definition?: Record<string, unknown> };
    check(
        "a conveyor does not keep launcher fields",
        switched.definition?.upType === undefined &&
            switched.definition?.leftType === undefined &&
            switched.definition?.rightType === undefined,
        JSON.stringify(switched.definition),
    );
}
{
    
    
    
    
    
    
    
    
    const fields = fieldsFor("elements");

    
    
    for (
        const [on, hidden] of [
            ["flammableOn", "flammableOutputId"],
            ["collectableOn", "collectableValue"],
        ] as const
    ) {
        
        check(`${on} exists`, fields.some((f) => f.key === on), on);
        const child = fields.find((f) => f.key === hidden);
        check(`${hidden} is gated on ${on}`, Boolean(child?.when), hidden);
        check(
            `${hidden} is hidden while ${on} is off`,
            child?.when?.({}) === false,
            `${hidden} shows with the toggle off`,
        );
        check(
            `${hidden} is shown while ${on} is on`,
            child?.when?.({ [on]: "true" }) === true,
            `${hidden} stays hidden with the toggle on`,
        );
    }

    const store = (definition: Record<string, unknown>) =>
        entryToForm("elements", { id: "mdmy.element.gel", name: "Gel", ...definition }) as Record<
            string,
            string
        >;
    const build = (form: Record<string, string>) =>
        formToEntry("elements", form) as Record<string, unknown>;

    
    
    check("an off element has no flammable", store({}).flammableOn !== "true", "toggled on");
    check(
        "an off element writes no flammable",
        build({ ...store({}) }).flammable === undefined,
        JSON.stringify(build({ ...store({}) }).flammable),
    );
    
    
    const bare = build({ ...store({}), flammableOn: "true" });
    check(
        "on with nothing set burns with no residue",
        JSON.stringify(bare.flammable) === "{}",
        JSON.stringify(bare.flammable),
    );
    
    
    const fullForm = store({
        flammable: {
            outputElementId: "mdmy.element.ash",
            outputChance: 0.5,
            fireInheritsDuration: true,
            duration: [0.05, 0.3],
        },
    });
    check(
        "a stored object reads as on",
        fullForm.flammableOn === "true",
        String(fullForm.flammableOn),
    );
    check(
        "the output element is a control",
        fullForm.flammableOutputId === "mdmy.element.ash",
        String(fullForm.flammableOutputId),
    );
    check(
        "the duration pair is two controls",
        fullForm.flammableDurationMin === "0.05" && fullForm.flammableDurationMax === "0.3",
        `${fullForm.flammableDurationMin}..${fullForm.flammableDurationMax}`,
    );
    const full = build(fullForm);
    check(
        "the full flammable object survives",
        JSON.stringify(full.flammable) ===
            JSON.stringify({
                outputElementId: "mdmy.element.ash",
                outputChance: 0.5,
                fireInheritsDuration: true,
                duration: [0.05, 0.3],
            }),
        JSON.stringify(full.flammable),
    );
    
    
    const fixed = build({ ...store({}), flammableOn: "true", flammableDurationMin: "1.2" });
    check(
        "a lone lifetime stays a number",
        fixed.flammable?.duration === 1.2,
        JSON.stringify(fixed.flammable),
    );
    
    
    const zero = build({ ...store({}), flammableOn: "true", flammableOutputChance: "0" });
    check(
        "a zero output chance is kept",
        zero.flammable?.outputChance === 0,
        JSON.stringify(zero.flammable),
    );
    
    
    
    
    
    
    
    check(
        "a bare flammable boolean is not read as on",
        store({ flammable: true }).flammableOn !== "true",
        "read as on",
    );
    check(
        "a bare collectable boolean is not read as on",
        store({ collectable: true }).collectableOn !== "true",
        "read as on",
    );
    check(
        "a stale boolean is dropped on save",
        build(store({ flammable: true })).flammable === undefined,
        JSON.stringify(build(store({ flammable: true })).flammable),
    );
    const gold = store({ collectable: { value: 2 } });
    check(
        "a collectable object reads as on",
        gold.collectableOn === "true",
        String(gold.collectableOn),
    );
    check(
        "the collector value is a control",
        gold.collectableValue === "2",
        String(gold.collectableValue),
    );
    check(
        "the collector value is stored as { value }",
        JSON.stringify(build(gold).collectable) === '{"value":2}',
        JSON.stringify(build(gold).collectable),
    );
    
    
    
    
    const blank = validateForm("elements", {
        ...formDefaults("elements"),
        collectableOn: "true",
    });
    check(
        "a collectable with no value is blocked",
        Boolean(blank.collectableValue),
        JSON.stringify(blank),
    );
    
    
    const blankSave = build({ ...store({}), collectableOn: "true" });
    check(
        "a blank collector value is not invented",
        JSON.stringify(blankSave.collectable) === "{}",
        JSON.stringify(blankSave.collectable),
    );
    const valued = validateForm("elements", {
        ...formDefaults("elements"),
        collectableOn: "true",
        collectableValue: "2",
    });
    check(
        "a collectable with a value is accepted",
        !valued.collectableValue,
        JSON.stringify(valued),
    );
    const off = validateForm("elements", { ...formDefaults("elements") });
    check("an element that is not collectable is fine", !off.collectableValue, JSON.stringify(off));
    
    const range = validateForm("elements", {
        ...formDefaults("elements"),
        flammableOn: "true",
        flammableDurationMin: "5",
        flammableDurationMax: "1",
    });
    check(
        "an inverted fire lifetime is blocked",
        Boolean(range.flammableDurationMax),
        JSON.stringify(range),
    );
}
{
    
    
    const form = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.belt",
        kind: "conveyor",
        definition: { id: "stale" },
    });
    form.structureId = "md-my-hown-mod:mdmy.structure.belt";
    const back = formToEntry("behaviors", form) as { definition?: Record<string, unknown> };
    check(
        "the picker beats a stale id in the JSON",
        back.definition?.id === "md-my-hown-mod:mdmy.structure.belt",
        JSON.stringify(back.definition),
    );
}
{
    
    const form = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.belt",
        kind: "conveyor",
        definition: { id: "md-my-hown-mod:mdmy.structure.belt" },
    });
    form.structureId = "";
    const back = formToEntry("behaviors", form) as { definition?: Record<string, unknown> };
    check(
        "clearing the picker clears the id",
        back.definition?.id === undefined,
        JSON.stringify(back.definition),
    );
}
{
    
    const form = entryToForm("behaviors", {
        id: "md-my-hown-mod:mdmy.behavior.x",
        kind: "conveyor",
        definition: { id: "leftover" },
    });
    form.kind = "launcher";
    form.upType = "u";
    form.leftType = "l";
    form.rightType = "r";
    const back = formToEntry("behaviors", form) as { definition?: Record<string, unknown> };
    check(
        "switching kind drops the other kind's ids",
        back.definition?.id === undefined,
        JSON.stringify(back.definition),
    );
    check(
        "switching kind keeps the new ones",
        back.definition?.upType === "u",
        JSON.stringify(back.definition),
    );
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
    
    
    
    
    check(
        "the passthrough is offered",
        fieldsFor("elements").map((f) => f.key).includes("advancedJson"),
        "the passthrough field is gone",
    );
    check(
        "a fresh element shows no Advanced section",
        !sectionsFor("elements", formDefaults("elements")).some((s) => s.title === "Advanced"),
        "a new entry shows an Advanced section",
    );
}
{
    
    
    const sh = await import("../schema.ts");
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
        all.every((a) => a.path.startsWith("assets/") && !a.path.includes("..")),
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
    
    
    const sample = listLibraryAssets()[0];
    check("catalog has a sample asset", !!sample?.name, "catalog empty");
    const upper = sample.name.toUpperCase();
    const hit = searchLibraryAssets(upper);
    check(
        "search is case-insensitive",
        hit.some((a) => a.name === sample.name),
        JSON.stringify(hit.map((a) => a.name)),
    );
    const none = searchLibraryAssets("zzz-no-such-icon-zzz");
    check("search misses return empty", none.length === 0, `${none.length}`);
    check("empty query returns all", searchLibraryAssets("").length === listLibraryAssets().length);
    check("query is trimmed", searchLibraryAssets(`  ${sample.name}  `).length > 0);
}
{
    
    const asset = listLibraryAssets()[0];
    const form = formDefaults("sprites");
    form.idSuffix = autoGraphicsKey(asset.name).replace("sprites:", "");
    form.path = asset.path;
    const errs = validateForm("sprites", form);
    check("picked asset validates", !errs.path, JSON.stringify(errs));
}
{
    
    const form = formDefaults("sprites");
    form.idSuffix = "some-asset";
    form.path = "assets/icons/does-not-exist-2x2.png";
    const errs = validateForm("sprites", form);
    check("unknown asset path rejected", !!errs.path, JSON.stringify(errs));
    form.path = "../../etc/passwd";
    check("path traversal rejected", !!validateForm("sprites", form).path);
}
{
    
    const form = formDefaults("sprites");
    form.idSuffix = "some-asset";
    form.path = "";
    check("empty asset path rejected", !!validateForm("sprites", form).path);
}
{
    
    check(
        "autoGraphicsKey namespaces",
        autoGraphicsKey("my-icon") === "sprites:my-icon",
        autoGraphicsKey("my-icon"),
    );
}
{
    
    
    check("fills empty field", resolveAutoFill("", undefined, "sprites:a") === "sprites:a");
    check(
        "fills undefined field",
        resolveAutoFill(undefined, undefined, "sprites:a") === "sprites:a",
    );
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
    
    const pathField = fieldsFor("sprites").find((f) => f.key === "path");
    check("sprite path is a library field", pathField?.kind === "library", pathField?.kind);
    check(
        "library field auto-fills the graphics key",
        pathField?.autoKey === "idSuffix",
        pathField?.autoKey,
    );
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
    check(
        "terrainRules round-trips",
        Array.isArray(back.back.terrainRules),
        JSON.stringify(back.back.terrainRules),
    );
    const f = fieldsFor("excavation").find((x) => x.key === "terrainRulesJson");
    check("terrainRules field exists", f?.kind === "terrainRules", f?.kind);

    const form = formDefaults("excavation");
    form.idSuffix = "drill";
    form.terrainRulesJson = JSON.stringify([{ damage: 5 }]);
    check(
        "rule without a terrain is rejected",
        !!validateForm("excavation", form).terrainRulesJson,
    );
    form.terrainRulesJson = JSON.stringify([{ cellType: "dune", damage: "abc" }]);
    check("non-numeric damage rejected", !!validateForm("excavation", form).terrainRulesJson);
    form.terrainRulesJson = JSON.stringify([{ cellType: "dune", damage: 5 }]);
    check("valid rule accepted", !validateForm("excavation", form).terrainRulesJson);
    form.terrainRulesJson = JSON.stringify([]);
    check("empty rule list accepted", !validateForm("excavation", form).terrainRulesJson);
    
    const empty = formToEntry("excavation", form);
    check(
        "empty rules are not stored",
        empty.terrainRules === undefined,
        JSON.stringify(empty.terrainRules),
    );
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
    check(
        "upgrade is nested under `upgrade`",
        u && typeof u === "object",
        JSON.stringify(back.back.upgrade),
    );
    check("upgrade.id round-trips", u?.id === "lvl2", JSON.stringify(u));
    check(
        "upgrade.costs round-trips",
        JSON.stringify(u?.costs) === "[100,250,500]",
        JSON.stringify(u?.costs),
    );
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

console.log("── a picker and its companion box are a read/write contract ──");





{
    const form = entryToForm("techs", {
        id: "md-my-hown-mod:t",
        name: "T",
        cost: 1,
        currencyType: "bits",
    });
    check(
        "an unlisted currency switches the picker to custom",
        form.currencyType === "__custom__",
        String(form.currencyType),
    );
    check(
        "…and lands in the companion box",
        form.currencyTypeCustom === "bits",
        String(form.currencyTypeCustom),
    );
    check(
        "…and comes back out as the value, not the sentinel",
        formToEntry("techs", form).currencyType === "bits",
        JSON.stringify(formToEntry("techs", form).currencyType),
    );

    
    
    const picked = formToEntry("techs", { ...form, currencyType: "gold" });
    check(
        "a picked option wins over the companion box",
        picked.currencyType === "gold",
        JSON.stringify(picked.currencyType),
    );
}

console.log("── an upgrade category requirement is stored, never read ──");





{
    const withObj = entryToForm("categories", {
        id: "md-my-hown-mod:c",
        name: "N",
        requirement: { techId: "t1" },
    });
    check(
        "an object requirement round-trips",
        JSON.stringify(formToEntry("categories", withObj).requirement) ===
            JSON.stringify({ techId: "t1" }),
        JSON.stringify(formToEntry("categories", withObj).requirement),
    );

    const withStr = entryToForm("categories", {
        id: "md-my-hown-mod:c",
        name: "N",
        requirement: "t1",
    });
    check(
        "a string requirement is shown",
        withStr.requirementJson === "t1",
        String(withStr.requirementJson),
    );
    check(
        "…and is dropped on save, as it always was",
        formToEntry("categories", withStr).requirement === undefined,
        JSON.stringify(formToEntry("categories", withStr).requirement),
    );

    
    const picked = formToEntry("categories", {
        ...withStr,
        requirementTechId: "t9",
        requirementJson: "",
    });
    check(
        "a hand-picked requirement is written as a string",
        picked.requirement === "t9",
        JSON.stringify(picked.requirement),
    );
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
        
        
        sprite: { id: "sprites:bolt", type: "onehand" },
    });
    check(
        "weapon projectileId round-trips",
        back.back.projectileId === "mdmy.proj.bolt",
        String(back.back.projectileId),
    );
    check(
        "weapon sprite id round-trips",
        back.back.sprite?.id === "sprites:bolt",
        JSON.stringify(back.back.sprite),
    );
}

console.log("── handler pickers are domain-scoped and described ──");
{
    const H = await import("../../handler/actions/index.ts");
    
    
    
    
    globalThis.__mdHandlers = {
        listAnyHandlerKeys: () => Object.keys(H.ANY_ACTIONS),
        listProcessorKeys: () => Object.keys(H.PROCESSING_ACTIONS),
        listHandlerKeys: () => Object.keys(H.MODIFIER_ACTIONS),
        ANY_HANDLER_DOCS: H.ACTION_DOCS,
        PROCESS_HANDLER_DOCS: H.ACTION_DOCS,
        CODE_HANDLER_DOCS: H.ACTION_DOCS,
    };
    const cat = await import("../../catalog.ts");
    const pickers = [
        ["signal", cat.listSignalHandlerKeys, "signalLog"],
        ["trigger", cat.listTriggerHandlerKeys, "triggerLog"],
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
        
        
        
        
        
        
        
        const real = new Set([
            ...Object.keys(H.ANY_ACTIONS),
            ...Object.keys(H.PROCESSING_ACTIONS),
            ...Object.keys(H.MODIFIER_ACTIONS),
        ]);
        check(
            `${name} picker keys all exist`,
            opts.every((o) => real.has(o.value)),
            JSON.stringify(opts.map((o) => o.value)),
        );
        check(
            `${name} picker labels carry a description`,
            opts.every((o) => o.label.includes("—")),
            opts[0]?.label,
        );
    }
    
    
    
    
    {
        const PROJ = await import("../../handler/projectile-option/index.ts");
        const pj = cat.listProjectileHandlerKeys();
        check("projectile picker is non-empty", pj.length > 0, `${pj.length}`);
        check(
            "projectile picker offers projectileFast",
            pj.some((o) => o.value === "projectileFast"),
            JSON.stringify(pj.map((o) => o.value)),
        );
        check(
            "projectile picker keys are all real options",
            pj.every((o) => o.value in PROJ.PROJECTILE_OPTIONS),
            JSON.stringify(pj.map((o) => o.value)),
        );
        check(
            "projectile picker keys are not actions",
            pj.every((o) => !(o.value in H.ANY_ACTIONS)),
            JSON.stringify(pj.map((o) => o.value).filter((v) => v in H.ANY_ACTIONS)),
        );
    }
    const proc = cat.listDescribedProcessorKeys();
    check("processor picker non-empty", proc.length > 0, `${proc.length}`);
    
    
    
    
    
    const everyAction = new Set(H.actionKeys());
    check(
        "processor picker keys all exist",
        proc.every((o) => everyAction.has(o.value)),
        proc.map((o) => o.value).filter((k) => !everyAction.has(k)).join(" "),
    );
    check(
        "processor picker labels described",
        proc.every((o) => o.label.includes("—")),
        proc[0]?.label,
    );
    check(
        "handlerDoc returns text",
        !!cat.handlerDoc("signalLog"),
        String(cat.handlerDoc("signalLog")),
    );
    check("handlerDoc unknown is undefined", cat.handlerDoc("nope") === undefined);

    for (const c of ["signals", "triggers", "processing"]) {
        
        
        
        
        const proc = fieldsFor(c).find((f) => f.key === "processId");
        check(
            `${c} declares a process reference`,
            proc?.kind === "processRef",
            JSON.stringify(proc?.kind),
        );
        check(
            `${c} no longer declares an inline actions list`,
            !fieldsFor(c).some((f) => f.kind === "actionList"),
        );
        check(
            `${c} no longer declares handlerKey`,
            !fieldsFor(c).some((f) => f.key === "handlerKey"),
        );
    }
    check(
        
        
        
        "projectiles declare a single option, not a process",
        !!fieldsFor("projectiles").find((f) =>
            f.key === "optionKey" && f.kind === "projectileOption"
        ) &&
            !fieldsFor("projectiles").some((f) => f.kind === "actionList"),
    );
    check(
        "projectiles no longer declare getOptionsKey",
        !fieldsFor("projectiles").some((f) => f.key === "getOptionsKey"),
    );
    check(
        "projectiles no longer declare an actionsJson",
        !fieldsFor("projectiles").some((f) => f.key === "actionsJson"),
    );
}

console.log("── no fabricated engine fields (6.1) ──");
{
    
    
    check(
        "structures dropped unlockedBy",
        !fieldsFor("structures").some((f) => f.key === "unlockedBy"),
    );
    const round = roundTrip("structures", {
        id: "md-my-hown-mod:mdmy.structure.crusher",
        name: "Crusher",
        categoryKey: "production",
        alwaysUnlocked: true,
    });
    check(
        "unlockedBy never reappears on save",
        round.back.unlockedBy === undefined,
        JSON.stringify(round.back.unlockedBy),
    );
    check(
        "alwaysUnlocked still round-trips",
        round.back.alwaysUnlocked === true,
        JSON.stringify(round.back.alwaysUnlocked),
    );
    
    const { FIELD_HELP } = await import("../../constants.ts");
    check(
        "field help omits unlockedBy",
        !JSON.stringify(FIELD_HELP.structures).includes("unlockedBy"),
        JSON.stringify(FIELD_HELP.structures),
    );
}

console.log("── typed handler registry (9.1 / 9.5 / 9.6) ──");
{
    const reg = await import("../../handler/core/handler-registry.ts");
    const hooks = await import("../../handler/actions/index.ts");
    
    

    
    const real = [
        ...Object.keys(hooks.ANY_ACTIONS),
        ...Object.keys(hooks.PROCESSING_ACTIONS),
        ...Object.keys(hooks.MODIFIER_ACTIONS),
    ];
    const known = reg.HANDLER_META.map((m) => m.key);
    const missing = real.filter((k) => !known.includes(k));
    const phantom = known.filter((k) => !real.includes(k));
    const dupes = known.filter((k, i) => known.indexOf(k) !== i);
    check("no handler missing from the registry", missing.length === 0, missing.join(" "));
    check("no phantom handler in the registry", phantom.length === 0, phantom.join(" "));
    check("no duplicate registry rows", dupes.length === 0, dupes.join(" "));

    
    const docs = hooks.ACTION_DOCS;
    const undoc = known.filter((k) => !docs[k]);
    check("every handler is documented", undoc.length === 0, undoc.join(" "));

    
    check(
        "itemConsume is gone (ActionType has no Consumable)",
        !("itemConsume" in hooks.ANY_ACTIONS),
    );
    check("itemConsume is not in the registry", !known.includes("itemConsume"));

    
    const slots = [
        "signal",
        "trigger",
        "processing",
        "upgrade",
        "modifier",
        "itemAction",
    ] as const;
    for (const s of slots) {
        check(`slot "${s}" offers handlers`, reg.handlersForSlot(s).length > 0);
    }
    const keys = (s: typeof slots[number]) => reg.handlersForSlot(s).map((m) => m.key);
    const sameSet = (a: string[], b: string[]) =>
        a.slice().sort().join() === b.slice().sort().join();
    
    
    
    
    
    
    
    
    
    const { needsOf, CALL_SITE_SCOPE } = await import("../../handler/core/scope.ts");
    const needs = (k: string) => needsOf(k);
    const signalProvides = CALL_SITE_SCOPE.signal;
    const byKey = (k: string) => reg.HANDLER_META.find((m) => m.key === k)!;
    
    
    
    check(
        "signal slot holds exactly the actions a signal delivers",
        sameSet(
            keys("signal"),
            known.filter((k) => reg.slotsForEntry(byKey(k)).includes("signal")),
        ),
        keys("signal").join(" "),
    );
    
    
    check(
        "no signal action needs something a signal does not deliver",
        keys("signal").every((k) =>
            needs(k).every((n) => n === "ret" || signalProvides[n as never] === true)
        ),
        keys("signal").filter((k) =>
            !needs(k).every((n) => n === "ret" || signalProvides[n as never] === true)
        ).join(" "),
    );
    
    
    for (
        const k of [
            "readElement", 
            "logicCount", 
            "itemExcavate", 
            "processorCount", 
        ]
    ) {
        check(`signal offers ${k}`, keys("signal").includes(k), keys("signal").join(" "));
    }
    
    
    
    check(
        "signal offers no commit-writing action",
        keys("signal").every((k) => !needs(k).includes("commit")),
        keys("signal").filter((k) => needs(k).includes("commit")).join(" "),
    );
    
    
    
    
    
    check(
        "the walks split by scope: readers reach signal, the writer does not",
        ["logicAny", "logicAll", "logicCount", "logicSum"].every((k) =>
            keys("signal").includes(k)
        ) && !keys("signal").includes("logicForEach"),
        keys("signal").filter((k) => k.startsWith("logic")).join(" ") || "none",
    );
    
    
    
    
    
    
    check(
        "no projectile HandlerSlot exists",
        !("projectile" in reg.HANDLER_SLOT_LABELS),
        Object.keys(reg.HANDLER_SLOT_LABELS).join(" "),
    );
    check(
        "no action may claim a projectile slot",
        reg.HANDLER_META.every((m: { slots: string[] }) => !m.slots.includes("projectile")),
    );
    
    
    
    
    
    
    {
        const { canRunAt, needsOf } = await import("../../handler/core/scope.ts");
        const overOffered = reg.handlersForSlot("trigger")
            .map((m) => m.key)
            .filter((k) => !canRunAt(k, "trigger"));
        check(
            "every trigger-slot handler can actually run on a trigger",
            overOffered.length === 0,
            overOffered.join(" "),
        );
        check(
            "triggerScan is not offered on trigger — it needs a position",
            !reg.handlersForSlot("trigger").some((m) => m.key === "triggerScan"),
        );
        check(
            "triggerScan is offered where a position is delivered",
            needsOf("triggerScan").includes("pos") &&
                canRunAt("triggerScan", "processing"),
        );
    }
    
    
    
    
    const { resolveAction } = await import("../../handler/core/process.ts");
    const unresolved = keys("processing").filter((k) => !resolveAction(k));
    check(
        "every processing-slot handler resolves to a function",
        unresolved.length === 0,
        unresolved.join(" "),
    );

    
    const mismatch = reg.HANDLER_META.filter((m) => m.slots.length === 0);
    check(
        "every handler declares at least one slot",
        mismatch.length === 0,
        mismatch.map((m) => m.key).join(" "),
    );
    const techInSignal = keys("signal").filter((k) => reg.handlerMeta(k)?.type === "tech");
    check(
        "no tech handler leaks into the signal slot",
        techInSignal.length === 0,
        techInSignal.join(" "),
    );
    const projInProcessing = keys("processing").filter((k) =>
        reg.handlerMeta(k)?.type === "projectile"
    );
    check(
        "no projectile handler leaks into processing",
        projInProcessing.length === 0,
        projInProcessing.join(" "),
    );

    
    const write = reg.handlerMeta("structureWriteData")!;
    check(
        "both required params reported when missing",
        reg.validateHandlerParams(write, {}).length === 2,
        JSON.stringify(reg.validateHandlerParams(write, {})),
    );
    check(
        "valid params produce no errors",
        reg.validateHandlerParams(write, { field: "charge", value: "5" }).length === 0,
    );
    
    
    
    const withConstraints = reg.handlerMeta("energyDefault")!;
    check(
        "int constraint enforced",
        reg.validateHandlerParams(withConstraints, { capacity: "2.5" }).length === 1,
        JSON.stringify(reg.validateHandlerParams(withConstraints, { capacity: "2.5" })),
    );
    check(
        "min constraint enforced",
        reg.validateHandlerParams(withConstraints, { capacity: "-1" }).length === 1,
    );
    check(
        "nan rejected",
        reg.validateHandlerParams(withConstraints, { capacity: "abc" }).length === 1,
    );
    const opts = reg.buildHandlerOptions(withConstraints, { capacity: "800" });
    check(
        "options are typed, not strings",
        opts.capacity === 800,
        JSON.stringify(opts),
    );
    check(
        "blank options are dropped",
        Object.keys(reg.buildHandlerOptions(withConstraints, { capacity: "" })).length === 0,
    );

    
    
    
    
    const cfg = {
        signals: [{ id: "s1", actions: [{ key: "structureWriteData" }] }],
        triggers: [{ id: "t1", actions: [{ key: "techGrantItem" }] }], 
        items: [{ id: "i1", actions: [{ key: "itemShoot" }] }],
    };
    const bad = reg.unreachableHandlers(cfg);
    
    
    
    
    
    
    
    
    
    
    
    
    check("the one mismatched slot is flagged unreachable", bad.length === 1, JSON.stringify(bad));
    check(
        "the tech handler is it",
        bad.some((b) => b.key === "techGrantItem" && b.usage.slot === "trigger"),
        JSON.stringify(bad),
    );
    check(
        "and nothing in the item slot is flagged",
        !bad.some((b) => b.usage.slot === "itemAction"),
        JSON.stringify(bad),
    );
    const idx = reg.usageIndex(cfg);
    check(
        "usage index maps handler -> entries",
        idx.structureWriteData?.[0]?.id === "s1",
        JSON.stringify(idx),
    );
    check("usage index covers item actions", idx.itemShoot?.[0]?.id === "i1", JSON.stringify(idx));

    
    check(
        "every handler declares a scope",
        reg.HANDLER_META.every((m) => !!reg.HANDLER_SCOPE_LABELS[m.scope]),
    );
    check(
        "scope labels cover all scopes",
        reg.HANDLER_SCOPES.every((s) => !!reg.HANDLER_SCOPE_LABELS[s]),
    );
}

console.log("── the two handler tabs are reachable and wired (9.2) ──");
{
    const sch = await import("../schema.ts");
    const hp = await import("../panel/handlers.ts");
    const reg = await import("../../handler/core/handler-registry.ts");
    const att = await import("../panel/attach.ts");

    
    
    
    
    
    
    
    for (const t of ["action", "projectileOption", "upgradeAction"] as const) {
        check(`${t} is a known tab`, t in sch.CATEGORY_META);
        check(
            `${t} is reachable — in a group or attached to one`,
            [
                ...sch.MENU_GROUPS.flatMap((g) => g.categories),
                ...Object.values(att.ATTACHED)
                    .flat(),
            ].includes(t),
        );
        check(
            `${t} has no config key (it is a browser)`,
            sch.CATEGORY_META[t].configKey === undefined,
        );
        check(`${t} has no entry form`, sch.fieldsFor(t).length === 0);
    }
    
    
    
    
    check(
        "the Handlers group holds exactly Actions and Processes",
        sch.MENU_GROUPS.find((g) => g.key === "handlers")?.categories.join() ===
            "action,customProcess",
    );
    
    
    check(
        "Projectile options hang off Items",
        att.parentOf("projectileOption" as never) === "items",
    );
    check(
        "Excavation options hang off Items",
        att.parentOf("excavationOption" as never) === "items",
    );
    check(
        "Upgrade actions hang off Upgrades",
        att.parentOf("upgradeAction" as never) === "upgrades",
    );
    check(
        "there is no `handlers` tab any more",
        !("handlers" in sch.CATEGORY_META),
    );
    check(
        "every group category has metadata",
        sch.MENU_GROUPS.every((g) => g.categories.every((c) => !!sch.CATEGORY_META[c])),
    );
    check("initial tab state is collapsed", hp.initialHandlersState().open === null);

    
    
    
    
    const withConstraints = reg.handlerMeta("energyDefault")!;
    check(
        "defaultParams uses declared defaults",
        hp.defaultParams(withConstraints).capacity === "1000",
        JSON.stringify(hp.defaultParams(withConstraints)),
    );
    check(
        "defaultParams omits params with no default",
        hp.defaultParams(reg.handlerMeta("structureWriteData")!).field === undefined,
    );

    
    const el = (t: string, p: unknown, ...c: unknown[]) => ({ t, p, c });
    const node = hp.renderActions({
        h: el as never,
        cfg: {
            signals: [{ id: "s1", actions: [{ key: "structureWriteData" }] }],
            triggers: [{ id: "t1", actions: [{ key: "techGrantItem" }] }],
        },
        state: hp.initialHandlersState(),
        setState: () => {},
        onGoTo: () => {},
        onCopy: () => {},
    }) as { t: string; c: unknown[] };
    const flat = JSON.stringify(node);
    
    
    
    
    
    
    check(
        "the actions screen has no duplicate title",
        !flat.includes('"Handlers"'),
        flat.slice(0, 200),
    );

    
    
    
    
    
    {
        const {
            ACTION_DOMAIN_LABELS,
            ACTION_DOMAINS,
            ACTION_EFFECT_LABELS,
        } = await import("../../handler/core/action-class.ts");
        const { CALL_SITE_SCOPE, SCOPE_NEED_LABELS } = await import("../../handler/core/scope.ts");
        
        
        
        
        
        
        
        
        
        
        
        const { HANDLER_META, isOnlyAtSlot } = await import(
            "../../handler/core/handler-registry.ts"
        );
        const general = HANDLER_META.filter((m) => !isOnlyAtSlot(m, "upgrade"));
        const present = new Set(general.map((m) => ACTION_DOMAINS[m.key]).filter(Boolean));
        for (const [domain, label] of Object.entries(ACTION_DOMAIN_LABELS)) {
            check(
                present.has(domain as never)
                    ? `handlers tab offers a ${label} filter`
                    : `handlers tab omits the unused ${label} filter`,
                flat.includes(label) === present.has(domain as never),
            );
        }
        for (const label of Object.values(ACTION_EFFECT_LABELS)) {
            check(`handlers tab offers a "${label}" filter`, flat.includes(label));
        }
        for (const label of Object.values(SCOPE_NEED_LABELS)) {
            check(`handlers tab offers a "${label}" scope filter`, flat.includes(label));
        }
        const { CALL_SITE_LABELS } = await import("../../handler/core/process.ts");
        for (const site of Object.keys(CALL_SITE_SCOPE)) {
            check(
                `handlers tab offers a "${
                    CALL_SITE_LABELS[site as keyof typeof CALL_SITE_LABELS]
                }" call-site filter`,
                flat.includes(CALL_SITE_LABELS[site as keyof typeof CALL_SITE_LABELS]),
            );
        }
        check("handlers tab is searchable", flat.includes("Search"));
        
        
        check(
            "handlers tab has an in-use toggle that names both states",
            flat.includes("In use only") && flat.includes("hide the ones nothing uses"),
        );
    }

    
    
    check("the action half is labelled", flat.includes("Actions"));
    check("the process half is labelled", flat.includes("Processes in use"));
    check(
        "handlers tab surfaces the unreachable reference",
        flat.includes("unusable handler reference"),
    );
    check("handlers tab names the offending handler", flat.includes("techGrantItem"));
}

console.log("── item use actions are type-gated (7.4 / 9.7) ──");
{
    const reg = await import("../../handler/core/handler-registry.ts");
    const cat = await import("../../catalog.ts");
    
    
    const { resolveAction } = await import("../../handler/core/process.ts");
    const sch = await import("../schema.ts");

    
    check("Consumable offers no use action", reg.itemActionHandlersFor("Consumable").length === 0);
    check(
        "catalog returns none for Consumable",
        cat.listItemActionHandlerKeys("Consumable").length === 0,
    );
    check(
        "catalog returns none for lowercase consumable",
        cat.listItemActionHandlerKeys("consumable").length === 0,
    );
    check("Tool offers a use action", cat.listItemActionHandlerKeys("Tool").length > 0);
    check("Weapon offers a use action", cat.listItemActionHandlerKeys("Weapon").length > 0);
    check("Mod offers a use action", cat.listItemActionHandlerKeys("Mod").length > 0);

    
    
    
    
    
    
    
    
    
    const toolKeys = cat.listItemActionHandlerKeys("Tool").map((o) => o.value);
    const weaponKeys = cat.listItemActionHandlerKeys("Weapon").map((o) => o.value);
    const modKeys = cat.listItemActionHandlerKeys("Mod").map((o) => o.value);
    const allItem = [...toolKeys, ...weaponKeys, ...modKeys];
    
    
    
    
    
    
    
    
    
    
    check(
        "a Tool is offered the dig action",
        toolKeys.includes("itemExcavate"),
        toolKeys.join(" "),
    );
    check(
        "a Weapon is offered the shoot action",
        weaponKeys.includes("itemShoot"),
        weaponKeys.join(" "),
    );
    
    
    check("a Weapon is not offered the dig action", !weaponKeys.includes("itemExcavate"));
    check("a Tool is not offered the shoot action", !toolKeys.includes("itemShoot"));
    
    
    
    
    
    check(
        "a Tool is offered no excavation preset",
        !toolKeys.some((k) => k.startsWith("excavation")),
        toolKeys.join(" "),
    );
    check(
        "Mod never sees the dig presets",
        !modKeys.includes("excavationCrusher"),
        modKeys.join(" "),
    );
    check(
        "noop is available to every type",
        toolKeys.includes("noop") && weaponKeys.includes("noop") && modKeys.includes("noop"),
    );
    check(
        "every offered key resolves to a function",
        allItem.every((k) => !!resolveAction(k)),
    );

    
    
    
    
    
    
    
    const field = sch.fieldsFor("items").find((f) => f.key === "processId")!;
    check("item declares a process reference", field?.kind === "processRef");
    check("the process field offers no dropdown options", !field.options);
    check("field is hidden for Consumable", field.when?.({ itemType: "Consumable" }) === false);
    check("field is shown for Tool", field.when?.({ itemType: "Tool" }) === true);
    check("field is hidden when no type chosen", field.when?.({}) === false);

    
    const { itemActionHandlersFor } = await import("../../handler/core/handler-registry.ts");
    const toolKeys2 = itemActionHandlersFor("Tool").map((m) => m.key);
    const weaponKeys2 = itemActionHandlersFor("Weapon").map((m) => m.key);
    
    
    
    
    
    
    check(
        "actions follow the itemType",
        toolKeys2.includes("toast") && weaponKeys2.includes("toast"),
        `tool=${toolKeys2.join(" ")} weapon=${weaponKeys2.join(" ")}`,
    );
    
    
    
    
    
    
    
    
    
    
    check(
        "a Tool is offered the dig action and not the shoot",
        toolKeys2.includes("itemExcavate") &&
            !toolKeys2.includes("itemShoot"),
        `tool=${toolKeys2.join(" ")}`,
    );
    check(
        "a Weapon is offered the shoot action and not the dig",
        weaponKeys2.includes("itemShoot") && !weaponKeys2.includes("itemExcavate"),
        `weapon=${weaponKeys2.join(" ")}`,
    );
    check("a Consumable gets no action at all", itemActionHandlersFor("Consumable").length === 0);

    
    const rt = roundTrip("items", {
        id: "md-my-hown-mod:mdmy.item.pick",
        name: "Pick",
        itemType: "Tool",
        actions: [{ key: "itemExcavate" }],
        sprite: { id: "sprites:pick", type: "onehand" },
    });
    check(
        "item process round-trips",
        JSON.stringify(rt.back.actions) === JSON.stringify([{ key: "itemExcavate" }]),
        JSON.stringify(rt.back.actions),
    );

    
    const consumed = formToEntry("items", {
        idSuffix: "juice",
        name: "Juice",
        itemType: "Consumable",
        processId: "sorter",
        spriteId: "sprites:juice",
    });
    check(
        "consumable never stores a process",
        consumed.processId === undefined,
        JSON.stringify(consumed.processId),
    );
    
    
    const backToTool = formToEntry("items", {
        idSuffix: "juice",
        name: "Juice",
        spriteId: "sprites:juice",
        itemType: "Tool",
        processId: "sorter",
    });
    check(
        "switching Consumable → Tool restores the process",
        backToTool.processId === "sorter",
        JSON.stringify(backToTool.processId),
    );
}

console.log("── tech fields are selectors, not free text (Phase 8) ──");
{
    const sch = await import("../schema.ts");
    const cat = await import("../../catalog.ts");
    const f = (k: string) => sch.fieldsFor("techs").find((x) => x.key === k)!;

    
    for (const k of ["currencyType", "branch"]) check(`${k} is a select`, f(k).kind === "select");
    check("currencyType has a custom box", f("currencyTypeCustom").kind === "text");
    check("branch has a custom box", f("branchCustom").kind === "text");
    check(
        "currency custom box only shows for __custom__",
        f("currencyTypeCustom").when?.({ currencyType: "__custom__" }) === true,
    );
    check(
        "currency custom box hidden otherwise",
        f("currencyTypeCustom").when?.({ currencyType: "gold" }) === false,
    );
    check(
        "branch custom box only shows for __custom__",
        f("branchCustom").when?.({ branch: "__custom__" }) === true,
    );

    
    
    const curs = cat.listCurrencyTypes().map((o) => o.value);
    const brs = cat.listTechBranches().map((o) => o.value);
    check("gold is offered", curs.includes("gold"), curs.join(" "));
    check(
        "no invented currency names remain",
        !curs.some((c) => ["auralite", "artifact", "ticket"].includes(c)),
        curs.join(" "),
    );
    check("currency offers a custom escape", curs.includes("__custom__"));
    check("branch offers a custom escape", brs.includes("__custom__"));
    check(
        "no invented branch names remain",
        !brs.includes("alien") && !brs.includes("refining"),
        brs.join(" "),
    );

    
    check("requires is a multiselect", f("requires").kind === "multiselect");
    check("parentId is a select", f("parentId").kind === "select");
    check("unlockStructures is a multiselect", f("unlockStructures").kind === "multiselect");
    check("unlockItems is a multiselect", f("unlockItems").kind === "multiselect");

    
    const rt = roundTrip("techs", {
        id: "md-my-hown-mod:mdmy.tech.tier2",
        name: "Tier 2",
        cost: 250,
        requires: ["md-my-hown-mod:mdmy.tech.tier1"],
        unlocks: { structures: ["md-my-hown-mod:mdmy.structure.crusher"] },
    });
    check(
        "requires round-trips as an array",
        Array.isArray(rt.back.requires) && rt.back.requires[0].endsWith("tier1"),
        JSON.stringify(rt.back.requires),
    );
    check(
        "unlocks.structures round-trips",
        rt.back.unlocks?.structures?.[0]?.endsWith("crusher") === true,
        JSON.stringify(rt.back.unlocks),
    );

    
    
    const seed = (techs: unknown[]) => {
        store.config = { ...(store.config ?? {}), techs };
    };
    seed([
        {
            id: "md-my-hown-mod:mdmy.tech.tier1",
            name: "Tier 1",
            branch: "industry",
            currencyType: "gold",
        },
        { id: "md-my-hown-mod:mdmy.tech.tier2", name: "Tier 2" },
    ]);
    const allIds = cat.listTechIds().map((o) => o.value);
    check("tech list is populated from the config", allIds.length === 2, allIds.join(" "));
    
    const ids = cat.listTechIds("mdmy.tech.tier2").map((o) => o.value);
    check(
        "self is excluded from the tech list",
        !ids.some((i) => i.endsWith("mdmy.tech.tier2")),
        ids.join(" "),
    );
    check(
        "other nodes remain selectable",
        ids.some((i) => i.endsWith("mdmy.tech.tier1")),
        ids.join(" "),
    );

    
    check(
        "branch options derive from the config",
        cat.listTechBranches().map((o) => o.value).includes("industry"),
        cat.listTechBranches().map((o) => o.value).join(" "),
    );
    seed([{ id: "md-my-hown-mod:mdmy.tech.c", name: "C", currencyType: "weirdcoin" }]);
    check(
        "currency options derive from the config",
        cat.listCurrencyTypes().map((o) => o.value).includes("weirdcoin"),
        cat.listCurrencyTypes().map((o) => o.value).join(" "),
    );

    
    
    seed([
        { id: "md-my-hown-mod:mdmy.tech.tier2", name: "Tier 2" },
        { id: "md-my-hown-mod:mdmy.tech.tier2b", name: "Tier 2b" },
    ]);
    const siblings = cat.listTechIds("mdmy.tech.tier2").map((o) => o.value);
    check(
        "a similarly-named sibling is not over-excluded",
        siblings.some((i) => i.endsWith("mdmy.tech.tier2b")),
        siblings.join(" "),
    );
    check(
        "self is still excluded alongside a sibling",
        !siblings.some((i) => i === "md-my-hown-mod:mdmy.tech.tier2"),
        siblings.join(" "),
    );
    seed([]);

    
    const cur = roundTrip("techs", {
        id: "md-my-hown-mod:mdmy.tech.custom",
        name: "Custom",
        cost: 10,
        currencyType: "weirdcoin",
        branch: "weirdbranch",
    });
    check(
        "unknown currency is preserved, not dropped",
        cur.back.currencyType === "weirdcoin",
        JSON.stringify(cur.back.currencyType),
    );
    check(
        "unknown branch is preserved, not dropped",
        cur.back.branch === "weirdbranch",
        JSON.stringify(cur.back.branch),
    );
    check(
        "unknown currency lands in the custom box",
        cur.form.currencyType === "__custom__" && cur.form.currencyTypeCustom === "weirdcoin",
        JSON.stringify(cur.form),
    );
    check(
        "known currency stays on the picker",
        (() => {
            const g = roundTrip("techs", {
                id: "md-my-hown-mod:mdmy.tech.g",
                name: "G",
                cost: 1,
                currencyType: "gold",
            });
            return g.form.currencyType === "gold" && g.form.currencyTypeCustom === "";
        })(),
    );

    
    
    const cleared = formToEntry("techs", {
        idSuffix: "c",
        name: "C",
        cost: "1",
        currencyType: "__custom__",
        currencyTypeCustom: "",
    });
    check(
        "empty custom box stores nothing",
        cleared.currencyType === undefined,
        JSON.stringify(cleared.currencyType),
    );
}

{
    
    
    
    
    
    

    console.log("── unlock nodes: the required owner of every structure's gate ──");

    const cat = await import("../../catalog.ts");
    const tl = await import("../tech-link.ts");
    store.config = {
        ...(store.config ?? {}),
        unlockNodes: [
            {
                id: "md-my-hown-mod:unlock.tier1",
                name: "Tier 1",
                kind: "tech",
                cost: 50,
                parentId: "md-my-hown-mod:unlock.default",
            },
            { id: "md-my-hown-mod:unlock.free", name: "Free", kind: "always" },
        ],
    };

    
    
    const opts = cat.listUnlockNodes().map((o) => o.value);
    check(
        "the default node is always offered",
        opts[0] === "md-my-hown-mod:unlock.default",
        opts.join(" "),
    );
    check("configured nodes are offered", opts.length === 3, opts.join(" "));
    store.config = { ...(store.config ?? {}), unlockNodes: [] };
    check(
        "the default survives an empty node list",
        cat.listUnlockNodes().length === 1,
        String(cat.listUnlockNodes().length),
    );
    store.config = {
        ...(store.config ?? {}),
        unlockNodes: [
            {
                id: "md-my-hown-mod:unlock.tier1",
                name: "Tier 1",
                kind: "tech",
                cost: 50,
                parentId: "md-my-hown-mod:unlock.free",
            },
        ],
    };

    const tech = roundTrip("unlockNodes", {
        id: "md-my-hown-mod:unlock.tier1",
        name: "Tier 1",
        kind: "tech",
        cost: 50,
        parentId: "md-my-hown-mod:unlock.free",
    });
    check(
        "a 'tech' node keeps its research fields",
        tech.back.cost === 50 && tech.back.parentId === "md-my-hown-mod:unlock.free",
        JSON.stringify(tech.back),
    );
    check(
        "a 'tech' node does not become a borrower",
        tech.back.techId === undefined,
        JSON.stringify(tech.back.techId),
    );

    const free = roundTrip("unlockNodes", {
        id: "md-my-hown-mod:unlock.free",
        name: "Free",
        kind: "always",
    });
    
    
    
    check(
        "an 'always' node keeps no research fields",
        free.back.cost === undefined && free.back.parentId === undefined,
        JSON.stringify(free.back),
    );
    check(
        "an 'always' node keeps its kind",
        free.back.kind === "always",
        JSON.stringify(free.back.kind),
    );

    
    
    const borrowed = formToEntry("unlockNodes", {
        idSuffix: "borrowed",
        name: "Borrowed",
        kind: "tech",
        useExistingTech: "true",
        techId: "md-my-hown-mod:unlock.tier1",
        cost: "999",
    });
    check(
        "a borrowed node keeps the tech id",
        borrowed.techId === "md-my-hown-mod:unlock.tier1",
        JSON.stringify(borrowed.techId),
    );
    check(
        "a borrowed node drops the cost",
        borrowed.cost === undefined,
        JSON.stringify(borrowed.cost),
    );

    
    
    const st = roundTrip("structures", {
        id: "md-my-hown-mod:crusher",
        unlockNode: "md-my-hown-mod:unlock.tier1",
    });
    check(
        "a structure keeps its unlock node",
        st.back.unlockNode === "md-my-hown-mod:unlock.tier1",
        JSON.stringify(st.back.unlockNode),
    );
    const dangling = entryToForm("structures", {
        id: "md-my-hown-mod:crusher",
        unlockNode: "md-my-hown-mod:unlock.gone",
    });
    check(
        "a dangling node is still read into the form",
        dangling.unlockNode === "md-my-hown-mod:unlock.gone",
        String(dangling.unlockNode),
    );

    
    
    
    
    const built = tl.engineTechOf(store.config.unlockNodes[0], store.config);
    check(
        "a 'tech' node resolves to an engine tech carrying its structures",
        built?.id === "md-my-hown-mod:unlock.tier1" && Array.isArray(built?.unlocks?.structures),
        JSON.stringify(built),
    );
}

console.log("── asset previews are real 16×16 pixels (Phase 10) ──");
{
    const cat = await import("../../catalog.ts");
    const styles = await import("../styles.ts");
    const assets = cat.listLibraryAssets();
    check("library is populated", assets.length > 0, String(assets.length));

    
    const noPreview = assets.filter((a) => !a.preview?.startsWith("data:image/png;base64,"));
    check(
        "every asset has a PNG data URL preview",
        noPreview.length === 0,
        noPreview.map((a) => a.name).join(" "),
    );

    
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
    check(
        "declared preview size matches the PNG header",
        badSize.length === 0,
        badSize.map((a) => a.name).join(" "),
    );
    
    
    
    
    
    const icons = assets.filter((a) => a.path.startsWith("assets/icons/"));
    const not16 = icons.filter((a) => a.previewW !== 16 || a.previewH !== 16);
    check(
        "every icon previews at 16×16",
        not16.length === 0,
        not16.map((a) => `${a.name} ${a.previewW}x${a.previewH}`).join(" "),
    );
    
    
    const nonIcons = assets.filter((a) => !a.path.startsWith("assets/icons/"));
    check(
        "non-icon bundled assets are listed too",
        nonIcons.length > 0,
        `${assets.length} assets, all under assets/icons/`,
    );

    
    check(
        "sprite scaling is pixelated",
        styles.spritePixel.imageRendering === "pixelated",
        String(styles.spritePixel.imageRendering),
    );

    
    check(
        "search still matches by name",
        cat.searchLibraryAssets("alien").some((a) => a.name === "icon-alien"),
    );
    check(
        "search carries previews through",
        cat.searchLibraryAssets("alien").every((a) => !!a.preview),
    );
}

console.log("── handler registry is documented and API-verified ──");
{
    const {
        ANY_ACTIONS,
        ACTION_DOCS,
        MODIFIER_ACTIONS,
        PROCESSING_ACTIONS,
    } = await import("../../handler/actions/index.ts");

    
    
    
    
    
    
    
    
    const live = new Set([
        ...Object.keys(ANY_ACTIONS),
        ...Object.keys(PROCESSING_ACTIONS),
        ...Object.keys(MODIFIER_ACTIONS),
    ]);
    for (const key of live) {
        check(`doc: ${key}`, !!ACTION_DOCS[key], "missing from ACTION_DOCS");
    }
    for (const key of Object.keys(ACTION_DOCS)) {
        check(`ACTION_DOCS live: ${key}`, live.has(key), "no such action");
    }

    
    const removed = [
        "techUnlockStructure", 
        "techGrantUpgrade", 
        "energyGenerator", 
        "energyConsumer", 
        "energyFromTool", 
        "energyFromProcessor", 
    ];
    for (const key of removed) {
        check(`removed: ${key}`, !(key in ANY_ACTIONS), "still registered");
    }

    
    for (const key of ["techAppendUnlock", "techSetUpgradeLevel", "energyConductor"]) {
        check(`added: ${key}`, key in ANY_ACTIONS, "missing");
    }

    
    const commits: unknown[][] = [];
    const ctx = {
        getResolvedTypeAtCell: () => 7,
        commit: (...args: unknown[]) => commits.push(args),
    };
    PROCESSING_ACTIONS.processorLift?.({ x: 1, y: 2 }, ctx);
    check("processorLift commit arity", commits[0]?.length === 1, `args=${commits[0]?.length}`);
    commits.length = 0;
    PROCESSING_ACTIONS.processorConvert?.({ x: 1, y: 2 }, ctx, { to: 9 });
    check("processorConvert commit arity", commits[0]?.length === 1, `args=${commits[0]?.length}`);

    
    
    
    
    const EXC = await import("../../handler/excavation-option/index.ts");
    const drill = EXC.EXCAVATION_OPTIONS.excavationDrill?.({});
    check(
        "drillTierDamage is numeric",
        typeof drill?.options?.drillTierDamage === "number",
        String(drill?.options?.drillTierDamage),
    );
    
    
    check(
        "the flags sit under options, not at the top level",
        drill?.power === 8 && drill.options?.fromDrill === true,
        JSON.stringify(drill),
    );

    
    const allowed = new Set(["capacity", "energyType"]);
    for (
        const key of [
            "energyDefault",
            "energyBank",
            "energyWire",
            "energyConductor",
            "energyNetwork",
        ]
    ) {
        const out = ANY_ACTIONS[key]?.({} as never, {}) as Record<string, unknown> | undefined;
        const bad = Object.keys(out ?? {}).filter((k) => !allowed.has(k));
        check(
            `energy opts documented: ${key}`,
            bad.length === 0,
            `undocumented: ${bad.join(", ")}`,
        );
    }

    
    check("MODIFIER_ACTIONS non-empty", Object.keys(MODIFIER_ACTIONS).length > 0);
}

console.log("── schema matches the real engine contracts ──");
{
    const keysOf = (cat) => fieldsFor(cat).map((f) => f.key);
    const optValues = (cat, key) => {
        const f = fieldsFor(cat).find((x) => x.key === key);
        return typeof f?.options === "function"
            ? f.options()
            : (f?.options ?? []).map((o) => o.value);
    };

    
    const roles = optValues("energy", "type");
    check(
        "energy roles are conductor/storage",
        roles.length === 2 && roles.includes("conductor") && roles.includes("storage"),
        JSON.stringify(roles),
    );
    check("energy has no producer role", !roles.includes("producer"));
    check("energy has no consumer role", !roles.includes("consumer"));
    check("energy exposes capacity", keysOf("energy").includes("capacity"));
    check("energy exposes network (energyType)", keysOf("energy").includes("energyType"));
    check("energy drops excludeFromNetwork", !keysOf("energy").includes("excludeFromNetwork"));

    
    check("terrain has no fog field", !keysOf("terrains").includes("fog"));
    check("terrain still exposes flammable", keysOf("terrains").includes("flammable"));

    
    const p = keysOf("processing");
    check("processing has no mode field", !p.includes("mode"));
    check("processing has no structureId field", !p.includes("structureId"));
    check("processing keys on structureType", p.includes("structureType"));
    check("processing has intervalMs", p.includes("intervalMs"));
    
    
    check("processing declares a process reference", p.includes("processId"));

    
    const spritePath = fieldsFor("sprites").find((f) => f.key === "path");
    check("sprite path is library kind", spritePath?.kind === "library");
    check("sprite path has no manual pattern", !spritePath?.pattern);

    
    const groups = MENU_GROUPS.map((g) => ({ key: g.key, cats: g.categories }));
    const techGroup = groups.find((g) => g.key === "tech");
    check("there is a Tech group", !!techGroup);
    check(
        "Tech group holds techs+upgrades",
        techGroup?.cats.includes("techs") && techGroup?.cats.includes("upgrades"),
    );
    const worldGroup = groups.find((g) => g.key === "world");
    check("World no longer holds techs", !worldGroup?.cats.includes("techs"));
    check("World no longer holds upgrades", !worldGroup?.cats.includes("upgrades"));
    
    
    const allCats = groups.flatMap((g) => g.cats);
    const attached = Object.values(ATTACHED).flat();
    const orphans = Object.keys(CATEGORY_META).filter(
        (k) => !allCats.includes(k as never) && !attached.includes(k as never),
    );
    check("no category is orphaned", orphans.length === 0, JSON.stringify(orphans));
    
    const doubled = allCats.filter((c) => attached.includes(c as never));
    check("no category is both a chip and an attachment", doubled.length === 0, doubled.join(","));
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
    check(
        "a tech requirement is stored as a plain id",
        entry.requirement === "mdmy.tech.tier2",
        JSON.stringify(entry.requirement),
    );

    
    
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
    check(
        "the raw box is shown for an object requirement",
        legacy.requirementTechId === "__custom__",
        legacy.requirementTechId,
    );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) Deno.exit(1);
