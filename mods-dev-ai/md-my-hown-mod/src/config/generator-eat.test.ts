/**
 * The random-artefact generator's tick, run for real.
 *
 * The claim under test: **the tick eats**. The previous version of this config
 * did not — it read the shared buffer and mirrored it into the structure's data
 * bag, so nothing was ever consumed and `progress` sat at 0 forever. The bug was
 * only visible by playing the game, because every offline check passed: the
 * process compiled, every action key was known, and no step referred to a buffer
 * path that was not declared.
 *
 * So this runs the *actual config* — not a hand-written stand-in — through the
 * real compiler, against a fake grid:
 *
 *     logicCount      → how much gold is in the 3x3
 *     removeElement   → take it, atomically
 *     bufferIncrement → progress += eaten, clamped by the slot's own max
 *     setStructureData→ mirror it back for the tooltip
 *
 *   deno test -A src/config/generator-eat.test.ts
 */
import { assertEquals } from "jsr:@std/assert";

// Installed **before** anything else is imported: `../ui/schema.ts` reaches
// `api.ts`, which reads the host `sandkit` at module load. A stub set afterwards
// would be too late, and the failure is a bare `api.ts:28` with no hint that a
// global is missing.
const EMPTY = new Map<string, string>();
(function installHost() {
    const g = globalThis as Record<string, unknown>;
    g.sandkit = {
        api: {
            storage: { ensure: () => {}, get: () => undefined, set: () => {}, remove: () => {} },
            elements: {
                list: () => [],
                register: () => {},
                getResolvedTypeAtCell: (x: number, y: number) => EMPTY.get(`${x},${y}`) ?? null,
            },
            grid: { mutate: () => {}, isCellEmptyAtCell: () => true },
            shared: { buffers: {} },
            structures: { list: () => [], recipes: {}, signals: {}, processing: {} },
            items: { list: () => [] },
            sprites: { list: () => [] },
            ui: { toast: () => {} },
        },
        state: { store: { mods: {} } },
        react: { createElement: () => null },
        enums: {},
    };
})();

const { compileEntryProcess, setProcessRegistry } = await import(
    "../handler/custom-process/index.ts"
);
const { ProcessRegistry } = await import("../handler/custom-process/registry.ts");
const { entryToForm, validateForm } = await import("../ui/schema.ts");

const CONFIG_URL = new URL(
    "../../../__home/md-random-artefact/config/random-artefact.json",
    import.meta.url,
);

const CONFIG = JSON.parse(await Deno.readTextFile(CONFIG_URL));

/** A 4×4 of zeros, the generator's `useRawShape` footprint. */
const SHAPE = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
];

/**
 * The host the element actions need: `grid.mutate` and the resolved-type read.
 *
 * Small on purpose. The shared buffer is the real one — `buffer-store.ts` builds
 * a `JsonMapBuffer` on first use — so the clamp under test is the production
 * clamp rather than a stand-in for it.
 */
function host(cells: Map<string, string>) {
    const prev = (globalThis as Record<string, unknown>).sandkit;
    (globalThis as Record<string, unknown>).sandkit = {
        api: {
            storage: {
                ensure: () => {},
                get: () => undefined,
                set: () => {},
                remove: () => {},
            },
            // `removeAtCell` lives here, on the api — the batch writer has no
            // removal, which is why putting one in the fake is what hid the crash.
            elements: {
                getResolvedTypeAtCell: (x: number, y: number) => cells.get(`${x},${y}`) ?? null,
                removeAtCell: (x: number, y: number) => cells.delete(`${x},${y}`),
            },
            grid: {
                mutate: (fn: (w: { elements: unknown }) => void) =>
                    fn({
                        elements: {
                            createAtCell: (x: number, y: number, t: string) =>
                                cells.set(`${x},${y}`, t),
                            replaceAtCell: (x: number, y: number, t: string) =>
                                cells.set(`${x},${y}`, t),
                            // NO `removeAtCell`: the engine's writer has none.
                        },
                    }),
                isCellEmptyAtCell: (x: number, y: number) => !cells.has(`${x},${y}`),
            },
            shared: { buffers: {} },
        },
        state: { store: { mods: {} } },
        react: { createElement: () => null },
        enums: {},
    };
    return () => {
        if (prev === undefined) delete (globalThis as Record<string, unknown>).sandkit;
        else (globalThis as Record<string, unknown>).sandkit = prev;
    };
}

/** Compile the config's tick, the way the register path does. */
function compileTick() {
    // A real `ProcessRegistry`, not a `Map`: it is a class with a private index, and
    // `setProcessRegistry` is typed for it. A Map compiles under `--no-check` and
    // then fails the real build, which is not a trade worth making.
    const registry = new ProcessRegistry(CONFIG.processes as never);
    setProcessRegistry(registry);
    const entry = CONFIG.processing.find((p: { id: string }) => p.id === "gen-tick");
    return compileEntryProcess({ processId: entry.processId }, "processing", registry);
}

/** One tick, against a grid. Returns the structure's data bag afterwards. */
function tick(compiled: ReturnType<typeof compileTick>, cells: Map<string, string>) {
    const restore = host(cells);
    const structure = {
        type: "md-my-hown-mod:generator",
        x: 100,
        y: 200,
        shape: SHAPE,
        data: {} as Record<string, unknown>,
    };
    // The **context**, not just the host: `writeCells` reads the resolved-type and
    // emptiness checks off the `StructureProcessingContext` the engine hands the
    // processor, and refuses to write without them. A context of `{x, y}` compiles
    // and runs and silently writes nothing — which is the same "no api.grid.mutate"
    // warning for a completely different reason.
    const context = {
        getResolvedTypeAtCell: (x: number, y: number) => cells.get(`${x},${y}`) ?? null,
        isCellEmptyAtCell: (x: number, y: number) => !cells.has(`${x},${y}`),
    };
    try {
        compiled.fn(structure, context);
    } finally {
        restore();
    }
    return structure.data;
}

Deno.test("the tick's steps are all real", () => {
    const compiled = compileTick();
    assertEquals(compiled.skipped, [], "an action key the catalogue does not know");
    assertEquals(compiled.unknownOptions, [], "an option no action declares");
});

Deno.test("the generator's tick consumes the gold in its 3x3", () => {
    const compiled = compileTick();
    // The centre of the 4×4 is (101, 201); the eat region is 3×3 from there.
    const cells = new Map<string, string>([
        ["101,201", "gold"],
        ["102,201", "gold"],
        ["100,201", "copper"],
    ]);
    tick(compiled, cells);

    assertEquals(cells.get("101,201"), undefined, "the gold at the centre was not eaten");
    assertEquals(cells.get("102,201"), undefined, "nor the gold beside it");
    assertEquals(
        cells.get("100,201"),
        "copper",
        "a different element must survive — the whole point of removeElement",
    );
});

Deno.test("the progress step is an increment by the count eaten", () => {
    // The slot's own `max` is the clamp — this is what does the work the source
    // mod does with `min(MAX_PROGRESS, …)`, and it is why the tick needs no
    // arithmetic action.
    const slot = CONFIG.buffers.find((b: { path: string }) => b.path === "progress");
    assertEquals(slot.max, 50, "the clamp is the slot's bound, so it has to be right");
    assertEquals(slot.min, 0, "and progress cannot go below zero");
    assertEquals(slot.default, 0, "and it starts at zero");

    // Asserted on the *program*, not on the value written to the structure.
    //
    // The increment and the mirror both need the real engine: `bufferIncrement`
    // goes through the `JsonMapBuffer` the store allocates, and `setStructureData`
    // through `structures.update`. A fake host that answered those would be
    // testing the fake. The consumption above is the part that had actually
    // broken, and it is checked against a real grid.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const inc = proc.steps.find((s: { key: string }) => s.key === "bufferIncrement");
    assertEquals(inc, {
        key: "bufferIncrement",
        options: { path: "progress", delta: "{{eaten}}" },
    });
    // And the count that feeds it is the count of what was eaten.
    const count = proc.steps.find((s: { key: string }) => s.key === "logicCount");
    assertEquals(count.as, "eaten", "the count is not bound to the name the delta reads");
    assertEquals(count.options.element, "gold", "and it counts the pinned material");
});

Deno.test("a tick with nothing to eat leaves the world alone", () => {
    const compiled = compileTick();
    const cells = new Map<string, string>([["100,201", "copper"]]);
    tick(compiled, cells);
    assertEquals(cells.get("100,201"), "copper", "copper is not food");
});

Deno.test("the tick's process survives the panel round trip", () => {
    // The process is edited in the panel, so a tick the panel cannot read back is
    // one Save away from being emptied — which is exactly how the Scope select
    // and the Program grid came to be empty in the first place.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const form = entryToForm("customProcess", proc);
    assertEquals(form.scope, "processing", "the Scope select came up empty");
    assertEquals((form.program__json ?? "").length > 0, true, "the Program grid came up empty");
    assertEquals(validateForm("customProcess", form), {});
});
