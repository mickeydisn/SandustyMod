/**
 * gen-reference.ts — Phase 7: the user-facing reference, generated.
 *
 * The README was hand-written once and has since drifted: it still claims
 * "sandkit v0.5.7", and it cannot express the two facts Phases 5 and 6
 * established — that a form field and an engine field are *different names*, and
 * that 11 engine-read fields are missing from the shipped typings.
 *
 * So the reference is generated from the same four artefacts the audit built,
 * which means it cannot drift from them:
 *
 *   schema.ts        the live form: labels, kinds, constraints, hints
 *   definitions.json what each register body actually reads, and what it throws
 *   parameter-map    every declared parameter, with its type and meaning
 *   object-graph     which ids may reference which
 *
 * Each row is the whole chain in one line: **UI field → stored key → engine
 * field**. That link is the thing a user actually needs, and it is the thing
 * that was previously missing everywhere.
 *
 * Usage: deno run -A tools/gen-reference.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const OUT = `${ROOT}doc-bundel/`;
const DOC = `${ROOT}doc/`;

export interface Row {
    /** The form control's key, e.g. `shapeJson`. */
    uiKey: string;
    label: string;
    kind: string;
    section: string;
    required: boolean;
    /** The stored config key this control produces, e.g. `shape`. */
    configKey: string;
    /** Whether the engine's register body reads that key. */
    engineReads: boolean;
    hint: string;
    /** Constraint summary: min/max/pattern/length. */
    rule: string;
}

// ------------------------------------------------------------------- reading

/** A short, human summary of a field's constraints. */
function ruleOf(f: Record<string, unknown>): string {
    const bits: string[] = [];
    if (f.min !== undefined) bits.push(`min ${f.min}`);
    if (f.max !== undefined) bits.push(`max ${f.max}`);
    if (f.int) bits.push("whole");
    if (f.pattern) bits.push(`pattern \`${f.pattern}\``);
    if (f.maxLength) bits.push(`≤ ${f.maxLength} chars`);
    if (f.jsonType) bits.push(`${f.jsonType} JSON`);
    return bits.join(", ");
}

/**
 * UI fields that are folded into a config value by hand-written code rather
 * than assigned one-to-one.
 *
 * These are the only entries in the mapping that are not read out of
 * `formToEntry`. Each one assembles a nested structure — an array of mode
 * objects, an array of variants, a `sprite: { id }` pair — so no static pass
 * over the source can name the destination. Everything else is derived.
 */
export const COMPOSITE: Record<string, [string, string][]> = {
    structures: [
        // The whole list is one control now. It used to be `buildModes[0].type`
        // plus a `spanTiles` box, which is what silently dropped modes 2..n.
        ["buildModesJson", "buildModes[]"],
        ["dirH", "buildModes[].directions"],
        ["dirV", "buildModes[].directions"],
        ["dirD", "buildModes[].directions"],
        ["shapeJson", "shape"],
        ["descriptionParamsJson", "descriptionParams"],
        ["tooltipHoverJson", "tooltipHover"],
        ["variantsJson", "variants"],
        // A key, not the function: `apply.ts` swaps it for the real draw fn.
        ["drawKey", "draw"],
        ["defaultDataJson", "defaultData"],
    ],
    elements: [
        ["durationRandomMin", "durationRandom.min"],
        ["durationRandomMax", "durationRandom.max"],
        ["colorsJson", "colors.variants"],
        ["metaColor", "metaColor"],
    ],
    upgrades: [
        ["upgradeId", "upgrade.id"],
        ["upgradeNameKey", "upgrade.nameKey"],
        ["maxLevel", "upgrade.maxLevel"],
        ["costsJson", "upgrade.costs"],
        ["oneOff", "upgrade.oneOff"],
    ],
    interactions: [
        // The descriptor is assembled from the `kind` plus that kind's fields.
        ["interactionKind", "interaction.kind"],
        ["structures", "interaction.structures"],
        ["destroyerItems", "interaction.items"],
        ["entities", "interaction.entities"],
        ["tipTextKey", "interaction.textKey"],
        ["tipVisibility", "interaction.visibleWhen | interaction.crossedOutWhen"],
        ["tipDataField", "interaction.*.dataField"],
        ["tipDataFieldEquals", "interaction.*.equals"],
        ["tipOnlyWhenTranslated", "interaction.onlyWhenTranslated"],
        // Kept verbatim, and only rendered when the stored object holds a field
        // the split form has no control for.
        ["interactionJson", "interaction (unmodelled fields, verbatim)"],
    ],
    terrains: [
        ["outputElement", "output.elementType"],
        ["outputChance", "output.chance"],
        ["colorHSLHue", "colorHSL[0]"],
        ["colorHSLSaturation", "colorHSL[1]"],
        ["colorHSLLightness", "colorHSL[2]"],
        ["interactionsJson", "interactions"],
        ["excavationRequirements", "excavationRequirements"],
        ["metaColor", "metaColor"],
    ],
    items: [
        ["cooldownMs", "cooldown"],
        ["spriteId", "sprite.id"],
        ["spriteType", "sprite.type"],
    ],
    recipes: [
        ["machine", "kind"],
        ["input", "input"],
        ["outputElement", "output"],
        ["outputChance", "chance"],
        ["minVelocity", "minimumDownwardVelocity"],
        ["outputs", "outputs"],
        ["outputsAbove", "outputsAbove"],
        ["outputsBelow", "outputsBelow"],
    ],
    contacts: [
        ["outputA", "outputA"],
        ["outputB", "outputB"],
    ],
    techs: [
        ["requires", "requires"],
        ["unlockStructures", "unlocks.structures"],
        ["unlockItems", "unlocks.items"],
    ],
    // `interactions` is assembled from the `kind` plus that kind's fields, so
    // the old single `interactionJson → interaction` row no longer applies.
    projectiles: [
        ["spriteId", "sprite.id"],
        ["optionsJson", "options"],
    ],
    excavation: [
        ["patternJson", "pattern"],
        ["terrainRulesJson", "terrainRules"],
        ["optionsJson", "options"],
    ],
    energy: [
        ["capacity", "options.capacity"],
        ["energyType", "options.energyType"],
        ["priority", "options.priority"],
    ],
    triggers: [["extraJson", "extra"]],
    behaviors: [["definitionJson", "definition"]],
    // `requirement` is stored verbatim and never read, so it is filed as a
    // pass-through rather than a working constraint.
    categories: [
        ["requirementTechId", "requirement (string)"],
        ["requirementJson", "requirement (anything else, verbatim)"],
    ],
    inputs: [
        ["subsectionJson", "subsection"],
        ["defaultKeys", "defaultKeys"],
    ],
    processing: [],
    modifiers: [["hookId", "hookId"]],
};

/**
 * Form fields that deliberately store nothing.
 *
 * `advancedJson` is the raw escape hatch, a `*On` toggle only gates its own
 * siblings, and a `*Custom` field is a fallback for a picker. Listing them keeps
 * the reference honest: every other field resolves to a config key.
 */
export const INDIRECT: RegExp = /^(advancedJson|.*On$|.*Custom$)$/;

/** Split a code block into `;`-terminated statements, ignoring nested ones. */
export function statementsOf(block: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of block) {
        if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth--;
        if (ch === ";" && depth === 0) {
            out.push(cur);
            cur = "";
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
}

/**
 * Which stored key a form control produces.
 *
 * The mapping is not name-based on purpose: `formToEntry` is what decides, and
 * `structuredKeys` already reads it. Here the same source is re-read per field
 * so a row can name the exact config key, which is the part a user needs and
 * the part that is invisible in the UI.
 */
export async function readMapping(): Promise<Map<string, Map<string, string>>> {
    const src = Deno.readTextFileSync(`${ROOT}src/ui/schema.ts`);
    const start = src.indexOf("export function formToEntry");
    const end = src.indexOf("\n}", start);
    const body = src.slice(start, end === -1 ? undefined : end);
    const out = new Map<string, Map<string, string>>();

    for (const m of body.matchAll(/case\s+"(\w+)":\s*\{/g)) {
        const tab = m[1];
        let depth = 1;
        let i = m.index! + m[0].length;
        for (; i < body.length && depth > 0; i++) {
            if (body[i] === "{") depth++;
            else if (body[i] === "}") depth--;
        }
        const block = body.slice(m.index! + m[0].length, i);
        const map = out.get(tab) ?? new Map<string, string>();

        // `setStr("name", opt(form, "name"))` — same key on both sides
        for (
            const k of block.matchAll(
                /set(?:Str|Num|Bool)\(\s*"(\w+)"\s*,\s*opt\w*\(\s*form\s*,\s*"(\w+)"/g,
            )
        ) {
            map.set(k[2], k[1]);
        }
        // `const c = optJson<T>(form, "kJson"); … if (c) entry.k = c;`
        //
        // Split into statements first: trying to match the generic inline breaks
        // on a nested one — `optJson<Record<string, unknown>>` closes with `>>`,
        // so a `[^>]*` pattern stops in the middle of the type. The read and the
        // write are then usually in *different* statements, joined here through
        // the local variable name.
        const stmts = statementsOf(block);
        const localOf: Record<string, string> = {}; // local name -> ui key
        for (const stmt of stmts) {
            // the argument list is written across lines, so it ends with a
            // trailing comma before the closing paren
            const read = stmt.match(
                /opt\w*[\s\S]*?\(\s*form\s*,\s*"(\w+)"\s*,?\s*\)/,
            );
            if (!read) continue;
            const decl = stmt.match(/(?:const|let|var)\s+(\w+)\s*=/);
            if (decl) localOf[decl[1]] = read[1];
        }
        for (const stmt of stmts) {
            const write = stmt.match(/entry\.(\w+)\s*=\s*([\s\S]*?);/);
            if (!write) continue;
            // the right side may be the local, or a call over it
            // (`entry.metaColor = hexToPacked(hex)`), so look for any local
            const name = Object.keys(localOf).find((l) => new RegExp(`\\b${l}\\b`).test(write[2]));
            if (name) map.set(localOf[name], write[1]);
        }
        // `for (const k of ["a","b"]) setBool(k, optBool(form, k))` — a loop
        // over literal keys, where the ui key and the config key are the same
        for (
            const loop of block.matchAll(
                /for \(\s*const\s+(\w+)\s+of\s+\[([^\]]*)\][\s\S]{0,120}?set(?:Str|Num|Bool)\(\s*\1\s*,\s*opt\w*\(\s*form\s*,\s*\1\s*\)/g,
            )
        ) {
            for (const name of loop[2].matchAll(/"(\w+)"/g)) {
                map.set(name[1], name[1]);
            }
        }
        // `entry.upgrade = { id: …, maxLevel: … }` — a nested object literal
        for (const k of block.matchAll(/entry\.(\w+)\s*=\s*\{([^{}]*)\}/g)) {
            for (const inner of k[2].matchAll(/(\w+)\s*[:=]/g)) {
                map.set(inner[1], `${k[1]}.${inner[1]}`);
            }
        }
        // composite constructions, which no amount of static reading resolves
        for (const [ui, config] of COMPOSITE[tab] ?? []) map.set(ui, config);
        out.set(tab, map);
    }
    // `entry.id` is assigned in the shared preamble of every tab, and its
    // value comes from `fullIdOf(form, cat)` — i.e. the idSuffix control
    for (const map of out.values()) {
        if (!map.has("idSuffix")) map.set("idSuffix", "id");
    }
    return out;
}

// ------------------------------------------------------------------ collecting

export interface TabDoc {
    tab: string;
    label: string;
    blurb: string;
    configKey: string;
    /** The api call(s) this tab's config is fed to. */
    calls: string[];
    rows: Row[];
}

export async function collect(): Promise<TabDoc[]> {
    const { stubSandkit } = await import("./ui-completeness.ts");
    stubSandkit();
    const schema = await import(`${ROOT}src/ui/schema.ts`);
    const { CONFIG_TO_TAB } = await import("./ui-completeness.ts");
    const { METHOD_TO_MOD } = await import("./extract-definitions.ts");
    const mapping = await readMapping();
    const engine = JSON.parse(Deno.readTextFileSync(`${OUT}definitions.json`));

    // engine fields read, grouped by the call that reads them
    const readsByCall = new Map<string, Set<string>>();
    for (const m of engine.methods) {
        if (!readsByCall.has(m.method)) readsByCall.set(m.method, new Set());
        for (const r of m.reads) readsByCall.get(m.method)!.add(r.field);
    }
    // the engine call each mod config type reaches
    const callForType = new Map<string, string[]>();
    for (const [method, type] of Object.entries(METHOD_TO_MOD)) {
        if (!type) continue;
        callForType.set(type, [...(callForType.get(type) ?? []), method]);
    }

    const docs: TabDoc[] = [];
    for (const [tab, meta] of Object.entries<any>(schema.CATEGORY_META)) {
        if (!meta.configKey) continue;
        const map = mapping.get(tab) ?? new Map<string, string>();
        const types = Object.entries(CONFIG_TO_TAB)
            .filter(([, tabs]) => tabs.includes(tab))
            .map(([type]) => type);
        const calls = [...new Set(types.flatMap((t) => callForType.get(t) ?? []))];
        // A config type can be fed to more than one api call. Keep only the
        // calls that actually read something this tab produces, so a secondary
        // registration (e.g. structures.registerPlacementConfig, which shares
        // StructureConfig but reads none of its form keys) cannot make a field
        // look engine-read when the real register call ignores it.
        const produced = new Set<string>();
        for (const v of map.values()) {
            if (!v || v === "—") continue;
            produced.add(v); // `upgrade.maxLevel`
            produced.add(v.split(/[.[]/)[0]); // `upgrade`
        }
        const relevant = calls.filter((c) =>
            [...(readsByCall.get(c) ?? [])].some((f) => produced.has(f))
        );
        const used = relevant.length ? relevant : calls;
        const read = new Set(used.flatMap((c) => [...(readsByCall.get(c) ?? [])]));

        const rows: Row[] = schema.fieldsFor(tab).map((f: any) => {
            const configKey = map.get(f.key) ?? "—";
            return {
                uiKey: f.key,
                label: f.label ?? f.key,
                kind: f.kind ?? "text",
                section: f.section ?? "—",
                required: Boolean(f.required),
                configKey,
                engineReads: configKey !== "—" && read.has(configKey),
                hint: f.hint ?? "",
                rule: ruleOf(f),
            };
        });
        docs.push({
            tab,
            label: meta.label,
            blurb: meta.blurb ?? "",
            configKey: meta.configKey,
            calls: used,
            rows,
        });
    }
    return docs;
}

// ------------------------------------------------------------------ rendering

const esc = (s: string) => s.replace(/\|/g, "\\|");

export function render(docs: TabDoc[]): string {
    const total = docs.reduce((a, d) => a + d.rows.length, 0);
    const out: string[] = [
        "# md-my-hown-mod — field reference",
        "",
        "Generated by `tools/gen-reference.ts`. Do not edit by hand — run",
        "`deno run -A tools/gen-reference.ts`.",
        "",
        "Every form control, the config key it stores, and whether the engine's",
        "registration code reads that key. The three names differ on purpose:",
        "the form says `shapeJson` where the engine says `shape`, and `idSuffix`",
        "where the engine says `id`.",
        "",
        "**not read** in the last column means the value is stored and passed to",
        "the engine, but the `register` body does not touch it. That is not",
        "necessarily wrong — the engine also stores fields the simulation reads",
        "later — but it is never *required*.",
        "",
        "A `—` in the **stores** column means the control stores nothing of its",
        "own: `advancedJson` is the raw escape hatch, a `*On` toggle only gates its",
        "siblings, and a `*Custom` field is the fallback for a picker.",
        "",
        `**${docs.length} tabs, ${total} fields.**`,
        "",
        "| tab | stored under | api call | fields |",
        "|---|---|---|---|",
    ];
    for (const d of docs) {
        out.push(
            `| [${esc(d.label)}](#${d.tab}) | \`${d.configKey}\` | ${
                d.calls.length ? d.calls.map((c) => `\`${c}\``).join(", ") : "—"
            } | ${d.rows.length} |`,
        );
    }

    for (const d of docs) {
        out.push("", `## ${esc(d.label)}`, "", `<a id="${d.tab}"></a>`, "");
        if (d.blurb) out.push(d.blurb, "");
        out.push(
            `Stored under \`${d.configKey}\`${
                d.calls.length
                    ? `, applied through \`${d.calls.map((c) => `\`${c}\``).join("`, `")}\``
                    : ""
            }.`,
            "",
        );
        out.push(
            "| field | label | stores | engine | rules | notes |",
            "|---|---|---|---|---|---|",
        );
        for (const r of d.rows) {
            out.push(
                `| \`${r.uiKey}\` | ${esc(r.label)} | \`${r.configKey}\` | ${
                    r.engineReads ? "read" : "not read"
                } | ${esc(r.rule) || "—"} | ${esc(r.hint) || "—"} |`,
            );
        }
    }
    return out.join("\n") + "\n";
}

// ---------------------------------------------------------------- known issues

export function renderIssues(): string {
    const params = JSON.parse(Deno.readTextFileSync(`${OUT}parameter-map.json`));
    const defs = JSON.parse(Deno.readTextFileSync(`${OUT}definitions.json`));

    const out: string[] = [
        "# Known engine behaviours",
        "",
        "Generated by `tools/gen-reference.ts`. Do not edit by hand.",
        "",
        "Everything here was read out of the shipped bundle or the shipped",
        "typings — not inferred. Each entry is a place where the obvious",
        "assumption is wrong, so it is worth writing down.",
        "",
        "## The typings omit fields the engine reads",
        "",
        "The engine's registration code reads these, and the `.d.ts` interface does",
        "not declare them. The mod exposes every one, so this is a gap **upstream**",
        "rather than in the mod.",
        "",
    ];
    const undeclared = params.flatMap((p: any) =>
        p.undeclared.map((f: string) => ({ def: p.definition, field: f }))
    );
    out.push("| definition | field |", "|---|---|");
    for (const u of undeclared) {
        out.push(`| \`${u.def}\` | \`${u.field}\` |`);
    }

    out.push("", "## Conditions that throw", "", "Read from the bundle:", "");
    for (const m of defs.methods) {
        const derefs = m.reads.filter((r: any) => r.derefs > 0);
        if (!derefs.length) continue;
        out.push(
            `**\`${m.method}\`** (bundle line ${m.line}) dereferences: ` +
                derefs.map((r: any) => `\`${r.field}\``).join(", "),
            "",
        );
    }

    out.push(
        "",
        "## Behaviours worth knowing",
        "",
        "- **`copyData: false` is rewritten.** The engine sets `skipCopyData = true`",
        "  itself, so the two spellings are the same switch. The mod offers only",
        "  `skipCopyData`.",
        "- **`defaultData` is deep-cloned**, then assigned to `instance.data` on",
        "  placement. It is the per-placed-copy data object and has nothing to do",
        "  with elements, which the old field label implied. The hover tooltip",
        "  reads it back through `dataField1..4`.",
        "- **A `draw` value stores the definition twice** — once with `draw`, once",
        "  with `draw: undefined` — so the engine has a draw-free copy to compare",
        "  against. And `draw` is a **function**, not data: `T(id, def.draw)`, then",
        "  `fn(session, instance, {tilemap, ctx, useTilemap, placing, opts})` where",
        "  returning `false` falls through to the normal sprite render. A string",
        "  there does not throw — it just stops drawing — so the config stores a",
        "  `drawKey` and `apply.ts` resolves it.",
        "- **`blockGridType` registers an alias.** When it differs from the id the",
        "  structure is registered under both, sharing one grid. It is also not",
        "  optional above 8x8: setting it to the structure's **own** id gives a",
        "  large structure its own grid. See the mod-confirmed section below.",
        "- **`buildModes` is a list, not a single mode.** `Array.isArray(e) &&",
        "  e.forEach(rt)`, and a structure may have several. The form used to hold",
        "  exactly one, so a second mode was dropped on save without a word.",
        '- **`buildModes[].spanTiles` throws** unless the mode `type` is `"line"`.',
        "  The form enforces this per row and strips the field otherwise.",
        "- **`linkedClearance` has exactly two states.** The field is minified to",
        "  `structureConfig.n` and the only comparison in the whole bundle is",
        '  `=== "allOrNothing"`. Anything else — a typo included — skips the',
        "  all-or-nothing check, so as a text box it was a switch that silently",
        "  ignored mistakes.",
        "- **An upgrade category needs `name` or `nameKey`.** The engine throws on",
        "  neither. The form enforces this as a cross-field rule, because",
        "  `required` on a single field would wrongly reject a name-key-only",
        "  category.",
        "- **An upgrade category's `requirement` is never read.** It is stored",
        "  verbatim as `mods.upgradeCategories[id].requirement` and a grep of the",
        "  whole repo finds no reader. It is a pass-through with no behaviour",
        "  attached, and no shipped mod sets it.",
        "- **`terrains.materialId` must be 101–149.** `obstacleBreakpoint` is a",
        "  real constant and equals **100** (`utils-worker.js/90823.js`), so the",
        "  range is exact. Every value in it is an obstacle, so there are no named",
        "  tiers to offer; the form leads with the engine's own next-free id.",
        "- **`KeyCode` and `BindingId` are `LooseString`, not closed enums.** A chord",
        '  such as `"Control+KeyC"` is valid, so a fixed picker would be wrong. A',
        "  `BindingId` may also reuse a vanilla `KeyBinding` name, which would",
        "  *replace* a built-in binding — the mod uses custom ids.",
        "",
        "## The enum is not the id",
        "",
        "The hardest thing to get right in the reference pickers, and the source",
        "of a long-standing bug: an enum member maps a **display name** to a",
        "**number**, and the config layer wants an **id** — a third thing, handed",
        "out only by `getIdByType` / `getDefinitionByType`.",
        "",
        "- **Element and terrain refs hold ids.** `resolveElementRef` uses",
        "  `getTypeById`, and `resolveTerrainRef` uses `terrains.getTypeById`, so",
        "  the stored value is an id string.",
        "- **Structure refs hold enum member names.** `resolveStructureType` does",
        "  `enums[v]` — it looks a member *name* up to get the number. So the",
        "  same enum is the right source for structures and the wrong source for",
        "  elements and terrains.",
        "- **`listElements` used to store the enum's display name as the id**, and",
        "  fell back to `String(type)` — a bare number, which is not a valid id —",
        "  for any element whose definition it could not read. Its \"already have",
        "  it?\" guard compared the enum's *number* against a map keyed by *id*, so",
        "  it never fired and every element got a second, lowercased duplicate.",
        "- **`hidden` elements are filtered out of the pickers.** The game keeps",
        "  internal types (resolved pointers, intermediate states) that are not",
        "  things a recipe should name. The Help screen's orphan check asks for",
        "  them with `includeHidden`, so a deliberate reference to one still",
        "  resolves instead of being reported as broken.",
        "- **Items have no enumeration API and no `getIdByType`**, so the",
        "  string-valued members of the `ItemId` enum are the only source of the",
        "  game's item ids. A number-valued member is skipped rather than offered.",
        "",
        "## Confirmed against shipped mods",
        "",
        "Cross-checked against real mods in `__scraped-mods/workshop/`, which is",
        "stronger evidence than the typings or the bundle alone.",
        "",
        "- **`blockGridType` is not optional above 8x8.** `3791498201` documents the",
        "  failure: a 20x20 Resource Silo that omitted it placed as a single 1-cell",
        "  unit with a hover tooltip that only resolved at the origin cell. \"Every",
        "  reference mod that omitted blockGridType only ever used shapes up to",
        "  8x8.\"",
        "- **`colors` is `{ variants: [[r,g,b,a], …] }`, not a bare array.** Every",
        "  mod that sets it uses the wrapper (`3790149867`, `3792673946`) and ships",
        "  four or five variants, because a variant is a random per-cell tint and",
        "  one flat colour looks synthetic. A 3-tuple is tolerated as opaque.",
        "- **`interactions[].structures` holds numeric `StructureRef`s, not ids.**",
        "  `3790149867` writes `{ kind: \"structure\", structures: [16] }`. Enum",
        "  numbers are not stable across builds, so a config-driven form cannot",
        "  offer this as an id picker without resolving them at register time.",
        "- **A custom `draw` must normalise the canvas it inherits.** Tool and",
        "  weapon effects leave `globalAlpha`, `filter` and shadow state active, and",
        "  a draw callback that inherits them renders the structure solid black and",
        "  keeps repainting that way, with no error. `3791498201` calls this out",
        "  explicitly. The camera transform must *not* be reset — the engine still",
        "  needs it.",
        "",
        "## Documented but not implemented here",
        "",
        "- `structures.registerPlacementConfig` is a real call with its own",
        "  definition (`structureId` + `fields`). The mod does not wrap it; it sits",
        "  outside the 36-member config surface.",
        "",
    );
    return out.join("\n");
}

// ------------------------------------------------------------ generated .d.ts

/**
 * A type this file can write down without inventing anything: primitives, and
 * the structural shapes the sdk spells out inline. Anything naming a type
 * declared elsewhere falls back to `unknown`.
 */
function resolvable(type: string): string {
    const t = (type ?? "").replace(/\s*\|\s*undefined$/, "").trim();
    if (/^(string|number|boolean|unknown|any)$/.test(t)) return t;
    if (/^0x[0-9a-f]+$/i.test(t)) return "number";
    if (/^\[.*\]$/.test(t)) return t;
    if (/^(readonly\s+)?string(\[\])?$/.test(t)) return t;
    if (/^(readonly\s+)?number(\[\])?$/.test(t)) return t;
    if (/^Record<[^>]*>$/.test(t)) return t;
    if (/^\{.*\}$/.test(t)) {
        // an inline object literal is kept only when every member type is one
        // this file can name; `{ elementType: elements.ElementType }` is not
        if (/\w+\.[A-Z]/.test(t)) return "unknown";
        return t;
    }
    return "unknown";
}

/**
 * Emit a `.d.ts` for the api surface the mod uses, derived from the Phase 0
 * index rather than typed by hand.
 *
 * Register calls are typed precisely, from the definition interfaces the sdk
 * ships — that is the part worth having in an editor. Everything else is listed
 * with its real arity and whether it throws, and typed `unknown` on purpose: the
 * bundle index records the *call*, not a signature, and inventing parameter
 * types here would be exactly the fabrication this audit spent seven phases
 * removing.
 */
export function renderDts(): string {
    const index = JSON.parse(Deno.readTextFileSync(`${OUT}api-index.json`));
    // The register calls are the methods `definitions.json` found field reads
    // in — that is the same 36-member set the capability map calls
    // "config-reachable", and every one of them resolves against the index.
    const defs = JSON.parse(Deno.readTextFileSync(`${OUT}definitions.json`));
    const registerable = new Set<string>(
        defs.methods.map((m: any) => m.method as string),
    );
    const params = JSON.parse(Deno.readTextFileSync(`${OUT}parameter-map.json`));
    const byCall = new Map<string, { name: string; type: string }[]>();
    for (const p of params) byCall.set(p.call, p.params);

    const out: string[] = [
        "/**",
        " * GENERATED by `tools/gen-reference.ts` — do not edit.",
        " *",
        " * The api surface this mod uses, derived from the Phase 0 bundle index.",
        " * Register calls are typed from the definition interfaces the sdk ships;",
        " * everything else is listed with its arity and throw behaviour, and typed",
        " * `unknown`, because the bundle records the call and not a signature.",
        " *",
        " * Re-run `deno run -A tools/gen-reference.ts` after changing the mod.",
        " */",
        "",
    ];
    let count = 0;
    for (const [ns, members] of Object.entries<any>(index.index)) {
        const lines: string[] = [];
        const seen = new Set<string>();
        for (const m of members as any[]) {
            if (m.kind === "re-export" && !registerable.has(m.path)) continue;
            // the index can list a namespace member twice (a real definition and
            // a re-export of it); a `.d.ts` cannot declare the same name twice
            if (seen.has(m.name)) continue;
            seen.add(m.name);
            const isReg = registerable.has(m.path);
            const types = isReg ? byCall.get(m.path) : undefined;
            const arity = m.arity ?? 0;
            // `parameter-map` flattens nested objects to `parent.child`. Those
            // are not valid identifiers in a type literal, so the signature
            // names only the top level; the doc comment keeps the full tree.
            const topLevel = types && types.length
                ? types.filter((t) => !t.name.includes("."))
                : undefined;
            // The doc keeps the real type; the signature falls back to `unknown`
            // for anything this file does not itself declare (`Projectile`,
            // `StructureId`, `elements.ElementType`, …). Keeping the real name
            // in a signature would make the file uncompilable on its own, and
            // stubbing those types would be inventing them.
            const sig = topLevel && topLevel.length
                ? `definition: { ${
                    topLevel.map((t) => `${t.name}: ${resolvable(t.type)}`)
                        .join("; ")
                } }`
                : Array.from({ length: arity }, (_, i) => `a${i}: unknown`)
                    .join(", ");
            // For non-register members the bundle only records the *call*, and its
            // parameter names are the minified ones (`e, t, n`). Printing those
            // would read like real parameter names, so the arity and the context
            // flag are reported instead.
            const doc = types && types.length
                ? types.map((t) => `\`${t.name}\`: ${t.type}`).join("; ")
                : `arity ${arity}${
                    m.takesContext ? "; takes the engine context" : ""
                }${m.throws ? "; throws" : ""}`;
            lines.push(
                `    /** ${doc} */`,
                `    export function ${m.name}(${sig}): unknown;`,
            );
            count++;
        }
        if (lines.length) {
            out.push(
                `export namespace ${ns.replace(/\./g, "_")} {`,
                ...lines,
                "}",
                "",
            );
        }
    }
    out.push(`// ${count} members`);
    return out.join("\n") + "\n";
}

if (import.meta.main) {
    const docs = await collect();
    // A `—` is only expected for the fields listed in INDIRECT. Anything else
    // is a mapping the generator could not read, and is reported rather than
    // silently rendered as a dash.
    const unmapped = docs.flatMap((d) =>
        d.rows.filter((r) => r.configKey === "—" && !INDIRECT.test(r.uiKey))
            .map((r) => `${d.tab}.${r.uiKey}`)
    );
    try {
        Deno.mkdirSync(DOC, { recursive: true });
        Deno.mkdirSync(`${ROOT}src/types`, { recursive: true });
        await Deno.writeTextFile(`${DOC}REFERENCE.md`, render(docs));
        await Deno.writeTextFile(`${DOC}KNOWN-ISSUES.md`, renderIssues());
        await Deno.writeTextFile(
            `${ROOT}src/types/engine-api.generated.d.ts`,
            renderDts(),
        );
        console.log(
            `tabs ${docs.length}, fields ${docs.reduce((a, d) => a + d.rows.length, 0)}`,
        );
        console.log(`-> ${DOC}REFERENCE.md`);
        console.log(`-> ${DOC}KNOWN-ISSUES.md`);
        console.log("-> src/types/engine-api.generated.d.ts");
    } catch (e) {
        console.error(`could not write ${DOC}:`, String(e));
        console.log(render(docs));
    }
    if (unmapped.length) {
        console.log(`\nunmapped fields (${unmapped.length}):`);
        for (const u of unmapped) console.log(`  ${u}`);
    }
}
