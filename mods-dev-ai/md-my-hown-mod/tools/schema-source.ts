

const ROOT = new URL("../", import.meta.url).pathname;


const DEFINITION_DIRS = [
    `${ROOT}src/ui/definition/core`,
    `${ROOT}src/ui/definition/custom`,
];


const NOT_DEFINITIONS = new Set(["types.ts", "values.ts", "fields.ts", "index.ts"]);


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


function constDeclsOf(src: string): string {
    return [...src.matchAll(/^const\s+[A-Z_][A-Z_0-9]*\s*=\s*\[[^\]]*\];/gm)]
        .map((m) => m[0])
        .join("\n");
}


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
            `        \n        case "${tab}": {` +
                (consts ? `\n${consts}` : "") + body +
                "\n        }",
        );
    }
    return out;
}


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
