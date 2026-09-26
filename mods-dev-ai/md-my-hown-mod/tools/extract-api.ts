/**
 * extract-api.ts — Phase 0: build the complete sandkit api index.
 *
 * The shipped bundle is the source of truth. The mod-facing `.d.ts` files are
 * supporting contracts and have already drifted, so the index is derived from
 * the bundle and the `.d.ts` is reconciled against it afterwards.
 *
 * The api object is `const Dt = {` in `modules/bundel.js/46781.js`. It is
 * parsed structurally: the source is first masked (all string, template, regex
 * and comment content blanked out but length-preserving) so that brace and
 * paren counting cannot be fooled by content, then walked by depth.
 *
 * Usage:
 *   deno run -A tools/extract-api.ts
 *   deno run -A tools/extract-api.ts --reconcile   # also diff against the .d.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
/** mod root, with trailing slash (tools/ -> md-my-hown-mod/) */
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
/** repository root, with trailing slash (tools/ -> mod/ -> mods-dev-ai/ -> repo/) */
const REPO = HERE.replace(/\/$/, "").split("/").slice(0, -3).join("/") + "/";
const BUNDLE = `${REPO}__bundel/modules/bundel.js/46781.js`;
const OUT_DIR = `${ROOT}doc-bundel/`;

/** Object key -> ApiMethod[] (one level of nesting kept for groups like storage.local) */
export type ApiIndex = Record<string, ApiMethod[]>;

export interface ApiMethod {
    name: string;
    /** dotted path, e.g. "storage.local.get" */
    path: string;
    line: number;
    /** raw parameter list as written in the bundle, e.g. "(e, t, n)" */
    params: string;
    /** how many declared parameters, counted from the raw list */
    arity: number;
    /** first parameter is the engine context (ctx.sandkit / ctx.session / ctx.store) */
    takesContext: boolean;
    kind: "arrow" | "method" | "re-export" | "value";
    /** body contains a `throw` — the call can fail loudly */
    throws: boolean;
    /** short body excerpt, for the reference docs */
    snippet: string;
}

const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/;
/** sticky variant: only ever matches at `lastIndex` */
const IDENT_RE = /[A-Za-z_$][A-Za-z0-9_$]*/y;

/**
 * Blank out string / template / regex / comment content while preserving every
 * character offset and newline, so offsets from the masked text index straight
 * into the original.
 */
function mask(src: string): string {
    const out = src.split("");
    const n = src.length;
    let i = 0;
    // stack of template-literal nesting so `${ "}" }` stays balanced
    const tmpl: number[] = [];

    const blank = (from: number, to: number) => {
        for (let k = from; k < to && k < n; k++) {
            if (out[k] !== "\n") out[k] = " ";
        }
    };

    while (i < n) {
        const c = src[i];
        const prev = (() => {
            for (let k = i - 1; k >= 0; k--) {
                if (out[k] !== " " && out[k] !== "\n" && out[k] !== "\t") return out[k];
            }
            return "";
        })();

        // line comment
        if (c === "/" && src[i + 1] === "/") {
            let j = i;
            while (j < n && src[j] !== "\n") j++;
            blank(i, j);
            i = j;
            continue;
        }
        // block comment
        if (c === "/" && src[i + 1] === "*") {
            let j = i + 2;
            while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
            j = Math.min(n, j + 2);
            blank(i, j);
            i = j;
            continue;
        }
        // quoted string
        if (c === '"' || c === "'") {
            const quote = c;
            let j = i + 1;
            while (j < n) {
                if (src[j] === "\\") j += 2;
                else if (src[j] === quote) break;
                else j++;
            }
            j = Math.min(n, j + 1);
            blank(i, j);
            i = j;
            continue;
        }
        // template literal, with ${} interpolation
        if (c === "`" && !tmpl.length) {
            let j = i + 1;
            let depth = 0;
            while (j < n) {
                if (src[j] === "\\") {
                    j += 2;
                    continue;
                }
                if (depth === 0 && src[j] === "`") break;
                if (depth === 0 && src[j] === "$" && src[j + 1] === "{") {
                    depth = 1;
                    j += 2;
                    continue;
                }
                if (depth > 0) {
                    if (src[j] === "{") depth++;
                    else if (src[j] === "}") depth--;
                }
                j++;
            }
            j = Math.min(n, j + 1);
            blank(i, j);
            i = j;
            continue;
        }
        // regex literal — only where a value can start, otherwise it is division
        if (c === "/" && "([{,=:[!&|?+-*%^~<>;".includes(prev)) {
            let j = i + 1;
            let inClass = false;
            while (j < n) {
                if (src[j] === "\\") {
                    j += 2;
                    continue;
                }
                if (src[j] === "[") inClass = true;
                else if (src[j] === "]") inClass = false;
                else if (src[j] === "/" && !inClass) break;
                else if (src[j] === "\n") break;
                j++;
            }
            if (src[j] === "/") {
                j++;
                while (j < n && /[a-z]/.test(src[j])) j++;
                blank(i, j);
                i = j;
                continue;
            }
        }
        i++;
    }
    return out.join("");
}

/** offset -> 1-based line number */
const lineOf = (src: string, off: number) => {
    let line = 1;
    for (let i = 0; i < off && i < src.length; i++) if (src[i] === "\n") line++;
    return line;
};

/** from an opening "(" scan to the matching ")" on masked text */
function matchParen(masked: string, open: number): number {
    let depth = 0;
    for (let i = open; i < masked.length; i++) {
        if (masked[i] === "(") depth++;
        else if (masked[i] === ")") {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/** from an opening "{" scan to the matching "}" on masked text */
function matchBrace(masked: string, open: number): number {
    let depth = 0;
    for (let i = open; i < masked.length; i++) {
        if (masked[i] === "{") depth++;
        else if (masked[i] === "}") {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/** split a raw parameter list into individual parameter sources */
export function splitParams(raw: string): string[] {
    const inner = raw.replace(/^\(/, "").replace(/\)$/, "").trim();
    if (!inner) return [];
    const out: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of inner) {
        if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth--;
        if (ch === "," && depth === 0) {
            out.push(cur.trim());
            cur = "";
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

/** count declared parameters, ignoring defaults and destructuring */
export function countParams(raw: string): number {
    return splitParams(raw).length;
}

interface Frame {
    /** dotted key path of the enclosing object, e.g. ["storage", "local"] */
    path: string[];
}

/** does this expression read engine context state? */
function readsContext(body: string): boolean {
    return /\b(?:sandkit|session|store|shared)\b/.test(body) &&
        /\b[a-zA-Z_$][\w$]*\s*(?:\?|\.)/.test(body);
}

/** first parameter name, if it is a plain identifier (not a destructuring pattern) */
function firstParamName(plist: string[]): string | null {
    const first = plist[0];
    if (!first) return null;
    const head = first.split(/[:=]/)[0].trim();
    return /^[A-Za-z_$][\w$]*$/.test(head) ? head : null;
}

export function extractApi(src: string): ApiIndex {
    const masked = mask(src);
    const index: ApiIndex = {};
    const decl = masked.indexOf("const Dt = {");
    if (decl < 0) throw new Error("could not locate `const Dt = {` in the module");
    const apiOpen = masked.indexOf("{", decl);
    const apiClose = matchBrace(masked, apiOpen);
    if (apiClose < 0) throw new Error("unbalanced braces for the api object");

    // frames[0] is the api object itself; frames[1] is a namespace, and so on
    const frames: Frame[] = [{ path: [] }];
    /** namespaces deeper than this are not descended into */
    const MAX_DEPTH = 3;

    const add = (m: ApiMethod) => {
        const ns = m.path.split(".")[0];
        (index[ns] ??= []).push(m);
    };

    /** read an expression body from `from` until a top-level "," or the object close */
    const readExpression = (from: number): [string, number] => {
        let d = 0;
        let e = from;
        while (e < masked.length) {
            const c = masked[e];
            if ("([{".includes(c)) d++;
            else if (")]}".includes(c)) {
                if (d === 0) break;
                d--;
            } else if (c === "," && d === 0) break;
            e++;
        }
        return [src.slice(from, e), e];
    };

    let i = apiOpen + 1;
    /** path pushed when the next "{" is opened (set by the nested-object branch) */
    let pending: string[] | null = null;

    while (i < apiClose) {
        const ch = masked[i];

        if (ch === "{") {
            const inherit = frames[frames.length - 1].path;
            frames.push({ path: pending ?? inherit });
            pending = null;
            i++;
            continue;
        }
        if (ch === "}") {
            if (frames.length > 1) frames.pop();
            i++;
            continue;
        }
        if (ch === "(") {
            const end = matchParen(masked, i);
            i = end < 0 ? masked.length : end + 1;
            continue;
        }

        // A key is an identifier immediately followed by ":".
        // The regex is sticky so it can only match AT `i` — a plain .match()
        // would find the next identifier anywhere in the rest of the file and
        // silently capture names at the wrong offset.
        IDENT_RE.lastIndex = i;
        const m = IDENT_RE.exec(masked);
        if (!m) {
            i++;
            continue;
        }
        const name = m[0];
        const parent = frames[frames.length - 1].path;
        const line = lineOf(src, i);
        let after = i + m[0].length;
        while (after < masked.length && /[ \t\r\n]/.test(masked[after])) after++;

        // ---- method shorthand: name(a, b) { ... } — there is no `name:` key ----
        if (masked[after] === "(") {
            const close = matchParen(masked, after);
            const params = src.slice(after, close + 1);
            const bc = masked[close + 1] === "{" ? matchBrace(masked, close + 1) : close;
            const body = src.slice(close + 1, bc + 1);
            const plist = splitParams(params);
            const fp = firstParamName(plist);
            add({
                name,
                path: [...parent, name].join("."),
                line,
                params,
                arity: plist.length,
                takesContext: fp !== null && readsContext(body),
                kind: "method",
                throws: /\bthrow\b/.test(body),
                snippet: body.replace(/\s+/g, " ").trim().slice(0, 200),
            });
            i = bc + 1;
            continue;
        }

        if (masked[after] !== ":") {
            i += m[0].length;
            continue;
        }

        let v = after + 1;
        while (v < masked.length && /[ \t\r\n]/.test(masked[v])) v++;

        // ---- function value ----
        if (masked[v] === "(") {
            const close = matchParen(masked, v);
            const params = src.slice(v, close + 1);
            let k = close + 1;
            while (k < masked.length && /[ \t\r\n]/.test(masked[k])) k++;
            const isArrow = masked.slice(k, k + 2) === "=>";
            let body = "";
            // `bodyEnd` is where the whole function ends; we resume scanning
            // there so the body's braces are never mistaken for namespaces.
            let bodyEnd = close + 1;
            if (isArrow) {
                let b = k + 2;
                while (b < masked.length && /[ \t\r\n]/.test(masked[b])) b++;
                if (masked[b] === "{") {
                    const bc = matchBrace(masked, b);
                    body = src.slice(b, bc + 1);
                    bodyEnd = bc + 1;
                } else {
                    const r = readExpression(b);
                    body = r[0];
                    bodyEnd = r[1];
                }
            } else if (masked[k] === "{") {
                // method shorthand: name(a, b) { ... }
                const bc = matchBrace(masked, k);
                body = src.slice(k, bc + 1);
                bodyEnd = bc + 1;
            }
            const plist = splitParams(params);
            const fp = firstParamName(plist);
            add({
                name,
                path: [...parent, name].join("."),
                line,
                params,
                arity: plist.length,
                takesContext: fp !== null && readsContext(body),
                kind: isArrow ? "arrow" : "method",
                throws: /\bthrow\b/.test(body),
                snippet: body.replace(/\s+/g, " ").trim().slice(0, 200),
            });
            i = bodyEnd;
            continue;
        }

        // ---- nested object (namespace or group) ----
        if (masked[v] === "{") {
            if (frames.length < MAX_DEPTH) {
                pending = [...parent, name];
            }
            i = v;
            continue;
        }

        // ---- re-export, plain value, or a paren-less arrow ----
        const [expr, end] = readExpression(v);
        const flat = expr.replace(/\s+/g, " ").trim();

        // `name: e => ...` and `name: (a, b) => ...` are very common in this
        // bundle; without this they would be miscounted as plain values and
        // lose their arity entirely.
        const arrow = flat.match(
            /^(?:async\s+)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/,
        );
        if (arrow) {
            // Record the parameter list **as written**. A paren-less arrow
            // (`name: e => ...`) is stored as `e`, not `(e)`, so the value can be
            // matched literally against the source line.
            const bare = arrow[1] !== undefined ? arrow[1] : arrow[2];
            const params = arrow[1] !== undefined ? `(${arrow[1]})` : bare;
            const plist = splitParams(`(${bare})`);
            const body = flat.slice(arrow[0].length);
            const fp = firstParamName(plist);
            add({
                name,
                path: [...parent, name].join("."),
                line,
                params,
                arity: plist.length,
                takesContext: fp !== null && readsContext(body),
                kind: "arrow",
                throws: /\bthrow\b/.test(body),
                snippet: body.slice(0, 200),
            });
            i = end;
            continue;
        }

        const isRef = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(flat);
        add({
            name,
            path: [...parent, name].join("."),
            line,
            params: "",
            arity: 0,
            takesContext: false,
            kind: isRef ? "re-export" : "value",
            throws: false,
            snippet: flat.slice(0, 200),
        });
        i = end;
    }

    for (const list of Object.values(index)) {
        list.sort((a, b) => a.line - b.line);
    }
    return index;
}

// ---------------------------------------------------------------- reporting

const STATS_KINDS = ["arrow", "method", "re-export", "value"] as const;

export function summarise(index: ApiIndex) {
    const all = Object.values(index).flat();
    return {
        namespaces: Object.keys(index).length,
        entries: all.length,
        functions: all.filter((m) => m.kind === "arrow" || m.kind === "method").length,
        reExports: all.filter((m) => m.kind === "re-export").length,
        values: all.filter((m) => m.kind === "value").length,
        takesContext: all.filter((m) => m.takesContext).length,
        throws: all.filter((m) => m.throws).length,
        byKind: Object.fromEntries(
            STATS_KINDS.map((k) => [k, all.filter((m) => m.kind === k).length]),
        ) as Record<string, number>,
    };
}

function renderMarkdown(
    index: ApiIndex,
    stats: ReturnType<typeof summarise>,
    srcName: string,
): string {
    const out: string[] = [];
    out.push("# Sandkit api index");
    out.push("");
    out.push(
        `Generated from \`${srcName}\` by \`tools/extract-api.ts\`. ` +
            "**This is the Phase 0 oracle** — the mod is verified against this, " +
            "not against the `.d.ts` files.",
    );
    out.push("");
    out.push("| metric | value |");
    out.push("|---|---|");
    out.push(`| namespaces | ${stats.namespaces} |`);
    out.push(`| total entries | ${stats.entries} |`);
    out.push(`| functions | ${stats.functions} |`);
    out.push(`| re-exports | ${stats.reExports} |`);
    out.push(`| plain values | ${stats.values} |`);
    out.push(`| take a context first arg | ${stats.takesContext} |`);
    out.push(`| can \`throw\` | ${stats.throws} |`);
    out.push("");
    out.push(
        "**\`ctx\` column** is `y` when the first parameter is the engine context " +
            "object carrying `.sandkit` / `.session` / `.store` / `.shared`. That " +
            "is the calling-convention question Phase 1 has to settle.",
    );
    out.push("");
    out.push("## Namespaces");
    out.push("");
    for (const ns of Object.keys(index).sort()) {
        out.push(`- \`${ns}\` — ${index[ns].length} entries`);
    }

    for (const ns of Object.keys(index).sort()) {
        out.push("");
        out.push(`## ${ns}`);
        out.push("");
        out.push("| method | params | ctx | throws | line | notes |");
        out.push("|---|---|---|---|---|---|");
        for (const m of index[ns]) {
            const params = m.kind === "re-export" || m.kind === "value" ? "—" : `\`${m.params}\``;
            const note = m.kind === "re-export"
                ? `re-export → \`${m.snippet}\``
                : m.snippet.replace(/\|/g, "\\|").slice(0, 110);
            out.push(
                `| \`${m.name}\` | ${params} | ${m.takesContext ? "y" : ""} | ${
                    m.throws ? "yes" : ""
                } | ${m.line} | ${note} |`,
            );
        }
    }
    out.push("");
    return out.join("\n");
}

/** every `dotted.path` declared as `name(` inside a .d.ts interface body */
export async function readDeclaredPaths(
    files: string[],
): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    for (const f of files) {
        let text: string;
        try {
            text = await Deno.readTextFile(f);
        } catch {
            continue;
        }
        const re =
            /(interface\s+([A-Za-z0-9_$]+)\s*\{)|^[ \t]*([A-Za-z0-9_$]+)\s*[?]?\s*(?:<[^>]*>)?\s*\(/gm;
        let m: RegExpExecArray | null;
        let current = "";
        while ((m = re.exec(text)) !== null) {
            if (m[2]) {
                current = m[2];
                continue;
            }
            if (m[3]) found.set(`${current}.${m[3]}`, f);
        }
    }
    return found;
}

/**
 * Names that look like declared members but are not api namespace members.
 * They are React hooks, or the parameter/callback context interfaces the api
 * passes into your callbacks — not things you call on `sandkit.api`.
 */
const NOT_API = /^\.|Context$|Context\.|Options$|Writer|Console|^use[A-Z]/;

export async function findDts(): Promise<string[]> {
    const roots = [`${REPO}__pakages/`, `${REPO}__bundel/`, `${ROOT}src/`];
    const out: string[] = [];
    // A manual walk: Deno's `readDir(..., { recursive: true })` shape differs
    // across versions and the DirEntry type here has no `path` field.
    const walk = async (dir: string) => {
        let entries: Deno.DirEntry[];
        try {
            entries = await Array.fromAsync(Deno.readDir(dir));
        } catch {
            return; // directory absent — fine
        }
        for (const e of entries) {
            const p = `${dir}${e.name}`;
            if (e.isDirectory) await walk(`${p}/`);
            else if (e.name.endsWith(".d.ts")) out.push(p);
        }
    };
    for (const r of roots) await walk(r);
    return out;
}

// --------------------------------------------------------------------- main

if (import.meta.main) {
    const src = await Deno.readTextFile(BUNDLE);
    const index = extractApi(src);
    const stats = summarise(index);
    const srcName = "__bundel/modules/bundel.js/46781.js";

    await Deno.writeTextFile(
        `${OUT_DIR}api-index.json`,
        JSON.stringify({ source: srcName, stats, index }, null, 2) + "\n",
    );
    await Deno.writeTextFile(
        `${OUT_DIR}API-INDEX.md`,
        renderMarkdown(index, stats, srcName),
    );

    console.log(`namespaces   ${stats.namespaces}`);
    console.log(`entries      ${stats.entries}`);
    console.log(`functions    ${stats.functions}`);
    console.log(`re-exports   ${stats.reExports}`);
    console.log(`values       ${stats.values}`);
    console.log(`take context ${stats.takesContext}`);
    console.log(`can throw    ${stats.throws}`);
    console.log(`-> ${OUT_DIR}API-INDEX.md`);
    console.log(`-> ${OUT_DIR}api-index.json`);

    if (Deno.args.includes("--reconcile")) {
        const files = await findDts();
        const declared = await readDeclaredPaths(files);
        const known = new Set<string>();
        for (const list of Object.values(index)) {
            for (const m of list) {
                known.add(m.path);
                known.add(m.name);
            }
        }
        // Not every declared member is an api member you can call: React hooks
        // and the callback context/options interfaces the api hands to your
        // functions are declarations too. Separate them so the report is honest.
        const missing: string[] = [];
        const notApi: string[] = [];
        for (const path of declared.keys()) {
            if (known.has(path.split(".").pop()!)) continue;
            if (NOT_API.test(path)) notApi.push(path);
            else missing.push(path);
        }
        missing.sort();
        notApi.sort();
        console.log(`\n.d.ts files scanned : ${files.length}`);
        console.log(`declared members   : ${declared.size}`);
        console.log(
            `not api members    : ${notApi.length}  (React hooks, callback contexts)`,
        );
        console.log(`ABSENT from bundle : ${missing.length}`);
        for (const m of missing) console.log(`  MISSING  ${m}`);
        if (missing.length === 0) {
            console.log("  (none — every declared api member exists in the bundle)");
        }
        await Deno.writeTextFile(
            `${OUT_DIR}api-reconcile.json`,
            JSON.stringify(
                {
                    files,
                    declared: [...declared.keys()].sort(),
                    missing,
                    notApi,
                },
                null,
                2,
            ) + "\n",
        );
        console.log(`-> ${OUT_DIR}api-reconcile.json`);
    }
}
