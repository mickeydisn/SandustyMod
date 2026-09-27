/**
 * The schema source, as the text parsers in this folder need to see it.
 *
 * `ui-completeness.ts` and `gen-reference.ts` read `formToEntry` as *text* rather
 * than running it, because the thing they want is not what a control produces but
 * which stored key each control can write. That is a static question, and running
 * the code would answer a different one.
 *
 * The problem is that a per-object definition no longer lives inside
 * `schema.ts`: `case "structures"` moved to `src/ui/definition/structure.ts` with
 * everything else about structures. So a parser pointed at `schema.ts` alone now
 * reports structures as exposing *no* fields — silently, and in a generated
 * document nobody reads closely enough to notice.
 *
 * So each definition's `formToEntry` is re-attached here under a synthetic
 * `case "<tab>"` header, and the parsers see the same shape they always did. The
 * alternative — rewriting the parsers to understand the definition format — would
 * make them depend on that format, which is the coupling this is trying to avoid.
 */

const ROOT = new URL("../", import.meta.url).pathname;

/** The two folders a definition may live in, and nothing else. */
const DEFINITION_DIRS = [
    `${ROOT}src/ui/definition/core`,
    `${ROOT}src/ui/definition/custom`,
];

/**
 * Files in a directory that are not definitions themselves.
 *
 * These four sit in the *parent* of `core/` and `custom/`, so they are not
 * candidates in the first place — but they are listed here so that the skip is
 * a property of the walk rather than an accident of where the shared files
 * happen to sit. Should one ever move down here, it would otherwise be read as
 * a definition and reported as a tab with no fields.
 */
const NOT_DEFINITIONS = new Set(["types.ts", "values.ts", "fields.ts", "index.ts"]);

/**
 * The body of a `function <name>(` declaration, braces balanced.
 *
 * Deliberately a brace counter rather than a regex: the bodies contain nested
 * object literals, template strings and comments, all of which a regex gets
 * wrong, and a truncation here reads as "this tab has no fields" rather than as
 * an error.
 */
function bodyOf(src: string, decl: RegExp): string | null {
    const m = decl.exec(src);
    if (!m) return null;
    const open = src.indexOf("{", m.index + m[0].length - 1);
    if (open === -1) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
            depth--;
            if (depth === 0) return src.slice(open + 1, i);
        }
    }
    return null;
}

/**
 * A definition's top-level string-array constants, as declarations.
 *
 * A definition is allowed to name a list it loops over — `const FLAGS = ["a","b"]`
 * — which is better source than repeating the literal in both directions of the
 * round trip. But the readers work on the *spliced* text, and a module-level
 * constant is not inside `formToEntry`'s braces, so a loop over it would resolve
 * to nothing and every field in the list would read as storing nothing.
 *
 * So the constants travel with the body. Only string arrays, only top-level:
 * those are the ones a loop can iterate and a reader can resolve.
 */
function constDeclsOf(src: string): string {
    return [...src.matchAll(/^const\s+[A-Z_][A-Z_0-9]*\s*=\s*\[[^\]]*\];/gm)]
        .map((m) => m[0])
        .join("\n");
}

/**
 * `schema.ts` plus every definition's `formToEntry`, keyed to its own tab.
 *
 * Returned as one string because that is what the existing parsers take. The
 * definition bodies are spliced in **inside** `formToEntry`'s braces, not
 * appended after them: both parsers bound their search with the next
 * line-initial `}`, so a block appended after the function's own closing brace
 * would be sliced off and the tab would report zero fields — silently, in a
 * generated document. Splicing keeps "one `formToEntry` per tab" true as a
 * property of the text the parsers actually see.
 */
export function schemaSourceWithDefinitions(): string {
    const src = Deno.readTextFileSync(`${ROOT}src/ui/schema.ts`);
    const blocks = definitionBlocks();
    if (blocks.length === 0) return src;
    const start = src.indexOf("export function formToEntry");
    if (start === -1) {
        throw new Error(
            "schema.ts has no formToEntry — ui-completeness and gen-reference have " +
                "nothing to read.",
        );
    }
    // The switch's closing brace, two lines up from the function's own: the body
    // ends with `}\n    }\n}`.
    const fnEnd = src.indexOf("\n}", start);
    if (fnEnd === -1) return src;
    const switchEnd = src.lastIndexOf("}", fnEnd);
    if (switchEnd <= start) return src;
    return src.slice(0, switchEnd) + "\n" + blocks.join("\n") + src.slice(switchEnd);
}

function definitionBlocks(): string[] {
    const out: string[] = [];
    for (const path of definitionPaths()) {
        const src = Deno.readTextFileSync(path);
        // The tab is a property of the definition, not of its filename, so read
        // it from the declaration and fall back to the stem.
        const tab = src.match(/tab:\s*"(\w+)"/)?.[1] ??
            path.split("/").pop()!.replace(/\.ts$/, "");
        const body = bodyOf(src, /function\s+formToEntry\s*\(/);
        if (!body) {
            throw new Error(
                `${path} has no formToEntry body — ui-completeness and gen-reference ` +
                    "would silently lose this tab. Either give it a formToEntry or " +
                    "stop expecting one here.",
            );
        }
        const consts = constDeclsOf(src);
        out.push(
            `        /* definition: ${path} */\n        case "${tab}": {` +
                (consts ? `\n${consts}` : "") + body +
                "\n        }",
        );
    }
    return out;
}

/**
 * Every definition file, in both ownership folders.
 *
 * The folders are listed explicitly rather than discovered with `readDirSync`,
 * because this function's failure mode is *silent*: a directory it fails to read
 * contributes no paths, every tab in it reports zero fields, and the result is a
 * generated document that is confidently wrong rather than an error. Naming the
 * two folders makes a third one ("draft", "deprecated") a change someone has to
 * make here, where the next reader sees the list, instead of a file that quietly
 * stops being reported on.
 *
 * `core` sorts before `custom`, so a path's position is stable across runs and
 * the generated output does not churn.
 */
function definitionPaths(): string[] {
    const out: string[] = [];
    for (const dir of DEFINITION_DIRS) {
        for (const entry of Deno.readDirSync(dir)) {
            if (!entry.isFile) continue;
            if (!entry.name.endsWith(".ts")) continue;
            if (NOT_DEFINITIONS.has(entry.name)) continue;
            out.push(`${dir}/${entry.name}`);
        }
    }
    if (out.length === 0) {
        throw new Error(
            "no definition files found in core/ or custom/ — ui-completeness and " +
                "gen-reference would report every tab as having no fields, silently.",
        );
    }
    return out.sort();
}
