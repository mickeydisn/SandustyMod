/**
 * Inventory of the engine's main-thread api, and of our own handler registries.
 *
 * Two questions, two different techniques:
 *
 *  1. The engine (`--engine`). Counts only `export function` that is NOT
 *     immediately preceded by `@deprecated`, so the output is the API a new mod
 *     should actually call. A regex is right here: the `@deprecated` tag sits on
 *     the JSDoc block directly above the declaration.
 *
 *  2. Our handlers (`--handlers`). This one IMPORTS the registries instead,
 *     because a regex is not good enough — a pass over handlers.ts matched `if`
 *     blocks and doc strings and reported 80 actions where there are 39.
 *
 * See HandlerAction.md for what the numbers mean.
 */
const TYPES = new URL(
    "../../../__scraped-mods/old/SandustryTypes/src/sandkit/api/",
    import.meta.url,
).pathname;

/** `namespace.fn` for every non-deprecated `export function`, with a count per namespace. */
async function engine() {
    const names: string[] = [];
    const perNamespace: Record<string, number> = {};
    for (const file of [...Deno.readDirSync(TYPES)].map((e) => e.name).sort()) {
        if (!file.endsWith(".d.ts")) continue;
        const ns = file.replace(/\.d\.ts$/, "");
        const lines = (await Deno.readTextFile(`${TYPES}/${file}`)).split("\n");
        // A JSDoc block owns its own @deprecated tag, so the flag is scoped to the
        // block rather than carried across lines: reset when a block *starts*, set
        // when the tag appears, and read it at the declaration. Resetting on the
        // closing `*/` instead would clear it one line too early and count every
        // deprecated function as current — which is exactly what it did.
        let inDoc = false;
        let deprecated = false;
        for (const line of lines) {
            if (!inDoc && /\/\*\*/.test(line)) {
                inDoc = true;
                deprecated = false;
            } else if (inDoc) {
                if (line.includes("@deprecated")) deprecated = true;
                if (/\*\//.test(line)) inDoc = false;
            }
            const m = line.match(/^\s*export function ([A-Za-z0-9_]+)/);
            if (!m) continue;
            if (deprecated) continue;
            names.push(`${ns}.${m[1]}`);
            perNamespace[ns] = (perNamespace[ns] ?? 0) + 1;
        }
    }
    console.log(`current api functions: ${names.length}`);
    const top = Object.entries(perNamespace).sort((a, b) => b[1] - a[1]);
    console.log(`namespaces with functions: ${top.length}`);
    console.log("  " + top.map(([n, c]) => `${n}(${c})`).join(" "));
}

/** Our three registries, imported, plus the class map's agreement with them. */
async function handlers() {
    globalThis.sandkit = {
        api: new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) }),
        enums: {},
    };
    const h = await import("../src/hooks/handlers.ts");
    const sets: Record<string, Record<string, unknown>> = {
        ANY_HANDLERS: h.ANY_HANDLERS,
        PROCESS_HANDLERS: h.PROCESS_HANDLERS,
        CODE_HANDLERS: h.CODE_HANDLERS,
    };
    const all = new Set<string>();
    for (const [n, r] of Object.entries(sets)) {
        const keys = Object.keys(r);
        for (const k of keys) all.add(k);
        console.log(`${n} ${keys.length}`);
        console.log("  " + keys.join(", "));
    }
    console.log(`TOTAL_UNIQUE ${all.size}`);
    const { ACTION_CLASSES } = await import("../src/hooks/action-class.ts");
    const counts: Record<string, number> = {};
    for (const c of Object.values(ACTION_CLASSES)) counts[c] = (counts[c] ?? 0) + 1;
    console.log("CLASSES " + JSON.stringify(counts) + " sum " + Object.keys(ACTION_CLASSES).length);
    console.log("NOT_CLASSIFIED " + [...all].filter((k) => !(k in ACTION_CLASSES)).join(","));
    console.log(
        "CLASSED_BUT_ABSENT " + Object.keys(ACTION_CLASSES).filter((k) => !all.has(k)).join(","),
    );
}

const arg = Deno.args[0];
if (arg === "--engine") await engine();
else await handlers();
globalThis.sandkit = {
    api: new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) }),
    enums: {},
};
const h = await import("../src/hooks/handlers.ts");
const sets: Record<string, Record<string, unknown>> = {
    ANY_HANDLERS: h.ANY_HANDLERS,
    PROCESS_HANDLERS: h.PROCESS_HANDLERS,
    CODE_HANDLERS: h.CODE_HANDLERS,
};
const all = new Set<string>();
for (const [n, r] of Object.entries(sets)) {
    const keys = Object.keys(r);
    for (const k of keys) all.add(k);
    console.log(n, keys.length);
    console.log("  " + keys.join(", "));
}
console.log("TOTAL_UNIQUE", all.size);
const { ACTION_CLASSES } = await import("../src/hooks/action-class.ts");
const counts: Record<string, number> = {};
for (const c of Object.values(ACTION_CLASSES)) counts[c] = (counts[c] ?? 0) + 1;
console.log("CLASSES", JSON.stringify(counts), "sum", Object.keys(ACTION_CLASSES).length);
const missing = [...all].filter((k) => !(k in ACTION_CLASSES));
console.log("NOT_CLASSIFIED", missing.length, missing.join(", "));
const extra = Object.keys(ACTION_CLASSES).filter((k) => !all.has(k));
console.log("CLASSED_BUT_ABSENT", extra.length, extra.join(", "));
