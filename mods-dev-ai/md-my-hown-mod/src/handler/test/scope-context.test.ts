
import { assert, assertEquals } from "https:
import { SCOPE_CONTEXT, scopeSeedNames, seedsFor } from "../core/scope-context.ts";
import { CALL_SITE_LABELS, type CallSite } from "../core/types.ts";



const SITES = Object.keys(CALL_SITE_LABELS) as CallSite[];

Deno.test("every call site has a row, and no row names a site that is gone", () => {
    assertEquals(Object.keys(SCOPE_CONTEXT).sort(), [...SITES].sort());
    for (const site of SITES) {
        assert(Array.isArray(SCOPE_CONTEXT[site]), `${site} has no seed list`);
    }
});

Deno.test("every seed is documented and says where it comes from", () => {
    
    
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
    
    
    
    
    
    
    
    
    
    const args = [
        { x: 1, y: 2, type: "t", data: {} },
        {
            type: "a",
            getResolvedTypeAtCell: () => null,
            isCellEmptyAtCell: () => true,
            commit: () => {},
            
            
            
            
            
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
    
    
    
    
    
    
    
    
    
    
    
    const bare = Object.keys(seedsFor("processing", [{ x: 1, y: 2 }])).sort();
    assertEquals(bare, [
        "structure.cellAt",
        "structure.footprint",
        "structure.matrixSize",
        "structure.shape",
        "structure.x",
        "structure.y",
    ]);
    
    assert(!("context.commit" in seedsFor("processing", [{ x: 1, y: 2 }])));
    
    for (const name of bare) {
        assert(scopeSeedNames("processing").includes(name), `${name} is not advertised`);
    }
});

Deno.test("a trigger gets no seeds, because its callback takes no arguments", () => {
    
    
    assertEquals(SCOPE_CONTEXT.trigger, []);
    assertEquals(seedsFor("trigger", [{}, {}]), {});
    assertEquals(seedsFor("trigger", []), {});
});

Deno.test("processing is the only site that offers the engine's context object", () => {
    
    
    
    const withContext = SITES.filter((s) =>
        scopeSeedNames(s).some((n) => n.startsWith("context."))
    );
    assertEquals(withContext, ["processing"]);
});




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
        
        
        console.warn("[scope-context] engine .d.ts not present — signature checks skipped");
        return;
    }

    
    assert(
        structures.includes(
            "process: (structure: Structure, context: StructureProcessingContext) => void",
        ),
        "the engine no longer passes (structure, context) to a processor",
    );
    
    for (
        const member of ["getResolvedTypeAtCell", "isCellEmptyAtCell", "commit"]
    ) {
        assert(
            new RegExp(`^\\s+${member}\\(`, "m").test(structures),
            `StructureProcessingContext.${member} is gone or changed shape`,
        );
    }
    
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
    
    
    const signals = engineSource("signals.d.ts");
    if (!signals) {
        console.warn("[scope-context] engine .d.ts not present — signal check skipped");
        return;
    }
    assert(
        /handler: \(structure: Structure\) => void/.test(signals),
        "the interactable signal handler changed shape",
    );
    
    assert(
        !scopeSeedNames("signal").includes("payload"),
        "signal offers a payload it is not given",
    );
});



Deno.test("a payload that throws on every read yields no seeds, and no throw", () => {
    
    
    
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
    
    assertEquals(seedsFor("behavior", ["a", "b"]), { key: "a" });
    assertEquals(seedsFor("behavior", []), {});
});
