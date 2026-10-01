// @ts-nocheck: the host stub is a partial `sandkit` and every register* call
// reaches through it, so the call sites cannot be typed without standing up the
// whole engine surface. Same trade as the other headless round-trip tests.
/**
 * The input-binding path in `registerTheRest`.
 */
import { assertEquals } from "jsr:@std/assert";

/** What the host was handed, per namespace. */
const seen: {
    bindings?: { id: string; keys: unknown; def: unknown }[];
    processing?: { id: string; def: unknown }[];
    placementConfigs?: unknown[];
} = {};

/** A resolver stub: `listInputBindingHandlerKeys` decides which keys are known. */
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
            // The engine signature is `(id, defaultKeys, definition)` — see the
            // `constants.ts` note on binding ids. The definition is the third
            // argument, so a stub that records the first is looking at an id.
            registerBinding: (id: string, keys: unknown, def: unknown) => {
                (seen.bindings ??= []).push({ id, keys, def });
            },
        },
        actions: {
            // The key this test binds. It only has to be a name the handler
            // registry knows; the point is that it arrives at all.
            list: () => ["noop"],
        },
    },
    react: { createElement: () => null },
    enums: {},
};

const { registerTheRest } = await import("./the-rest.ts");

Deno.test("a bare-key input binding is registered with a live function", () => {
    seen.bindings = [];
    // `noop` is a real action in the registry; the stub host only needs to
    // exist for the register call itself.
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
    // The whole failure mode was an empty pair: the key stayed as text because the
    // ref never resolved, so `typeof def.onDownKey === "function"` was false and
    // the slot was left out of `handlers` entirely.
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
    // Counted, but the slots are left alone: handing the engine a handler pair
    // with neither side filled is inert, and it warned on the way past.
    assertEquals(counts.inputBindings, 1);
    const def = seen.bindings[0].def as Record<string, unknown>;
    assertEquals(def.handlers, {}, "an unknown key must not produce a handler");
});

// ── the DataCloneError on quit ────────────────────────────────────────────────
// Found in the game, on every quit, with any config carrying a `processing`
// entry:
//
//   Uncaught (in promise) DataCloneError: Failed to execute 'postMessage' on
//   'Worker': … could not be cloned.
//
// The save is a structured clone of the whole store:
//
//   simulation.manager.postMessage([Save, { ...e.store }, …])
//
// and a **function** cannot be cloned. The register path used to write the
// compiled callback onto the config entry it was iterating — and
// `api.storage.get` is `state.store.mods[modId][key]`, a **live reference, not a
// copy**. So `entry.process = compiled.fn` was writing the function straight
// into the save payload, and every subsequent save threw.
//
// The engine is still handed a working callback; the fix is that the store never
// sees one.
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

    // The engine got a real callback…
    const def = seen.processing[0].def as Record<string, unknown>;
    assertEquals(typeof def.process, "function", "the engine got no callback");
    assertEquals(
        def.structureType,
        "md-my-hown-mod:generator",
        "and no structure type, so nothing ticks",
    );

    // …and the entry that lives in the store did not grow one.
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

// ── an option key no action declares ──────────────────────────────────────────
// The quietest failure in the catalogue. The action resolves, so `skipped` stays
// empty and the process compiles; the step then runs on the action's *defaults*.
// A config that named a real action and misspelled one of its options therefore
// looked perfectly valid everywhere above the action itself.
//
// Found in the game as the only symptom, on placing a structure:
//
//   setSpritesheetByValue: no thresholds, so there is no frame to choose
//
// The config said `{"value": "1"}`. The action's parameter is `value2`, and
// `thresholds` is what picks a frame at all.
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
            // The real names, in the same step list, to show the difference.
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

// ── the placement round trip ─────────────────────────────────────────────────

Deno.test("the config's placement definition reaches registerPlacementConfig", async () => {
    // The end-to-end shape of the bug this guards. `registerTheRest` iterates
    // `config.placementConfigs`; an entry nested under a structure is simply not
    // in that list, so the loop body never runs, nothing is registered, and the
    // hotbar widgets never appear -- with no error anywhere to notice. Reading
    // the nested location in the config test made it pass anyway.
    //
    // Driven by the REAL config file, so a move of the entry breaks this.
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
    // Every field needs a default, or the engine seeds it as `undefined` -- see
    // the note in `placement-fields.test.ts` about non-finite `compare`.
    for (const f of sent.fields) {
        assertEquals("default" in f, true, `${f.id} reaches the engine with no default`);
    }
});

Deno.test("a definition nested under a structure registers nothing", async () => {
    // The same config with the entry put back where it used to be. This must
    // register zero -- it is the failure being guarded against, pinned so the
    // location cannot quietly change back.
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
