



import { assertEquals } from "jsr:@std/assert";


const seen: {
    bindings?: { id: string; keys: unknown; def: unknown }[];
    processing?: { id: string; def: unknown }[];
    placementConfigs?: unknown[];
} = {};


globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        sprites: { list: () => [] },
        structures: {
            list: () => [],
            recipes: {},
            processing: {
                register: (id: string, def: unknown) => {
                    (seen.processing ??= []).push({ id, def });
                },
            },
            registerPlacementConfig: (def: unknown) => {
                (seen.placementConfigs ??= []).push(def);
            },
            signals: {},
        },
        elements: { list: () => [] },
        items: { list: () => [] },
        input: {
            
            
            
            registerBinding: (id: string, keys: unknown, def: unknown) => {
                (seen.bindings ??= []).push({ id, keys, def });
            },
        },
        actions: {
            
            
            list: () => ["noop"],
        },
    },
    react: { createElement: () => null },
    enums: {},
};

const { registerTheRest } = await import("./the-rest.ts");

Deno.test("a bare-key input binding is registered with a live function", () => {
    seen.bindings = [];
    
    
    const counts = registerTheRest({
        inputBindings: [
            {
                id: "md-my-hown-mod:mdmy.binding.noop",
                onDownKey: "noop",
                onUpKey: "noop",
            },
        ],
    } as never);

    assertEquals(counts.inputBindings, 1, "the binding was not registered at all");
    const handlers = seen.bindings[0].def.handlers as Record<string, unknown>;
    
    
    
    assertEquals(
        typeof handlers.down,
        "function",
        "the down slot was not compiled to a function",
    );
    assertEquals(
        typeof handlers.up,
        "function",
        "the up slot was not compiled to a function",
    );
});

Deno.test("an unknown binding key is reported, not registered as text", () => {
    seen.bindings = [];
    const counts = registerTheRest({
        inputBindings: [
            {
                id: "md-my-hown-mod:mdmy.binding.bogus",
                onDownKey: "noSuchHandlerAnywhere",
                onUpKey: "noSuchHandlerAnywhere",
            },
        ],
    } as never);
    
    
    assertEquals(counts.inputBindings, 1);
    const def = seen.bindings[0].def as Record<string, unknown>;
    assertEquals(def.handlers, {}, "an unknown key must not produce a handler");
});




















Deno.test("a processing entry reaches the engine without a function in the entry", () => {
    seen.processing = [];
    const entry = {
        id: "gen-tick",
        structureType: "md-my-hown-mod:generator",
        intervalMs: 200,
        processId: "artefact-generator-tick",
    };

    registerTheRest({
        version: 1,
        processing: [entry],
        processes: [
            {
                id: "artefact-generator-tick",
                scope: "processing",
                steps: [{ key: "bufferRead", options: { path: "progress" }, as: "x" }],
            },
        ],
    } as never);

    
    const def = seen.processing[0].def as Record<string, unknown>;
    assertEquals(typeof def.process, "function", "the engine got no callback");
    assertEquals(
        def.structureType,
        "md-my-hown-mod:generator",
        "and no structure type, so nothing ticks",
    );

    
    assertEquals(
        typeof entry.process,
        "undefined",
        "the compiled callback was written onto the stored config entry",
    );
    assertEquals(
        JSON.stringify(entry),
        JSON.stringify({
            id: "gen-tick",
            structureType: "md-my-hown-mod:generator",
            intervalMs: 200,
            processId: "artefact-generator-tick",
        }),
        "the stored entry was mutated — a function in here breaks the save's clone",
    );
});













Deno.test("an option no action declares is reported, not silently dropped", async () => {
    const { compileEntryProcess, setProcessRegistry } = await import(
        "../handler/custom-process/index.ts"
    );
    const registry = new Map();
    setProcessRegistry(registry);

    registry.set("bad-opts", {
        id: "bad-opts",
        scope: "processing",
        steps: [
            { key: "setSpritesheetByValue", options: { value: "1" } },
            
            { key: "setSpritesheetByValue", options: { value2: "1", thresholds: "0.5" } },
        ],
    });

    const compiled = compileEntryProcess({ processId: "bad-opts" }, "processing", registry);

    assertEquals(
        compiled.skipped,
        [],
        "the action key is valid, so nothing is skipped — that is the whole problem",
    );
    assertEquals(
        compiled.unknownOptions,
        ["setSpritesheetByValue.value"],
        "the misspelled option was not reported",
    );
});

Deno.test("a step's own key and as are not mistaken for options", async () => {
    const { compileEntryProcess, setProcessRegistry } = await import(
        "../handler/custom-process/index.ts"
    );
    const registry = new Map();
    setProcessRegistry(registry);

    registry.set("clean", {
        id: "clean",
        scope: "processing",
        steps: [
            {
                key: "setSpritesheetByValue",
                options: { value2: "0", thresholds: "0.5" },
                as: "frame",
            },
        ],
    });

    const compiled = compileEntryProcess({ processId: "clean" }, "processing", registry);
    assertEquals(compiled.unknownOptions, [], "a well-formed step reported a problem");
});



Deno.test("the config's placement definition reaches registerPlacementConfig", async () => {
    
    
    
    
    
    
    
    const cfg = JSON.parse(
        await Deno.readTextFile(
            new URL(
                "../../../md-random-artefact/config/random-artefact.json",
                import.meta.url,
            ),
        ),
    );

    seen.placementConfigs = [];
    const counts = registerTheRest({
        structures: cfg.structures,
        placementConfigs: cfg.placementConfigs,
    } as never);

    assertEquals(
        (seen.placementConfigs ?? []).length,
        1,
        "no placement definition was handed to the engine",
    );
    assertEquals(counts.placementConfigs, 1);

    const sent = seen.placementConfigs![0] as {
        structureId: string;
        fields: { id: string; type: string; default?: unknown }[];
    };
    assertEquals(sent.structureId, "md-my-hown-mod:generator");
    assertEquals(
        sent.fields.map((f) => f.id),
        ["chargeTarget", "matPref"],
    );
    
    
    for (const f of sent.fields) {
        assertEquals("default" in f, true, `${f.id} reaches the engine with no default`);
    }
});

Deno.test("a definition nested under a structure registers nothing", async () => {
    
    
    
    const cfg = JSON.parse(
        await Deno.readTextFile(
            new URL(
                "../../../md-random-artefact/config/random-artefact.json",
                import.meta.url,
            ),
        ),
    );
    const structures = cfg.structures.map((s: Record<string, unknown>) => ({ ...s }));
    structures[0] = {
        ...structures[0],
        placementConfigs: cfg.placementConfigs,
    };

    seen.placementConfigs = [];
    registerTheRest({ structures, placementConfigs: undefined } as never);
    assertEquals(
        (seen.placementConfigs ?? []).length,
        0,
        "a nested entry was registered, so the loop is reading somewhere unexpected",
    );
});
