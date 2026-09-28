/**
 * The scope model: `needs ⊆ provides`, and the table that encodes it.
 *
 * The point of these tests is that `ACTION_SCOPE` is **measured, not declared**.
 * They re-run the same probe the table was generated from, so an action cannot
 * start needing `pos` (or stop needing `cell`) without a test failing. That is the
 * only reason the derived `slots` in `handler-registry.ts` can be trusted at all.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { HANDLER_META } from "../core/handler-registry.ts";
import { resolveAction } from "../core/process.ts";
// Imported for the cross-check in "only actions that change the grid are filed as
// committing": that test needs to know whether an action is measured `api`-bound, and
// this is the only table that knows. It is a *measurement*, not a declaration, which is
// what makes it worth importing rather than re-deriving.
import { ACTION_CLASSES } from "../core/action-class.ts";
import {
    ACTION_DOMAIN_BLURBS,
    ACTION_DOMAIN_LABELS,
    ACTION_DOMAINS,
    ACTION_EFFECT_BLURBS,
    ACTION_EFFECT_LABELS,
    ACTION_EFFECTS,
    isVacuousReturn,
} from "../core/action-class.ts";
import {
    ACTION_SCOPE,
    CALL_SITE_SCOPE,
    canRunAt,
    needsOf,
    SCOPE_NEEDS,
    type ScopeNeed,
    scopeSatisfies,
    slotsFor,
} from "../core/scope.ts";

// ── the probe, kept honest against tools/analyze-scopes.ts ───────────────────

function probe(into: Set<string>, prefix = ""): unknown {
    return new Proxy(function () {} as object, {
        get(_t, prop) {
            if (typeof prop === "symbol") {
                // `Symbol.toPrimitive` must be **absent**, not a stub: V8 calls it
                // before falling back to `valueOf`, so a callable here makes
                // `Number(probe)` NaN. That is not hypothetical — an action guarding
                // on `if (!amount) return` then returns before reading the payload,
                // and this probe reports it as needing nothing, which is a wrong
                // answer rather than a missing one. See the note on `options` below.
                if (prop === Symbol.toPrimitive) return undefined;
                return () => undefined;
            }
            const path = `${prefix}${String(prop)}`;
            into.add(path);
            if (prop === "valueOf" || prop === "toString") return () => 1;
            return probe(into, `${path}.`);
        },
        apply: () => undefined,
        set: () => true,
    });
}

function measureNeeds(key: string): ScopeNeed[] {
    const fn = resolveAction(key);
    if (!fn) return [];
    const payload = new Set<string>();
    const ctx = new Set<string>();
    const { log, warn } = console;
    console.log = () => {};
    console.warn = () => {};
    // A recording proxy for the options too, not a plain `{}`. This is the
    // subtlety that makes the probe agree with the tool: `structureWriteData`
    // guards on `o.field` and returns early if it is missing, so a plain object
    // would make it read nothing at all and report `needs: []` — a wrong answer
    // rather than a missing one, which is much harder to notice.
    const options = probe(new Set(), "options.");
    // A `sandkit` global, for the same reason. Without it `energyGenerateWhileHeld`
    // hits `if (!energy?.addAtCell) return` and never reaches the `st.x` it needs —
    // so it would measure as needing nothing, which is a wrong answer rather than
    // a missing one. The tool sets this up too; the two probes have to match.
    const prevSandkit = (globalThis as { sandkit?: unknown }).sandkit;
    (globalThis as { sandkit?: unknown }).sandkit = probe(new Set(), "api.");
    try {
        fn(probe(payload), probe(ctx), options);
    } catch {
        // A throw still tells us what it touched before failing, and every action
        // is wrapped, so this is not a real path.
    } finally {
        console.log = log;
        console.warn = warn;
        if (prevSandkit === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = prevSandkit;
    }
    const top = new Set([...payload].map((p) => p.split(".")[0]));
    const needs: ScopeNeed[] = [];
    if (top.has("x") || top.has("y")) needs.push("pos");
    if (top.has("data")) needs.push("data");
    if (ctx.size > 0) needs.push("cell");
    return needs;
}

Deno.test("ACTION_SCOPE matches what the actions actually read", () => {
    // The guard that makes the derived slots trustworthy. If this fails, run
    // `deno run -A tools/analyze-scopes.ts` and paste the emitted table.
    const drift: string[] = [];
    for (const key of Object.keys(ACTION_SCOPE)) {
        const measured = measureNeeds(key).sort();
        const declared = [...needsOf(key)].sort();
        if (measured.join("+") !== declared.join("+")) {
            drift.push(`${key}: measured [${measured}] but ACTION_SCOPE says [${declared}]`);
        }
    }
    assertEquals(drift, [], `scope drift:\n  ${drift.join("\n  ")}`);
});

Deno.test("every registered action has a scope entry", () => {
    // The other direction: an action with no entry defaults to needing nothing,
    // which would silently widen where it can run. That default is convenient and
    // exactly the kind of convenience that hides a mistake, so it is asserted here.
    const missing = HANDLER_META.map((m) => m.key).filter((k) => !(k in ACTION_SCOPE));
    assertEquals(missing, [], `no scope recorded: ${missing.join(", ")}`);
});

// ── the rule ───────────────────────────────────────────────────────────────

Deno.test("an action may run only where its needs are delivered", () => {
    // The one-line rule, stated as examples rather than as a loop, so a failure
    // names a case a reader can picture.
    assert(canRunAt("processorConvert", "processing"), "needs the cell context");
    assert(!canRunAt("processorConvert", "signal"), "a signal has no commit()");
    assert(!canRunAt("processorConvert", "itemAction"), "nor does an item use");
    assert(canRunAt("structureReadData", "signal"), "a structure has .data");
    assert(!canRunAt("structureReadData", "trigger"), "a trigger gets nothing at all");
    // "Needs nothing, so it fits anywhere" is no longer assertable against
    // `projectile`, because `projectile` is not a call site any more. A needless
    // action fits every site that *is* one, and that is the whole rule.
    assert(canRunAt("noop", "signal"), "needs nothing, so it fits any call site");
    assert(!canRunAt("noop", "projectile"), "projectile is not a call site at all");
});

Deno.test("only the cell actions are offered where the grid is reachable", () => {
    // `cell` is the scarcest thing the engine hands out — only `process()` and the
    // modifier hooks have it — so it is the axis worth pinning exactly. The list was
    // three; it is four, because `isElementAtCell` reads a cell to answer into the
    // process context and cannot be offered anywhere the grid is out of reach.
    //
    // Now eleven. The seven element actions all need `cell` for the same reason, and
    // the fact that they **cannot** be offered in `modifier` — which *does* have the
    // grid — is the list earning its keep: they are `commit`-shaped, and a modifier
    // hook has no `commit` to commit through.
    const wantsCell = Object.entries(ACTION_SCOPE)
        .filter(([, n]) => n.includes("cell"))
        .map(([k]) => k)
        .sort();
    assertEquals(wantsCell, [
        "countElements",
        "countEmpty",
        "createElement",
        "emptyCells",
        "isElementAtCell",
        "processorConvert",
        "processorLift",
        "processorScan",
        "readElement",
        "replaceElement",
        "transformElement",
    ]);
    for (const key of wantsCell) {
        const sites = slotsFor(key);
        assert(
            sites.every((s) => CALL_SITE_SCOPE[s].cell),
            `${key} was offered at a site with no cell context: ${sites.join(", ")}`,
        );
    }
});

Deno.test("no action is offered a call site that delivers less than it needs", () => {
    // The regression this whole module exists for. `triggerScan` and
    // `energyGenerateWhileHeld` both used to be declared on `trigger`, where the
    // engine calls `callback()` with no arguments at all — so they could only ever
    // return early. Nothing errored; they just never did anything.
    for (const m of HANDLER_META) {
        for (const slot of m.slots) {
            assert(
                canRunAt(m.key, slot),
                `${m.key} is offered in "${slot}", which delivers less than it reads`,
            );
        }
    }
});

Deno.test("a trigger delivers nothing, so only the needless actions fit there", () => {
    // `registerTrigger` puts `extra` in the *registration*, not the call, so the
    // engine's callback really is invoked with zero arguments. This is the fact
    // that makes the row above a bug rather than a style choice.
    assertEquals(CALL_SITE_SCOPE.trigger, { pos: false, data: false, cell: false, ret: false });
    assert(slotsFor("noop").includes("trigger"));
    for (const key of Object.keys(ACTION_SCOPE)) {
        if (needsOf(key).length === 0) continue;
        assert(!canRunAt(key, "trigger"), `${key} needs something a trigger never sends`);
    }
});

Deno.test("scopeSatisfies is the subset relation, and it is total", () => {
    const all: ScopeNeed[] = ["pos", "data", "cell"];
    assert(scopeSatisfies({ pos: true, data: true, cell: true, ret: false }, all));
    assert(!scopeSatisfies({ pos: true, data: false, cell: true, ret: false }, all));
    // `ret` is not a need, so a slot that only reads the return still satisfies an
    // action that wants nothing.
    assert(scopeSatisfies({ pos: false, data: false, cell: false, ret: true }, []));
    assert(!canRunAt("noop", "not-a-call-site"), "an unknown site satisfies nothing");
    assertEquals(SCOPE_NEEDS.length, 3, "three needs is the whole vocabulary");
});

// ── the other two axes the panel filters by ──────────────────────────────────

Deno.test("every action has exactly one effect and one domain", () => {
    // `ACTION_DOMAINS` is the one declared axis, so this is what keeps it honest.
    // A new action that is not filed would otherwise be invisible in the panel,
    // which is precisely how `cls` and `type` accumulated their dead entries.
    const keys = HANDLER_META.map((m) => m.key);
    const noEffect = keys.filter((k) => !ACTION_EFFECTS[k]);
    const noDomain = keys.filter((k) => !ACTION_DOMAINS[k]);
    assertEquals(noEffect, [], `no effect recorded: ${noEffect.join(", ")}`);
    assertEquals(noDomain, [], `no domain recorded: ${noDomain.join(", ")}`);
});

Deno.test("the effect vocabulary is closed and fully labelled", () => {
    // A filter chip with no label renders as a blank, and a label with no member
    // renders as a chip that can never match. Both are silent, so both are pinned.
    const used = new Set(Object.values(ACTION_EFFECTS));
    for (const e of used) {
        assert(ACTION_EFFECT_LABELS[e], `effect "${e}" has no label`);
        assert(ACTION_EFFECT_BLURBS[e], `effect "${e}" has no blurb`);
    }
    for (const d of new Set(Object.values(ACTION_DOMAINS))) {
        assert(ACTION_DOMAIN_LABELS[d], `domain "${d}" has no label`);
        assert(ACTION_DOMAIN_BLURBS[d], `domain "${d}" has no blurb`);
    }
    assertEquals(used.size, 6, "six effects, all of them reachable");
    assertEquals(Object.keys(ACTION_DOMAIN_LABELS).length, 9, "nine domains");
});

Deno.test("only actions that change the grid are filed as committing", () => {
    // The claim is strong, so it is checked against the two things that can prove it.
    //
    // The rule used to be a single one: `commits` ⇒ `needsOf(key).includes("cell")`,
    // on the grounds that `ctx.commit` was the only way to change the world from a
    // processor. The motion family made that **false** — `setVelocityAtCell` changes a
    // cell and reads no context at all. So the rule is now a disjunction, and both
    // halves are load-bearing:
    //
    //   commits ⇒ reads the context (`ctx.commit`) **or** reaches an `api.*` namespace
    //
    // Which is the honest generalisation. `ACTION_CLASSES[key] === "api"` is measured
    // rather than declared, so this is a real cross-check between two independent
    // classifications: if a future action claimed to commit while doing neither, it
    // would be caught here even though both tables were individually consistent.
    for (const [key, effect] of Object.entries(ACTION_EFFECTS)) {
        if (effect !== "commits") continue;
        const viaContext = needsOf(key).includes("cell");
        const viaApi = ACTION_CLASSES[key] === "api";
        assert(
            viaContext || viaApi,
            `${key} claims to commit but neither reads the context nor reaches the api, ` +
                "so it cannot change anything",
        );
    }
    assertEquals(
        Object.entries(ACTION_EFFECTS).filter(([, e]) => e === "commits").map(([k]) => k).sort(),
        [
            // The four `act` motion actions and the six element ones, **in true sorted
            // order** so the two groups interleave. That interleaving is the point: it
            // shows on one list that `commits` no longer means "uses `ctx.commit`".
            "addVelocity",
            "createElement",
            "emptyCells",
            "processorConvert",
            "processorLift",
            "replaceElement",
            "setDuration",
            "setVelocity",
            "teleportElement",
            "toParticle",
            "transformElement",
        ],
        "the three sense element actions only read, so they are not committers",
    );
});

Deno.test("a value returned where the engine ignores it is flagged, not hidden", () => {
    // The 13 vacuous handlers, as a rule rather than a list. This used to be 20
    // with 7 exceptions on the `projectile` slot — the one place the return was
    // read. Those 7 are now `ProjectileOptionFn`s rather than actions, so the
    // `returns` effect has **no** site that reads it and every one of the 13 is
    // vacuous. The count went 20 → 13 → 11: the projectile presets left the
    // catalogue, and `itemExcavate` / `itemShoot` stopped being factories once
    // they dug and shot for real.
    assert(isVacuousReturn("energyBank", false), "processing discards it");
    // Was `excavationCrusher` here. The five excavation profiles are
    // `ExcavationOptionFn`s in `../excavation-option/` now, and this test is about
    // *actions* — an option has no slot to be vacuous on, so the assertion moved
    // with it rather than being deleted.
    assert(!isVacuousReturn("processorConvert", false), "not a returns action at all");
    // The 6 themselves, so the count in the plan stays honest.
    assertEquals(
        Object.keys(ACTION_EFFECTS).filter((k) => isVacuousReturn(k, false)).length,
        6,
        "6 return a value and no slot reads it",
    );
    // And a projectile option is not in that table at all — its return is its
    // whole purpose, so calling it vacuous would be exactly backwards.
    assertEquals(
        Object.keys(ACTION_EFFECTS).filter((k) => k.startsWith("projectile")),
        [],
        "a projectile option was filed as an action effect",
    );
});
