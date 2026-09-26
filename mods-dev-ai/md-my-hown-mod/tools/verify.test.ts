import { assert, assertEquals } from "jsr:@std/assert";
import {
    DEAD_PROBES,
    MOD_OWN_KEYS,
    TYPINGS_OMIT,
    argCount,
    coveredConfigTypes,
    indexPublic,
    isRealCall,
    loadArtefacts,
} from "./verify.ts";

const a = loadArtefacts();
const index = indexPublic(a.pub);

// ── the index itself ─────────────────────────────────────────────────────────

Deno.test("the public index resolves aliases as well as members", () => {
    // `ui.toast` is `export import toast = shared.api.ui.toast`, so it lives in
    // aliases, not members. Indexing members alone made 36 calls unresolvable.
    assert(index.has("ui.toast"), "ui.toast missing from the index");
    assert(index.has("elements.getTypeById"), "elements.getTypeById missing");
});

Deno.test("the index reaches nested namespaces", () => {
    // `shared.api.elements.getTypeById` is three levels down
    assert(index.has("elements.getTypeById"));
    assert(index.size > 300, `index only holds ${index.size} members`);
});

Deno.test("every indexed member carries a signature", () => {
    for (const [path, m] of index) {
        assert(m.name.length > 0, `${path} has no name`);
        assert(m.total !== undefined, `${path} has no arity`);
    }
});

// ── check 1: every mod call resolves ─────────────────────────────────────────

const realCalls = a.calls.calls.filter(isRealCall);
const unresolved = realCalls.filter((c: any) => !index.has(`${c.ns}.${c.method}`));

Deno.test("the mod makes real calls (guard against a vacuous test)", () => {
    assert(realCalls.length > 50, `only ${realCalls.length} calls to check`);
});

Deno.test("every mod call resolves, or is a known dead probe", () => {
    const unknown = unresolved
        .map((c: any) => `${c.ns}.${c.method}`)
        .filter((p: string) => !DEAD_PROBES.has(p));
    assertEquals(unknown, [], `unresolved: ${unknown.join(", ")}`);
});

Deno.test("the dead-probe list has not changed", () => {
    // If a future engine adds one of these, this fails so the note in
    // catalog.ts can be corrected rather than left to rot.
    const found = new Set<string>(
        unresolved.map((c: any) => `${c.ns}.${c.method}`),
    );
    const added = [...found].filter((p) => !DEAD_PROBES.has(p));
    const stale = [...DEAD_PROBES].filter((p) => !found.has(p));
    assertEquals(added, [], "new dead probes appeared");
    assertEquals(stale, [], "these probes now resolve — remove them from the list");
});

Deno.test("every mod call passes at least the required argument count", () => {
    const short: string[] = [];
    for (const c of realCalls) {
        const m = index.get(`${c.ns}.${c.method}`);
        if (!m) continue; // a dead probe
        const given = argCount(c.args ?? "");
        if (given < m.required) {
            short.push(
                `${c.ns}.${c.method} given ${given}, needs ${m.required} (${m.params})`,
            );
        }
    }
    assertEquals(short, [], `too few arguments:\n  ${short.join("\n  ")}`);
});

Deno.test("no mod call passes more arguments than the api accepts", () => {
    const over: string[] = [];
    for (const c of realCalls) {
        const m = index.get(`${c.ns}.${c.method}`);
        if (!m) continue;
        const given = argCount(c.args ?? "");
        if (given > m.total) {
            over.push(`${c.ns}.${c.method} given ${given}, accepts ${m.total}`);
        }
    }
    assertEquals(over, [], `too many arguments:\n  ${over.join("\n  ")}`);
});

Deno.test("argCount does not split inside an object or a call", () => {
    assertEquals(argCount("a, b, { c, d }"), 3);
    assertEquals(argCount("fn(x, y), z"), 2);
    assertEquals(argCount(""), 0);
    assertEquals(argCount("   "), 0);
    assertEquals(argCount("a, [b, c]"), 2);
});

// ── check 2: every config key is one the engine knows ────────────────────────

const engineFields = new Set<string>();
for (const m of a.defs.methods) {
    for (const r of m.reads) {
        engineFields.add(r.field);
        engineFields.add(r.field.split(".")[0]);
    }
}
for (const p of a.params) {
    for (const q of p.params) {
        engineFields.add(q.name);
        engineFields.add(q.name.split(".")[0]);
    }
}

Deno.test("the engine field set is non-empty (guard)", () => {
    assert(engineFields.size > 50, `only ${engineFields.size} fields`);
});

Deno.test("every key of a resolved config type is known to the engine", async () => {
    // This is the check that would have caught `registerConveyor` (the engine
    // spells it `registerConveyorType`) and a stripped `upgradeCategory.id`.
    //
    // Scoped to the config types whose engine payload was actually resolved.
    // Anything else has no engine field set to check against.
    const { parseDts } = await import("./extract-public-api.ts");
    const covered = coveredConfigTypes(a.params);
    const [mod] = parseDts(
        Deno.readTextFileSync(
            new URL("../src/constants.ts", import.meta.url).pathname,
        ),
        "src/constants.ts",
        "mod",
    );
    const unknown: string[] = [];
    let checked = 0;
    for (const t of mod.types) {
        if (!covered.has(t.name)) continue;
        for (const f of t.fields) {
            const key = f.name.split(".")[0];
            if (engineFields.has(key) || MOD_OWN_KEYS.has(key)) continue;
            unknown.push(`${t.name}.${f.name}`);
        }
        checked++;
    }
    // the check must actually be doing something
    assert(checked >= 6, `only ${checked} config types in scope`);

    // What remains is the *inverse* of the audit's `undeclared` finding: keys
    // the mod declares that the engine does not describe. Those are a reviewed
    // list, and the assertion is that it has neither grown nor shrunk.
    const added = unknown.filter((k) => !TYPINGS_OMIT.has(k));
    const stale = [...TYPINGS_OMIT].filter((k) => !unknown.includes(k));
    assertEquals(added, [], `config keys the engine never mentions: ${added.join(", ")}`);
    assertEquals(stale, [], `these are now declared by the typings: ${stale.join(", ")}`);
});

Deno.test("the resolved config types are the ones the reference documents", () => {
    // keeps `coveredConfigTypes` honest against the artefact it is derived from
    const covered = coveredConfigTypes(a.params);
    for (
        const d of [
            "ElementConfig",
            "StructureConfig",
            "TerrainConfig",
            "UpgradeConfig",
            "UpgradeCategoryConfig",
            "ProjectileConfig",
        ]
    ) {
        assert(covered.has(d), `${d} is not in the resolved set`);
    }
    // Two are deliberately out of scope, for different reasons:
    //  - `ItemConfig`: the mod has no `registerItem` at all.
    //  - `TechConfig`: the mod registers through `tech.registerNode`, which
    //    delegates into another module, so its payload is undetermined rather
    //    than mapped. `tech.register` is resolved, but the mod never calls it.
    assert(!covered.has("ItemConfig"), "ItemConfig should not be in scope");
    assert(!covered.has("TechConfig"), "TechConfig should not be in scope");
});

Deno.test("the mod does not depend on a deprecated member", () => {
    // `elements.getTypeFromId` is @deprecated. Calling it optionally is fine;
    // the audit is that the mod must not *depend* on it.
    const src = Deno.readTextFileSync(
        new URL("../src/packages/mysandkit.ts", import.meta.url).pathname,
    );
    assert(
        !/api\.elements\.getTypeFromId\s*\(/.test(src),
        "getTypeFromId is called directly and is @deprecated",
    );
});