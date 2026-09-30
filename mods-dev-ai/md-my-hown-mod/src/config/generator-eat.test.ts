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

/**
 * The `then` of the block that tests `varName`, anywhere in the tree.
 *
 * Descends into **both** branches. It used to follow only `else`, which was enough
 * when the three material blocks chained through `else` (there is no `else if`),
 * and wrong the moment a block was nested in a `then` — which is where the
 * `nextGold`/`nextCopper`/`nextSand` blocks live, inside the spawn branch. A
 * search that cannot see a block reports it as "never written", which reads as a
 * config bug rather than a test that is not looking in the right place.
 */
function branchFor(steps: Step[], varName: string): Step[] {
    for (const s of steps) {
        if (s.key !== "if") continue;
        if (s.options?.var === varName) return s.then ?? [];
        const nested = branchFor(s.then ?? [], varName);
        if (nested.length) return nested;
        const inElse = branchFor(s.else ?? [], varName);
        if (inElse.length) return inElse;
    }
    return [];
}

Deno.test("the material changes only when an artefact is generated", () => {
    // The rule the source mod implements: `pickMaterialIndex` runs on the spawn
    // cycle, not on the tick.
    //
    // The bug this pins: `randomInt` was the **first** step of the 200 ms tick, so
    // the generator re-rolled its material five times a second. Because the
    // material picks which link lights and how fast the charge climbs, the whole
    // machine churned constantly -- and it looked correct in the panel, because
    // every step was valid. Nothing offline can see a cadence; only the config's
    // *shape* can.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");

    // 1. No roll at the top of the tick. This is the assertion that would have
    //    caught it, and it is the simplest one to read.
    assertEquals(
        proc.steps.some((s: Step) => s.key === "randomInt"),
        false,
        "the tick re-rolls the material on every pass, so it changes five times a " +
            "second instead of once per artefact",
    );

    // 2. The tick *reads* the stored index, so the material persists between
    //    spawns. Without this read the branches have nothing to agree on.
    assertEquals(
        proc.steps.some(
            (s: Step) => s.key === "bufferRead" && s.options?.path === "materialIndex",
        ),
        true,
        "the tick no longer reads materialIndex, so the branches cannot see a material",
    );

    // 3. The roll is inside the threshold branch -- the spawn branch.
    const spawn = (proc.steps as Step[]).find(
        (s: Step) => s.key === "if" && s.options?.var === "full",
    );
    assert(spawn, "the generator has no threshold branch to spawn from");
    const roll = (spawn.then as Step[]).find((s: Step) => s.key === "randomInt");
    assertEquals(roll?.options, { min: "0", max: "2" });
    assertEquals(roll?.as, "pick", "the roll binds nothing, so it is discarded");
    assertEquals(
        (spawn.then as Step[]).some(
            (s: Step) =>
                s.key === "bufferWrite" && s.options?.path === "materialIndex" &&
                s.options?.value === "{{pick}}",
        ),
        true,
        "the new material is rolled but never stored, so the next tick reads the old one",
    );

    // 4. And the write happens nowhere else. A second `materialIndex` write
    //    outside the spawn branch re-introduces the churn under another spelling.
    const writesOutside: string[] = [];
    const walk = (steps: Step[], inside: boolean) => {
        for (const s of steps ?? []) {
            const inSpawn = inside || (s.key === "if" && s.options?.var === "full");
            if (s.key === "bufferWrite" && s.options?.path === "materialIndex" && !inSpawn) {
                writesOutside.push(s.key);
            }
            walk(s.then ?? [], inSpawn);
            walk(s.else ?? [], inSpawn);
        }
    };
    walk(proc.steps, false);
    assertEquals(writesOutside, [], "materialIndex is written outside the spawn branch");

    // 5. The artefact is made of the *new* material, so "the element changes when
    //    an artefact is generated" is true of the artefact too, not just the
    //    generator. Mapped through compares because the pick is a number.
    for (
        const [flag, element] of [
            ["nextGold", "gold"],
            ["nextCopper", "copper"],
            ["nextSand", "sand"],
        ]
    ) {
        assertEquals(
            branchFor(proc.steps, flag).some(
                (s: Step) =>
                    s.key === "bufferWrite" && s.options?.path === "emit-element" &&
                    s.options?.value === element,
            ),
            true,
            `the ${flag} branch never names ${element} as the emitted element`,
        );
    }
});

Deno.test("the generator eats only the material it picked", () => {
    // Pinned to gold it charged at gold's rate forever and the copper and sand
    // links could never light — the material-link feature was dead on arrival
    // while looking correctly wired.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");

    // Each material gets its own branch, and the branch eats *that* material.
    // All three counting the same element would make the choice cosmetic.
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

Deno.test("each material charges at its own rate, and the rates really differ", () => {
    // The rule the source mod implements: `progress += round(cells / mult)`.
    //
    // The bug this pins: all three branches added the raw cell count, so gold,
    // copper and sand charged at **identical** speed. The `mult` was written to
    // the structure's data bag and read by nothing — decoration on the tooltip,
    // on a machine whose entire point is that the three materials differ.
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");

    // Each branch divides by its own multiplier, and the increment adds the
    // result rather than the cell count. Both halves matter: dividing and then
    // incrementing by `eaten` would compute the rate and throw it away.
    const rate: Record<string, number> = {};
    for (
        const [flag, element, mult] of [
            ["isGold", "gold", "1"],
            ["isCopper", "copper", "0.5"],
            ["isSand", "sand", "5"],
        ] as const
    ) {
        const branch = branchFor(proc.steps, flag);
        const m = branch.find((s: Step) => s.key === "math");
        assert(m, `the ${flag} branch has no math step, so its rate is the raw cell count`);
        assertEquals(
            m.options,
            { left: "{{eaten}}", op: "div", right: mult },
            `${flag} does not charge at cells/${mult}`,
        );
        assertEquals(m.as, "charge", `the ${flag} rate is computed and then not used`);
        assertEquals(
            branch.some(
                (s: Step) => s.key === "bufferIncrement" && s.options?.delta === "{{charge}}",
            ),
            true,
            `${flag} increments by the cell count instead of its own rate`,
        );
        // Parsed to a number, not carried as the option's string: the three
        // assertions at the end do arithmetic on it, and `"10" / "0.5"` in a test
        // is a string concatenated rather than a number divided.
        rate[element] = Number(mult);
    }

    // And the three multipliers are genuinely different, which is the whole claim.
    // A test that only checked the steps exist would pass with three identical
    // multipliers — and that is exactly the config that shipped.
    assertEquals(new Set(Object.values(rate)).size, 3, "the three rates are not distinct");

    // The ordering, written as the source's arithmetic so the direction of each
    // one is checked rather than assumed: copper is worth twice a gold cell
    // (`/ 0.5`), and five sand cells make a charge.
    const charge = (cells: number, mult: number) => Math.round(cells / mult);
    assertEquals(charge(10, rate.gold), 10);
    assertEquals(charge(10, rate.copper), 20);
    assertEquals(charge(10, rate.sand), 2);
});

Deno.test("every branch in the tick holds a list of steps", () => {
    // A branch whose `then` is an object rather than an array compiles, validates,
    // and renders in the panel as a block with nothing visible inside it — and does
    // nothing in the game. That shape reached the config once, from a patch script
    // that assigned a block where a list belonged, so it is checked here rather
    // than left to be rediscovered by playing the game.
    const bad: string[] = [];
    const walk = (steps: Step[], where: string) => {
        for (const s of steps ?? []) {
            for (const k of ["then", "else"] as const) {
                const v = (s as Record<string, unknown>)[k];
                if (v === undefined) continue;
                if (!Array.isArray(v)) {
                    bad.push(`${where}/${s.key}.${k} is ${typeof v}, not a list`);
                    continue;
                }
                walk(v as Step[], `${where}/${s.key}.${k}`);
            }
        }
    };
    for (const p of CONFIG.processes) walk(p.steps, p.id);
    assertEquals(bad, [], `a branch is not a list: ${bad.join(", ")}`);
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
    // It removes itself **only** when it is done, and not one tick earlier.
    //
    // The config had `removeStructure` inside the `hasMore` branch, so the artefact
    // deleted itself on its first tick and never emitted anything. Asserting the
    // exact contents of `else` would have caught that too, but it also breaks every
    // time a "mark me done" line is added in front of it -- so what is asserted is
    // the rule: present when finished, absent while working.
    assertEquals(
        block.then.some((s: { key: string }) => s.key === "removeStructure"),
        false,
        "the artefact removes itself while it still has something to emit",
    );
    assertEquals(
        block.else.at(-1)?.key,
        "removeStructure",
        "having emitted everything, the artefact does not remove itself last",
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
 *
 * A named alias over `branchFor`, kept because a dozen assertions below are about
 * *gold specifically*, and spelling `branchFor(steps, "isGold")` at each one buries
 * what they are checking under the lookup. It used to carry its own copy of the
 * walk — a version that followed only `else`, so it could not see a block nested
 * in a `then`. Two copies of a search, one of them wrong, is the arrangement that
 * eventually makes a test pass against a config it was not looking at.
 */
function goldBranch(proc: { steps: Step[] }): Step[] {
    const gold = branchFor(proc.steps, "isGold");
    if (gold.length === 0) {
        throw new Error("no branch on isGold — the material pick is unwired");
    }
    return gold;
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
    // The clamp is no longer the charge target -- that is the placement field's
    // `chargeTarget`, and the player chooses it per generator. The clamp is now
    // only the **ceiling that has to be reachable**: a target above it would make
    // the generator charge forever and never fill, which is a dead generator that
    // still looks correct in the panel. The invariant this test was written to
    // protect -- "the slot's own `max` is the clamp" -- is unchanged; what moved
    // is which number is the target.
    const target = CONFIG.structures
        .find((s: { id: string }) => s.id.endsWith(":generator"))
        .defaultData.chargeTarget;
    assertEquals(target, 50, "and a freshly placed generator still charges for 50");
    assertEquals(
        slot.max,
        200,
        "the clamp is the slot's bound, so it has to be the highest reachable target",
    );
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
    // The increment adds the **rate**, not the cell count. This assertion used to
    // expect `delta: {{eaten}}`, which *was* the bug: all three materials then
    // charged at the same speed and `mult` was decoration on the tooltip. The rate
    // itself is checked in "each material charges at its own rate" — what matters
    // here is that the number being added is the one the `math` step produced.
    assertEquals(must("bufferIncrement"), {
        key: "bufferIncrement",
        options: { path: "progress", delta: "{{charge}}" },
    });
    // The chain that produces it: count the cells, then divide by the multiplier.
    const count = must("logicCount");
    assertEquals(count.as, "eaten", "the count is not bound to the name the rate reads");
    assertEquals(count.options?.element, "gold", "and it counts the chosen material");
    const rate = must("math");
    assertEquals(rate.as, "charge", "the rate is not bound to the name the delta reads");
    assertEquals(rate.options?.left, "{{eaten}}", "the rate is not of the count eaten");
    assertEquals(rate.options?.op, "div", "the rate is not cells divided by the multiplier");
    // Gold's multiplier is 1, so this division is a no-op — asserted anyway,
    // because a config that dropped the `math` step for gold alone would still
    // charge correctly, and the other two branches would be the only evidence.
    assertEquals(rate.options?.right, "1");
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
    // Asserted as "the blocks that must be here are here" rather than a count.
    // A count is a tripwire that fires on every legitimate edit — it went 4 -> 7
    // when the spawn branch grew its three element-mapping blocks, and 7 -> 12
    // when the two placement fields added their five. The failure said nothing
    // about what was actually wrong in either case. Naming the blocks says what
    // the screen has to show.
    for (
        const varName of [
            "isGold",
            "isCopper",
            "isSand",
            "full",
            "nextGold",
            "nextCopper",
            "nextSand",
            // The two placement fields. `hasPref` and its three material
            // branches decide what `idx` is; `hasTarget` picks between the
            // chosen charge target and the literal 50. All five are `if` blocks
            // the grid must render, or a step is invisible in the editor and
            // one keystroke away from being dropped.
            "hasPref",
            "wantsGold",
            "wantsCopper",
            "wantsSand",
            "hasTarget",
        ]
    ) {
        assert(
            branchFor(steps, varName).length > 0,
            `the ${varName} block is missing from the form, so the grid shows one fewer if`,
        );
    }

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
