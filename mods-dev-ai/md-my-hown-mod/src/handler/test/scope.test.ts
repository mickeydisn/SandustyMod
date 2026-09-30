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
    VALID_OPTIONS,
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

/**
 * A recording proxy: every property read is noted, and calling it returns a stub.
 *
 * ## Why `apply` returns a plausible value rather than `undefined`
 *
 * The `read` / `commit` split is decided by *behaviour* — does the action still work
 * when the engine hands over no context? — so the stub has to model a world that
 * answers. Returning `undefined` from every call made `api.elements.getResolvedTypeAtCell`
 * look like an empty cell, so `readElement` returned `""` without a context, the probe
 * scored that as "stopped working", and every ambient reader was mis-filed as
 * `commit` — the exact error the split was introduced to remove.
 *
 * ## Why the read stub and the option stub differ
 *
 * `countElements` compares what a cell holds against the `element` its **options** name.
 * One shared stub made both sides `"probe"`, every cell matched, and — worse — the
 * comparison passed for the wrong reason: the action had found nothing and the id it was
 * looking for was equally fictional. Separate values keep the comparison honest, so the
 * action only scores as "worked" if it genuinely reached an ambient reader and compared
 * its result against a *different* id, which is what a real count does.
 */
const READ_STUB = "probe-read";
const OPTION_STUB = "probe-option";

function probe(into: Set<string>, prefix = "", stub: string = OPTION_STUB): unknown {
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
                return () => stub;
            }
            const path = `${prefix}${String(prop)}`;
            into.add(path);
            if (prop === "valueOf" || prop === "toString") return () => 1;
            return probe(into, `${path}.`, stub);
        },
        apply: () => stub,
        set: () => true,
    });
}

/** The proxy that stands in for `globalThis.sandkit.api` — the ambient namespaces. */
function apiProbe(into: Set<string>): unknown {
    return probe(into, "api.", READ_STUB);
}

/**
 * Run an action once with a recording context, and again with **no context at all**.
 *
 * The second run is the whole point, and it exists because access patterns cannot answer
 * the question the `read` / `commit` split asks. `readElement` touches
 * `ctx.getResolvedTypeAtCell` *and* `api.elements.getResolvedTypeAtCell`; so does
 * `createElement`. Looking at which context members were read says both are
 * context-bound, which is the wrong answer for one of them.
 *
 * ## The measure is a **cell-read reach**, not a return value
 *
 * An earlier version judged "did it work?" by the return value, and that is wrong for
 * the most obvious cases: `countElements` returns `0` and `isElementAtCell` returns
 * `false` when the cell does not hold the element it was asked about — a perfectly
 * correct answer, scored as "stopped working".
 *
 * A second version compared the whole `api.*` set across the two runs, which is wrong in
 * the other direction: `createElement` calls `api.grid.mutate` **before** it discovers
 * the context is missing, so it reaches the engine either way and looked ambient.
 *
 * So the question is asked precisely, about the one thing the `read` need is about:
 * **with no context, does the action still read a cell?** That is exactly the set of
 * ambient cell readers — `api.elements.getResolvedTypeAtCell` and
 * `api.grid.isCellEmptyAtCell` — which is the same pair the ambient fallbacks in
 * `actions/element/index.ts` and `actions/sense/index.ts` call. Reaching one means the
 * action has an ambient path and needs `read`; touching the context and reaching neither
 * means the context was its only route, which is `commit`.
 */
function measureNeeds(key: string): ScopeNeed[] {
    const fn = resolveAction(key);
    if (!fn) return [];
    const payload = new Set<string>();
    const ctx = new Set<string>();
    // Every `api.*` path the action reaches when the engine has handed over **no**
    // context — what a signal, an item use or a modifier hook looks like from inside.
    const withoutCtx = new Set<string>();
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
    //
    // `apiProbe` rather than a bare `probe`, so an ambient *read* answers with a
    // different value from the one the options carry. See the note on the stubs above.
    const prevSandkit = (globalThis as { sandkit?: unknown }).sandkit;
    // An action that **validates** its options cannot be driven by a proxy answering
    // "defined" to everything: the five range walks read `mx` as set *and* `dx` as 1,
    // report a conflict, and return before reaching the engine. So they are measured a
    // third time with a real, valid bag — the same table the class probe uses, so the
    // two measurements cannot drift into disagreeing about what an action touches.
    const valid = VALID_OPTIONS[key];
    try {
        // First run, with a context: this is what records the payload and the context.
        (globalThis as { sandkit?: unknown }).sandkit = apiProbe(new Set());
        try {
            fn(probe(payload), probe(ctx), options);
        } catch {
            // A throw still tells us what it reached before failing, and every action is
            // wrapped, so this is not a real path.
        }
        if (valid) {
            try {
                fn(probe(payload), probe(ctx), valid);
            } catch {
                // Same.
            }
        }
        // Second run, without one: what ambient engine surface can it still reach?
        (globalThis as { sandkit?: unknown }).sandkit = apiProbe(withoutCtx);
        try {
            fn(probe(new Set()), null, options);
        } catch {
            // Same: not a real path, and it reached nothing more.
        }
        if (valid) {
            try {
                fn(probe(new Set()), null, valid);
            } catch {
                // Same.
            }
        }
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
    // The old single `cell` need, split in two by the only question that separates
    // them: with the context gone, can the action still read a cell?
    if (ctx.size > 0) {
        const stillReadsAmbiently = [...AMBIENT_CELL_READS].some((p) =>
            [...withoutCtx].some((seen) => seen.endsWith(`.${p}`))
        );
        needs.push(stillReadsAmbiently ? "read" : "commit");
    }
    return needs;
}

/**
 * The ambient cell readers — the engine members a `read` action may rely on without
 * a `StructureProcessingContext`.
 *
 * Matched as **leaf names**, not as `api.elements.getResolvedTypeAtCell`. That is
 * deliberate and it is not laziness: `hostNs("elements")` walks one segment at a time
 * through a namespace this codebase cannot type, so the recording proxy sees
 * `api.elements` on one read and `api.getResolvedTypeAtCell` on the next. Writing the
 * dotted path here would match nothing and every ambient reader would be scored
 * `commit` — a probe that is confidently wrong, which is the worst kind.
 *
 * ## Why this is a list and not a rule
 *
 * A name list cannot tell a **read** from a **write**: `createElement` also reaches
 * `api.grid.mutate` with no context in sight, so "reached some api" would score it
 * `read` and quietly drop the `commit` need that is the whole reason it exists. The
 * distinction has to come from the engine's own vocabulary, so it is enumerated here
 * and kept honest by the drift test below — a new ambient reader that is not on this
 * list is reported as scope drift, not absorbed.
 *
 * The third name, `getDataAtCell`, is the terrain family's ambient per-cell accessor
 * and is here because of `logicSum`. It is the same category as the other two: a
 * top-level function on an ordinary `api.*` namespace (`terrains.d.ts`), callable
 * from any call site, which is precisely what `ctx.commit` is not.
 */
const AMBIENT_CELL_READS = [
    "getResolvedTypeAtCell",
    "isCellEmptyAtCell",
    "getDataAtCell",
];

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
    assert(canRunAt("processorConvert", "processing"), "needs a commit");
    assert(!canRunAt("processorConvert", "signal"), "a signal has no commit()");
    assert(
        !canRunAt("processorConvert", "itemAction"),
        "nor does an item use — but it does have a position now, see the test below",
    );
    assert(canRunAt("structureReadData", "signal"), "a structure has .data");
    assert(!canRunAt("structureReadData", "trigger"), "a trigger gets nothing at all");
    // "Needs nothing, so it fits anywhere" is no longer assertable against
    // `projectile`, because `projectile` is not a call site any more. A needless
    // action fits every site that *is* one, and that is the whole rule.
    assert(canRunAt("noop", "signal"), "needs nothing, so it fits any call site");
    assert(!canRunAt("noop", "projectile"), "projectile is not a call site at all");
});

Deno.test("an item use has a position, and the cell families come with it", () => {
    // The regression this file now exists to prevent, and the reason `pos` was
    // corrected for `itemAction`.
    //
    // `handleAction(state, action)` hands over the engine **state**, whose `x`/`y` do
    // not exist — the cursor is the cell. `api.input.getMouseCellPosition()` is
    // ambient (`input.d.ts:37`, "the cell under the cursor") and the three shipping
    // mods that dig from a hotbar tool all read it. So `pos` is true here, and with
    // it the whole element / terrain / structure / motion catalogue.
    //
    // This used to be the opposite: `pos: false` refused 51 of the 80 actions to the
    // item slot and pushed `itemExcavate` / `itemShoot` — the two actions named for
    // items — out of it entirely.
    assertEquals(CALL_SITE_SCOPE.itemAction, {
        pos: true,
        data: true,
        read: true,
        commit: false,
        ret: false,
    });
    for (const key of ["itemExcavate", "itemShoot", "createTerrain", "buildStructure"]) {
        assert(canRunAt(key, "itemAction"), `${key} should run from a hotbar tool`);
    }
    // …and the readers, which no longer need a context at all.
    for (const key of ["readElement", "countElements", "countEmpty", "isElementAtCell"]) {
        assert(canRunAt(key, "itemAction"), `${key} reads ambiently, so an item can ask too`);
    }
});

Deno.test("only a commit needs the context; a read is ambient", () => {
    // The split the old single `cell` need hid. `api.elements.getResolvedTypeAtCell`
    // and `api.grid.isCellEmptyAtCell` are top-level functions (`elements.d.ts:71`,
    // `grid.d.ts:21`), so *reading* a cell needs no `StructureProcessingContext`.
    // `ctx.commit` is a member of that interface and of nothing else, so *writing*
    // through it is the one thing only `process()` can serve.
    //
    // `removeElement` is deliberately absent: it removes through
    // `api.elements.removeAtCellWhenIdle`, a top-level call, so it needs no
    // commit. It was listed here while removal was still aimed at the batch
    // writer — which has no `removeAtCell` to aim at.
    const wantsCommit = Object.entries(ACTION_SCOPE)
        .filter(([, n]) => n.includes("commit"))
        .map(([k]) => k)
        .sort();
    assertEquals(wantsCommit, [
        "createElement",
        "emptyCells",
        "logicForEach",
        "processorConvert",
        "processorLift",
        "replaceElement",
        "transformElement",
    ]);
    for (const key of wantsCommit) {
        assertEquals(
            slotsFor(key),
            ["processing"],
            `${key} writes through ctx.commit, which only process() delivers`,
        );
    }

    // The readers are the mirror image: they need a position, not a context, so they
    // are offered everywhere a position exists — including the modifier hooks, which
    // have a `pos` but no `commit`.
    //
    // The four logic walks joined this list, and they are the first four entries
    // here that are not element-family actions. They read through the same
    // `cellReaders` helper the element readers use, so they are ambient for the same
    // reason and inherit the same reach — a hotbar tool can count water around the
    // cursor. `logicSum` is in this list for `getDataAtCell` rather than
    // `getResolvedTypeAtCell`, but it is the same kind of claim: a top-level
    // function on an ordinary namespace, reachable from any call site.
    const wantsRead = Object.entries(ACTION_SCOPE)
        .filter(([, n]) => n.includes("read"))
        .map(([k]) => k)
        .sort();
    assertEquals(wantsRead, [
        "countElements",
        "countEmpty",
        "isElementAtCell",
        "logicAll",
        "logicAny",
        "logicCount",
        "logicSum",
        "readElement",
        // Removing joins the readers. It resolves the element id through the
        // context's `getResolvedTypeAtCell` — the same top-level read the other
        // readers use — and then removes with `api.elements.removeAtCellWhenIdle`,
        // which needs no commit either.
        "removeElement",
    ]);
    for (const key of wantsRead) {
        const sites = slotsFor(key);
        assert(
            sites.includes("processing") && sites.includes("itemAction") &&
                sites.includes("signal"),
            `${key} reads ambiently, so it should not be locked to one slot: ${sites.join(", ")}`,
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
    assertEquals(CALL_SITE_SCOPE.trigger, {
        pos: false,
        data: false,
        read: true,
        commit: false,
        ret: false,
    });
    assert(slotsFor("noop").includes("trigger"));
    for (const key of Object.keys(ACTION_SCOPE)) {
        if (needsOf(key).length === 0) continue;
        assert(!canRunAt(key, "trigger"), `${key} needs something a trigger never sends`);
    }
});

Deno.test("scopeSatisfies is the subset relation, and it is total", () => {
    const all: ScopeNeed[] = ["pos", "data", "read", "commit"];
    assert(
        scopeSatisfies({ pos: true, data: true, read: true, commit: true, ret: false }, all),
    );
    // A `read` is not a `commit`. This is the distinction the old single `cell` need
    // could not express, and it is the one that decides whether an element reader may
    // sit in a slot that hands over no context.
    assert(
        !scopeSatisfies({ pos: true, data: true, read: true, commit: false, ret: false }, all),
    );
    assert(
        scopeSatisfies({ pos: true, data: true, read: false, commit: false, ret: false }, [
            "pos",
            "data",
        ]),
    );
    // `ret` is not a need, so a slot that only reads the return still satisfies an
    // action that wants nothing.
    assert(
        scopeSatisfies({ pos: false, data: false, read: false, commit: false, ret: true }, []),
    );
    assert(!canRunAt("noop", "not-a-call-site"), "an unknown site satisfies nothing");
    assertEquals(SCOPE_NEEDS.length, 4, "four needs is the whole vocabulary");
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
    // 9 → 10, and the new one is the only domain named after a **namespace** rather than
    // a role. Every other entry answers "what kind of action is this" (energy, items,
    // projectiles); `terrain` answers "what is this about", because the solid world is a
    // subject and nothing else in the catalogue is about rock. Folding it into `grid`
    // would have kept the count at 9 and made the panel's domain filter unable to separate
    // a wall from a grain of sand — which is the one question a domain filter is for.
    // Ten → eleven with `signalOutput`, and the new one is a subject rather than a
    // role, like `terrain`. Everything before it either described what a thing does
    // (energy, items, projectiles) or where it shows up (diagnostics, feedback).
    // Wiring is neither: it is the thing a `senderType` signal is *for*, and it had
    // nowhere to live before `signalOutput` existed to need one.
    assertEquals(Object.keys(ACTION_DOMAIN_LABELS).length, 11, "eleven domains");
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
    //   commits ⇒ needs `commit` (uses `ctx.commit`) **or** reaches an `api.*` namespace
    //
    // Which is the honest generalisation. `ACTION_CLASSES[key] === "api"` is measured
    // rather than declared, so this is a real cross-check between two independent
    // classifications: if a future action claimed to commit while doing neither, it
    // would be caught here even though both tables were individually consistent.
    for (const [key, effect] of Object.entries(ACTION_EFFECTS)) {
        if (effect !== "commits") continue;
        const viaContext = needsOf(key).includes("commit");
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
            "removeElement",
            "replaceElement",
            "setDuration",
            "setVelocity",
            "teleportElement",
            "toParticle",
            "transformElement",
            // The element data slots. `writeDataField` is a committer and not a
            // `writes`-effect action because a slot is per-cell state the engine
            // keeps on the element — it moves with the cell and is saved with it —
            // so it is a grid change rather than a structure's own bag. Sits last
            // because this list is compared in sorted order.
            "writeDataField",
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
    // The 7 themselves, so the count in the plan stays honest.
    //
    // 6 → 7 with `bufferRead`, and this one is a real finding rather than a
    // bookkeeping chore, so it is worth stating. The rule is "returns a value
    // that no call site reads", and `bufferRead` returns one that no engine call
    // site reads either — the engine ignores every process return. What makes it
    // different from the other six is that a process step binds it with `as:`, so
    // the value is not lost, it is captured one layer above the engine.
    //
    // So it is counted here, which reads oddly, and the alternative was worse:
    // declaring it non-vacuous would have meant adding a call site that "uses the
    // return", and `CALL_SITE_USES_RETURN` is all-`false` **because** the engine
    // reads none of them. Inventing one `true` to make the count come out would
    // have been a lie about the engine, bought to keep an assertion tidy.
    assertEquals(
        Object.keys(ACTION_EFFECTS).filter((k) => isVacuousReturn(k, false)).length,
        7,
        "7 return a value and no slot reads it",
    );
    // And a projectile option is not in that table at all — its return is its
    // whole purpose, so calling it vacuous would be exactly backwards.
    assertEquals(
        Object.keys(ACTION_EFFECTS).filter((k) => k.startsWith("projectile")),
        [],
        "a projectile option was filed as an action effect",
    );
});
