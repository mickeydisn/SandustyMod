/**
 * extract-object-graph.ts — Phase 2: how the engine's objects reference
 * each other, and the id space they live in.
 *
 * Built from the typings, which are the only description of the main-thread
 * api that exists. Two things must be untangled first:
 *
 *   1. Definitions hide behind aliases. `api.elements.ElementDefinition` is
 *      `export import … = shared.api.elements.ElementDefinition`, and the real
 *      shape is an object literal written with commas. The public index now
 *      carries `shared/` so those fields are reachable.
 *
 *   2. Every reference is one of three things, and mixing them up is the
 *      classic mod bug:
 *
 *        ElementType  numeric handle   ElementTypeEnum | TaggedNumber<"elementType">
 *        ElementId    string id        LooseString<never>
 *        ElementRef   either           ElementType | ElementId
 *
 * Usage: deno run -A tools/extract-object-graph.ts
 */

import {
    buildIndex,
    parseDts,
    type ApiType,
    type Namespace,
    type PublicIndex,
} from "./extract-public-api.ts";

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const OUT_DIR = `${ROOT}doc-bundel/`;

/** How a name or field participates in the id space. */
export type IdRole = "handle" | "id" | "ref" | "other";

export interface IdSpace {
    name: string;
    role: IdRole;
    /** the right hand side it is defined as, verbatim */
    definition: string;
    doc: string;
}

/** Split a union into its top-level members. */
function unionParts(rhs: string): string[] {
    const out: string[] = [];
    let depth = 0, cur = "";
    for (const ch of rhs) {
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) depth--;
        if (ch === "|" && depth === 0) {
            out.push(cur.trim());
            cur = "";
        } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

/**
 * Classify a declared type alias into the id space.
 *
 * The shapes are consistent across elements, structures, terrains and items, so
 * they can be recognised from the definition text rather than by hard-coding a
 * list of names. The important case is a union that admits *both* a number and
 * a string — `ItemId = ItemIdEnum | LooseString<never>` — which is a reference,
 * not a handle, and treating it as a handle is what makes a picker emit a
 * number where the engine wanted the string.
 */
export function classifyIdSpace(name: string, rhs: string, doc = ""): IdSpace {
    const parts = unionParts(rhs);
    let numeric = false;
    let stringy = false;
    for (const p of parts) {
        if (/^LooseString</.test(p)) stringy = true;
        else if (/TaggedNumber</.test(p)) numeric = true;
        else if (/[A-Za-z0-9_]Enum$/.test(p)) numeric = true;
    }
    const role: IdRole = numeric && stringy
        ? "ref"
        : numeric
        ? "handle"
        : stringy
        ? "id"
        : "other";
    return { name, role, definition: rhs, doc };
}

/**
 * Classify a set of aliases, resolving chains.
 *
 * `ElementRef = ElementType | ElementId` names two other id-space types rather
 * than a `LooseString<…>` or an `*Enum`, so it cannot be judged from its own
 * text alone. Classifying is therefore repeated until nothing changes, which
 * settles `ElementRef` once `ElementType` and `ElementId` are known.
 */
export function classifyIdSpaceAll(
    defs: { name: string; target: string; doc: string }[],
): IdSpace[] {
    // A name may be declared more than once with different detail — the public
    // `signals.d.ts` says `StructureType = unknown` while the shared typings
    // give the real `StructureTypeEnum | TaggedNumber<"structureType">`. Keep
    // every declaration and use the first one that actually says something.
    const byName = new Map<string, { name: string; target: string; doc: string }[]>();
    for (const d of defs) {
        const list = byName.get(d.name) ?? [];
        list.push(d);
        byName.set(d.name, list);
    }

    const out = new Map<string, IdSpace>();
    const roleOf = (n: string): IdRole | undefined => {
        const r = out.get(n)?.role;
        return r === "other" ? undefined : r;
    };

    const evaluate = (
        name: string,
        target: string,
        doc: string,
    ): IdSpace => {
        let numeric = false;
        let stringy = false;
        for (const p of unionParts(target)) {
            if (/^LooseString</.test(p)) stringy = true;
            else if (/TaggedNumber</.test(p) || /[A-Za-z0-9_]Enum$/.test(p)) {
                numeric = true;
            } else {
                const r = roleOf(p);
                if (r === "handle") numeric = true;
                else if (r === "id") stringy = true;
                else if (r === "ref") {
                    numeric = true;
                    stringy = true;
                }
            }
        }
        const role: IdRole = numeric && stringy
            ? "ref"
            : numeric
            ? "handle"
            : stringy
            ? "id"
            : "other";
        return { name, role, definition: target, doc };
    };

    for (let pass = 0; pass < 6; pass++) {
        let changed = false;
        for (const [name, list] of byName) {
            const known = out.get(name);
            if (known && known.role !== "other") continue;
            let best: IdSpace | null = null;
            for (const d of list) {
                const got = evaluate(name, d.target, d.doc);
                if (got.role !== "other") {
                    best = got;
                    break;
                }
            }
            const next = best ?? evaluate(name, list[0].target, list[0].doc);
            if (!known || known.role !== next.role || known.definition !== next.definition) {
                changed = true;
            }
            out.set(name, next);
        }
        if (!changed) break;
    }
    return [...out.values()].filter((s) => s.role !== "other");
}

// ------------------------------------------------------------------ edges
export interface Edge {
    from: string;
    field: string;
    to: string;
    /** the declared type of the field */
    via: string;
    optional: boolean;
    /** `handle` for a numeric type, `id` for a string, `ref` for either */
    role: IdRole;
    doc: string;
}

/** A type name that is a primitive, a container, or a TypeScript utility. */
const NOISE = new Set([
    "string", "number", "boolean", "void", "unknown", "any", "never", "object",
    "Record", "Partial", "Required", "Readonly", "Array", "Map", "Set", "Date",
    "PropertyKey", "Function", "Promise", "Error", "RegExp", "Symbol", "BigInt",
]);

/** Pull candidate type references out of a field's declared type text. */
export function referencedTypes(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(/([A-Z][A-Za-z0-9_]*)/g)) {
        if (!NOISE.has(m[1])) out.add(m[1]);
    }
    return [...out];
}

export interface Graph {
    types: Map<string, ApiType>;
    idSpace: IdSpace[];
    edges: Edge[];
    /** types nothing points at — the roots a mod authors first */
    roots: string[];
    /** types with no outgoing reference */
    leaves: string[];
}

/**
 * Assemble the graph from every namespace the index knows about, main and
 * shared alike, because a main-thread alias names a shared type.
 */
export function buildGraph(namespaces: Namespace[]): Graph {
    const types = new Map<string, ApiType>();
    const defs: { name: string; target: string; doc: string }[] = [];
    for (const ns of namespaces) {
        for (const t of ns.types) {
            // first definition wins, but a shape with fields beats an empty one
            const cur = types.get(t.name);
            if (!cur || (cur.fields.length === 0 && t.fields.length > 0)) {
                types.set(t.name, t);
            }
        }
        for (const a of ns.aliases) {
            // re-export paths carry no id-space meaning
            if (/\bshared\.api\./.test(a.target)) continue;
            defs.push({ name: a.name, target: a.target, doc: a.doc });
        }
    }
    const idSpace = classifyIdSpaceAll(defs);

    const roleOf = (name: string): IdRole =>
        idSpace.find((s) => s.name === name)?.role ?? "other";

    const edges: Edge[] = [];
    for (const t of types.values()) {
        for (const f of t.fields) {
            for (const ref of referencedTypes(f.text)) {
                // keep only references we can resolve to a shape or an id role
                if (!types.has(ref) && roleOf(ref) === "other") continue;
                edges.push({
                    from: t.name,
                    field: f.name,
                    to: ref,
                    via: f.text,
                    optional: f.optional,
                    role: roleOf(ref),
                    doc: f.doc,
                });
            }
        }
    }

    const referenced = new Set(edges.map((e) => e.to));
    const sourceNames = new Set(
        edges.filter((e) => types.has(e.to)).map((e) => e.from),
    );
    return {
        types,
        idSpace,
        edges,
        roots: [...types.keys()].filter((n) => !sourceNames.has(n)).sort(),
        leaves: [...types.keys()].filter((n) => !referenced.has(n)).sort(),
    };
}


// ------------------------------------------------ mod vs engine definitions

/**
 * Which engine shape each of the mod's stored config objects corresponds to.
 *
 * Only entries that can be matched to a real engine type are listed. A `null`
 * value means the mod holds something the engine has no matching definition for
 * and it has to be resolved by hand.
 */
const MOD_TO_ENGINE: Record<string, string | null> = {
    ElementConfig: "ElementDefinition",
    StructureConfig: "SandkitStructureDefinition",
    ProcessingConfig: "StructureProcessingDefinitionV1",
    ContactReactionConfig: "ContactRecipeDefinitionV1",
    ProjectileConfig: "ProjectileDefinition",
    ExcavationProfileConfig: "ExcavationProfileDefinitionV1",
    ItemConfig: "ItemDefinition",
    TerrainConfig: "TerrainDefinition",
    TechConfig: "TechDefinition",
    UpgradeConfig: "UpgradeDefinition",
    UpgradeCategoryConfig: "UpgradeCategoryDefinition",
    // `RecipeConfig` covers four machines with different bodies, so it cannot be
    // compared against a single shape without lying. Compare per kind instead.
    RecipeConfig: null,
    // No `*Definition` shape is declared for these in the typings. They are
    // either registered with an inline object type or have no register call.
    InteractionConfig: null,
    ModifierConfig: null,
    SignalConfig: null,
    TriggerConfig: null,
    SpriteConfig: null,
    EnergyTypeConfig: null,
    StructureBehaviorConfig: null,
};

export interface Drift {
    modType: string;
    engineType: string | null;
    /** the engine shape accepts unnamed extra fields, so no comparison applies */
    openEnded: boolean;
    /** fields the mod stores that the engine shape does not declare */
    extra: string[];
    /** fields the engine shape declares that the mod does not store */
    missing: string[];
    /** fields present in both */
    shared: string[];
}

/**
 * Compare the mod's stored config shapes with the engine's definitions.
 *
 * This is the rule set the catalog pickers need: a field in `extra` is either
 * an engine feature the typings do not document or a field the engine will
 * ignore, and a field in `missing` is a real option the UI does not offer yet.
 *
 * An open-ended engine shape — one carrying `[key: string]: unknown` — accepts
 * fields the typings never mention, so its *absent* fields cannot be called
 * wrong. It still declares real options, though, so `missing` is kept and only
 * `extra` is dropped.
 */
export function diffMod(
    modTypes: Map<string, ApiType>,
    engineTypes: Map<string, ApiType>,
): Drift[] {
    const out: Drift[] = [];
    for (const [modType, engineType] of Object.entries(MOD_TO_ENGINE)) {
        const mine = modTypes.get(modType);
        const theirs = engineType ? engineTypes.get(engineType) : undefined;
        if (!mine || !theirs) {
            out.push({
                modType,
                engineType,
                openEnded: false,
                extra: [],
                missing: [],
                shared: [],
            });
            continue;
        }
        const theirNames = new Set(theirs.fields.map((f) => f.name));
        const myNames = new Set(mine.fields.map((f) => f.name));
        const missing = [...theirNames].filter((n) => !myNames.has(n)).sort();
        out.push({
            modType,
            engineType,
            openEnded: theirs.openEnded,
            // an open-ended shape permits unknown fields, so nothing the mod
            // stores can be wrong here
            extra: theirs.openEnded
                ? []
                : [...myNames].filter((n) => !theirNames.has(n)).sort(),
            missing,
            shared: [...myNames].filter((n) => theirNames.has(n)).sort(),
        });
    }
    return out;
}

function renderDrift(rows: Drift[]): string {
    const out: string[] = [
        "## Mod config vs engine definitions",
        "",
        "The rule set the catalog pickers follow. `extra` is stored by the mod",
        "but not declared by the engine shape; `missing` is declared by the",
        "engine but never stored, so the UI cannot offer it yet.",
        "",
        "| mod type | engine shape | extra | missing |",
        "|---|---|---|---|",
    ];
    for (const r of rows) {
        const shape = r.engineType ? `\`${r.engineType}\`` : "_unmatched_";
        const note = r.openEnded
            ? " _(open-ended: accepts any field)_"
            : r.engineType
            ? ""
            : " _(no engine shape identified)_";
        out.push(
            `| \`${r.modType}\` | ${shape}${note} | ${
                r.openEnded ? "n/a" : r.extra.length
            } | ${r.missing.length} |`,
        );
    }
    out.push("");
    for (const r of rows) {
        if (!r.engineType) continue;
        if (!r.extra.length && !r.missing.length) continue;
        out.push(`### \`${r.modType}\` → \`${r.engineType}\``, "");
        if (r.extra.length) {
            out.push("stored by the mod, not in the engine shape:", "");
            for (const f of r.extra) out.push(`- \`${f}\``);
            out.push("");
        }
        if (r.missing.length) {
            out.push("in the engine shape, never stored:", "");
            for (const f of r.missing) out.push(`- \`${f}\``);
            out.push("");
        }
    }
    return out.join("\n");
}

// -------------------------------------------------------------- rendering

const ROLE_BADGE: Record<IdRole, string> = {
    handle: "🔢 handle",
    id: "🔤 id",
    ref: "🔀 ref",
    other: "",
};

function render(graph: Graph): string {
    const out: string[] = [
        "# Object graph",
        "",
        "Generated by `tools/extract-object-graph.ts`. Do not edit by hand.",
        "",
        "How the engine's objects reference each other, and which id space each",
        "reference lives in.",
        "",
    ];

    out.push("## The id space", "");
    out.push("Three kinds of name, and the difference is the classic mod bug:", "");
    out.push("| name | role | defined as |");
    out.push("|---|---|---|");
    for (const s of graph.idSpace.sort((a, b) => a.name.localeCompare(b.name))) {
        out.push(
            `| \`${s.name}\` | ${ROLE_BADGE[s.role]} | \`${s.definition}\` |`,
        );
    }
    out.push("");

    out.push("## Object kinds", "");
    out.push("| type | fields | referenced by |");
    out.push("|---|---|---|");
    const byTarget = new Map<string, number>();
    for (const e of graph.edges) {
        if (graph.types.has(e.to)) {
            byTarget.set(e.to, (byTarget.get(e.to) ?? 0) + 1);
        }
    }
    for (const name of [...graph.types.keys()].sort()) {
        const t = graph.types.get(name)!;
        out.push(
            `| \`${name}\` | ${t.fields.length} | ${byTarget.get(name) ?? 0} |`,
        );
    }
    out.push("");

    out.push("## References", "");
    out.push("| from | field | to | via | |");
    out.push("|---|---|---|---|---|");
    for (const e of graph.edges.slice().sort((a, b) =>
        a.from.localeCompare(b.from) || a.field.localeCompare(b.field)
    )) {
        const field = `\`${e.field}\`${e.optional ? "?" : ""}`;
        const via = `\`${e.via.slice(0, 60)}\``;
        out.push(
            `| \`${e.from}\` | ${field} | \`${e.to}\` | ${via} | ${
                ROLE_BADGE[e.role]
            } |`,
        );
    }
    out.push("");
    return out.join("\n");
}

// -------------------------------------------------------------------- main

if (import.meta.main) {
    const idx: PublicIndex = await buildIndex();
    const graph = buildGraph([...idx.main, ...idx.shared]);

    let modDrift: Drift[] = [];
    if (Deno.args.includes("--mod")) {
        const constants = await Deno.readTextFile(`${ROOT}src/constants.ts`);
        const [ns] = parseDts(constants, "src/constants.ts", "mod");
        const modTypes = new Map(ns.types.map((t) => [t.name, t]));
        modDrift = diffMod(modTypes, graph.types);
        await Deno.writeTextFile(
            `${OUT_DIR}mod-config-drift.json`,
            JSON.stringify(modDrift, null, 2) + "\n",
        );
    }

    await Deno.writeTextFile(
        `${OUT_DIR}object-graph.json`,
        JSON.stringify(
            {
                stats: {
                    types: graph.types.size,
                    edges: graph.edges.length,
                    idSpace: graph.idSpace.length,
                    roots: graph.roots.length,
                    leaves: graph.leaves.length,
                },
                idSpace: graph.idSpace,
                edges: graph.edges,
                roots: graph.roots,
                leaves: graph.leaves,
            },
            null,
            2,
        ) + "\n",
    );
    await Deno.writeTextFile(
        `${OUT_DIR}OBJECT-GRAPH.md`,
        render(graph) + (modDrift.length ? "\n" + renderDrift(modDrift) : ""),
    );
    console.log(`types      ${graph.types.size}`);
    console.log(`edges      ${graph.edges.length}`);
    console.log(`id space   ${graph.idSpace.length}`);
    console.log(`roots      ${graph.roots.length}`);
    console.log(`leaves     ${graph.leaves.length}`);
    if (modDrift.length) {
        const matched = modDrift.filter((d) => d.engineType);
        console.log(`\nmod config shapes matched: ${matched.length}`);
        console.log("  (extra = n/a means the engine shape accepts any field)");
        for (const d of matched) {
            console.log(
                `  ${d.modType} -> ${d.engineType}: ` +
                    `${d.openEnded ? "n/a" : "+" + d.extra.length} extra, ` +
                    `-${d.missing.length} unexposed` +
                    (d.openEnded ? "  (open-ended)" : ""),
            );
        }
        console.log(`-> ${OUT_DIR}mod-config-drift.json`);
    }
    console.log(`-> ${OUT_DIR}OBJECT-GRAPH.md`);
    console.log(`-> ${OUT_DIR}object-graph.json`);
}

