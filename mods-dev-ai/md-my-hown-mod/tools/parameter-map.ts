/**
 * parameter-map.ts — Phase 6: every parameter the engine accepts, per function.
 *
 * Phase 5 worked from the *implementation*: which fields a `register` body
 * actually dereferences. That is the right floor, but it understates the
 * surface. A definition interface is also what the engine **stores** — several
 * of these carry an `[key: string]: unknown` index signature, so a field the
 * body never reads is still persisted and later consulted by the simulation.
 *
 * This tool therefore reports three things per parameter, and the difference
 * between them is the interesting part:
 *
 *   declared  the `.d.ts` interface lists it
 *   read      the register body dereferences it (Phase 3)
 *   exposed   a structured form control can set it (Phase 5)
 *
 * A parameter that is `declared` but not `exposed` is a candidate, not a bug —
 * but it is the list Phase 6 exists to produce. A parameter that is `read` but
 * not `declared` is a real finding: the typings are incomplete.
 *
 * Usage: deno run -A tools/parameter-map.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const OUT = `${ROOT}doc-bundel/`;

export interface Param {
    name: string;
    /** Declared type text, e.g. `number`, `{ id: string }`, `boolean[]`. */
    type: string;
    optional: boolean;
    /** JSDoc line for the field, which is the only stated meaning available. */
    doc: string;
    /** Control this parameter should have, inferred from its type. */
    control: Control;
}

export type Control =
    | "text"
    | "number"
    | "toggle"
    | "select"
    | "picker"
    | "ref-list"
    | "nested"
    | "matrix"
    | "color"
    /** a function — the form must offer a handler key, never raw code */
    | "callback"
    | "unknown";

/**
 * Infer the control a parameter wants from its declared type.
 *
 * This is the "right control type" check Phase 6 asks for. It is deliberately
 * conservative: anything it cannot classify returns `"unknown"` rather than
 * guessing, so an unclassified parameter shows up instead of hiding.
 */
export function controlFor(type: string): Control {
    const t = (type ?? "").trim();
    if (!t) return "unknown";
    // `readonly` is a type-level modifier and does not change the control
    const bare = t.replace(/^readonly\s+/, "");
    if (/^boolean(\s*\|\s*undefined)?$/.test(bare)) return "toggle";
    if (/^number(\s*\|\s*undefined)?$/.test(bare)) return "number";
    // 0xRRGGBB / "0xRRGGBB" — a packed colour, not a plain number
    if (/^(0x[0-9a-f]+|"0x[0-9a-f]+")(\s*\|\s*undefined)?$/i.test(t)) {
        return "color";
    }
    if (/^string(\s*\|\s*undefined)?$/.test(bare)) return "text";
    if (/^(\w+)\[\](\s*\|\s*undefined)?$/.test(bare)) return "ref-list";
    // a tuple is a fixed-size vector — the engine types `colorHSL` as
    // `[number, number, number]`, so the members are type names, not digits
    if (/^\[[\w\s,.|]+\](\s*\|\s*undefined)?$/.test(t)) return "matrix";
    if (/^(readonly\s+)?Record</.test(t)) return "nested";
    if (/^Record</.test(bare)) return "nested";
    // a bare identifier naming a domain type is a reference to another object
    if (/^[A-Z][A-Za-z]*(\s*\|\s*undefined)?$/.test(bare)) {
        return "picker";
    }
    if (/\{\s*$/.test(t)) return "nested";
    if (/\(/.test(t)) return "callback";
    return "unknown";
}

/** Definitions that describe a registerable object, and the api that takes it. */
export const DEFINITION_CALLS: Record<string, string> = {
    // a `type … = { … }` alias, not an `interface` — it is the element payload
    ElementDefinition: "elements.register",
    ItemDefinition: "items.register",
    SandkitStructureDefinition: "structures.register",
    TerrainDefinition: "terrains.register",
    TechDefinition: "tech.register",
    UpgradeDefinition: "upgrades.register",
    UpgradeCategoryDefinition: "upgrades.registerCategory",
    ProjectileDefinition: "projectiles.register",
    ExcavationProfileDefinition: "excavation.registerProfile",
    ContactRecipeDefinition: "reactions.register",
    StructureProcessingDefinition: "structures.processing.register",
    MainTriggerDefinition: "triggers.register",
    InputBindingDefinition: "input.registerBinding",
    // NOT structures.register — this is the payload of
    // `structures.registerPlacementConfig`, a separate call
    PlacementConfigDefinition: "structures.registerPlacementConfig",
};

/**
 * Interfaces that are not a register payload — runtime/gameplay data shapes
 * with no form. Listing them would overstate the gap.
 */
export const NOT_REGISTERABLE = new Set([
    "ModMapDefinition",
    "KineticPressRecipeDefinition",
    "PlanterBoxRecipeDefinition",
    "ShakerRecipeDefinition",
    "WeightedRefineryRecipeDefinition",
    "StructureProcessorDefinition",
]);

/** Expand a nested object type into `parent.child` parameters. */
export function flatten(name: string, type: string, depth = 0): Param[] {
    const out: Param[] = [];
    if (depth > 2) return out;
    const m = /^\{([\s\S]*?)\}/.exec(type.trim());
    if (!m) return out;
    for (const line of m[1].split(/[;\n]/)) {
        const f = /^\s*(\w+)(\?)?\s*:\s*([\s\S]+?);?\s*$/.exec(line);
        if (!f) continue;
        const [, key, opt, inner] = f;
        if (key === "[key: string]") continue; // index signature, not a field
        out.push({
            name: `${name}.${key}`,
            type: inner.trim(),
            optional: Boolean(opt),
            doc: "",
            control: controlFor(inner),
        });
        out.push(...flatten(`${name}.${key}`, inner, depth + 1));
    }
    return out;
}

// ------------------------------------------------------------------- parse

export interface Field {
    name: string;
    type: string;
    optional: boolean;
    doc: string;
}

/**
 * Parse the body of a `.d.ts` `interface` into its members.
 *
 * `parseObjectType` in extract-public-api.ts is not reusable here: it splits
 * members on commas, because it is built for TypeScript *object type literals*
 * (`{ a: string, b: number }`). An interface separates its members with
 * semicolons and newlines, so that parser returns one field for an entire
 * interface body.
 *
 * JSDoc is captured on the way through, because it is the only stated meaning
 * available for most of these parameters.
 */
export function parseInterface(body: string): Field[] {
    // walk the body, keeping comments so a doc can be attached to the member
    // that follows it
    const out: Field[] = [];
    let i = 0;
    let doc: string[] = [];
    let cur = "";
    let depth = 0;
    const flush = () => {
        const t = cur.trim();
        cur = "";
        if (!t) return;
        if (t.startsWith("[") || /^\/\//.test(t)) return; // index signature
        const m = t.match(/^([A-Za-z0-9_$]+)(\?)?\s*:\s*([\s\S]+?)\s*[,;]?\s*$/);
        if (!m) return;
        out.push({
            name: m[1],
            type: m[3].replace(/;\s*$/, "").trim(),
            optional: Boolean(m[2]),
            doc: doc.join(" ").trim(),
        });
        doc = [];
    };

    while (i < body.length) {
        // a block comment is documentation, not code
        if (body.startsWith("/**", i)) {
            const end = body.indexOf("*/", i);
            if (end === -1) break;
            for (
                const line of body.slice(i + 3, end)
                    .split("\n")
                    .map((l) => l.replace(/^\s*\*?/, "").trim())
            ) {
                if (line) doc.push(line);
            }
            i = end + 2;
            continue;
        }
        if (body.startsWith("/*", i)) {
            const end = body.indexOf("*/", i);
            if (end === -1) break;
            i = end + 2;
            continue;
        }
        if (body.startsWith("//", i)) {
            const end = body.indexOf("\n", i);
            i = end === -1 ? body.length : end;
            continue;
        }
        const ch = body[i];
        // only real brackets open a group. `<` / `>` must not count: an arrow
        // type like `() => Record<string, unknown>` would otherwise unbalance
        // the depth and swallow the following members.
        if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth--;
        // a member ends at a top-level `;` or newline
        if (depth === 0 && (ch === ";" || ch === "\n")) {
            flush();
            i++;
            continue;
        }
        cur += ch;
        i++;
    }
    flush();
    // a newline inside a member is just formatting
    return out.map((f) => ({ ...f, type: f.type.replace(/\s*\n\s*/g, " ") }));
}

// ------------------------------------------------------------------- collect

export interface Report {
    definition: string;
    call: string;
    /** All parameters the `.d.ts` declares, nested ones included. */
    params: Param[];
    /** Declared names the register body actually dereferences. */
    read: string[];
    /** Declared names a structured form control can set. */
    exposed: string[];
    /** Declared but not exposed — the Phase 6 work list. */
    candidates: Param[];
    /** Read by the engine but absent from the `.d.ts`. */
    undeclared: string[];
}

const SDK_DIRS = [
    "sandkit/api",
    "shared/api",
    "shared",
    "sandkit",
    "configs",
];

/** The sdk typings live at the repo root, not under the mod directory. */
function sdkRoot(): string {
    return HERE.replace(/\/$/, "").split("/").slice(0, -3).join("/") + "/";
}

/** Every `export interface X` in the shipped typings, with its fields. */
async function readDefinitions(): Promise<
    { params: Map<string, Param[]>; raw: Map<string, Field[]> }
> {
    const out = new Map<string, Param[]>();
    const raw = new Map<string, Field[]>();
    const seen = new Set<string>();
    const pkg = `${sdkRoot()}__pakages/__other/sandkit/src/`;
    for (const dir of SDK_DIRS) {
        const base = `${pkg}${dir}/`;
        let entries: string[];
        try {
            entries = [];
            for await (const e of Deno.readDir(base)) {
                if (e.isFile && e.name.endsWith(".d.ts")) entries.push(e.name);
            }
        } catch {
            continue;
        }
        for (const name of entries) {
            const text = Deno.readTextFileSync(`${base}${name}`);
            // Most payloads are `interface X { … }` separated by `;`, but some
            // are `type X = { … }` separated by commas — `ElementDefinition` is
            // the important one, since it is the element payload. Matching only
            // `interface` left every element field unverified.
            for (const m of text.matchAll(/interface (\w+)\s*\{/g)) {
                const iface = m[1];
                if (seen.has(iface)) continue;
                let depth = 1;
                let i = m.index! + m[0].length;
                for (; i < text.length && depth > 0; i++) {
                    if (text[i] === "{") depth++;
                    else if (text[i] === "}") depth--;
                }
                seen.add(iface);
                out.set(
                    iface,
                    paramsOf(parseInterface(
                        text.slice(m.index! + m[0].length, i),
                    )),
                );
                raw.set(
                    iface,
                    parseInterface(text.slice(m.index! + m[0].length, i)),
                );
            }
            for (const m of text.matchAll(/type (\w+)\s*=\s*\{/g)) {
                const iface = m[1];
                if (seen.has(iface)) continue;
                let depth = 1;
                let i = m.index! + m[0].length;
                for (; i < text.length && depth > 0; i++) {
                    if (text[i] === "{") depth++;
                    else if (text[i] === "}") depth--;
                }
                seen.add(iface);
                const fields = parseInterface(
                    text.slice(m.index! + m[0].length, i),
                );
                out.set(iface, paramsOf(fields));
                raw.set(iface, fields);
            }
        }
    }
    return { params: out, raw };
}

/** Expand a parsed field list into params, including nested ones. */
function paramsOf(fields: Field[]): Param[] {
    const params: Param[] = [];
    for (const f of fields) {
        params.push({
            name: f.name,
            type: f.type,
            optional: f.optional,
            doc: f.doc,
            control: controlFor(f.type),
        });
        params.push(...flatten(f.name, f.type));
    }
    return params;
}

/**
 * A bare identifier can name either a data shape (`StructureVariant`) or a bag
 * of functions (`InputBindingHandlers`). The name alone cannot tell them apart,
 * so resolve it against the interfaces already collected and look at the
 * members: an interface whose fields are all function-typed is a callback.
 */
export function refineControls(
    params: Param[],
    defs: Map<string, Field[]>,
): void {
    for (const p of params) {
        if (p.control !== "picker") continue;
        const ref = p.type.trim().replace(/\s*\|\s*undefined$/, "");
        const target = defs.get(ref);
        if (!target || !target.length) continue;
        const allFns = target.every((f) => /\(/.test(f.type));
        if (allFns) p.control = "callback";
    }
}

export async function build(): Promise<Report[]> {
    const { params: defs, raw } = await readDefinitions();
    const engine = JSON.parse(Deno.readTextFileSync(`${OUT}definitions.json`));
    const { structuredKeys } = await import("./ui-completeness.ts");
    const byTab = structuredKeys(Deno.readTextFileSync(`${ROOT}src/ui/schema.ts`));
    const exposed = new Set<string>();
    for (const keys of byTab.values()) for (const k of keys) exposed.add(k);

    const readsByCall = new Map<string, Set<string>>();
    for (const m of engine.methods) {
        if (!readsByCall.has(m.method)) readsByCall.set(m.method, new Set());
        for (const r of m.reads) readsByCall.get(m.method)!.add(r.field);
    }

    const reports: Report[] = [];
    for (const [definition, call] of Object.entries(DEFINITION_CALLS)) {
        const params = defs.get(definition);
        if (!params) continue;
        // resolve identifier-typed parameters now that every interface is known
        refineControls(params, raw);
        const read = new Set(readsByCall.get(call) ?? []);
        // a nested parameter counts as exposed if either its full path or its
        // root is a key the form produces
        const hit = new Set(
            params
                .map((p) => p.name)
                .filter((n) => exposed.has(n) || exposed.has(n.split(".")[0])),
        );
        const declared = new Set(params.map((p) => p.name));
        reports.push({
            definition,
            call,
            params,
            read: [...read].sort(),
            exposed: [...hit].sort(),
            candidates: params.filter((p) => !hit.has(p.name)),
            undeclared: [...read].filter((n) => !declared.has(n)).sort(),
        });
    }
    return reports;
}

export function render(reports: Report[]): string {
    const out: string[] = [
        "# Parameter map",
        "",
        "Generated by `tools/parameter-map.ts`. Do not edit by hand.",
        "",
        "Every parameter the engine's typings declare, per registerable definition,",
        "with the control its type implies and whether a form can set it.",
        "",
        "- **declared** — listed in the shipped `.d.ts`",
        "- **read** — the register body dereferences it",
        "- **exposed** — a structured form control can set it",
        "",
        "A *candidate* is declared but not exposed. An *undeclared* entry is read",
        "by the engine but missing from the typings.",
        "",
        "| definition | api call | declared | read | exposed | candidates | undeclared |",
        "|---|---|---|---|---|---|---|",
    ];
    for (const r of reports) {
        out.push(
            `| \`${r.definition}\` | \`${r.call}\` | ${r.params.length} | ${r.read.length} | ${r.exposed.length} | ${r.candidates.length} | ${r.undeclared.length} |`,
        );
    }
    for (const r of reports) {
        if (!r.candidates.length && !r.undeclared.length) continue;
        out.push("", `### \`${r.definition}\` → \`${r.call}\``, "");
        out.push(
            "| parameter | type | control | optional | meaning |",
            "|---|---|---|---|---|",
        );
        for (const p of r.candidates) {
            out.push(
                `| \`${p.name}\` | \`${p.type}\` | ${p.control} | ${
                    p.optional ? "yes" : "**no**"
                } | ${p.doc || "—"} |`,
            );
        }
        if (r.undeclared.length) {
            out.push("", "Read by the engine but not declared:", "");
            out.push(r.undeclared.map((u) => `- \`${u}\``).join("\n"));
        }
    }
    return out.join("\n") + "\n";
}

if (import.meta.main) {
    const reports = await build();
    await Deno.writeTextFile(
        `${OUT}parameter-map.json`,
        JSON.stringify(reports, null, 2) + "\n",
    );
    await Deno.writeTextFile(`${OUT}PARAMETER-MAP.md`, render(reports));
    const sum = (f: (r: Report) => number) => reports.reduce((a, r) => a + f(r), 0);
    console.log(`definitions analysed : ${reports.length}`);
    console.log(`declared parameters  : ${sum((r) => r.params.length)}`);
    console.log(`exposed              : ${sum((r) => r.exposed.length)}`);
    console.log(`candidates           : ${sum((r) => r.candidates.length)}`);
    console.log(`undeclared           : ${sum((r) => r.undeclared.length)}`);
    for (const r of reports) {
        if (r.candidates.length) {
            console.log(
                `  ${r.definition}: ${r.candidates.map((c) => c.name).join(", ")}`,
            );
        }
        if (r.undeclared.length) {
            console.log(`  ${r.definition}: UNDECLARED ${r.undeclared.join(", ")}`);
        }
    }
    console.log(`-> ${OUT}PARAMETER-MAP.md`);
}
