/**
 * The custom process: the object, its index, and its compiler.
 *
 * The claims worth holding, in the order they can break:
 *
 *  1. **A reference compiles.** A definition naming a process gets that process's
 *     function — which is the entire feature (D5).
 *  2. **The scope is checked.** A `processing` process used from a `signal` is
 *     refused, because its context is seeded from different arguments.
 *  3. **A cycle terminates and is reported.** The failure mode without the guard is a
 *     hung game tick, which no test would survive.
 *  4. **A diamond is not a cycle.** A→B, A→C, B→D, C→D is legal and must expand D
 *     twice rather than being cut short.
 *  5. **Nesting shares one context.** A variable bound inside a nested process is
 *     readable by a step after it in the parent — that is the reason expansion
 *     splices rather than composes.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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

/** A process, with the fields a test does not care about defaulted away. */
function proc(
    id: string,
    scope: CustomProcessConfig["scope"],
    steps: CustomProcessConfig["steps"],
): CustomProcessConfig {
    return { id, scope, steps };
}

const LOG = { key: "processorLog" };
const COUNT = { key: "processorCount" };

// ── The index ─────────────────────────────────────────────────────────────────

Deno.test("a registry indexes by id and filters by slot", () => {
    const reg = new ProcessRegistry([
        proc("b", "signal", [LOG]),
        proc("a", "processing", [LOG]),
        proc("c", "signal", [LOG]),
    ]);
    assertEquals(reg.ids(), ["a", "b", "c"]);
    assertEquals(reg.get("a")?.scope, "processing");
    assertEquals(reg.get("nope"), undefined);
    // A picker must not offer a process that cannot run here.
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

// ── Scope ─────────────────────────────────────────────────────────────────────

Deno.test("a process used in the wrong slot is refused, and says which", () => {
    const reg = new ProcessRegistry([proc("sorter", "processing", [LOG])]);
    assertEquals(processProblem(reg, "sorter", "processing"), undefined);
    // Both halves of the claim, because "wrong slot" alone leaves the author guessing
    // which six.
    assertEquals(
        processProblem(reg, "sorter", "signal"),
        "built for processing, used in signal",
    );
    assertEquals(processProblem(reg, "ghost", "signal"), "no such process: ghost");
});

Deno.test("a refused process still produces a callable, so the definition registers", () => {
    // A missing machine is easier to notice than a missing machine *and* a console
    // error about the machine.
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

// ── The reference ─────────────────────────────────────────────────────────────

Deno.test("a definition naming a process gets that process's steps", () => {
    // D5: the definition holds an id, and editing the process changes every use.
    const reg = new ProcessRegistry([proc("sorter", "signal", [LOG, COUNT])]);
    const { expanded, skipped } = compileCustomProcess(reg, "sorter", "signal");
    assertEquals(expanded, ["sorter"]);
    assertEquals(skipped, [], "both steps resolved");
});

Deno.test("editing one process changes what every reference compiles to", () => {
    // The property D5 exists for, stated as a test: two registries built from the
    // same ids but different steps produce different functions.
    const before = new ProcessRegistry([proc("sorter", "signal", [LOG])]);
    const after = new ProcessRegistry([proc("sorter", "signal", [LOG, COUNT])]);
    const a = compileCustomProcess(before, "sorter", "signal");
    const b = compileCustomProcess(after, "sorter", "signal");
    assert(a.fn !== b.fn, "each registry compiles its own function");
    assertEquals(a.expanded, b.expanded, "same reference, different bodies");
});

// ── Nesting ───────────────────────────────────────────────────────────────────

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
    // The reason expansion splices rather than composes: a variable bound inside the
    // nested process must still be readable by a step after it in the parent.
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
    // No failures means `{{isWater}}` resolved — from the nested process's binding.
    assertEquals(failures, []);
});

Deno.test("a cycle is reported and terminates", () => {
    // Without the guard this recurses forever on a game tick. The `truncated` flag is
    // how a caller knows it did not compile the whole program.
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
    // It stopped rather than expanding forever.
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
    // A→B, A→C, B→D, C→D. D appears twice but never inside itself, so the path-based
    // guard must let it through — a "seen anywhere" guard would wrongly cut this.
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
    // The backstop for what a cycle check cannot see: forty *distinct* processes is
    // legal and merely silly.
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
    // A nested process runs many actions and has no single return value, so binding
    // the last one's result would be a lie.
    const reg = new ProcessRegistry([
        proc("inner", "signal", [LOG]),
        proc("outer", "signal", [{ key: "inner", as: "result" }]),
    ]);
    const failures: unknown[] = [];
    compileCustomProcess(reg, "outer", "signal", (f) => failures.push(f.error));
    assert(failures.includes("a nested process binds nothing"));
});

// ── The usage scan ────────────────────────────────────────────────────────────

Deno.test("the scan finds which definitions name which process", () => {
    // D5's other half: the panel can say `used ×3`, which is the only thing that makes
    // a reference's blast radius visible while the author is editing it.
    const cfg = {
        signals: [
            { id: "a", processId: "sorter" },
            { id: "b", processId: "sorter" },
            { id: "c" },
        ],
        processing: [{ id: "d", processId: "drain" }],
        // A key with no slot is not a definition, so it is not a usage.
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
    // Until the migration runs, an entry holding `actions: [...]` genuinely references
    // nothing — so it must not be counted, or the panel would show a usage for a
    // process that is not involved. This is the claim Phase 5b changes, deliberately.
    const cfg = { signals: [{ id: "a", actions: [{ key: "processorLog" }] }] };
    assertEquals(scanProcessUsage(cfg), []);
    assertEquals(processUsageCounts(cfg), {});
});

Deno.test("the scan is empty rather than throwing on a config it does not recognise", () => {
    // A hand-edited config can hold anything. The scan walks every top-level key, so
    // it must survive a non-array and a non-object without a guard at each call site.
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
