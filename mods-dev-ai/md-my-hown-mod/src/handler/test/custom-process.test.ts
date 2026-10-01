
import { assert, assertEquals } from "https:
import {
    compileCustomProcess,
    type CustomProcessConfig,
    derivedProcessId,
    MAX_NESTING,
    processProblem,
    ProcessRegistry,
    processUsageCounts,
    scanProcessUsage,
} from "../custom-process/index.ts";


function proc(
    id: string,
    scope: CustomProcessConfig["scope"],
    steps: CustomProcessConfig["steps"],
): CustomProcessConfig {
    return { id, scope, steps };
}

const LOG = { key: "processorLog" };
const COUNT = { key: "processorCount" };



Deno.test("a registry indexes by id and filters by slot", () => {
    const reg = new ProcessRegistry([
        proc("b", "signal", [LOG]),
        proc("a", "processing", [LOG]),
        proc("c", "signal", [LOG]),
    ]);
    assertEquals(reg.ids(), ["a", "b", "c"]);
    assertEquals(reg.get("a")?.scope, "processing");
    assertEquals(reg.get("nope"), undefined);
    
    assertEquals(reg.forSlot("signal").map((p) => p.id), ["b", "c"]);
    assertEquals(reg.forSlot("processing").map((p) => p.id), ["a"]);
});

Deno.test("a derived id is never confused with a named one", () => {
    assertEquals(derivedProcessId("mdmy.machine.sorter"), "mdmy.machine.sorter#process");
    const reg = new ProcessRegistry([
        { ...proc("x#process", "signal", [LOG]), derived: true, derivedFrom: "x" },
    ]);
    assertEquals(reg.derivedIds(), ["x#process"]);
    assertEquals(reg.forSlot("signal").map((p) => p.id), ["x#process"]);
});



Deno.test("a process used in the wrong slot is refused, and says which", () => {
    const reg = new ProcessRegistry([proc("sorter", "processing", [LOG])]);
    assertEquals(processProblem(reg, "sorter", "processing"), undefined);
    
    
    assertEquals(
        processProblem(reg, "sorter", "signal"),
        "built for processing, used in signal",
    );
    assertEquals(processProblem(reg, "ghost", "signal"), "no such process: ghost");
});

Deno.test("a refused process still produces a callable, so the definition registers", () => {
    
    
    const reg = new ProcessRegistry([proc("sorter", "processing", [LOG])]);
    const failures: unknown[] = [];
    const { fn, truncated } = compileCustomProcess(
        reg,
        "sorter",
        "signal",
        (f) => failures.push(f.error),
    );
    assertEquals(typeof fn, "function");
    assertEquals(fn(null, null), undefined, "and it does nothing");
    assertEquals(truncated, true);
    assertEquals(failures.length, 1);
});



Deno.test("a definition naming a process gets that process's steps", () => {
    
    const reg = new ProcessRegistry([proc("sorter", "signal", [LOG, COUNT])]);
    const { expanded, skipped } = compileCustomProcess(reg, "sorter", "signal");
    assertEquals(expanded, ["sorter"]);
    assertEquals(skipped, [], "both steps resolved");
});

Deno.test("editing one process changes what every reference compiles to", () => {
    
    
    const before = new ProcessRegistry([proc("sorter", "signal", [LOG])]);
    const after = new ProcessRegistry([proc("sorter", "signal", [LOG, COUNT])]);
    const a = compileCustomProcess(before, "sorter", "signal");
    const b = compileCustomProcess(after, "sorter", "signal");
    assert(a.fn !== b.fn, "each registry compiles its own function");
    assertEquals(a.expanded, b.expanded, "same reference, different bodies");
});



Deno.test("a nested process is spliced in where it was named", () => {
    const reg = new ProcessRegistry([
        proc("inner", "signal", [LOG]),
        proc("outer", "signal", [COUNT, { key: "inner" }, LOG]),
    ]);
    const { expanded, skipped } = compileCustomProcess(reg, "outer", "signal");
    assertEquals(expanded, ["outer", "inner"]);
    assertEquals(skipped, [], "every leaf step resolved");
});

Deno.test("a nested process shares the parent's context", () => {
    
    
    const reg = new ProcessRegistry([
        proc("probe", "processing", [
            { key: "isElementAtCell", as: "isWater", options: { element: "water" } },
        ]),
        proc("outer", "processing", [
            { key: "probe" },
            { key: "signalLog", options: { note: "{{isWater}}" } },
        ]),
    ]);
    const failures: { id: string; error: unknown }[] = [];
    const { fn } = compileCustomProcess(reg, "outer", "processing", (f) => failures.push(f));
    fn({ x: 3, y: 3 }, {
        getResolvedTypeAtCell: () => "water",
        isCellEmptyAtCell: () => false,
        commit: () => {},
    });
    
    assertEquals(failures, []);
});

Deno.test("a cycle is reported and terminates", () => {
    
    
    const reg = new ProcessRegistry([
        proc("a", "signal", [{ key: "b" }]),
        proc("b", "signal", [{ key: "a" }]),
    ]);
    const failures: { id: string; error: unknown }[] = [];
    const { fn, truncated, expanded } = compileCustomProcess(
        reg,
        "a",
        "signal",
        (f) => failures.push(f),
    );
    assertEquals(typeof fn, "function", "and it still returns a callable");
    assertEquals(truncated, true);
    assert(failures.some((f) => f.error === "cycle"), "the cycle is reported");
    
    assert(expanded.length < 10, `expanded ${expanded.length} times`);
    assertEquals(fn(null, null), undefined);
});

Deno.test("a process that names itself is caught immediately", () => {
    const reg = new ProcessRegistry([proc("a", "signal", [LOG, { key: "a" }])]);
    const failures: unknown[] = [];
    const { truncated } = compileCustomProcess(
        reg,
        "a",
        "signal",
        (f) => failures.push(f.error),
    );
    assertEquals(truncated, true);
    assert(failures.includes("cycle"));
});

Deno.test("a diamond is not a cycle", () => {
    
    
    const reg = new ProcessRegistry([
        proc("d", "signal", [LOG]),
        proc("b", "signal", [{ key: "d" }]),
        proc("c", "signal", [{ key: "d" }]),
        proc("a", "signal", [{ key: "b" }, { key: "c" }]),
    ]);
    const failures: unknown[] = [];
    const { truncated, expanded } = compileCustomProcess(
        reg,
        "a",
        "signal",
        (f) => failures.push(f.error),
    );
    assertEquals(truncated, false, "a diamond must not be mistaken for a cycle");
    assertEquals(expanded, ["a", "b", "d", "c", "d"]);
    assertEquals(failures, []);
});

Deno.test("a long chain is stopped by the depth limit, and reported", () => {
    
    
    const many: CustomProcessConfig[] = [];
    const last = MAX_NESTING + 3;
    for (let i = 0; i < last; i++) {
        many.push(proc(`p${i}`, "signal", i === last - 1 ? [LOG] : [{ key: `p${i + 1}` }]));
    }
    const failures: unknown[] = [];
    const { truncated, fn } = compileCustomProcess(
        new ProcessRegistry(many),
        "p0",
        "signal",
        (f) => failures.push(f.error),
    );
    assertEquals(truncated, true);
    assert(failures.some((e) => String(e).startsWith("nested deeper")));
    assertEquals(typeof fn, "function");
});

Deno.test("an `as` on a nested step is reported, not silently ignored", () => {
    
    
    const reg = new ProcessRegistry([
        proc("inner", "signal", [LOG]),
        proc("outer", "signal", [{ key: "inner", as: "result" }]),
    ]);
    const failures: unknown[] = [];
    compileCustomProcess(reg, "outer", "signal", (f) => failures.push(f.error));
    assert(failures.includes("a nested process binds nothing"));
});



Deno.test("the scan finds which definitions name which process", () => {
    
    
    const cfg = {
        signals: [
            { id: "a", processId: "sorter" },
            { id: "b", processId: "sorter" },
            { id: "c" },
        ],
        processing: [{ id: "d", processId: "drain" }],
        
        sprites: [{ id: "e", processId: "sorter" }],
    };
    const usage = scanProcessUsage(cfg);
    assertEquals(usage.length, 3);
    assertEquals(usage[0], {
        category: "signals",
        id: "a",
        slot: "signal",
        processId: "sorter",
    });
    assertEquals(usage[2].slot, "processing");
    assertEquals(processUsageCounts(cfg), { sorter: 2, drain: 1 });
});

Deno.test("a legacy action array names no process, because it is not one", () => {
    
    
    
    const cfg = { signals: [{ id: "a", actions: [{ key: "processorLog" }] }] };
    assertEquals(scanProcessUsage(cfg), []);
    assertEquals(processUsageCounts(cfg), {});
});

Deno.test("the scan is empty rather than throwing on a config it does not recognise", () => {
    
    
    for (
        const cfg of [
            {},
            { signals: null },
            { signals: "nope" },
            { signals: [null, 5, "x"] },
            { processing: [{ processId: "" }] },
            { processing: [{ processId: 7 }] },
        ]
    ) {
        assertEquals(scanProcessUsage(cfg as Record<string, unknown>), []);
    }
});
