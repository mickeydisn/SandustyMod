/**
 * extract-definitions.ts — Phase 3: what each register call actually reads.
 *
 * The typings are a description; this is the implementation. For every
 * `register*` / `updateDefinition` method in the engine api, this walks the real
 * body in the bundle and reports the top-level properties it reads, together
 * with whether each read is guarded.
 *
 * A guarded read — `t.colors && …`, `null != t.metaColor && …`, `t.x?.y` — means
 * the field is optional. An unguarded read means the body assumes it, so
 * omitting it is at best undefined behaviour and at worst a throw.
 *
 * This is what settles the question the typings cannot: they list what a shape
 * *may* contain, not what the engine *inspects*.
 *
 * Usage: deno run -A tools/extract-definitions.ts
 */

import { type ApiIndex, splitParams } from "./extract-api.ts";
import { type ApiType, buildIndex, parseDts, type PublicIndex } from "./extract-public-api.ts";

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const REPO = HERE.replace(/\/$/, "").split("/").slice(0, -3).join("/") + "/";
const BUNDLE = `${REPO}__bundel/modules/bundel.js/46781.js`;
const INDEX = `${ROOT}doc-bundel/api-index.json`;
const OUT_DIR = `${ROOT}doc-bundel/`;

const DOLLAR = "$";

/**
 * Index of the argument that carries the definition object.
 *
 * The bundle's parameter names are mangled, so the position is guessed from the
 * shape. `register(ctx, def, options)` puts the definition second, but
 * `processing.register(ctx, id, def)` puts it third, and guessing wrong means
 * reading properties off the *id* instead of the definition.
 */
export function definitionArg(
    name: string,
    params: string[],
    /** names from the public typings, in the same order without the context */
    publicNames?: string[],
): number | null {
    if (params.length < 2) return null;
    if (publicNames?.length) {
        const at = publicNames.findIndex((n) =>
            /^(def|definition|conf|config|options?)$/i.test(n) ||
            /definition/i.test(n)
        );
        if (at !== -1 && at + 1 < params.length) return at + 1;
    }
    // `register(ctx, def, …)` — the definition is the second argument
    if (/^register/.test(name)) return 1;
    // `updateDefinition(ctx, id, partial, …)` — the partial is the last one
    if (name === "updateDefinition") return params.length - 1;
    return null;
}

/** Index just past the bracket matching the one at `open`. */
function matchBracket(src: string, open: number): number {
    const close = { "(": ")", "[": "]", "{": "}" }[src[open]];
    if (!close) return -1;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === src[open]) depth++;
        else if (src[i] === close) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * The source of a method body, starting from its recorded line.
 *
 * A body is either a block — `=> { … }` — or a parenthesised expression, as in
 * the delegation style this bundle uses everywhere:
 *
 *     registerNode: (e, t, n) => (0, xe.registerTechNode)(e, t, n)
 *
 * Searching for a `{` in that case runs past the end of the method and returns a
 * neighbouring function's body, which then looks like a set of required fields
 * that do not exist.
 */
export function bodyOf(src: string, line: number): string {
    const lines = src.split("\n");
    let at = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) at += lines[i].length + 1;
    const arrow = src.indexOf("=>", at);
    if (arrow === -1 || arrow - at > 400) return "";
    let i = arrow + 2;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === "(") {
        const close = matchBracket(src, i);
        return close === -1 ? "" : src.slice(i, close + 1);
    }
    if (src[i] === "{") {
        const close = matchBracket(src, i);
        return close === -1 ? "" : src.slice(i, close + 1);
    }
    // a bare expression body, terminated by the end of the statement
    const end = src.indexOf("\n", i);
    return src.slice(i, end === -1 ? src.length : end).trim();
}

/** `xe.registerTechNode` in `(0, xe.registerTechNode)(e, t, n)` — code we cannot see. */
export function externalDelegate(body: string): string | null {
    const m = body.match(
        /^\(\s*(?:0\s*,\s*)?([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\s*\)\s*\(/,
    );
    return m ? m[1] : null;
}

export interface FieldRead {
    field: string;
    /**
     * times the field's *value* is used, e.g. `t.colors && f(t.colors)`.
     * Safe when the field is absent — it just evaluates to undefined.
     */
    valueReads: number;
    /**
     * times the field is dereferenced — `t.colors.variants`, `t.sprite()`,
     * `t.sprite[0]`. This is what throws when the field is missing, and it is
     * the only thing that makes a field effectively required.
     */
    derefs: number;
}

/**
 * Blank out nested scopes that redeclare the parameter.
 *
 * The bundle uses short names throughout, so an inner `function (e, t) { … }`
 * shadows the definition parameter and its `t.indexOf(…)` would otherwise be
 * read as a property of the definition.
 */
export function stripShadowing(body: string, param: string): string {
    const word = new RegExp(String.raw`(^|[^\w$])${param}(?=[^\w$]|$)`);
    const out = body.split("");
    const openers = [
        /\(([^()]*)\)\s*=>\s*\{/g,
        // a single-parameter arrow needs no parentheses: `(e => { … })`
        /([A-Za-z_$][\w$]*)\s*=>\s*\{/g,
        /function\s*\(([^()]*)\)\s*\{/g,
        /function\s+[\w$]+\s*\(([^()]*)\)\s*\{/g,
    ];
    // a nested scope shadows the parameter either by naming it in the argument
    // list, or by declaring it with `var` / `let` / `const` inside the body
    const declares = new RegExp(
        String.raw`\b(?:var|let|const)\s+(?:[^;{}\n]*,\s*)*${param}(?=[^\w$]|$)`,
    );
    for (const re of openers) {
        for (const m of body.matchAll(re)) {
            const brace = body.indexOf("{", m.index! + m[0].length - 1);
            if (brace === -1) continue;
            const close = matchBracket(body, brace);
            if (close === -1) continue;
            const inner = body.slice(brace, close + 1);
            if (!word.test(m[1]) && !declares.test(inner)) continue;
            for (let i = brace; i <= close; i++) {
                if (out[i] !== "\n") out[i] = " ";
            }
        }
    }
    return out.join("");
}

/**
 * Top-level properties of `param` read inside a body.
 *
 * Only the first segment after the parameter counts: `t.colors.variants` reads
 * the field `colors`. Each read is classified as a plain value read or a
 * dereference, because only a dereference fails when the field is absent.
 */
export function readsOf(body: string, param: string): FieldRead[] {
    const clean = stripShadowing(body, param);
    const found = new Map<string, FieldRead>();
    // The lookbehind must exclude `$` as well as word characters: the bundle
    // uses `$t` for imported modules, and `\bt\.` would match inside `$t.triggers`
    // and report a field that belongs to a module, not the definition.
    const re = new RegExp(
        String.raw`(?<![\w$${DOLLAR}])${param}\??\.([A-Za-z_$][\w$]*)`,
        "g",
    );
    for (const m of clean.matchAll(re)) {
        const at = m.index!;
        const field = m[1];
        // what follows the field name decides whether it is dereferenced
        const after = clean.slice(at + m[0].length);
        const deref = /^\s*(\.|\(|\[)/.test(after) || /^\?\.?\s*(\.|\(|\[)/.test(after);
        const cur = found.get(field) ?? { field, valueReads: 0, derefs: 0 };
        if (deref) cur.derefs++;
        else cur.valueReads++;
        found.set(field, cur);
    }
    return [...found.values()].sort((a, b) => a.field.localeCompare(b.field));
}

// ------------------------------------------------------------------ driver

export interface RegisterDef {
    method: string;
    params: string;
    line: number;
    /** fields the body reads, following thin delegations */
    reads: FieldRead[];
    /** the body spreads the whole object, so unknown fields survive */
    passthrough: boolean;
    /** the body calls a normaliser that rewrites name/description */
    i18nNormalised: boolean;
    /** the body can throw */
    throws: boolean;
    /** the literal messages the body throws, which state the real rules */
    throwMessages: string[];
    /** wrappers traversed to reach the implementation */
    delegatedThrough: string[];
    /**
     * the body forwards to another module, so the fields it reads are not in
     * this file and are genuinely unknown rather than empty
     */
    delegatesToModule: string | null;
}

/**
 * Index module-level helpers so a one-line delegate can be followed.
 *
 * `structures.register` in the engine api is literally `Ke(e, t, n)`. The fields
 * the engine inspects only appear in `Ke`, so without this every such method
 * would report no fields at all.
 */
export function indexHelpers(src: string): Map<string, string> {
    const helpers = new Map<string, string>();
    // `name` is indexed by the offset of its opening paren
    const record = (name: string, paren: number) => {
        if (helpers.has(name) || paren < 0) return;
        const close = matchBracket(src, paren);
        if (close === -1) return;
        let i = close + 1;
        while (i < src.length && /\s/.test(src[i])) i++;
        // the body is either `{ … }` or the block of an `=> { … }` arrow
        if (src[i] === "{") {
            const bodyClose = matchBracket(src, i);
            if (bodyClose === -1) return;
            helpers.set(name, src.slice(i, bodyClose + 1));
            return;
        }
        if (!src.startsWith("=>", i)) return;
        const brace = src.indexOf("{", i);
        if (brace === -1) return;
        const bodyClose = matchBracket(src, brace);
        if (bodyClose === -1) return;
        helpers.set(name, src.slice(brace, bodyClose + 1));
    };
    // `Name = (args) => {` — a minified const or a var in a comma list. The
    // lookahead leaves the `(` unconsumed, so it sits at the end of the match.
    for (
        const m of src.matchAll(
            /(?:^|[,;]|\})\s*([A-Za-z_$][\w$]*)\s*=\s*(?=\()/g,
        )
    ) {
        record(m[1], m.index! + m[0].length);
    }
    // `function Name(args) {` — a hoisted declaration, where the match includes
    // the `(` itself
    for (
        const m of src.matchAll(
            /(?:^|[;,}\s])function\s+([A-Za-z_$][\w$]*)\s*\(/g,
        )
    ) {
        record(m[1], m.index! + m[0].length - 1);
    }
    return helpers;
}

/** A body that only forwards to one helper, e.g. `{ Ke(e, t, n) }`. */
export function delegateOf(
    body: string,
    param: string,
    helpers: Map<string, string>,
): string | null {
    const inner = body.replace(/^\{|\}$/g, "").trim();
    const m = inner.match(
        new RegExp(String.raw`^([A-Za-z_$][\w$]*)\(([^()]*)\)$`),
    );
    if (!m) return null;
    // the delegate must actually receive the definition parameter
    if (!new RegExp(String.raw`(^|[^\w$])${param}(?=[^\w$]|$)`).test(m[2])) {
        return null;
    }
    return helpers.get(m[1]) ?? null;
}

/**
 * Literal `throw new Error("…")` messages, which state the actual rules.
 *
 * The three quote styles are handled separately: a template literal routinely
 * contains apostrophes — `Terrain '${t.id}' has invalid materialId` — so a
 * single character class would truncate the message at the first quote.
 */
export function throwMessagesOf(body: string): string[] {
    const out: string[] = [];
    const add = (s: string) => {
        const clean = s.replace(/\$\{[^}]*\}/g, "…").replace(/\s+/g, " ").trim();
        if (clean) out.push(clean.slice(0, 240));
    };
    for (const m of body.matchAll(/throw new Error\(\s*`([^`]*)`/g)) add(m[1]);
    for (const m of body.matchAll(/throw new Error\(\s*"([^"]*)"/g)) add(m[1]);
    for (const m of body.matchAll(/throw new Error\(\s*'([^']*)'/g)) add(m[1]);
    return [...new Set(out)];
}

// APPEND-MARKER

// ------------------------------------------------------------------ driver

export interface RegisterDef {
    method: string;
    params: string;
    line: number;
    /** fields the body reads */
    reads: FieldRead[];
    /** the body spreads the whole object, so unknown fields survive */
    passthrough: boolean;
    /** the body calls a normaliser that rewrites name/description */
    i18nNormalised: boolean;
    /** the body can throw */
    throws: boolean;
}

/**
 * Every distinct register/update method, deduplicated by full path.
 *
 * The key must be the path, not namespace plus name: `structures`,
 * `structures.recipes` and `structures.processing` each have a `register`, and
 * collapsing them silently attributed the recipe registrar's body to
 * `structures.register`.
 */
export function collectRegisters(index: ApiIndex): {
    method: string;
    params: string;
    line: number;
}[] {
    const seen = new Set<string>();
    const out: { method: string; params: string; line: number }[] = [];
    for (const [, methods] of Object.entries(index)) {
        for (const m of methods) {
            if (!/^register|updateDefinition$/.test(m.name)) continue;
            if (m.kind === "value") continue;
            const key = m.path;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ method: key, params: m.params, line: m.line });
        }
    }
    return out.sort((a, b) => a.method.localeCompare(b.method));
}

export function buildDefinitions(
    src: string,
    index: ApiIndex,
    publicIndex?: PublicIndex,
): RegisterDef[] {
    const helpers = indexHelpers(src);
    /**
     * Parameter names for a method from the public typings, which are not
     * mangled. They are what identifies which engine argument is the
     * definition, since the engine's own names carry no meaning.
     */
    const publicNamesFor = (path: string): string[] | undefined => {
        const [ns, ...rest] = path.split(".");
        const namespace = publicIndex?.main.find((n) => n.name === ns);
        const method = namespace?.members.find((m) => m.name === rest.join("."));
        return method?.argNames;
    };

    const out: RegisterDef[] = [];
    for (const { method, params, line } of collectRegisters(index)) {
        const plist = splitParams(params).map((p) =>
            p.replace(/^\.\.\./, "").replace(/[?=].*$/s, "").trim()
        );
        const at = definitionArg(
            method.split(".").pop()!,
            plist,
            publicNamesFor(method),
        );
        if (at === null || !plist[at]) continue;
        const param = plist[at];
        let body = bodyOf(src, line);
        if (!body) continue;

        // follow a thin wrapper down to the implementation
        const delegatedThrough: string[] = [];
        const seen = new Set<string>();
        for (let hop = 0; hop < 4; hop++) {
            const target = delegateOf(body, param, helpers);
            if (!target || seen.has(target)) break;
            seen.add(target);
            delegatedThrough.push(target.slice(0, 40));
            body = target;
        }

        out.push({
            method,
            params,
            line,
            reads: readsOf(body, param),
            // `{...def}` keeps any field the body never looks at
            passthrough: new RegExp(String.raw`\.\.\.${param}\b`).test(body),
            // `xt(def, …)` rewrites name/description into i18n keys
            i18nNormalised: new RegExp(String.raw`\bxt\(\s*${param}\b`).test(body),
            throws: /\bthrow\b/.test(body),
            throwMessages: throwMessagesOf(body),
            delegatedThrough,
            delegatesToModule: externalDelegate(body),
        });
    }
    return out;
}

function render(defs: RegisterDef[]): string {
    const out: string[] = [
        "# What each register call reads",
        "",
        "Generated by `tools/extract-definitions.ts` from the shipped bundle.",
        "Do not edit by hand.",
        "",
        "A **deref** is a field whose value is used as an object — `t.colors.variants`,",
        "`t.sprite()`, `t.sprite[0]`. That is the only thing that fails when the field",
        "is missing, so only dereffed fields are effectively required. A plain",
        "**read** is safe: an absent field simply evaluates to `undefined`.",
        "",
        "Where a method is a one-line wrapper, the body it forwards to was followed",
        "so the table describes the implementation, not the stub.",
        "",
    ];
    for (const d of defs) {
        out.push(`## \`${d.method}\``, "");
        out.push(`bundle line ${d.line} · \`${d.params}\``);
        const notes = [
            d.passthrough ? "copies the whole definition, so unread fields survive" : "",
            d.i18nNormalised ? "rewrites `name`/`description` into i18n keys" : "",
            d.throws ? "**can throw**" : "",
            d.delegatesToModule
                ? `implementation is in \`${d.delegatesToModule}\`, another module — the fields it reads are not in this file`
                : "",
        ].filter(Boolean);
        if (notes.length) out.push("", ...notes.map((n) => `- ${n}`));
        if (d.throwMessages.length) {
            out.push("", "Rejects with:", "");
            for (const m of d.throwMessages) out.push(`- \`${m}\``);
        }
        out.push("");
        if (!d.reads.length) {
            out.push(
                d.delegatesToModule
                    ? "Fields read are **not determined**: the implementation is in another module."
                    : "Reads no properties of the definition.",
                "",
            );
            continue;
        }
        out.push("| field | read | deref | requirement |", "|---|---|---|---|");
        for (const r of d.reads) {
            out.push(
                `| \`${r.field}\` | ${r.valueReads} | ${r.derefs} | ${
                    r.derefs > 0 ? "**required** — dereferenced" : "optional — value only"
                } |`,
            );
        }
        out.push("");
    }
    return out.join("\n");
}

// -------------------------------------------------- mod config comparison

/**
 * Which stored mod config feeds each register call.
 *
 * A key of `null` means the api takes something the mod does not store.
 */
export const METHOD_TO_MOD: Record<string, string | null> = {
    "elements.register": "ElementConfig",
    "structures.register": "StructureConfig",
    "items.register": "ItemConfig",
    "terrains.register": "TerrainConfig",
    "upgrades.register": "UpgradeConfig",
    "upgrades.registerCategory": "UpgradeCategoryConfig",
    "projectiles.register": "ProjectileConfig",
    "reactions.registerContact": "ContactReactionConfig",
    "energy.registerType": "EnergyTypeConfig",
    "excavation.registerProfile": "ExcavationProfileConfig",
    "signals.register": "SignalConfig",
    "triggers.register": "TriggerConfig",
    "structures.processing.register": "ProcessingConfig",
    "structures.recipes.register": "RecipeConfig",
    "tech.registerNode": "TechConfig",
    "tech.updateDefinition": "TechConfig",
    "structures.registerPlacementConfig": "StructureConfig",
    "conveyors.registerType": "StructureBehaviorConfig",
    "launchers.registerType": "StructureBehaviorConfig",
};

export interface Comparison {
    method: string;
    modType: string | null;
    /** false when the implementation is in another module, so reads are unknown */
    determined: boolean;
    /** the engine dereferences these, so omitting them fails */
    requiredByEngine: string[];
    /** the engine never looks at these, so the engine ignores them */
    ignoredByEngine: string[];
    /** the engine reads a field the mod config does not declare */
    modOnly: string[];
    /** the mod config declares a field this method never reads */
    neverRead: string[];
}

export function compareMod(
    defs: RegisterDef[],
    modTypes: Map<string, ApiType>,
): Comparison[] {
    const out: Comparison[] = [];
    for (const d of defs) {
        const modType = METHOD_TO_MOD[d.method] ?? null;
        const reads = new Set(d.reads.map((r) => r.field));
        const requiredByEngine = d.reads
            .filter((r) => r.derefs > 0)
            .map((r) => r.field);
        const determined = !d.delegatesToModule;
        if (!modType || !modTypes.has(modType) || !determined) {
            out.push({
                method: d.method,
                modType,
                determined,
                requiredByEngine,
                ignoredByEngine: [],
                modOnly: [],
                neverRead: [],
            });
            continue;
        }
        const mine = new Set(
            (modTypes.get(modType)?.fields ?? []).map((f) => f.name),
        );
        out.push({
            method: d.method,
            modType,
            determined,
            requiredByEngine,
            ignoredByEngine: d.reads
                .filter((r) => r.derefs === 0)
                .map((r) => r.field),
            modOnly: [...reads].filter((f) => !mine.has(f)).sort(),
            neverRead: [...mine].filter((f) => !reads.has(f)).sort(),
        });
    }
    return out;
}

function renderComparison(rows: Comparison[]): string {
    const out: string[] = [
        "## Mod config against the implementation",
        "",
        "Fields the engine dereferences are required; the rest are optional.",
        "`never read` is the useful column for a form builder: those are fields the",
        "mod stores that the engine does not inspect on this call.",
        "",
        "| register call | mod config | required | never read |",
        "|---|---|---|---|",
    ];
    for (const r of rows) {
        if (!r.modType || !r.determined) continue;
        out.push(
            `| \`${r.method}\` | \`${r.modType}\` | ${
                r.requiredByEngine.join(", ") || "—"
            } | ${r.neverRead.length} |`,
        );
    }
    out.push("");
    for (const r of rows) {
        if (!r.modType || !r.determined) continue;
        if (!r.modOnly.length && !r.neverRead.length) continue;
        out.push(`### \`${r.method}\` ← \`${r.modType}\``, "");
        if (r.modOnly.length) {
            out.push("Engine reads, mod config does not declare:", "");
            for (const f of r.modOnly) out.push(`- \`${f}\``);
            out.push("");
        }
        if (r.neverRead.length) {
            out.push("Mod stores, engine never reads here:", "");
            for (const f of r.neverRead) out.push(`- \`${f}\``);
            out.push("");
        }
    }
    return out.join("\n");
}

if (import.meta.main) {
    const src = await Deno.readTextFile(BUNDLE);
    const index = JSON.parse(await Deno.readTextFile(INDEX)).index as ApiIndex;
    const defs = buildDefinitions(src, index, await buildIndex());

    let comparison: Comparison[] = [];
    if (Deno.args.includes("--mod")) {
        const constants = await Deno.readTextFile(`${ROOT}src/constants.ts`);
        const [ns] = parseDts(constants, "src/constants.ts", "mod");
        comparison = compareMod(
            defs,
            new Map(ns.types.map((t) => [t.name, t])),
        );
    }

    await Deno.writeTextFile(
        `${OUT_DIR}definitions.json`,
        JSON.stringify({ methods: defs, comparison }, null, 2) + "\n",
    );
    await Deno.writeTextFile(
        `${OUT_DIR}DEFINITIONS.md`,
        render(defs) + (comparison.length ? "\n" + renderComparison(comparison) : ""),
    );
    const withRequired = defs.filter((d) => d.reads.some((r) => r.derefs > 0));
    const allRequired = new Set(
        withRequired.flatMap((d) =>
            d.reads.filter((r) => r.derefs > 0).map((r) => `${d.method}.${r.field}`)
        ),
    );
    console.log(`register/update methods : ${defs.length}`);
    console.log(`with a required field   : ${withRequired.length}`);
    console.log(`required fields total   : ${allRequired.size}`);
    console.log(
        `followed a wrapper      : ${defs.filter((d) => d.delegatedThrough.length).length}`,
    );
    console.log(`copies the whole object : ${defs.filter((d) => d.passthrough).length}`);
    console.log(`rewrites i18n keys      : ${defs.filter((d) => d.i18nNormalised).length}`);
    console.log(`can throw               : ${defs.filter((d) => d.throws).length}`);
    if (comparison.length) {
        const matched = comparison.filter((c) => c.modType && c.determined);
        const undetermined = comparison.filter((c) => !c.determined);
        console.log(`\nmod config matched      : ${matched.length} register calls`);
        for (const c of matched) {
            if (c.modOnly.length) {
                console.log(
                    `  ${c.method}: engine reads but mod config lacks -> ${c.modOnly.join(", ")}`,
                );
            }
        }
        if (undetermined.length) {
            console.log(
                `undetermined (implementation in another module): ${undetermined.length}`,
            );
        }
    }
    console.log(`-> ${OUT_DIR}DEFINITIONS.md`);
    console.log(`-> ${OUT_DIR}definitions.json`);
}
