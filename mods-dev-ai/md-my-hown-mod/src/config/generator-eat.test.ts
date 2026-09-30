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
import { assert, assertEquals } from "jsr:@std/assert";

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

/** A process step, with the nested branches `if` blocks carry. */
type Step = {
    key: string;
    as?: string;
    options?: Record<string, string>;
    then?: Step[];
    else?: Step[];
};

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

function compileEntry(id: string, processes = CONFIG.processes as never[]) {
    const registry = new ProcessRegistry(processes);
    setProcessRegistry(registry);
    const entry = (CONFIG.processing as { id: string; processId?: string }[]).find(
        (p) => p.id === id,
    );
    if (!entry) throw new Error(`no processing entry "${id}"`);
    return compileEntryProcess({ processId: entry.processId }, "processing", registry);
}

/** Compile the config's tick, the way the register path does. */
const compileTick = () => compileEntry("gen-tick");

/** Compile the artefact's emitter. */
const compileArtefact = () => compileEntry("artefact-tick");

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

Deno.test("the generator picks a material each cycle, and only eats that one", () => {
    // The rule the source mod's `pickMaterialIndex` implements. Pinned to gold it
    // charged at gold's rate forever and the copper and sand links could never
    // light — the material-link feature was dead on arrival while looking
    // correctly wired.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const pick = proc.steps.find((s: Step) => s.key === "randomInt");
    assertEquals(pick, {
        key: "randomInt",
        options: { min: "0", max: "2" },
        as: "pick",
    });
    // The pick has to be **stored**, or the three links have nothing to agree on
    // and each one is deciding for itself.
    assertEquals(
        proc.steps.some(
            (s: Step) =>
                s.key === "bufferWrite" && s.options?.path === "materialIndex" &&
                s.options?.value === "{{pick}}",
        ),
        true,
        "the pick is never written to materialIndex, so no link can read it",
    );

    // Each material gets its own branch, and the branch eats *that* material.
    // All three counted the same element, the choice would be cosmetic.
    // Walks **recursively**, which is load-bearing: `if` has no `else if`, so
    // copper's branch lives inside gold's `else` and sand's inside copper's.
    // A top-level-only search finds gold and reports the other two as missing,
    // which reads as "the branches were never written" rather than "the search
    // did not descend".
    const branchFor = (steps: Step[], varName: string): Step[] => {
        for (const s of steps) {
            if (s.key !== "if") continue;
            if (s.options?.var === varName) return s.then ?? [];
            const nested = branchFor(s.else ?? [], varName);
            if (nested.length) return nested;
        }
        return [];
    };
    const seen = new Set<string>();
    for (
        const [flag, element] of [
            ["isGold", "gold"],
            ["isCopper", "copper"],
            ["isSand", "sand"],
        ]
    ) {
        const branch = branchFor(proc.steps, flag);
        assertEquals(
            branch.some((s) => s.key === "logicCount" && s.options?.element === element),
            true,
            `the ${flag} branch never counts ${element}`,
        );
        seen.add(element);
    }
    assertEquals(
        seen.size,
        3,
        "the three branches do not each eat their own material — the pick is cosmetic",
    );

    // Each branch also lights its own link and no other. This is the whole point
    // of the three material structures existing.
    for (
        const [flag, link] of [
            ["isGold", "links-gold"],
            ["isCopper", "links-copper"],
            ["isSand", "links-sand"],
        ]
    ) {
        assertEquals(
            branchFor(proc.steps, flag).some(
                (s: Step) =>
                    s.key === "bufferWrite" && s.options?.path === link &&
                    s.options?.value === "1",
            ),
            true,
            `the ${flag} branch never publishes to ${link}`,
        );
    }
    // And all three links are cleared before the branches run, so a link stops
    // reporting active the moment its material stops being the chosen one.
    const cleared = proc.steps.filter(
        (s: Step) =>
            s.key === "bufferWrite" && s.options?.value === "0" &&
            s.options?.path?.startsWith("links-"),
    );
    assertEquals(cleared.length, 3, "the links are not all cleared before the pick");
});

Deno.test("the generator spawns once it crosses 50, and resets", () => {
    // The rule the `compare` action exists for, tested on the real config.
    //
    // Before this the tick stopped at charging: progress reached the clamp of 50
    // and stayed there, `status` read "charging" forever, and no artefact was
    // ever produced — the mod's entire output was unreachable. Every offline
    // check passed, which is the point: the program compiled and every action was
    // real, it just never branched.
    const compiled = compileTick();
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const keys = proc.steps.map((s: { key: string }) => s.key);
    assertEquals(
        keys.includes("compare"),
        true,
        "the tick has no threshold test, so it can never know it is full",
    );
    const block = proc.steps.find(
        (s: { key: string; options?: { var?: string } }) =>
            s.key === "if" && s.options?.var === "full",
    );
    assertEquals(
        block?.options?.var,
        "full",
        "the branch tests the comparison's own output, not some other name",
    );
    // And the branch has to do the three things that make a spawn a spawn.
    const then = block.then.map((s: { key: string }) => s.key);
    assertEquals(
        then.includes("buildStructure"),
        true,
        "the full branch never places the artefact",
    );
    assertEquals(
        then.includes("bufferWrite"),
        true,
        "the full branch never hands over the spawn payload",
    );
    // The reset is the part that would be missed: without it the generator stays
    // full and spawns on every subsequent tick.
    const reset = block.then.find(
        (s: { key: string; options?: { path?: string } }) =>
            s.key === "bufferWrite" && s.options?.path === "progress",
    );
    assertEquals(reset?.options?.value, "0", "progress is not reset after a spawn");
});

Deno.test("the artefact emits while it has something left, and removes itself after", () => {
    // The source mod's whole lifecycle: emit 2 per tick, then delete itself.
    // The config had the structure registered with `remaining: 0` and **no
    // processor at all**, so none of this existed.
    const compiled = compileArtefact();
    assertEquals(compiled.skipped, [], "an action key the catalogue does not know");
    assertEquals(compiled.unknownOptions, [], "an option no action declares");

    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-emit");
    const block = proc.steps.find((s: { key: string }) => s.key === "if");
    assertEquals(block?.options?.var, "hasMore");
    assertEquals(
        block.then.filter((s: { key: string }) => s.key === "createElement").length,
        2,
        "the source emits 2 cells per tick",
    );
    assertEquals(
        block.else.map((s: { key: string }) => s.key),
        ["removeStructure"],
        "having emitted everything, the artefact removes itself",
    );
    // The counter is what makes `hasMore` true at all, and a negative counter
    // would flip the branch the wrong way on the first tick.
    const slot = CONFIG.buffers.find((b: { path: string }) => b.path === "emit-remaining");
    assertEquals(slot.min, 0, "the count-down is clamped at zero, not left to go negative");
});

Deno.test("every buffer path a step uses is one the config declares", () => {
    // The failure this catches is silent and total: `bufferRead` of an undeclared
    // path returns the type's zero, so the process compiles, every action is real,
    // and the value is simply always 0. That is exactly how the three material
    // links came to report "idle" forever — they read `links.goldActive` while the
    // declared buffers were `links-gold`.
    const declared = new Set(
        (CONFIG.buffers as { path: string }[]).map((b) => b.path),
    );
    const used = new Set<string>();
    const walk = (steps: { key: string; options?: { path?: string } }[]) => {
        for (const s of steps ?? []) {
            if (s.key.startsWith("buffer") && typeof s.options?.path === "string") {
                used.add(s.options.path);
            }
            const nested = s as unknown as {
                then?: { key: string; options?: { path?: string } }[];
                else?: { key: string; options?: { path?: string } }[];
            };
            walk(nested.then ?? []);
            walk(nested.else ?? []);
        }
    };
    for (
        const p of CONFIG.processes as {
            id: string;
            steps: { key: string; options?: { path?: string } }[];
        }[]
    ) {
        walk(p.steps);
    }
    assertEquals(
        [...used].filter((p) => !declared.has(p)).sort(),
        [],
        "a buffer path no slot declares — reads of these silently return zero",
    );
    // And the reverse, which is the other half: the link buffers exist precisely
    // so the three material processes have somewhere to publish.
    for (const name of ["gold", "copper", "sand"]) {
        assertEquals(
            declared.has(`links-${name}`),
            true,
            `links-${name} is declared but unused, so no link can publish to it`,
        );
    }
});

/**
 * The steps of the branch that runs when the generator picked gold.
 *
 * Walks nested `if` blocks rather than indexing, so it keeps finding the right
 * branch when the nesting is rearranged — which is what a config author editing
 * the process in the panel will do.
 */
function goldBranch(proc: { steps: Step[] }): Step[] {
    const find = (steps: Step[], varName: string): Step[] | undefined => {
        for (const s of steps) {
            if (s.key !== "if") continue;
            if (s.options?.var === varName) return s.then ?? [];
            const nested = find(s.else ?? [], varName);
            if (nested) return nested;
        }
        return undefined;
    };
    const outer = find(proc.steps, "isGold");
    if (!outer) throw new Error("no branch on isGold — the material pick is unwired");
    return outer;
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
    // The count and the increment now live **inside each material's branch**, not at
    // the top level — the generator eats only what it picked, so there is no
    // single `logicCount` left to point at. Finding the gold branch is what makes
    // this assertion mean "gold is counted and charged"; finding it by walking
    // rather than by position is what keeps that true when branches move.
    const gold = goldBranch(proc);
    const must = (key: string): Step => {
        const s = gold.find((step) => step.key === key);
        if (!s) throw new Error(`the gold branch has no "${key}" step`);
        return s;
    };
    assertEquals(must("bufferIncrement"), {
        key: "bufferIncrement",
        options: { path: "progress", delta: "{{eaten}}" },
    });
    // And the count that feeds it is the count of what was eaten.
    const count = must("logicCount");
    assertEquals(count.as, "eaten", "the count is not bound to the name the delta reads");
    assertEquals(count.options?.element, "gold", "and it counts the chosen material");
    // The removal must name the **same** element, or the generator charges for
    // what it did not take — a leak that no assertion on the increment would catch.
    const remove = must("removeElement");
    assertEquals(
        remove.options?.element,
        count.options?.element,
        "it counts one element and removes another",
    );
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

Deno.test("the tick's branches come back through the panel, not just the steps", () => {
    // The round trip above checks that the form is *populated* — and it passed with
    // a config whose entire behaviour lived inside `if` blocks, because the grid
    // rendered a block as a bare row. So the stronger check is here: the branches
    // must be in the form the panel hands the editor, or the screen is showing an
    // `if` with nothing in it while the file has the whole program.
    //
    // `then`/`else` were dropped by `withOptions` and `withAs` on the first keystroke,
    // so a config that round-trips on load could still be destroyed on save. This
    // asserts the shape is what the editor will be handed.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const form = entryToForm("customProcess", proc);
    const steps = JSON.parse(form.program__json ?? "[]") as Step[];

    const countBlocks = (list: Step[]): number =>
        list.reduce((n, s) =>
            n + (s.key === "if" ? 1 : 0) + countBlocks(s.then ?? []) +
            countBlocks(s.else ?? []), 0);
    assertEquals(
        countBlocks(steps),
        4,
        "the generator's threshold rule and three material branches are not all in the form",
    );

    // And each branch must still hold its steps, not just exist.
    const branchSizes: number[] = [];
    const collect = (list: Step[]): void => {
        for (const s of list) {
            if (s.key !== "if") continue;
            branchSizes.push((s.then ?? []).length, (s.else ?? []).length);
            collect(s.then ?? []);
            collect(s.else ?? []);
        }
    };
    collect(steps);
    assert(
        branchSizes.some((n) => n > 1),
        "every branch is empty or a single step, so the grid would show bare ifs",
    );
});
