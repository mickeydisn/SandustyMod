/**
 * extract-public-api.ts — index the PUBLIC `sandkit.api` from the typings.
 *
 * Phase 0 indexed the engine escape hatch (`Dt`, context-first). This indexes
 * the surface a mod actually calls, which is declared — not shipped — in
 * `__pakages/__other/sandkit/src/sandkit/api/*.d.ts`.
 *
 * The runtime proof of the convention came from
 * `__bundel/bund/extra-mod-worker.js`, whose composer does:
 *
 *     const o = e;                                   // e = engine context
 *     const api = L({ elements: L({                 // L = Object.freeze
 *         createAtCell: (x, y, t) => FH.elements.createAt(o, x, y, t),
 *     })});
 *
 * The context is captured once and closed over, so public members take only
 * the mod's own arguments. That is why `register(definition)` has one parameter
 * here while `register(ctx, definition)` has two in the engine api.
 *
 * Usage: deno run -A tools/extract-public-api.ts [--check]
 */

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const REPO = HERE.replace(/\/$/, "").split("/").slice(0, -3).join("/") + "/";
const PKG = `${REPO}__pakages/__other/sandkit/src/`;
const OUT_DIR = `${ROOT}doc-bundel/`;

// ------------------------------------------------------------------- types

export interface Param {
    /** the parameter text, e.g. `elementTypeOrId: ElementRef` */
    text: string;
    name: string;
    optional: boolean;
    rest: boolean;
    type: string;
}

export interface ApiMember {
    namespace: string;
    name: string;
    /** full parameter list exactly as declared, `()` when there are none */
    params: string;
    /** parameter names in order — the things a caller must supply */
    argNames: string[];
    /** how many arguments a caller must pass */
    required: number;
    /** total accepted */
    total: number;
    returns: string;
    doc: string;
    /** `Main thread only` / `Worker only`, when the typings say so */
    thread: string | null;
    file: string;
    line: number;
}

export interface ApiType {
    namespace: string;
    name: string;
    doc: string;
    /** field names declared in the interface body */
    fields: { name: string; text: string; optional: boolean; doc: string }[];
    /**
     * the body carries an index signature such as `[key: string]: unknown`.
     *
     * Such a type accepts fields the typings never mention, so a field-by-field
     * comparison against it is meaningless. `ItemDefinition` is one: it declares
     * only `handleAction` and `afterRender` and lets everything else through.
     */
    openEnded: boolean;
    file: string;
    line: number;
}

export interface Namespace {
    name: string;
    doc: string;
    thread: string | null;
    members: ApiMember[];
    types: ApiType[];
    aliases: { name: string; target: string; doc: string }[];
}

// ------------------------------------------------------------------ parsing

/** Split a declared parameter list into individual parameters. */
export function parseParams(src: string): Param[] {
    const inner = src.trim().replace(/^\(/, "").replace(/\)$/, "");
    if (!inner.trim()) return [];
    const parts: string[] = [];
    let depth = 0, cur = "";
    for (const ch of inner) {
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) depth--;
        if (ch === "," && depth === 0) {
            parts.push(cur);
            cur = "";
        } else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map((p) => {
        const text = p.trim();
        // a default value may contain a colon; the type is what follows it
        const at = text.indexOf(":");
        const head = at === -1 ? text : text.slice(0, at);
        return {
            text,
            // strip the rest marker, the optional marker and any default value
            name: head.replace(/^\.\.\./, "").replace(/[?=].*$/s, "").trim(),
            optional: text.includes("?") || text.includes("=") ||
                /^\.\.\./.test(text),
            rest: /^\.\.\./.test(text),
            type: at === -1 ? "" : text.slice(at + 1).trim(),
        };
    });
}

/** Collapse a JSDoc block to its summary lines, dropping tag lines. */
function summariseDoc(block: string): string {
    return block
        .replace(/^\/\*\*?/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((l) => l.replace(/^\s*\*/, "").trim())
        .filter((l) => l && !l.startsWith("@"))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

const THREAD = /^(Main thread only|Worker only|Both threads|main thread only|worker only)\b/i;

function threadOf(doc: string, body: string): string | null {
    const m = doc.match(THREAD) ?? body.slice(0, 400).match(THREAD);
    if (!m) return null;
    const t = m[1].toLowerCase();
    return t.startsWith("worker") ? "worker" : t.startsWith("main") ? "main" : "both";
}

// ------------------------------------------------------- declaration parsing

/** Index just past the bracket that matches the one at `open`. */
function matchBracket(s: string, open: number): number {
    const pairs: Record<string, string> = {
        "(": ")",
        "[": "]",
        "{": "}",
        "<": ">",
    };
    const close = pairs[s[open]];
    if (!close) return -1;
    let depth = 0;
    for (let i = open; i < s.length; i++) {
        if (s[i] === s[open]) depth++;
        else if (s[i] === close) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Index of the `;` that ends a declaration starting at `from`, or -1.
 *
 * Scanning by bracket depth rather than for the first `;` matters because a
 * signature can contain `;` inside a nested type, and a parameter list can span
 * several lines.
 */
export function declarationEnd(s: string, from: number): number {
    let depth = 0;
    let sawParams = false;
    for (let i = from; i < s.length; i++) {
        const ch = s[i];
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) {
            // `>` is ambiguous: it closes a generic *or* is the arrow in
            // `=> void`. Only a closer that matches something can close, and the
            // depth must never go negative, or the closing `;` is never found.
            if (depth > 0) depth--;
            if (depth === 0 && ch === ")") sawParams = true;
        } else if (ch === ";" && depth === 0 && sawParams) return i;
    }
    return -1;
}

interface FnDecl {
    name: string;
    params: string;
    returns: string;
}

/**
 * Parse `export function name<Generics>(a, b): R;`.
 *
 * Positional rather than a single regex, because the name may be followed by
 * explicit type parameters and the parameter list may contain nested
 * parentheses, as in `callback: (payload: EventPayload<K>) => void`.
 */
export function parseFunctionDecl(src: string): FnDecl | null {
    const head = src.match(/^export\s+function\s+([A-Za-z0-9_$]+)/);
    if (!head) return null;
    let i = head[0].length;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === "<") {
        const close = matchBracket(src, i);
        if (close === -1) return null;
        i = close + 1;
        while (i < src.length && /\s/.test(src[i])) i++;
    }
    if (src[i] !== "(") return null;
    const closeParen = matchBracket(src, i);
    if (closeParen === -1) return null;
    let j = closeParen + 1;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== ":") return null;
    const returns = src.slice(j + 1).replace(/;\s*$/, "").trim();
    return {
        name: head[1],
        params: src.slice(i, closeParen + 1),
        returns,
    };
}

/**
 * Is there an index signature directly in the body, rather than nested?
 *
 * `ElementDefinition` contains `defaultDataFields?: { [key: string]: number }`,
 * so a plain search finds `[key:` and wrongly calls the whole type open-ended.
 * Only a `[` at depth zero of the body is the type's own signature.
 */
export function hasTopLevelIndexSignature(body: string): boolean {
    let depth = 0;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === "[" || ch === "{" || ch === "(" || ch === "<") {
            if (
                depth === 0 &&
                /^\[\s*(key|string|number)\s*:/.test(body.slice(i, i + 20))
            ) {
                return true;
            }
            depth++;
        } else if (ch === "]" || ch === "}" || ch === ")" || ch === ">") {
            if (depth > 0) depth--;
        }
    }
    return false;
}

// ------------------------------------------------------ object type literals

/**
 * Parse the body of `export type X = { … }` into its properties.
 *
 * These are comma separated and may nest, and they are written with `,` rather
 * than `;`, so they cannot share the interface field parser. Comments are
 * removed first; the remaining text is the type reference we want to keep.
 */
export function parseObjectType(body: string): ApiType["fields"] {
    const text = body
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
    const parts: string[] = [];
    let depth = 0, cur = "";
    for (const ch of text) {
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) depth--;
        if (ch === "," && depth === 0) {
            parts.push(cur);
            cur = "";
        } else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    const out: ApiType["fields"] = [];
    for (const p of parts) {
        const m = p.trim().match(/^([A-Za-z0-9_$]+)(\?)?\s*:\s*([\s\S]+)$/);
        if (m) {
            out.push({
                name: m[1],
                text: m[3].replace(/,\s*$/, "").trim(),
                optional: Boolean(m[2]),
                doc: "",
            });
        }
    }
    return out;
}

/** Index of the `;` ending a type alias, or -1 when it is still open. */
export function typeAliasEnd(s: string): number {
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) {
            if (depth > 0) depth--;
        } else if (ch === ";" && depth === 0) return i;
    }
    return -1;
}

// ------------------------------------------------------------ file parsing

/**
 * Parse one `.d.ts` file into namespaces, members, types and aliases.
 *
 * Line oriented with brace-depth tracking, which is sufficient here: the
 * typings are machine-formatted, and accumulating a declaration until its
 * terminating `;` handles multi-line parameter lists.
 */
export function parseDts(
    text: string,
    file: string,
    rootName?: string,
): Namespace[] {
    const lines = text.split("\n");
    const out: Namespace[] = [];
    let ns: Namespace | null = null;
    let depth = 0;
    let doc: string[] = [];
    let inDoc = false;
    let iface: ApiType | null = null;
    // Namespaces nest — `structures.recipes` and `structures.processing` are
    // declared inside `structures` — so track the full dotted path together
    // with the brace depth at which each one opened. Both are needed:
    // without the depth guard a nested close pops the parent, and without the
    // parent object a close cannot restore who owns the following members.
    const stack: Namespace[] = [];
    const baseDepths: number[] = [];
    /** depth of the current interface body's own top level */
    let ifaceTop = -1;

    // A root namespace lets the same parser read an ordinary module whose
    // declarations sit at the top level, such as the mod's `constants.ts`.
    if (rootName) {
        ns = {
            name: rootName,
            doc: "",
            thread: null,
            members: [],
            types: [],
            aliases: [],
        };
        out.push(ns);
        stack.push(ns);
        baseDepths.push(-1); // never reached, so the root is never popped
    }


    const flushDoc = () => {
        const d = summariseDoc(doc.join("\n"));
        doc = [];
        return d;
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        const lineNo = i + 1;

        // ---- JSDoc collection
        if (line.startsWith("/**")) {
            inDoc = true;
            doc = [line];
            if (line.includes("*/")) {
                inDoc = false;
            }
            continue;
        }
        if (inDoc) {
            doc.push(raw);
            if (line.includes("*/")) inDoc = false;
            continue;
        }
        const pending = doc.length ? flushDoc() : "";

        // ---- namespace / interface open
        const nsOpen = line.match(/^export\s+namespace\s+([A-Za-z0-9_$]+)\s*\{/);
        if (nsOpen) {
            const path = [...stack.map((s) => s.name), nsOpen[1]].join(".");
            ns = {
                name: path,
                doc: pending,
                thread: threadOf(pending, ""),
                members: [],
                types: [],
                aliases: [],
            };
            out.push(ns);
            stack.push(ns);
            baseDepths.push(depth);
            depth += (line.match(/\{/g) ?? []).length;
            depth -= (line.match(/\}/g) ?? []).length;
            iface = null;
            continue;
        }
        // ---- `export type X = …`
        //
        // Two shapes live behind this one keyword: an object literal written
        // with commas (`ElementDefinition = { id: string, … }`) and a named
        // alias (`ElementType = ElementTypeEnum | TaggedNumber<"elementType">`).
        // Unions span many lines — `Interaction = A | B | … | H` — so accumulate
        // to the terminating `;` before deciding, otherwise the continuation
        // lines leak their braces into the depth count and swallow the members
        // that follow.
        if (line.startsWith("export type") && ns) {
            const head = line.match(/^export\s+type\s+([A-Za-z0-9_$]+)\s*=/);
            if (head) {
                let buf = line;
                let j = i;
                while (typeAliasEnd(buf) === -1 && j + 1 < lines.length) {
                    j++;
                    buf += " " + lines[j].trim();
                }
                const brace = buf.indexOf("{");
                const braceClose = brace === -1 ? -1 : matchBracket(buf, brace);
                if (brace !== -1 && braceClose !== -1) {
                    const body = buf.slice(brace + 1, braceClose);
                    ns.types.push({
                        namespace: ns.name,
                        name: head[1],
                        doc: pending,
                        fields: parseObjectType(body),
                        openEnded: hasTopLevelIndexSignature(body),
                        file,
                        line: lineNo,
                    });
                } else {
                    const rhs = buf.slice(buf.indexOf("=") + 1)
                        .replace(/;\s*$/, "").trim();
                    ns.aliases.push({
                        name: head[1],
                        target: rhs,
                        doc: pending,
                    });
                }
                i = j;
                continue;
            }
        }

        const ifOpen = line.match(/^export\s+interface\s+([A-Za-z0-9_$]+)/);
        if (ifOpen) {
            depth += (line.match(/\{/g) ?? []).length;
            depth -= (line.match(/\}/g) ?? []).length;
            if (ns) {
                iface = {
                    namespace: ns.name,
                    name: ifOpen[1],
                    doc: pending,
                    fields: [],
                    openEnded: false,
                    file,
                    line: lineNo,
                };
                ns.types.push(iface);
            }
            // depth of the interface body's own top level; a member of a nested
            // object sits deeper and is not a field of this interface
            ifaceTop = depth;
            continue;
        }
        if (iface && ifaceTop === depth && line && !line.startsWith("}")) {
            // an index signature means the type accepts unnamed extra fields
            if (/^\[\s*(key|string|number)\s*:/.test(line)) {
                iface.openEnded = true;
            } else {
                const f = line.match(/^([A-Za-z0-9_$]+)(\?)?\s*:\s*(.+?);?$/);
                if (f) {
                    iface.fields.push({
                        name: f[1],
                        text: f[3].replace(/;$/, "").trim(),
                        optional: Boolean(f[2]),
                        doc: pending,
                    });
                }
            }
        }

        // ---- alias:  export import Name = target
        const alias = line.match(
            /^export\s+import\s+([A-Za-z0-9_$]+)\s*=\s*(.+?);?$/,
        );
        if (alias && ns) {
            ns.aliases.push({
                name: alias[1],
                target: alias[2].replace(/;$/, "").trim(),
                doc: pending,
            });
            continue;
        }

        // ---- function declaration, possibly spanning several lines
        if (line.startsWith("export function") && ns) {
            let buf = line;
            let j = i;
            let end = declarationEnd(buf, 0);
            while (end === -1 && j + 1 < lines.length) {
                j++;
                buf += " " + lines[j].trim();
                end = declarationEnd(buf, 0);
            }
            const decl = parseFunctionDecl(buf);
            if (decl) {
                const plist = parseParams(decl.params);
                ns.members.push({
                    namespace: ns.name,
                    name: decl.name,
                    params: decl.params,
                    argNames: plist.map((p) => p.name),
                    required: plist.filter((p) => !p.optional).length,
                    total: plist.length,
                    returns: decl.returns,
                    doc: pending,
                    thread: null,
                    file,
                    line: lineNo,
                });
            }
            i = j;
            continue;
        }

        // ---- depth bookkeeping for everything else
        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;
        // close every namespace whose opening depth we have fallen back to, and
        // hand ownership back to the enclosing namespace rather than dropping it
        while (baseDepths.length > 0 && depth <= baseDepths[baseDepths.length - 1]) {
            baseDepths.pop();
            stack.pop();
            ns = stack[stack.length - 1] ?? null;
            iface = null;
        }
        if (baseDepths.length === 0) depth = Math.max(0, depth);
    }
    return out;
}

// ----------------------------------------------------------------- indexing

async function listDts(dir: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (d: string) => {
        let entries: Deno.DirEntry[];
        try {
            entries = await Array.fromAsync(Deno.readDir(d));
        } catch {
            return;
        }
        for (const e of entries) {
            const p = `${d}/${e.name}`;
            if (e.isDirectory) await walk(p);
            else if (e.name.endsWith(".d.ts")) out.push(p);
        }
    };
    await walk(dir);
    return out.sort();
}

/** Merge parsed namespaces from many files, keying by name. */
function merge(parsed: Namespace[]): Map<string, Namespace> {
    const map = new Map<string, Namespace>();
    for (const n of parsed) {
        const cur = map.get(n.name);
        if (!cur) {
            map.set(n.name, n);
            continue;
        }
        cur.members.push(...n.members);
        cur.types.push(...n.types);
        cur.aliases.push(...n.aliases);
        cur.doc ||= n.doc;
        cur.thread ??= n.thread;
    }
    return map;
}

export interface PublicIndex {
    main: Namespace[];
    worker: Namespace[];
    /** `shared/api/*.d.ts` — the definition shapes the public api aliases to */
    shared: Namespace[];
    stats: Record<string, number>;
}

/** Parse every `.d.ts` under a directory and merge the namespaces found. */
async function indexDir(dir: string): Promise<Map<string, Namespace>> {
    const parsed: Namespace[] = [];
    for (const f of await listDts(dir)) {
        parsed.push(...parseDts(await Deno.readTextFile(f), f));
    }
    return merge(parsed);
}

export async function buildIndex(): Promise<PublicIndex> {
    const mainMap = await indexDir(`${PKG}sandkit/api/`);
    const workerMap = await indexDir(`${PKG}worker/`);
    // `shared/api/*.d.ts` holds the real definition shapes. The public api reaches
    // them through `export import ElementDefinition = shared.api.elements.…`, so
    // without this directory the graph has no fields to draw.
    const sharedMap = await indexDir(`${PKG}shared/`);
    const all = [
        ...new Set([...mainMap.keys(), ...workerMap.keys(), ...sharedMap.keys()]),
    ];
    const sum = (m: Map<string, Namespace>, f: (n: Namespace) => number) =>
        [...m.values()].reduce((n, x) => n + f(x), 0);
    return {
        main: [...mainMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        worker: [...workerMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        shared: [...sharedMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        stats: {
            mainNamespaces: mainMap.size,
            mainMembers: sum(mainMap, (x) => x.members.length),
            mainTypes: sum(mainMap, (x) => x.types.length),
            mainFields: sum(mainMap, (x) =>
                x.types.reduce((k, t) => k + t.fields.length, 0)
            ),
            mainAliases: sum(mainMap, (x) => x.aliases.length),
            workerNamespaces: workerMap.size,
            workerMembers: sum(workerMap, (x) => x.members.length),
            sharedNamespaces: sharedMap.size,
            sharedTypes: sum(sharedMap, (x) => x.types.length),
            sharedFields: sum(sharedMap, (x) =>
                x.types.reduce((k, t) => k + t.fields.length, 0)
            ),
            mainOnly: all.filter((k) => !workerMap.has(k)).length,
            sharedNamespacesWithMain:
                [...mainMap.keys()].filter((k) => sharedMap.has(k)).length,
        },
    };
}

// ----------------------------------------------------------------- markdown

function sign(m: ApiMember): string {
    return `${m.name}${m.params}: ${m.returns}`;
}

function render(ns: Namespace[], title: string, src: string): string {
    const out: string[] = [
        `# ${title}`,
        "",
        `Generated from \`${src}\`. Do not edit by hand —`,
        `run \`deno run -A tools/extract-public-api.ts\`.`,
        "",
        "Public `sandkit.api` members take only your own arguments: the engine",
        "context is captured once and closed over by the host composer.",
        "",
    ];
    for (const n of ns) {
        const badge = n.thread ? ` — *${n.thread} only*` : "";
        out.push(`## \`api.${n.name}\`${badge}`);
        if (n.doc) out.push("", n.doc);
        out.push("");
        if (n.members.length) {
            out.push("| call | returns | notes |", "|---|---|---|");
            for (const m of n.members) {
                out.push(
                    `| \`${sign(m)}\` | \`${m.returns}\` | ${m.doc || ""} |`,
                );
            }
            out.push("");
        }
        if (n.aliases.length) {
            out.push("**Aliases**", "");
            for (const a of n.aliases) out.push(`- \`${a.name}\` → \`${a.target}\``);
            out.push("");
        }
        if (n.types.length) {
            out.push("<details><summary>Types</summary>", "");
            for (const t of n.types) {
                out.push(`**\`${t.name}\`**${t.doc ? ` — ${t.doc}` : ""}`, "");
                if (t.fields.length) {
                    for (const f of t.fields) {
                        out.push(
                            `- \`${f.name}${f.optional ? "?" : ""}\`: \`${f.text}\`${
                                f.doc ? ` — ${f.doc}` : ""
                            }`,
                        );
                    }
                }
                out.push("");
            }
            out.push("</details>", "");
        }
    }
    return out.join("\n");
}

// -------------------------------------------------- mod call reconciliation

export interface CallSite {
    file: string;
    line: number;
    /** the resolved dotted namespace, e.g. `structures.recipes` */
    ns: string;
    method: string | null;
    args: string | null;
    /** false when the member is referenced but not invoked on this line */
    called: boolean;
    /** accessed through `?.`, i.e. a deliberate capability probe */
    optional: boolean;
}

async function modSources(root: string): Promise<{ path: string; text: string }[]> {
    const out: { path: string; text: string }[] = [];
    const walk = async (d: string) => {
        for await (const e of Deno.readDir(d)) {
            const p = `${d}/${e.name}`;
            if (e.isDirectory) await walk(p);
            else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
                out.push({ path: p, text: await Deno.readTextFile(p) });
            }
        }
    };
    await walk(root);
    return out;
}

/** Count top-level arguments in a call's argument text. */
export function countArgs(args: string): number {
    const t = args.trim();
    if (!t) return 0;
    let depth = 0, n = 1;
    for (const ch of t) {
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) depth--;
        else if (ch === "," && depth === 0) n++;
    }
    return n;
}

/**
 * Find every `api.<ns>[.<method>](...)` access in the mod source.
 *
 * The mod has its own `./api.ts` module, so a bare `api.foo` is ambiguous until
 * you know whether `foo` is a real api namespace. We therefore capture the
 * access and let the caller classify against the index.
 *
 * Scanning runs over the whole file, not line by line: the bundle's style puts
 * object arguments on their own lines, so a line-based scan reads `register({`
 * as a zero-argument call.
 */
export interface ModApi {
    /** `api` is declared in this file (the wrapper module) */
    local: boolean;
    /** module specifier `api` is imported from, when imported */
    from: string | null;
    /** `api` is the host handle, not a wrapper */
    host: boolean;
}

/**
 * Work out what `api` means in a given mod file.
 *
 * The mod has two layers and they are easy to confuse:
 *   - `src/api.ts` re-exports the raw host handle (`sandkit.api`)
 *   - `src/packages/mysandkit.ts` defines a *wrapper* that forwards to the
 *     host and injects arguments such as the mod id
 *
 * A file importing `api` from the wrapper is calling the wrapper, so its
 * signatures are the wrapper's, not the host's.
 */
export function classifyApi(text: string): ModApi {
    const imports = [...text.matchAll(
        /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
    )];
    for (const m of imports) {
        if (!new RegExp(`\\bapi\\b`).test(m[1])) continue;
        const from = m[2];
        return { local: false, from, host: !/mysandkit/i.test(from) };
    }
    return { local: /export\s+const\s+api\s*=/.test(text), from: null, host: true };
}

export function findCalls(
    text: string,
): { path: string[]; start: number; called: boolean; host: boolean; optional: boolean }[] {
    const out: {
        path: string[];
        start: number;
        called: boolean;
        host: boolean;
        optional: boolean;
    }[] = [];
    // `api` may be written as `g()?.api?.x` (always the host handle) or as a
    // bare `api.x` (the imported handle, host or wrapper depending on the
    // file). A preceding dot is therefore recorded, not rejected, and the
    // separator is either `.` or `?.` — never both.
    const sep = String.raw`(?:\?\.|\.)`;
    const pat = new RegExp(
        String.raw`(?<![\w$])api\s*${sep}\s*([A-Za-z0-9_$]+)` +
            String.raw`(?:\s*${sep}\s*([A-Za-z0-9_$]+))?` +
            String.raw`(?:\s*${sep}\s*([A-Za-z0-9_$]+))?` +
            String.raw`\s*(?:\?\.)?\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*(\()?`,
        "g",
    );
    for (const m of text.matchAll(pat)) {
        const path = [m[1], m[2], m[3]].filter((x): x is string => Boolean(x));
        out.push({
            path,
            start: m.index!,
            called: m[4] === "(",
            host: m.index! > 0 && text[m.index! - 1] === ".",
            // `api.x?.y?.(…)` is a deliberate capability probe rather than a
            // hard dependency, so an unknown name is not automatically an error
            optional: m[0].includes("?."),
        });
    }
    return out;
}

/**
 * Replace comment and string bodies with spaces, preserving offsets and
 * newlines. Without this, a documentation reference such as
 * `doc/api.recipes.md   (legal machine ids)` is read as a call to
 * `api.recipes.md(...)`.
 */
export function stripComments(text: string): string {
    const out = text.split("");
    let i = 0;
    const blank = (from: number, to: number) => {
        for (let k = from; k < to && k < out.length; k++) {
            if (out[k] !== "\n") out[k] = " ";
        }
    };
    while (i < text.length) {
        const two = text.slice(i, i + 2);
        if (two === "//") {
            const end = text.indexOf("\n", i);
            blank(i, end === -1 ? text.length : end);
            i = end === -1 ? text.length : end;
        } else if (two === "/*") {
            const end = text.indexOf("*/", i + 2);
            blank(i, end === -1 ? text.length : end + 2);
            i = end === -1 ? text.length : end + 2;
        } else if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
            const q = text[i];
            let j = i + 1;
            while (j < text.length && text[j] !== q) {
                if (text[j] === "\\") j++;
                j++;
            }
            blank(i, j + 1);
            i = j + 1;
        } else i++;
    }
    return out.join("");
}

/** Read the balanced argument text that follows an opening paren at `open`. */
export function readArgs(text: string, open: number): string {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
        else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") {
            depth--;
            if (depth === 0) return text.slice(open + 1, i);
        }
    }
    return text.slice(open + 1);
}

/**
 * Compare every mod call against the public index.
 *
 * `aliasCalls` are accesses like `api.registerConveyor(...)` where `api` is a
 * local variable already bound to `sandkit.api.structureBehaviors`. They are
 * not errors, but they cannot be resolved without scope tracking, so they are
 * reported separately rather than silently dropped.
 */
export async function checkMod(idx: PublicIndex, srcRoot: string) {
    const nsMap = new Map(idx.main.map((n) => [n.name, n]));
    const allNames = new Set<string>();
    for (const n of idx.main) {
        for (const m of n.members) allNames.add(m.name);
        for (const a of n.aliases) allNames.add(a.name);
    }
    const calls: CallSite[] = [];
    let skipped = 0;
    // names the mod deliberately feature-detects with `typeof x === "function"`
    const probes = new Set<string>();
    for (const f of await modSources(srcRoot)) {
        const rel = f.path.replace(/^.*\/md-my-hown-mod\//, "");
        // scan the comment-stripped copy to find call sites, but slice the
        // arguments from the original: stripComments blanks string bodies, so
        // a single `` `${a}.${b}` `` argument would otherwise read as zero args
        const code = stripComments(f.text);
        const kind = classifyApi(f.text);
        for (const m of f.text.matchAll(/typeof\s+[\w$.]*?\.?([A-Za-z0-9_$]+)\s*===\s*"function"/g)) {
            probes.add(m[1]);
        }
        for (const c of findCalls(code)) {
            // `g()?.api?.x` is always the host. A bare `api.x` is the host only
            // when this file imports the host handle rather than the wrapper.
            const isHost = c.host || kind.host;
            if (!isHost) {
                skipped++;
                continue;
            }
            const line = code.slice(0, c.start).split("\n").length;
            const open = c.called ? code.indexOf("(", c.start + 1) : -1;
            // Resolve the longest namespace prefix, then treat what is left as
            // the method: [structures, recipes, register] -> ns
            // `structures.recipes`, method `register`.
            let cut = c.path.length;
            while (cut > 1 && !nsMap.has(c.path.slice(0, cut).join("."))) cut--;
            calls.push({
                file: rel,
                line,
                ns: c.path.slice(0, cut).join("."),
                method: c.path.length > cut ? c.path.slice(cut).join(".") : null,
                args: open === -1 ? null : readArgs(f.text, open),
                called: c.called,
                optional: c.optional,
            });
        }
    }
    const badNs = new Map<string, CallSite>();
    const aliasCalls = new Map<string, CallSite>();
    const probed = new Map<string, CallSite>();
    const badMethod = new Map<string, CallSite>();
    const arity = new Map<string, CallSite>();
    for (const c of calls) {
        const ns = nsMap.get(c.ns);
        if (!ns) {
            if (allNames.has(c.ns)) {
                aliasCalls.set(c.ns, c);
            } else if (probes.has(c.ns)) {
                // `typeof api.registerConveyor === "function"` — a deliberate
                // capability check for a name this build may not have.
                probed.set(c.ns, c);
            } else badNs.set(c.ns, c);
            continue;
        }
        if (!c.method) continue;
        const m = ns.members.find((x) => x.name === c.method) ??
            ns.aliases.find((x) => x.name === c.method);
        if (!m) {
            // An unknown name reached through `?.` is a compatibility probe
            // across builds, not a wrong call — the mod already handles it.
            if (c.optional) probed.set(`${c.ns}.${c.method}`, c);
            else badMethod.set(`${c.ns}.${c.method}`, c);
            continue;
        }
        // Arity only means something at a real call site. A member may be
        // referenced and invoked indirectly, e.g.
        //   const fn = api.structures.addVariant ?? api.structures.registerVariant;
        //   fn?.(base, variant, options);
        if (!c.called) continue;
        if ("required" in m) {
            const n = countArgs(c.args ?? "");
            if (n < m.required) {
                arity.set(
                    `${c.ns}.${c.method} needs >=${m.required}, got ${n}`,
                    c,
                );
            }
        }
    }
    return { calls, skipped, probes: [...probes], badNs, aliasCalls, probed, badMethod, arity };
}

// -------------------------------------------------------------------- main

if (import.meta.main) {
    const idx = await buildIndex();
    await Deno.writeTextFile(
        `${OUT_DIR}public-api.json`,
        JSON.stringify(idx, null, 2) + "\n",
    );
    await Deno.writeTextFile(
        `${OUT_DIR}PUBLIC-API.md`,
        render(idx.main, "Public mod api — `sandkit.api` (main thread)", "__pakages/__other/sandkit/src/sandkit/api/*.d.ts") +
            "\n\n---\n\n" +
            render(idx.worker, "Worker api — `sandkit.api` (worker thread)", "__pakages/__other/sandkit/src/worker/*.d.ts"),
    );
    for (const [k, v] of Object.entries(idx.stats)) {
        console.log(`${k.padEnd(20)} ${v}`);
    }
    console.log(`-> ${OUT_DIR}PUBLIC-API.md`);
    console.log(`-> ${OUT_DIR}public-api.json`);

    if (Deno.args.includes("--mod")) {
        const r = await checkMod(idx, `${ROOT}src/`);
        const show = (title: string, m: Map<string, CallSite>) => {
            console.log(`\n${title}: ${m.size}`);
            for (const [k, c] of m) {
                console.log(`  ${k}\n      ${c.file}:${c.line}`);
            }
        };
        console.log(
            `\nhost call sites    : ${r.calls.length}` +
                (r.skipped ? `  (${r.skipped} wrapper calls skipped)` : ""),
        );
        show("unknown namespace", r.badNs);
        show("unknown method", r.badMethod);
        show("too few arguments", r.arity);
        console.log(
            `\nresolved through a local alias (not an error): ${r.aliasCalls.size}`,
        );
        for (const k of r.aliasCalls.keys()) console.log(`  ${k}`);
        console.log(
            `capability-probed, absent in these typings  : ${r.probed.size}`,
        );
        for (const k of r.probed.keys()) console.log(`  ${k}`);
        if (
            r.badNs.size === 0 && r.badMethod.size === 0 && r.arity.size === 0
        ) {
            console.log(
                "\nEvery host api call resolves against the public typings.",
            );
        }
        await Deno.writeTextFile(
            `${OUT_DIR}mod-api-calls.json`,
            JSON.stringify(
                {
                    total: r.calls.length,
                    wrapperCallsSkipped: r.skipped,
                    unknownNamespace: [...r.badNs.values()],
                    unknownMethod: [...r.badMethod.values()],
                    tooFewArguments: [...r.arity.values()],
                    aliasCalls: [...r.aliasCalls.values()],
                    capabilityProbed: [...r.probed.values()],
                    calls: r.calls,
                },
                null,
                2,
            ) + "\n",
        );
        console.log(`-> ${OUT_DIR}mod-api-calls.json`);
    }
}


