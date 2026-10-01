
import { assert, assertEquals } from "jsr:@std/assert";





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
    "../../../md-random-artefact/config/random-artefact.json",
    import.meta.url,
);


type Step = {
    key: string;
    as?: string;
    options?: Record<string, string>;
    then?: Step[];
    else?: Step[];
};

const CONFIG = JSON.parse(await Deno.readTextFile(CONFIG_URL));


const SHAPE = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
];


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


const compileTick = () => compileEntry("gen-tick");


const compileArtefact = () => compileEntry("artefact-tick");


function tick(compiled: ReturnType<typeof compileTick>, cells: Map<string, string>) {
    const restore = host(cells);
    const structure = {
        type: "md-my-hown-mod:generator",
        x: 100,
        y: 200,
        shape: SHAPE,
        data: {} as Record<string, unknown>,
    };
    
    
    
    
    
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
    
    
    
    
    
    
    
    
    
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");

    
    
    assertEquals(
        proc.steps.some((s: Step) => s.key === "randomInt"),
        false,
        "the tick re-rolls the material on every pass, so it changes five times a " +
            "second instead of once per artefact",
    );

    
    
    assertEquals(
        proc.steps.some(
            (s: Step) => s.key === "bufferRead" && s.options?.path === "materialIndex",
        ),
        true,
        "the tick no longer reads materialIndex, so the branches cannot see a material",
    );

    
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
    
    
    
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");

    
    
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
    
    
    const cleared = proc.steps.filter(
        (s: Step) =>
            s.key === "bufferWrite" && s.options?.value === "0" &&
            s.options?.path?.startsWith("links-"),
    );
    assertEquals(cleared.length, 3, "the links are not all cleared before the pick");
});

Deno.test("each material charges at its own rate, and the rates really differ", () => {
    
    
    
    
    
    
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");

    
    
    
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
        
        
        
        rate[element] = Number(mult);
    }

    
    
    
    assertEquals(new Set(Object.values(rate)).size, 3, "the three rates are not distinct");

    
    
    
    const charge = (cells: number, mult: number) => Math.round(cells / mult);
    assertEquals(charge(10, rate.gold), 10);
    assertEquals(charge(10, rate.copper), 20);
    assertEquals(charge(10, rate.sand), 2);
});

Deno.test("every branch in the tick holds a list of steps", () => {
    
    
    
    
    
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
    
    
    const reset = block.then.find(
        (s: { key: string; options?: { path?: string } }) =>
            s.key === "bufferWrite" && s.options?.path === "progress",
    );
    assertEquals(reset?.options?.value, "0", "progress is not reset after a spawn");
});

Deno.test("the artefact emits while it has something left, and removes itself after", () => {
    
    
    
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
        block.then.some((s: { key: string }) => s.key === "removeStructure"),
        false,
        "the artefact removes itself while it still has something to emit",
    );
    assertEquals(
        block.else.at(-1)?.key,
        "removeStructure",
        "having emitted everything, the artefact does not remove itself last",
    );
    
    
    const slot = CONFIG.buffers.find((b: { path: string }) => b.path === "emit-remaining");
    assertEquals(slot.min, 0, "the count-down is clamped at zero, not left to go negative");
});

Deno.test("every buffer path a step uses is one the config declares", () => {
    
    
    
    
    
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
    
    
    for (const name of ["gold", "copper", "sand"]) {
        assertEquals(
            declared.has(`links-${name}`),
            true,
            `links-${name} is declared but unused, so no link can publish to it`,
        );
    }
});


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
    
    
    
    const slot = CONFIG.buffers.find((b: { path: string }) => b.path === "progress");
    
    
    
    
    
    
    
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

    
    
    
    
    
    
    
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    
    
    
    
    
    const gold = goldBranch(proc);
    const must = (key: string): Step => {
        const s = gold.find((step) => step.key === key);
        if (!s) throw new Error(`the gold branch has no "${key}" step`);
        return s;
    };
    
    
    
    
    
    assertEquals(must("bufferIncrement"), {
        key: "bufferIncrement",
        options: { path: "progress", delta: "{{charge}}" },
    });
    
    const count = must("logicCount");
    assertEquals(count.as, "eaten", "the count is not bound to the name the rate reads");
    assertEquals(count.options?.element, "gold", "and it counts the chosen material");
    const rate = must("math");
    assertEquals(rate.as, "charge", "the rate is not bound to the name the delta reads");
    assertEquals(rate.options?.left, "{{eaten}}", "the rate is not of the count eaten");
    assertEquals(rate.options?.op, "div", "the rate is not cells divided by the multiplier");
    
    
    
    assertEquals(rate.options?.right, "1");
    
    
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
    
    
    
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const form = entryToForm("customProcess", proc);
    assertEquals(form.scope, "processing", "the Scope select came up empty");
    assertEquals((form.program__json ?? "").length > 0, true, "the Program grid came up empty");
    assertEquals(validateForm("customProcess", form), {});
});

Deno.test("the tick's branches come back through the panel, not just the steps", () => {
    
    
    
    
    
    
    
    
    
    const proc = CONFIG.processes.find((p: { id: string }) => p.id === "artefact-generator-tick");
    const form = entryToForm("customProcess", proc);
    const steps = JSON.parse(form.program__json ?? "[]") as Step[];

    const countBlocks = (list: Step[]): number =>
        list.reduce((n, s) =>
            n + (s.key === "if" ? 1 : 0) + countBlocks(s.then ?? []) +
            countBlocks(s.else ?? []), 0);
    
    
    
    
    
    
    for (
        const varName of [
            "isGold",
            "isCopper",
            "isSand",
            "full",
            "nextGold",
            "nextCopper",
            "nextSand",
            
            
            
            
            
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
