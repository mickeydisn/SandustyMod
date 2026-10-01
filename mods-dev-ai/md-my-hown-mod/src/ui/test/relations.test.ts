

import { assert, assertEquals } from "jsr:@std/assert";

globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        elements: { list: () => [] },
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { fieldsFor, CATEGORY_META } = await import("../schema.ts");
const { RELATIONS, relationsOf, targetsOf } = await import("../relations.ts");

Deno.test("the table is not empty", () => {
    assert(RELATIONS.length > 15, `only ${RELATIONS.length} relations`);
});

Deno.test("every relation names a real category on both ends", () => {
    for (const r of RELATIONS) {
        assert(CATEGORY_META[r.from], `${r.from} is not a category`);
        assert(CATEGORY_META[r.to], `${r.to} is not a category`);
    }
});

Deno.test("every relation's field really exists in that category's form", () => {
    const bad: string[] = [];
    for (const r of RELATIONS) {
        const keys = fieldsFor(r.from).map((f: { key: string }) => f.key);
        if (!keys.includes(r.field)) {
            bad.push(`${r.from}.${r.field} (form has: ${keys.join(", ")})`);
        }
    }
    assertEquals(
        bad,
        [],
        `relations pointing at fields that do not exist: ${bad.join("; ")}`,
    );
});

Deno.test("a many-valued relation points at a field that can hold many", () => {
    
    
    
    
    
    
    
    const MANY_KINDS = new Set(["multiselect", "shape", "terrainRules", "outputs"]);
    const canHoldMany = (f: { kind: string; jsonType?: string }) =>
        MANY_KINDS.has(f.kind) || (f.kind === "json" && f.jsonType === "array");
    const bad: string[] = [];
    for (const r of RELATIONS) {
        const f = fieldsFor(r.from).find((x: { key: string }) => x.key === r.field);
        if (r.many && f && !canHoldMany(f)) {
            bad.push(`${r.from}.${r.field} claims many but is a ${f.kind}`);
        }
    }
    assertEquals(bad, [], bad.join("; "));
});

Deno.test("no duplicate from/field pairs", () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const r of RELATIONS) {
        const k = `${r.from}.${r.field}`;
        if (seen.has(k)) dup.push(k);
        seen.add(k);
    }
    assertEquals(dup, []);
});


const REFERENCE_LISTS = new Map<string, string>([
    
    ["listElements", "elements"],
    ["listStructures", "structures"],
    ["listItems", "items"],
    ["listTerrains", "terrains"],
    ["listSpriteIds", "sprites"],
    ["listTechIds", "techs"],
    ["listOutputTargets", "elements"],
    ["listProcessorKeys", "processing"],
    ["listDescribedProcessorKeys", "processing"],
    
    
    
    
    
]);


const ENTRY_TABS = new Set([
    "elements",
    "structures",
    "items",
    "terrains",
    "techs",
    "sprites",
    "recipes",
    "processing",
    "contacts",
    "interactions",
    "signals",
    "triggers",
    "behaviors",
    "energy",
    "excavation",
    "projectiles",
    "upgrades",
    "categories",
    "inputs",
]);

Deno.test("every reference field is filed as a relation", () => {
    const filed = new Set(RELATIONS.map((r) => `${r.from}.${r.field}`));
    const missing: string[] = [];

    for (const tab of Object.keys(CATEGORY_META)) {
        if (!CATEGORY_META[tab].configKey) continue; 
        for (const f of fieldsFor(tab)) {
            if (f.kind !== "select" && f.kind !== "multiselect") continue;
            
            
            
            
            const src = `${String(f.options ?? "")}`;
            for (const [fn, target] of REFERENCE_LISTS) {
                if (!src.includes(fn)) continue;
                
                
                
                if (target === tab && !filed.has(`${tab}.${f.key}`)) continue;
                if (!ENTRY_TABS.has(target)) continue;
                const key = `${tab}.${f.key}`;
                if (!filed.has(key)) {
                    missing.push(`${key} → ${target} (offers ${fn})`);
                }
                break;
            }
        }
    }
    assertEquals(
        missing,
        [],
        `reference fields missing from the relation table — the graph is silently incomplete:\n  ${
            missing.join("\n  ")
        }`,
    );
});

Deno.test("every relation has a note that explains it in plain words", () => {
    
    
    
    const terse = RELATIONS.filter((r) => (r.note ?? "").trim().length < 25)
        .map((r) => `${r.from}.${r.field} → ${r.to}`);
    assertEquals(terse, [], `relations with no usable explanation: ${terse.join(", ")}`);
});

Deno.test("every note is a real sentence, not a placeholder", () => {
    for (const r of RELATIONS) {
        assert(r.note.length > 20, `${r.from}.${r.field} has a stub note`);
        assert(r.note.trim().endsWith("."), `${r.from}.${r.field} note has no full stop`);
    }
});

Deno.test("relationsOf and targetsOf agree with the table", () => {
    for (const r of RELATIONS) {
        assert(
            relationsOf(r.from).some((x) => x.field === r.field),
            `relationsOf(${r.from}) is missing ${r.field}`,
        );
        assert(
            targetsOf(r.from).includes(r.to),
            `targetsOf(${r.from}) is missing ${r.to}`,
        );
    }
});

Deno.test("required relations are the ones the engine actually requires", () => {
    
    
    
    
    const required = RELATIONS.filter((r) => r.strength === "required")
        .map((r) => `${r.from}.${r.field}`);
    for (
        const k of [
            "processing.structureType",
            "upgrades.itemId",
            "signals.target",
        ]
    ) {
        assert(required.includes(k), `${k} should be marked required`);
    }
});
