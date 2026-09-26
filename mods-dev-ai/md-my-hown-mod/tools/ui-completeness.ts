/**
 * ui-completeness.ts — Phase 5/6: does the form cover what the engine reads?
 *
 * Phase 6 asks for a test asserting the field count per definition matches.
 * Counting is not the point, though — a field can be present in the form and
 * still never reach the engine, or reach it under a name the engine does not
 * read. So this compares three sets per definition:
 *
 *   engine     the fields the register body actually touches (Phase 3)
 *   mod config the fields the stored config type declares
 *   ui         the fields the form exposes
 *
 * and reports each disagreement, rather than a single number that could be met
 * the wrong way.
 *
 * Usage: deno run -A tools/ui-completeness.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
// `HERE` ends in `/tools/`; stripping it must leave the separator in place
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const OUT = `${ROOT}doc-bundel/`;

import { schemaSourceWithDefinitions } from "./schema-source.ts";

export interface Gaps {
    /** the engine reads it, the form does not expose it */
    missingFromUi: string[];
    /** the engine never reads it, yet the form exposes it */
    notReadByEngine: string[];
    /** the engine reads it, and the mod's config type never declares it */
    missingFromConfig: string[];
    engineReads: number;
    uiHas: number;
    configHas: number;
}

/** A stub for the host `sandkit` global, so the ui modules can be imported. */
export function stubSandkit(): void {
    // the proxy refers to itself, so it needs an explicit type to break the
    // circular inference
    const anyFn: unknown = new Proxy(() => {}, {
        get: () => anyFn,
        apply: () => anyFn,
    });
    (globalThis as Record<string, unknown>).sandkit = {
        api: new Proxy({}, { get: () => anyFn }),
    };
}

export interface Sources {
    definitions: { methods: { method: string; reads: { field: string; derefs: number }[] }[] };
    publicApi: { main: { name: string; members: { name: string; kind?: string }[] }[] };
    modTypes: Map<string, { fields: { name: string }[] }>;
    /** fields per form tab, from the live ui schema */
    uiFields: Map<string, string[]>;
}

export function compare(
    engineReads: string[],
    configFields: string[],
    uiFields: string[],
): Gaps {
    const engine = new Set(engineReads);
    const ui = new Set(uiFields);
    const config = new Set(configFields);
    return {
        // an exposed field the engine ignores is a form that promises something
        // the engine never does
        notReadByEngine: [...ui].filter((f) => !engine.has(f)).sort(),
        missingFromUi: [...engine].filter((f) => !ui.has(f)).sort(),
        missingFromConfig: [...engine].filter((f) => !config.has(f)).sort(),
        engineReads: engine.size,
        uiHas: ui.size,
        configHas: config.size,
    };
}

// ------------------------------------------------------------------- wiring

/**
 * Which stored config each register call is fed from, and which form tab edits
 * it. Keyed by the mod config type, so a config with several entry points
 * (`recipes` and `processing` both reach `structures.recipes.register`) is
 * credited to every tab that can actually set it.
 */
export const CONFIG_TO_TAB: Record<string, string[]> = {
    ElementConfig: ["elements"],
    StructureConfig: ["structures"],
    ItemConfig: ["items"],
    TerrainConfig: ["terrains"],
    TechConfig: ["techs"],
    UpgradeCategoryConfig: ["categories"],
    UpgradeConfig: ["upgrades"],
    ProjectileConfig: ["projectiles"],
    ContactReactionConfig: ["contacts"],
    InteractionConfig: ["interactions"],
    EnergyTypeConfig: ["energy"],
    ExcavationProfileConfig: ["excavation"],
    SignalConfig: ["signals"],
    TriggerConfig: ["triggers"],
    ProcessingConfig: ["processing"],
    RecipeConfig: ["recipes"],
    ModifierConfig: ["modifiers"],
    StructureBehaviorConfig: ["behaviors"],
    SpriteConfig: ["sprites"],
};

async function load(): Promise<Sources> {
    const definitions = JSON.parse(
        Deno.readTextFileSync(`${OUT}definitions.json`),
    );
    stubSandkit();
    const schema = await import(`${ROOT}src/ui/schema.ts`);
    const { parseDts } = await import("./extract-public-api.ts");
    const [mod] = parseDts(
        Deno.readTextFileSync(`${ROOT}src/constants.ts`),
        "src/constants.ts",
        "mod",
    );
    const uiFields = new Map<string, string[]>();
    // Read as one document, so a tab whose `formToEntry` lives in its own
    // definition file is seen the same as one still inside `schema.ts`.
    const structured = structuredKeys(schemaSourceWithDefinitions());
    for (const tab of Object.keys(schema.CATEGORY_META)) {
        uiFields.set(tab, [...(structured.get(tab) ?? [])]);
    }
    return {
        definitions,
        publicApi: { main: [] },
        modTypes: new Map(mod.types.map((t: any) => [t.name, t])),
        uiFields,
    };
}

/** Field keys across every tab that can edit a config type. */
function uiFieldsFor(
    src: Sources,
    modType: string,
): { tabs: string[]; fields: string[] } {
    const tabs = CONFIG_TO_TAB[modType] ?? [];
    const fields = [...new Set(tabs.flatMap((t) => src.uiFields.get(t) ?? []))];
    return { tabs, fields };
}

export async function run() {
    const src = await load();
    const { METHOD_TO_MOD } = await import("./extract-definitions.ts");
    const rows: {
        method: string;
        modType: string;
        tabs: string[];
        gaps: Gaps;
    }[] = [];
    for (const m of src.definitions.methods) {
        const modType = METHOD_TO_MOD[m.method];
        if (!modType || !src.modTypes.has(modType)) continue;
        const engineReads = m.reads.map((r: any) => r.field);
        const configFields = (src.modTypes.get(modType) as any).fields.map(
            (f: any) => f.name,
        );
        const { tabs, fields } = uiFieldsFor(src, modType);
        rows.push({
            method: m.method,
            modType,
            tabs,
            gaps: compare(engineReads, configFields, fields),
        });
    }
    return rows;
}

function render(rows: { method: string; modType: string; tabs: string[]; gaps: Gaps }[]): string {
    const out: string[] = [
        "# UI completeness",
        "",
        "Generated by `tools/ui-completeness.ts`. Do not edit by hand.",
        "",
        "Three sets are compared per register call: the fields the engine body",
        "actually reads, the fields the mod's config type declares, and the fields",
        "the form exposes.",
        "",
        "- **missing from UI** — the engine reads it and the form cannot set it",
        "- **not read by engine** — the form offers it and the engine ignores it",
        "- **missing from config** — the engine reads it and the config type has no",
        "  such field, so it can never be set",
        "",
        "| register call | config | tabs | engine | config | ui | missing from UI |",
        "|---|---|---|---|---|---|---|",
    ];
    for (const r of rows) {
        const g = r.gaps;
        out.push(
            `| \`${r.method}\` | \`${r.modType}\` | ${
                r.tabs.join(", ") || "—"
            } | ${g.engineReads} | ${g.configHas} | ${g.uiHas} | ${
                g.missingFromUi.length ? g.missingFromUi.map((f) => `\`${f}\``).join(", ") : "—"
            } |`,
        );
    }
    out.push("");
    const notes = rows.filter((r) =>
        r.gaps.missingFromConfig.length || r.gaps.notReadByEngine.length
    );
    if (notes.length) {
        out.push("## Detail", "");
        for (const r of notes) {
            out.push(`### \`${r.method}\``, "");
            if (r.gaps.missingFromConfig.length) {
                out.push(
                    "Engine reads, config type cannot hold: " +
                        r.gaps.missingFromConfig.map((f) => `\`${f}\``).join(", "),
                    "",
                );
            }
            if (r.gaps.notReadByEngine.length) {
                out.push(
                    "Form exposes, engine ignores: " +
                        r.gaps.notReadByEngine.map((f) => `\`${f}\``).join(", "),
                    "",
                );
            }
        }
    }
    return out.join("\n");
}

if (import.meta.main) {
    const rows = await run();
    const totalMissing = rows.reduce(
        (a, r) => a + r.gaps.missingFromUi.length,
        0,
    );
    const totalUnused = rows.reduce(
        (a, r) => a + r.gaps.notReadByEngine.length,
        0,
    );
    await Deno.writeTextFile(
        `${OUT}ui-completeness.json`,
        JSON.stringify(rows, null, 2) + "\n",
    );
    await Deno.writeTextFile(`${OUT}UI-COMPLETENESS.md`, render(rows));
    console.log(`register calls compared : ${rows.length}`);
    console.log(`engine fields           : ${rows.reduce((a, r) => a + r.gaps.engineReads, 0)}`);
    console.log(`ui fields exposed       : ${rows.reduce((a, r) => a + r.gaps.uiHas, 0)}`);
    console.log(`missing from UI         : ${totalMissing}`);
    console.log(`exposed but never read  : ${totalUnused}`);
    for (const r of rows) {
        if (r.gaps.missingFromUi.length) {
            console.log(
                `  ${r.method}: ${r.gaps.missingFromUi.join(", ")}`,
            );
        }
    }
    console.log(`-> ${OUT}UI-COMPLETENESS.md`);
}

/**
 * Config keys a form tab can produce through a *structured* control.
 *
 * Comparing form field keys to engine field names directly is meaningless,
 * because the two are deliberately different: the form says `shapeJson` where
 * the engine says `shape`, `costsJson` where the engine says `costs`, and
 * `idSuffix` where the engine says `id`. The translation is `formToEntry`, so
 * that is what gets read — the keys it assigns are exactly the ones a real
 * control can produce.
 *
 * `advancedJson` is excluded: it is an escape hatch, and counting it would make
 * every field look reachable.
 */
export function structuredKeys(schemaSrc: string): Map<string, Set<string>> {
    const start = schemaSrc.indexOf("export function formToEntry");
    if (start === -1) return new Map();
    const end = schemaSrc.indexOf("\n}", start);
    const body = schemaSrc.slice(start, end === -1 ? undefined : end);

    const out = new Map<string, Set<string>>();
    for (const m of body.matchAll(/case\s+"(\w+)":\s*\{/g)) {
        const tab = m[1];
        // find where this case block closes
        let depth = 1;
        let i = m.index! + m[0].length;
        for (; i < body.length && depth > 0; i++) {
            if (body[i] === "{") depth++;
            else if (body[i] === "}") depth--;
        }
        const block = body.slice(m.index! + m[0].length, i);
        const keys = out.get(tab) ?? new Set<string>();

        for (const k of block.matchAll(/set(?:Str|Num|Bool|Raw)\(\s*"(\w+)"/g)) {
            keys.add(k[1]);
        }
        for (const k of block.matchAll(/entry\.(\w+)\s*=/g)) keys.add(k[1]);
        // `for (const k of ["a", "b"]) setBool(k, …)` — literal key arrays
        for (const k of block.matchAll(/\[\s*"(\w+)"\s*(?:,\s*"\w+"\s*)+\]/g)) {
            for (const name of k[0].matchAll(/"(\w+)"/g)) keys.add(name[1]);
        }
        // nested object literals: `entry.upgrade = { id, nameKey, … }`
        for (const k of block.matchAll(/entry\.(\w+)\s*=\s*\{([^{}]*)\}/g)) {
            for (const inner of k[2].matchAll(/(\w+)\s*[:=]/g)) {
                keys.add(`${k[1]}.${inner[1]}`);
            }
        }
        // …and the same shape written through a definition's writer:
        // `w.setRaw("render", { imageName: image })`. Without this a key a
        // per-object definition writes would vanish from the report — the same
        // key, reached through a different call, read as a different answer.
        for (const k of block.matchAll(/setRaw\(\s*"(\w+)"\s*,\s*\{([^{}]*)\}/g)) {
            for (const inner of k[2].matchAll(/(\w+)\s*[:=]/g)) {
                keys.add(`${k[1]}.${inner[1]}`);
            }
        }
        // the advancedJson escape hatch is deliberately not counted
        keys.delete("advancedJson");
        out.set(tab, keys);
    }
    // `entry.id` is assigned in the shared preamble, before the switch, so it
    // belongs to every tab. It comes from `fullIdOf(form, cat)`.
    if (/\bentry\.id\s*=/.test(body)) {
        for (const keys of out.values()) keys.add("id");
    }
    return out;
}
