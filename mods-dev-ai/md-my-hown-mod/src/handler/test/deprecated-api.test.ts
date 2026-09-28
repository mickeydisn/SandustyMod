/**
 * No deprecated engine api may be called from the build.
 *
 * The engine marks 61 of its functions `@deprecated`, and most of them are the
 * *obvious* choice to reach for — `elements.removeAtCellWhenIdle`,
 * `structures.setData`, `player.buildings.unlockByType`. We used one of them, and
 * the mod still worked, so nothing in the game would have told us. This test is
 * the thing that tells us.
 *
 * The list is derived from the type files rather than hand-written, so it cannot
 * drift. See HandlerAction.md §9.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TYPES = new URL(
    "../../../../../__scraped-mods/old/SandustryTypes/src/sandkit/api/",
    import.meta.url,
).pathname;

/**
 * Every function whose JSDoc block carries `@deprecated`, as its full dotted path.
 *
 * The path must include **nested** namespaces, not just the file. `player.d.ts`
 * declares both `player` and `player.buildings`, and the deprecated call is
 * `player.buildings.unlockByType` — keying that by file name alone gives
 * `player.unlockByType`, which the call-site match then never finds. A guard that
 * silently cannot see the one real violation we had is worse than no guard.
 */
async function deprecatedNames(): Promise<string[]> {
    const out = new Set<string>();
    for (const file of [...Deno.readDirSync(TYPES)].map((e) => e.name)) {
        if (!file.endsWith(".d.ts")) continue;
        const root = file.replace(/\.d\.ts$/, "");
        const lines = (await Deno.readTextFile(`${TYPES}/${file}`)).split("\n");
        // The tag is scoped to its own JSDoc block, so the flag resets when a
        // block *opens*. Resetting on the closing `*/` instead clears it one line
        // early and marks every function current — which is what it did.
        let inDoc = false;
        let deprecated = false;
        // `export namespace x {` opens a level and `}` closes one. The stack starts
        // empty because the outermost namespace repeats the file name, and a pop
        // only happens at a `}` that closes a *declaration* — never at the `}` of
        // an inline object type, which is what stripped the namespace off the
        // first dozen entries (`WhenIdle` came out bare).
        const stack: string[] = [];
        let inType = false;
        for (const line of lines) {
            if (!inDoc && /\/\*\*/.test(line)) {
                inDoc = true;
                deprecated = false;
            } else if (inDoc) {
                if (line.includes("@deprecated")) deprecated = true;
                if (/\*\//.test(line)) inDoc = false;
            }
            const open = line.match(/export namespace ([A-Za-z0-9_]+)/);
            if (open) {
                stack.push(open[1]);
                continue;
            }
            // `type X = {` … `};` — braces here belong to a type, not the namespace.
            if (/export type /.test(line)) inType = true;
            if (/^\s*\}/.test(line)) {
                if (inType) {
                    if (/^\s*\};?\s*$/.test(line)) inType = false;
                } else if (stack.length > 0) stack.pop();
            }
            const m = line.match(/^\s*export function ([A-Za-z0-9_]+)/);
            if (m && deprecated) {
                // The stack can be empty when a multi-line `export type` brace ran
                // the pop early. The file name is then the namespace, since the
                // outermost declaration in every file has exactly that name.
                const path = stack.length > 0 ? [...stack, m[1]] : [root, m[1]];
                out.add(path.join("."));
            }
        }
    }
    return [...out].sort();
}

const deprecated = new Set(await deprecatedNames());

/** The bare names, for the sanity assertions. */
const deprecatedBare = new Set([...deprecated].map((k) => k.split(".").at(-1)));

/** Every `.ts` under `src/`, minus generated stubs and tests. */
async function sourceFiles(): Promise<string[]> {
    const out: string[] = [];
    const root = new URL("../../../", import.meta.url).pathname;
    async function walk(dir: string) {
        for (const e of Deno.readDirSync(dir)) {
            const path = `${dir}/${e.name}`;
            if (e.isDirectory) await walk(path);
            else if (e.name.endsWith(".ts")) {
                // Generated stubs *describe* the old api in bulk. They are not
                // calls, and scanning them would report hundreds of false hits.
                if (e.name.endsWith(".generated.d.ts")) continue;
                if (e.name.endsWith(".test.ts")) continue;
                out.push(path);
            }
        }
    }
    await walk(root);
    return out;
}

/** Source with comments and string/template literals blanked. */
function codeOnly(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

Deno.test("the deprecation list was actually derived", () => {
    // If this dropped to 0 the walk broke and the test below would pass
    // *vacuously* — the failure mode a guard test is most prone to.
    assertEquals(deprecated.size, 61, "the derived deprecation list changed size");
    for (const n of ["unlockByType", "setData", "addProcessor", "removeAtCellWhenIdle"]) {
        assert(deprecatedBare.has(n), `${n} should be deprecated but is not in the list`);
    }
});

Deno.test("no source file calls a deprecated engine function", async () => {
    const hits: string[] = [];
    for (const file of await sourceFiles()) {
        const code = codeOnly(await Deno.readTextFile(file));
        // Matched as `api.<namespace>.<fn>(`, namespace included. A bare name is
        // not enough: `ui.register` is deprecated while `structures.register` is
        // the primary registration call, and matching the name alone reported
        // both. The namespace is escaped **per segment** — `player.buildings` is
        // two segments, and `String.replace` with a string pattern replaces only
        // the first occurrence, so the second dot stayed unescaped and matched
        // any character.
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
