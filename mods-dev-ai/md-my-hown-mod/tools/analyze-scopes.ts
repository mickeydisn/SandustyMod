



type Hits = { payload: Set<string>; ctx: Set<string>; api: Set<string> };


function probe(into: Set<string>, prefix = ""): unknown {
    return new Proxy(function () {} as object, {
        get(_t, prop) {
            if (typeof prop === "symbol") return undefined;
            const path = `${prefix}${String(prop)}`;
            into.add(path);
            return probe(into, `${path}.`);
        },
        apply() {
            
            
            
            
            
            const method = prefix.endsWith(".") ? prefix.slice(0, -1) : prefix;
            
            
            if (method.endsWith("getMouseCellPosition")) return { x: 0, y: 0 };
            
            
            if (method.endsWith("getDataAtCell")) return { hitPoints: 0 };
            return undefined;
        },
        set() {
            return true;
        },
    });
}

function measure(
    fn: (p: unknown, c: unknown, o: unknown) => unknown,
    valid?: Record<string, unknown>,
): {
    hits: Hits;
    noCtxApi: Set<string>;
    returnsObject: boolean;
    threw: boolean;
} {
    const hits: Hits = { payload: new Set(), ctx: new Set(), api: new Set() };
    
    
    
    const noCtxApi = new Set<string>();
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    (globalThis as { sandkit?: unknown }).sandkit = probe(hits.api, "api.");
    let threw = false;
    let returned: unknown;
    
    
    
    
    
    
    const run = (o: unknown) => fn(probe(hits.payload), probe(hits.ctx), o);
    const runNoCtx = (o: unknown) => fn(probe(new Set()), null, o);
    try {
        returned = run(probe(new Set(), "options."));
        if (valid) run(valid);
    } catch {
        threw = true;
    } finally {
        (globalThis as { sandkit?: unknown }).sandkit = probe(noCtxApi, "api.");
        try {
            runNoCtx(probe(new Set(), "options."));
            if (valid) runNoCtx(valid);
        } catch {
            
        }
        console.log = log;
        console.warn = warn;
        delete (globalThis as { sandkit?: unknown }).sandkit;
    }
    return {
        hits,
        noCtxApi,
        returnsObject: returned !== null && typeof returned === "object",
        threw,
    };
}




const CALL_SITE_PROVIDES: Record<
    string,
    { pos: boolean; data: boolean; read: boolean; commit: boolean }
> = {
    
    
    signal: { pos: true, data: true, read: true, commit: false },
    
    
    trigger: { pos: false, data: false, read: true, commit: false },
    
    processing: { pos: true, data: true, read: true, commit: true },
    
    
    
    itemAction: { pos: true, data: true, read: true, commit: false },
    
    projectile: { pos: false, data: false, read: false, commit: false },
    
    upgrade: { pos: false, data: true, read: true, commit: false },
    
    behavior: { pos: false, data: false, read: true, commit: false },
    
    modifier: { pos: true, data: true, read: true, commit: false },
};



const AMBIENT_CELL_READS = [
    "getResolvedTypeAtCell",
    "isCellEmptyAtCell",
    "getDataAtCell",
];

function needsOf(h: Hits, noCtxApi: Set<string>): {
    pos: boolean;
    data: boolean;
    read: boolean;
    commit: boolean;
} {
    const top = new Set([...h.payload].map((p) => p.split(".")[0]));
    const ambient = [...noCtxApi].some((p) =>
        AMBIENT_CELL_READS.some((leaf) => p.endsWith(`.${leaf}`))
    );
    return {
        pos: top.has("x") || top.has("y"),
        data: top.has("data"),
        read: h.ctx.size > 0 && ambient,
        commit: h.ctx.size > 0 && !ambient,
    };
}

const sat = (need: boolean, gives: boolean) => !need || gives;








const { HANDLER_META } = await import("../src/handler/core/handler-registry.ts");
const { resolveAction } = await import("../src/handler/core/process.ts");



const { VALID_OPTIONS } = await import("../src/handler/core/action-class.ts");

interface Row {
    key: string;
    declared: string[];
    needs: { pos: boolean; data: boolean; read: boolean; commit: boolean };
    api: string;
    derived: string[];
    bad: string[];
}

const rows: Row[] = [];
for (const m of HANDLER_META) {
    const fn = resolveAction(m.key);
    if (!fn) continue;
    const r = measure(fn, VALID_OPTIONS[m.key]);
    const needs = needsOf(r.hits, r.noCtxApi);
    const api = r.hits.api.size ? [...r.hits.api][0].split(".")[1] ?? "?" : "-";

    
    
    const derived = Object.entries(CALL_SITE_PROVIDES)
        .filter(([, g]) =>
            sat(needs.pos, g.pos) && sat(needs.data, g.data) &&
            sat(needs.read, g.read) && sat(needs.commit, g.commit)
        )
        .map(([slot]) => slot);

    
    
    
    const bad = m.slots.filter((s) => !derived.includes(s));
    rows.push({ key: m.key, declared: [...m.slots], needs, api, derived, bad });
}



const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
const need = (n: Row["needs"]) =>
    [n.pos && "pos", n.data && "data", n.read && "read", n.commit && "commit"]
        .filter(Boolean)
        .join("+") || "-";
console.log(
    pad("action", 30) + pad("needs", 12) + pad("api", 8) + pad("declared", 30) + "verdict",
);
console.log("-".repeat(96));
for (const r of rows) {
    const verdict = r.bad.length ? `CANNOT RUN on ${r.bad.join(", ")}` : "";
    console.log(
        pad(r.key, 30) + pad(need(r.needs), 12) + pad(r.api, 8) +
            pad(r.declared.join(", "), 30) + verdict,
    );
}

const broken = rows.filter((r) => r.bad.length);
console.log(`\n${rows.length} actions measured, ${broken.length} unservable.`);
if (broken.length) {
    console.log(`\n${broken.length} are OFFERED in a slot the engine cannot serve:`);
    for (const r of broken) {
        console.log(`  ${r.key} needs ${need(r.needs)}; ${r.bad.join("/")} delivers less.`);
    }
}
console.log(
    `\n${
        rows.filter((r) => r.api !== "-").length
    } call api.* — ambient on globalThis, so it costs no scope.`,
);



const byNeed = new Map<string, string[]>();
for (const r of rows) {
    const k = need(r.needs);
    byNeed.set(k, [...(byNeed.get(k) ?? []), r.key]);
}
console.log(`\n── ACTION_SCOPE, grouped by need signature ──`);
for (const [k, keys] of [...byNeed].sort()) {
    const needList = k === "-" ? [] : k.split("+");
    console.log(`    
    console.log(
        `    ${keys.map((n) => JSON.stringify(n)).join(", ")}: [${
            needList.map((n) => JSON.stringify(n)).join(", ")
        }],`,
    );
}
