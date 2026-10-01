
import { assert, assertEquals } from "https:

const TYPES = new URL(
    "../../../../../__scraped-mods/old/SandustryTypes/src/sandkit/api/",
    import.meta.url,
).pathname;


async function deprecatedNames(): Promise<string[]> {
    const out = new Set<string>();
    for (const file of [...Deno.readDirSync(TYPES)].map((e) => e.name)) {
        if (!file.endsWith(".d.ts")) continue;
        const root = file.replace(/\.d\.ts$/, "");
        const lines = (await Deno.readTextFile(`${TYPES}/${file}`)).split("\n");
        
        
        
        let inDoc = false;
        let deprecated = false;
        
        
        
        
        
        const stack: string[] = [];
        let inType = false;
        for (const line of lines) {
            if (!inDoc && /\/\*\*/.test(line)) {
                inDoc = true;
                deprecated = false;
            } else if (inDoc) {
                if (line.includes("@deprecated")) deprecated = true;
                if (/\*\
            }
            const open = line.match(/export namespace ([A-Za-z0-9_]+)/);
            if (open) {
                stack.push(open[1]);
                continue;
            }
            
            if (/export type /.test(line)) inType = true;
            if (/^\s*\}/.test(line)) {
                if (inType) {
                    if (/^\s*\};?\s*$/.test(line)) inType = false;
                } else if (stack.length > 0) stack.pop();
            }
            const m = line.match(/^\s*export function ([A-Za-z0-9_]+)/);
            if (m && deprecated) {
                
                
                
                const path = stack.length > 0 ? [...stack, m[1]] : [root, m[1]];
                out.add(path.join("."));
            }
        }
    }
    return [...out].sort();
}

const deprecated = new Set(await deprecatedNames());


const deprecatedBare = new Set([...deprecated].map((k) => k.split(".").at(-1)));


async function sourceFiles(): Promise<string[]> {
    const out: string[] = [];
    const root = new URL("../../../", import.meta.url).pathname;
    async function walk(dir: string) {
        for (const e of Deno.readDirSync(dir)) {
            const path = `${dir}/${e.name}`;
            if (e.isDirectory) await walk(path);
            else if (e.name.endsWith(".ts")) {
                
                
                if (e.name.endsWith(".generated.d.ts")) continue;
                if (e.name.endsWith(".test.ts")) continue;
                out.push(path);
            }
        }
    }
    await walk(root);
    return out;
}


function codeOnly(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\
        .replace(/\/\/[^\n]*/g, "")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

Deno.test("the deprecation list was actually derived", () => {
    
    
    assertEquals(deprecated.size, 61, "the derived deprecation list changed size");
    for (const n of ["unlockByType", "setData", "addProcessor", "removeAtCellWhenIdle"]) {
        assert(deprecatedBare.has(n), `${n} should be deprecated but is not in the list`);
    }
});

Deno.test("no source file calls a deprecated engine function", async () => {
    const hits: string[] = [];
    for (const file of await sourceFiles()) {
        const code = codeOnly(await Deno.readTextFile(file));
        
        
        
        
        
        
        
        for (const key of deprecated) {
            const segs = key.split(".").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
            if (new RegExp(`\\bapi\\s*\\.\\s*${segs.join("\\s*\\.\\s*")}\\s*\\(`).test(code)) {
                hits.push(`${file.split("src/").at(-1)}: ${key}`);
            }
        }
    }
    assertEquals(
        hits,
        [],
        `deprecated engine api called:\n  ${hits.join("\n  ")}\n` +
            "See HandlerAction.md §9 for the current replacement.",
    );
});
