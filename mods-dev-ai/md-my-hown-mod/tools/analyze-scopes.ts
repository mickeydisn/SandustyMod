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

/** A proxy that records every top-level property read and answers a nested one. */
function probe(into: Set<string>, prefix = ""): unknown {
    return new Proxy(function () {} as object, {
        get(_t, prop) {
            if (typeof prop === "symbol") return undefined;
            const path = `${prefix}${String(prop)}`;
            into.add(path);
            return probe(into, `${path}.`);
        },
        apply() {
            return undefined;
        },
        set() {
            return true;
        },
    });
}

function measure(fn: (p: unknown, c: unknown, o: unknown) => unknown): {
    hits: Hits;
    returnsObject: boolean;
    threw: boolean;
} {
    const hits: Hits = { payload: new Set(), ctx: new Set(), api: new Set() };
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    (globalThis as { sandkit?: unknown }).sandkit = probe(hits.api, "api.");
    let threw = false;
    let returned: unknown;
    try {
        returned = fn(probe(hits.payload), probe(hits.ctx), probe(new Set(), "options."));
    } catch {
        threw = true;
    } finally {
        console.log = log;
        console.warn = warn;
        delete (globalThis as { sandkit?: unknown }).sandkit;
    }
    return {
        hits,
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
const CALL_SITE_PROVIDES: Record<string, { pos: boolean; data: boolean; cell: boolean }> = {
    // handler(structure) — a placed structure: x, y and .data
    signal: { pos: true, data: true, cell: false },
    // callback() — the engine passes NOTHING. `extra` is in the *registration*,
    // so it is the config's, not the engine's. See registerTrigger.
    trigger: { pos: false, data: false, cell: false },
    // process(structure, context) — everything
    processing: { pos: true, data: true, cell: true },
    // handleAction(state, action) — an item instance
    itemAction: { pos: false, data: true, cell: false },
    // getOptions() — nothing; it is a factory, and its *return* is the payload
    projectile: { pos: false, data: false, cell: false },
    // onUpgrade(item) — an item instance
    upgrade: { pos: false, data: true, cell: false },
    // onDownKey(key) — a key code
    behavior: { pos: false, data: false, cell: false },
    // intercept/modify(args, ctx) — whatever the hook chose to pass
    modifier: { pos: true, data: true, cell: true },
};

/** What an action reads, collapsed from the recorded top-level payload paths. */
function needsOf(h: Hits): { pos: boolean; data: boolean; cell: boolean } {
    const top = new Set([...h.payload].map((p) => p.split(".")[0]));
    return {
        pos: top.has("x") || top.has("y"),
        data: top.has("data"),
        cell: h.ctx.size > 0,
    };
}

const sat = (need: boolean, gives: boolean) => !need || gives;

// ── run ──────────────────────────────────────────────────────────────────────

const { HANDLER_META } = await import("../src/hooks/handler-registry.ts");
const { resolveAction } = await import("../src/hooks/process.ts");

interface Row {
    key: string;
    declared: string[];
    needs: { pos: boolean; data: boolean; cell: boolean };
    api: string;
    derived: string[];
    bad: string[];
}

const rows: Row[] = [];
for (const m of HANDLER_META) {
    const fn = resolveAction(m.key);
    if (!fn) continue;
    const r = measure(fn);
    const needs = needsOf(r.hits);
    const api = r.hits.api.size ? [...r.hits.api][0].split(".")[1] ?? "?" : "-";

    // A process may offer an action whatever the call site actually delivers, and
    // nothing else. This is the whole of the scope rule.
    const derived = Object.entries(CALL_SITE_PROVIDES)
        .filter(([, g]) =>
            sat(needs.pos, g.pos) && sat(needs.data, g.data) && sat(needs.cell, g.cell)
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
    [n.pos && "pos", n.data && "data", n.cell && "cell"].filter(Boolean).join("+") || "-";
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
