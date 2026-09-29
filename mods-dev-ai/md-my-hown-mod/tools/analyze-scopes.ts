/**
 * WHAT EACH ACTION ACTUALLY TOUCHES — measured, not declared.
 *
 * Run with:  deno run -A tools/analyze-scopes.ts
 *
 * This is the evidence for the scope redesign in PLAN.md. The question it answers
 * is: *for every (action, call site) pair the registry currently offers, does the
 * engine actually hand that action what it reads?*
 *
 * The probe is the same one `action-class.ts` uses — recording proxies plus a
 * silenced console — so a result here and a class there cannot disagree about
 * what an action touched.
 */

// ── probe ────────────────────────────────────────────────────────────────────

type Hits = { payload: Set<string>; ctx: Set<string>; api: Set<string> };

/**
 * A proxy that records every property read and answers a nested one.
 *
 * The `apply` trap is the part that matters, and it is not "return undefined". Two
 * engine members are **functions that must answer with a value** for the code under
 * test to proceed at all:
 *
 *   - `api.input.getMouseCellPosition()` — the cursor. `anchorFor` falls back to it
 *     whenever a payload has no `x`, and returns "no anchor" when it cannot read one.
 *     A walk that cannot resolve an anchor refuses before it reaches the grid, so a
 *     probe answering `undefined` here measures the *refusal*, not the action.
 *   - `api.terrains.getDataAtCell(x, y)` — `logicSum`'s only number source.
 *
 * A generic `undefined` made the four read-only walks report `["pos"]` while
 * `scope.test.ts` — whose probe does answer — reported `["pos", "read"]`. Two
 * measurement tools disagreeing is worse than either being slightly wrong, so the
 * cursor is answered with a real cell here too.
 */
function probe(into: Set<string>, prefix = ""): unknown {
    return new Proxy(function () {} as object, {
        get(_t, prop) {
            if (typeof prop === "symbol") return undefined;
            const path = `${prefix}${String(prop)}`;
            into.add(path);
            return probe(into, `${path}.`);
        },
        apply() {
            // The `prefix` on this level ends with a `.` — `get` hands the child a
            // prefix of `"api.input.getMouseCellPosition."` — so it is trimmed before
            // the name is compared. Getting this wrong is silent: the method is read
            // and recorded, then answers `undefined`, and the measurement quietly
            // describes the action's *refusal* instead of its behaviour.
            const method = prefix.endsWith(".") ? prefix.slice(0, -1) : prefix;
            // A real cell, so an action that resolves its position by cursor — which is
            // every cell action on an item use — gets an anchor instead of a refusal.
            if (method.endsWith("getMouseCellPosition")) return { x: 0, y: 0 };
            // No terrain anywhere: 0 rather than `undefined`, so `logicSum` reaches its
            // reduction instead of reporting "no value" for every cell.
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
    // The ambient surface reached on a second run with **no** context, which is what
    // decides `read` vs `commit` in `needsOf` below. Kept separate from `hits.api` so the
    // reported namespace is still the one from the normal, context-carrying run.
    const noCtxApi = new Set<string>();
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    (globalThis as { sandkit?: unknown }).sandkit = probe(hits.api, "api.");
    let threw = false;
    let returned: unknown;
    // An action that **validates** its options cannot be driven by a proxy answering
    // "defined" to every field: the five range walks would read `mx` as set and `dx` as
    // 1, report a conflict, and return before reaching the engine. So they are also run
    // with a real, valid bag — the same `VALID_OPTIONS` the class probe and
    // `scope.test.ts` use, because a measurement tool that disagrees with the test it
    // is meant to check is worse than no tool.
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
            // Not a real path — every action is wrapped — and it reached nothing more.
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

// ── the model under test ─────────────────────────────────────────────────────

/**
 * What each call site actually delivers. This is the **provider** half of the
 * scope model, and every row is read off the engine rather than assumed:
 * `CALL_SITE_SIGNATURES` in process.ts, and the registration code in
 * `mysandkit.ts` / `apply.ts`.
 */
const CALL_SITE_PROVIDES: Record<
    string,
    { pos: boolean; data: boolean; read: boolean; commit: boolean }
> = {
    // handler(structure) — a placed structure: x, y and .data. Reading a cell is
    // ambient (`api.elements.getResolvedTypeAtCell`), so `read` is true everywhere.
    signal: { pos: true, data: true, read: true, commit: false },
    // callback() — the engine passes NOTHING. `extra` is in the *registration*,
    // so it is the config's, not the engine's. See registerTrigger.
    trigger: { pos: false, data: false, read: true, commit: false },
    // process(structure, context) — the only site with a `commit`.
    processing: { pos: true, data: true, read: true, commit: true },
    // handleAction(state, action) — the cursor cell. `api.input.getMouseCellPosition()`
    // is ambient (`input.d.ts:37`), so an item use DOES have a position. This row said
    // `pos: false`, which is what stopped a Tool from digging.
    itemAction: { pos: true, data: true, read: true, commit: false },
    // getOptions() — nothing; it is a factory, and its *return* is the payload
    projectile: { pos: false, data: false, read: false, commit: false },
    // onUpgrade(item) — an item instance
    upgrade: { pos: false, data: true, read: true, commit: false },
    // onDownKey(key) — a key code
    behavior: { pos: false, data: false, read: true, commit: false },
    // intercept/modify(args, ctx) — whatever the hook chose to pass
    modifier: { pos: true, data: true, read: true, commit: false },
};

/**
 * What an action reads, collapsed from the recorded top-level payload paths.
 *
 * The `read` / `commit` split is decided the same way `scope.test.ts` decides it, and
 * **not** by which context members were read. Reading `ctx.getResolvedTypeAtCell` does
 * not make an action context-bound: `readElement` does that *and* calls
 * `api.elements.getResolvedTypeAtCell`, which is ambient, so it runs anywhere.
 *
 * So this asks about the second run — what the action could still reach with no context
 * at all — and checks whether it reached a cell reader. The names are **leaves** because
 * `hostNs("elements")` walks one segment at a time through a namespace this codebase
 * cannot type, so the proxy records `api.elements` and then `api.getResolvedTypeAtCell`
 * on the next read; matching a dotted path here would match nothing.
 */
/**
 * The engine's ambient per-cell accessors.
 *
 * A name list because a name list is the only thing that can tell a **read** from a
 * **write** here: `createElement` also reaches `api.grid.mutate` with no context in
 * sight, so "reached some api" would score it `read` and quietly drop the `commit`
 * need that is the entire reason it exists. `getDataAtCell` is the terrain family's
 * ambient accessor, here for `logicSum`; it is the same category as the element and
 * grid readers — a top-level function on an ordinary `api.*` namespace, callable
 * from any call site, which is exactly what `ctx.commit` is not.
 */
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

// ── run ──────────────────────────────────────────────────────────────────────

// `handler/`, not the `hooks/` this used to import. The directory was renamed when the
// modifier slot became a call site rather than a category of behaviour, and this tool was
// left pointing at the old path — so the one thing a *measurement* tool must never do is
// quietly stop running. `scope.test.ts` re-derives the same table and fails when the two
// disagree, so a broken import here means the table can no longer be regenerated at all.
const { HANDLER_META } = await import("../src/handler/core/handler-registry.ts");
const { resolveAction } = await import("../src/handler/core/process.ts");
// The same valid-options table the class probe and `scope.test.ts` use, for the same
// reason: an action that validates its options cannot be driven by a proxy that answers
// "defined" to every field. Three probes and one table, so no two of them can disagree.
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

    // A process may offer an action whatever the call site actually delivers, and
    // nothing else. This is the whole of the scope rule.
    const derived = Object.entries(CALL_SITE_PROVIDES)
        .filter(([, g]) =>
            sat(needs.pos, g.pos) && sat(needs.data, g.data) &&
            sat(needs.read, g.read) && sat(needs.commit, g.commit)
        )
        .map(([slot]) => slot);

    // The bug that matters: a slot the registry *offers* this action, where the
    // engine hands it something it does not read. That is the action silently doing
    // nothing at runtime — the worst failure mode, because nothing errors.
    const bad = m.slots.filter((s) => !derived.includes(s));
    rows.push({ key: m.key, declared: [...m.slots], needs, api, derived, bad });
}

// ── report ───────────────────────────────────────────────────────────────────

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

// ── emit ─────────────────────────────────────────────────────────────────────
// Grouped by need signature, which is how the panel will group them.
const byNeed = new Map<string, string[]>();
for (const r of rows) {
    const k = need(r.needs);
    byNeed.set(k, [...(byNeed.get(k) ?? []), r.key]);
}
console.log(`\n── ACTION_SCOPE, grouped by need signature ──`);
for (const [k, keys] of [...byNeed].sort()) {
    const needList = k === "-" ? [] : k.split("+");
    console.log(`    // needs ${k}`);
    console.log(
        `    ${keys.map((n) => JSON.stringify(n)).join(", ")}: [${
            needList.map((n) => JSON.stringify(n)).join(", ")
        }],`,
    );
}
