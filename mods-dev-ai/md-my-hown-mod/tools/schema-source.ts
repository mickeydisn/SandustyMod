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

/** The files a definition may live in, and nothing else — not types, not values. */
const DEFINITION_DIR = `${ROOT}src/ui/definition`;

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
        out.push(`        /* definition: ${path} */\n        case "${tab}": {${body}\n        }`);
    }
    return out;
}

function definitionPaths(): string[] {
    const out: string[] = [];
    for (const entry of Deno.readDirSync(DEFINITION_DIR)) {
        if (!entry.isFile) continue;
        if (!entry.name.endsWith(".ts")) continue;
        if (entry.name === "types.ts" || entry.name === "values.ts") continue;
        if (entry.name === "fields.ts") continue;
        if (entry.name === "index.ts") continue;
        out.push(`${DEFINITION_DIR}/${entry.name}`);
    }
    return out.sort();
}
