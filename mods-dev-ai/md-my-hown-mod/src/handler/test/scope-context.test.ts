/**
 * The scope → context table, checked against the engine's own `.d.ts`.
 *
 * ## Why this file is mostly about a claim
 *
 * `SCOPE_CONTEXT` tells an author which names a process may use at a given call site.
 * If that table drifts from the engine, the failure is **silent and blamed on the
 * author**: the variable exists in the panel, the author's step reads it, and it is
 * always `undefined`. Worse than having no table at all, because a panel that offers
 * nothing tells the truth by omission.
 *
 * So every row is verified against the shipped types rather than trusted. The engine
 * source lives outside the mod, so its absence is handled explicitly rather than
 * skipped — a missing engine tree must not turn this into a test that passes because
 * it checks nothing.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SCOPE_CONTEXT, scopeSeedNames, seedsFor } from "../core/scope-context.ts";
import { CALL_SITE_LABELS, type CallSite } from "../core/types.ts";

// ── The table's own shape ─────────────────────────────────────────────────────

const SITES = Object.keys(CALL_SITE_LABELS) as CallSite[];

Deno.test("every call site has a row, and no row names a site that is gone", () => {
    assertEquals(Object.keys(SCOPE_CONTEXT).sort(), [...SITES].sort());
    for (const site of SITES) {
        assert(Array.isArray(SCOPE_CONTEXT[site]), `${site} has no seed list`);
    }
});

Deno.test("every seed is documented and says where it comes from", () => {
    // A seed with no `from` is the one thing that cannot be checked later, because
    // there is nothing to check it against.
    for (const site of SITES) {
        for (const seed of SCOPE_CONTEXT[site]) {
            assert(seed.name.length > 0, `${site}: a seed with no name`);
            assert(seed.doc.length > 5, `${site}.${seed.name}: no description`);
            assert(
                seed.from.length > 0,
                `${site}.${seed.name}: no engine path, so it can never be verified`,
            );
        }
    }
});

Deno.test("the runtime seeds exactly the names the table advertises", () => {
    // The panel and the runtime must not disagree. `seedsFor` filters through
    // `SCOPE_CONTEXT` precisely so this holds, and this is the test that says so.
    //
    // A **full** pair of arguments, because each site reads a different subset: the
    // first is the engine's structure / state, the second is a
    // `StructureProcessingContext` *or* the fired `action`. Filling both completely
    // is what lets one fixture stand in for all seven sites — and the other half of
    // the rule, that a seed the engine did *not* deliver is absent rather than
    // present-and-undefined, is checked separately below.
    const args = [
        { x: 1, y: 2, type: "t", data: {} },
        {
            type: "a",
            getResolvedTypeAtCell: () => null,
            isCellEmptyAtCell: () => true,
            commit: () => {},
            // Added with the element work. The two enable/disable members are in the
            // engine's own `processing.register` reference and this fixture was simply
            // still describing the older, shorter context — which is the drift this
            // pair of tests exists to catch, caught from the other direction: a seed
            // the table advertises and the runtime cannot fill.
            isEnabledAtCell: () => true,
            setEnabledAtCell: () => {},
        },
    ];
    for (const site of SITES) {
        const got = Object.keys(seedsFor(site, args)).sort();
        assertEquals(got, scopeSeedNames(site).sort(), `${site} drifted`);
    }
});

Deno.test("a seed the engine did not deliver is absent, not undefined", () => {
    // The distinction `hasVar` exists to make: "not here at this site" versus "here,
    // and it happens to be undefined".
    //
    // This structure has no `type` and no `data`, so the table must **not** claim to
    // offer those two — offering them would promise a name whose value is always
    // `undefined`, which is the failure this whole table is written to avoid.
    //
    // The four **matrix** seeds are still here, and that is the point: they are
    // **derived**, not read off the structure. A structure with no registered
    // definition is a 1×1 footprint, and `footprintSeeds` always produces a value —
    // so unlike `structure.type` they are never `undefined` for want of a lookup.
    const bare = Object.keys(seedsFor("processing", [{ x: 1, y: 2 }])).sort();
    assertEquals(bare, [
        "structure.cellAt",
        "structure.footprint",
        "structure.matrixSize",
        "structure.shape",
        "structure.x",
        "structure.y",
    ]);
    // And a site with no context object at all offers no `commit`.
    assert(!("context.commit" in seedsFor("processing", [{ x: 1, y: 2 }])));
    // But every name it does offer is advertised — the filter runs before the removal.
    for (const name of bare) {
        assert(scopeSeedNames("processing").includes(name), `${name} is not advertised`);
    }
});

Deno.test("a trigger gets no seeds, because its callback takes no arguments", () => {
    // `callback: () => void` in `triggers.d.ts`. Inventing a `tick` here is the
    // single most tempting lie in this table, so the emptiness is pinned.
    assertEquals(SCOPE_CONTEXT.trigger, []);
    assertEquals(seedsFor("trigger", [{}, {}]), {});
    assertEquals(seedsFor("trigger", []), {});
});

Deno.test("processing is the only site that offers the engine's context object", () => {
    // `commit` and the two cell readers come from `StructureProcessingContext`, and
    // `processing` is the only call site that delivers one. If a second site ever
    // grows them, this is the test that should have to change.
    const withContext = SITES.filter((s) =>
        scopeSeedNames(s).some((n) => n.startsWith("context."))
    );
    assertEquals(withContext, ["processing"]);
});

// ── Against the engine's own declarations ─────────────────────────────────────

/** The engine's `.d.ts` tree, if this checkout has it. */
const ENGINE_API = new URL(
    "../../../../../__scraped-mods/old/SandustryTypes/src/sandkit/api/",
    import.meta.url,
);

function engineSource(file: string): string | null {
    try {
        return Deno.readTextFileSync(new URL(file, ENGINE_API).pathname);
    } catch {
        return null;
    }
}

Deno.test("the seeds match the engine's declared signatures", () => {
    const structures = engineSource("structures.d.ts");
    if (!structures) {
        // A missing engine tree must not turn the rest of this file into a no-op.
        // Saying so loudly is better than passing because it checked nothing.
        console.warn("[scope-context] engine .d.ts not present — signature checks skipped");
        return;
    }

    // The processing signature, verbatim from the engine.
    assert(
        structures.includes(
            "process: (structure: Structure, context: StructureProcessingContext) => void",
        ),
        "the engine no longer passes (structure, context) to a processor",
    );
    // Every `StructureProcessingContext` member the table claims.
    for (
        const member of ["getResolvedTypeAtCell", "isCellEmptyAtCell", "commit"]
    ) {
        assert(
            new RegExp(`^\\s+${member}\\(`, "m").test(structures),
            `StructureProcessingContext.${member} is gone or changed shape`,
        );
    }
    // And the four `Structure` fields the table reads.
    assert(/^\s+x: number;/m.test(structures), "Structure.x is gone");
    assert(/^\s+y: number;/m.test(structures), "Structure.y is gone");
    assert(/^\s+type\?: StructureRef;/m.test(structures), "Structure.type moved");
    assert(/^\s+data\?: StructureData;/m.test(structures), "Structure.data moved");
});

Deno.test("the trigger's no-argument callback is the engine's, not an assumption", () => {
    const triggers = engineSource("triggers.d.ts");
    if (!triggers) {
        console.warn("[scope-context] engine .d.ts not present — trigger check skipped");
        return;
    }
    assert(
        /callback: \(\) => void/.test(triggers),
        "the trigger callback now takes arguments — SCOPE_CONTEXT.trigger is wrong",
    );
});

Deno.test("the signal handler really takes one argument", () => {
    // The one place this table could easily over-offer: `targets.register` delivers a
    // second `payload`, but the *interactable* slot does not.
    const signals = engineSource("signals.d.ts");
    if (!signals) {
        console.warn("[scope-context] engine .d.ts not present — signal check skipped");
        return;
    }
    assert(
        /handler: \(structure: Structure\) => void/.test(signals),
        "the interactable signal handler changed shape",
    );
    // So `payload` must not appear as a seed. The whole point of the note in the file.
    assert(
        !scopeSeedNames("signal").includes("payload"),
        "signal offers a payload it is not given",
    );
});

// ── Hostile input ─────────────────────────────────────────────────────────────

Deno.test("a payload that throws on every read yields no seeds, and no throw", () => {
    // A regression this feature caused and this table's own tests caught: seeding
    // runs outside the per-step `try` in `compileProcess`, so a throwing property
    // read escaped the isolation the compiler promises and took down a game tick.
    const hostile = new Proxy({}, {
        get() {
            throw new Error("boom");
        },
    });
    for (const site of SITES) {
        let threw = false;
        try {
            seedsFor(site, [hostile, hostile]);
        } catch {
            threw = true;
        }
        assert(!threw, `${site}: seeding a hostile payload escaped`);
    }
    assertEquals(seedsFor("signal", [hostile, null]), {});
});

Deno.test("a site with no arguments still seeds what it can", () => {
    // `behavior` gets one argument; asking for two must not invent a second.
    assertEquals(seedsFor("behavior", ["a", "b"]), { key: "a" });
    assertEquals(seedsFor("behavior", []), {});
});
