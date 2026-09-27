/**
 * Phase 0 of PLAN.md: freeze the current dispatch contract.
 *
 * The Process/Action split is a refactor of handler dispatch, so before any of it
 * happens, "what does a slot resolve to, and does that function return anything"
 * has to be pinned by a test. Otherwise the refactor and a real behaviour change
 * look identical, and the only way to tell them apart is to run the game.
 *
 * The inventory below is **measured, not assumed** — every key was called with
 * nulls and classified by what came back. Two things it turned up that the split
 * depends on:
 *
 *  - **Only ONE slot uses a returned value.** Measured: 7 of the 43 handlers
 *    return something, and all 7 are projectile `getOptions` factories. Every
 *    other slot — signal, trigger, processing, upgrade, itemAction — is a
 *    side-effect callback whose result nothing reads. So a process made of N
 *    actions almost never has a return, which makes the merge rule a question
 *    about one slot instead of a general one.
 *
 *  - **13 of the 18 value-returning handlers are wired to a slot that DISCARDS
 *    the return.** `energyDefault`…`energyNetwork` are slotted on `processing`,
 *    where `apply.ts` does `entry.process = fn` and the engine ignores what
 *    comes back. The `excavation*`, `itemDefault`, `itemExcavate` and `itemShoot`
 *    family is slotted on `itemAction`, whose `handleAction` is documented
 *    `(state, action) => unknown`, "handles item use actions". These look like
 *    **data factories for a different object** (an energy type, an excavation
 *    profile) that were wired into a callback slot. Phase 0 does not fix that —
 *    it *records* it, so the split cannot quietly carry the bug forward. See
 *    `VACUOUS_RETURNS`.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ANY_HANDLERS, PROCESS_HANDLERS, resolveAnyHandler } from "./handlers.ts";
import { HANDLER_META, type HandlerSlot, itemActionHandlersFor } from "./handler-registry.ts";
import { PROJECTILE_OPTIONS, resolveProjectileOption } from "./projectile-option/index.ts";
import { resolveAction } from "./process.ts";

// ── The inventory ────────────────────────────────────────────────────────────

/** Implemented handler → the slots it is offered in. */
const IMPLEMENTED: Record<string, HandlerSlot[]> = {
    noop: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    itemDefault: ["itemAction"],
    processorNoop: ["processing"],
    excavationDefault: ["itemAction"],
    excavationCrusher: ["itemAction"],
    excavationDrill: ["itemAction"],
    excavationGun: ["itemAction"],
    excavationShatter: ["itemAction"],
    energyDefault: ["processing"],
    energyBank: ["processing"],
    energyWire: ["processing"],
    energyConductor: ["processing"],
    energyNetwork: ["processing"],
    // Was ["trigger"], where it could never run: a trigger callback is called with no
    // arguments. It needs a position, so it belongs on the one site that supplies
    // one. See ACTION_SCOPE and tools/analyze-scopes.ts.
    triggerScan: ["processing"],
    signalLog: ["signal"],
    structureInspect: ["signal"],
    structureReadData: ["signal"],
    structureWriteData: ["signal"],
    triggerLog: ["trigger"],
    triggerTick: ["trigger"],
    itemExcavate: ["itemAction"],
    itemShoot: ["itemAction"],
    processorLog: ["processing"],
    processorScan: ["processing"],
    processorLift: ["processing"],
    processorConvert: ["processing"],
    processorCount: ["processing"],
    // Was also "trigger". It reads structure.x/y to find the network, and a trigger
    // sends nothing, so that entry could only ever return early.
    energyGenerateWhileHeld: ["processing"],
    energyConsumePerRun: ["processing", "trigger"],
    // The seven `projectile*` presets are **deliberately absent**. They were
    // `["projectile"]` and are now `ProjectileOptionFn`s in
    // `./projectile-option/registry.ts` — a different registry, a different
    // signature, and no slot at all. `PROJECTILE_OPTION_KEYS` below asserts they
    // stay absent, so re-adding one here fails rather than quietly restoring it.
    techAppendUnlock: ["upgrade"],
    techSetUpgradeLevel: ["upgrade"],
    techGrantItem: ["upgrade"],
    upgradeCountLevel: ["upgrade"],
    upgradeLog: ["upgrade"],
    upgradeScale: ["upgrade"],
    upgradeAdd: ["upgrade"],
};

/**
 * Slots whose callback the engine calls for effect and ignores the result, so a
 * value returned from them is discarded.
 *
 * `itemAction` is in this list because `ItemDefinition.handleAction` is typed
 * `(state, action) => unknown` and documented as "handles item use actions" — a
 * side-effect callback whose `unknown` result nothing reads. **`projectile` is
 * deliberately NOT here**: `getOptions` is a factory, and its return is the
 * point. That makes `projectile` the only slot where a returned value survives.
 */
const VOID_SLOTS: HandlerSlot[] = [
    "signal",
    "trigger",
    "processing",
    "upgrade",
    "itemAction",
];

Deno.test("the action catalogue's API binding, measured", () => {
    // The rule going forward: an action is atomic and calls exactly one `api.*`
    // section. Measured by installing a fake `sandkit` and recording which
    // namespaces an action reaches for while running.
    //
    // Today **5 of 39** satisfy it. That is the point of the test: the rule is a
    // design rule, not a description, and adopting it means deciding what to do
    // with the other 34. If this number moves, the plan's Phase 2 scope moved
    // with it.
    //
    // (It was 5 of 43. The seven projectile presets were 4 of the 38 that do not
    // satisfy the rule, and they have left the action catalogue altogether.)
    const API_CALLING: Record<string, string> = {
        energyGenerateWhileHeld: "energy",
        energyConsumePerRun: "energy",
        techAppendUnlock: "tech",
        techSetUpgradeLevel: "upgrades",
        techGrantItem: "player",
    };
    const touched = new Set<string>();
    const fake: Record<string, unknown> = {};
    for (const ns of ["energy", "tech", "upgrades", "player"]) {
        // A proxy that records the namespace on any property read, so a handler
        // that reaches for `api.energy.consume` registers "energy" whether or not
        // the leaf method exists.
        fake[ns] = new Proxy(function () {}, {
            get: (_t, p) => {
                if (typeof p === "string") touched.add(ns);
                return () => undefined;
            },
        });
    }
    const g = globalThis as { sandkit?: unknown };
    const had = "sandkit" in g;
    const prev = g.sandkit;
    g.sandkit = { api: fake };
    try {
        for (const key of Object.keys(IMPLEMENTED)) {
            const fn = fnFor(key);
            if (!fn) continue;
            probe(fn);
        }
    } finally {
        if (had) g.sandkit = prev;
        else delete g.sandkit;
    }
    assertEquals(
        [...touched].sort(),
        Object.values(API_CALLING).filter((v, i, a) => a.indexOf(v) === i).sort(),
        "the set of API namespaces reached for changed",
    );
    // And the honest headline: 5 of 36 actions call an API at all.
    //
    // (Was 5 of 43. The seven projectile presets were among the 38 that do *not*
    // call an API, and they are no longer actions at all. 36 is the live size of
    // `ANY_HANDLERS` + `PROCESS_HANDLERS`; the three modifier actions in
    // `CODE_HANDLERS` are counted by `HANDLER_META` and are not in this table,
    // which is why 36 and 39 are both correct numbers for different things.)
    assertEquals(Object.keys(API_CALLING).length, 5);
    assertEquals(Object.keys(IMPLEMENTED).length, 36);
});

Deno.test("`type` measures neither axis — that is why the split is real", () => {
    // `type: "cell"` files an itemAction that returns a profile next to a trigger
    // that logs cells. They share a label and nothing else, which is the two axes
    // collapsed into one field. Pinned so the field's replacement is deliberate.
    const byType = new Map<string, string[]>();
    for (const [key, slots] of Object.entries(IMPLEMENTED)) {
        const meta = HANDLER_META.find((m) => m.key === key);
        if (!meta) continue;
        byType.set(meta.type, [...(byType.get(meta.type) ?? []), ...slots]);
    }
    const cellSpans = new Set(byType.get("cell"));
    // This used to assert three call sites. It is two now, and the reason matters:
    // the third was `triggerScan`, which is filed `cell` and reads a position, but
    // a trigger callback is called with no arguments — so it could never do the
    // cell scan its own doc comment describes. Dropping the slot was the fix, and
    // this assertion is what noticed. If it ever spans three again, the extra one
    // is a `type`/`slots` disagreement rather than a new capability.
    assertEquals(
        [...cellSpans].sort(),
        ["itemAction", "processing"],
        'type:"cell" spans a different set of call sites than the scope rule allows',
    );
    // A call-site label and an API label in one field, both still load-bearing.
    assert(byType.has("processor"), "the call-site label went away");
    assert(byType.has("tech"), "the API-ish label went away");
});

/**
 * Handlers that return a value into a slot that throws it away. Named so the
 * regression is loud: if one is re-slotted, or if the engine starts honouring
 * the return, this list is wrong and someone should look.
 */
const VACUOUS_RETURNS = [
    "energyDefault",
    "energyBank",
    "energyWire",
    "energyConductor",
    "energyNetwork",
    "itemDefault",
    "excavationDefault",
    "excavationCrusher",
    "excavationDrill",
    "excavationGun",
    "excavationShatter",
    "itemExcavate",
    "itemShoot",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Call an action with nulls and report what it produced. */
function probe(fn: (...a: unknown[]) => unknown): "void" | "value" {
    const realLog = console.log;
    // Several handlers log on the way in; the noise would bury the failures.
    console.log = () => {};
    try {
        return fn(null, null, null) === undefined ? "void" : "value";
    } finally {
        console.log = realLog;
    }
}

const fnFor = (key: string): ((...a: unknown[]) => unknown) | undefined =>
    ((ANY_HANDLERS as Record<string, unknown>)[key] ??
        (PROCESS_HANDLERS as Record<string, unknown>)[key]) as
            | ((...a: unknown[]) => unknown)
            | undefined;

// ── Tests ────────────────────────────────────────────────────────────────────

Deno.test("every declared handler key is reachable through resolveAnyHandler", () => {
    // The pre-split resolver is no longer what registration calls — `resolveAction`
    // is, and it also unwraps `CODE_HANDLERS`. This test still matters: the two must
    // not disagree about what exists, or a config accepted by one would be silently
    // dropped by the other.
    const codeOnly = new Set(["logArgs", "identity", "logBuildingPayload"]);
    const missing = HANDLER_META
        .map((m) => m.key)
        .filter((k) => !codeOnly.has(k) && typeof resolveAnyHandler(k) !== "function");
    assertEquals(missing, [], `unreachable: ${missing.join(", ")}`);
});

Deno.test("the inventory is complete — no handler escaped classification", () => {
    // A new handler added without a line above would otherwise be silently
    // unclassified, and the rest of this file would keep passing.
    const live = new Set([...Object.keys(ANY_HANDLERS), ...Object.keys(PROCESS_HANDLERS)]);
    const recorded = new Set(Object.keys(IMPLEMENTED));
    assertEquals(
        [...live].filter((k) => !recorded.has(k)),
        [],
        "implemented but not classified",
    );
    assertEquals(
        [...recorded].filter((k) => !live.has(k)),
        [],
        "classified but not implemented",
    );
});

Deno.test("the projectile presets are options, and stay out of the action system", () => {
    // The negative half of the split, pinned. Each of the seven used to be an
    // `ANY_HANDLERS` entry with `slots: ["projectile"]`; all three of those facts
    // are asserted here, because each one on its own is a silent regression:
    //
    //   - a registry entry means the Handlers tab lists it as an action
    //   - a `resolveAction` hit means a config could still name it as a process action
    //   - a `projectile` slot means a projectile could hold a *list* of them again
    for (const key of Object.keys(PROJECTILE_OPTIONS)) {
        // `Object.hasOwn`, not `key in obj`: `in` walks the prototype chain, so it
        // answers `true` for any key an `Object.prototype` member happens to share
        // — and this registry is a bare object literal, so it has all of them. The
        // check has to be about *own* entries or it silently passes for the wrong
        // reason.
        assert(
            !Object.hasOwn(ANY_HANDLERS, key),
            `${key} is back in the action registry`,
        );
        assert(
            !Object.hasOwn(PROCESS_HANDLERS, key),
            `${key} is back in the process registry`,
        );
        assertEquals(
            resolveAction(key),
            undefined,
            `${key} still resolves as an action — a projectile could name it as one`,
        );
        assertEquals(
            HANDLER_META.find((m) => m.key === key),
            undefined,
            `${key} is advertised as a handler`,
        );
        // And it must still exist as what it actually is.
        assertEquals(typeof resolveProjectileOption(key), "function", `${key} is not an option`);
    }
    // The reverse direction too: no action may claim the (now removed) slot.
    for (const m of HANDLER_META) {
        assert(!m.slots.includes("projectile" as never), `${m.key} claims the projectile slot`);
    }
});

Deno.test("the inventory's slots match what the registry declares", () => {
    // The two must not drift: the registry decides what the UI offers, the
    // inventory records what the code does.
    for (const [key, slots] of Object.entries(IMPLEMENTED)) {
        const meta = HANDLER_META.find((m) => m.key === key);
        assert(meta, `${key} has no HANDLER_META entry`);
        assertEquals(
            [...meta.slots].sort(),
            [...slots].sort(),
            `${key} is slotted differently in the registry`,
        );
    }
});

Deno.test("registration compiles a process, so options finally arrive", () => {
    // **The bug this whole split exists to fix.** The engine calls
    // `process(structure, context)` — two arguments. The old registration handed it
    // the raw action, whose third parameter was therefore always `undefined`, so
    // `processorConvert` could never be given the `to` its schema marks `required`.
    // `compileProcess` binds the options at build time instead.
    //
    // Read the wiring out of the registration modules rather than calling the
    // engine: the point is that the *registration path* compiles a list, not that
    // some function somewhere could have done it.
    const here = new URL("../register/", import.meta.url).pathname;
    const src = Deno.readTextFileSync(here + "the-rest.ts");
    const compiles = (src.match(/compileProcess\(/g) ?? []).length;
    // Was five. The projectile site now calls `compileProjectile` — a different
    // compiler for a different kind of thing — so this count dropping to four is
    // the split, not a lost call site. `compileProjectile(` is asserted separately
    // below for the same reason: a silently-absent projectile compile would leave a
    // projectile with no `getOptions` at all.
    assertEquals(
        compiles,
        4,
        "processing, signal, trigger, behavior (projectile moved to compileProjectile)",
    );
    assert(
        (src.match(/compileProjectile\(/g) ?? []).length === 1,
        "the projectile site no longer compiles an option",
    );
    // And no site resolves a bare key any more — that is the old 1:1 shape.
    assertEquals(
        (src.match(/resolveAnyHandler/g) ?? []).length,
        0,
        "a registration site still resolves a single key",
    );
});

Deno.test("the upgrade slot is wired, which it never was", () => {
    // `registerUpgrade` destructured `onUpgradeKey` out and never set `onUpgrade`,
    // so all 7 upgrade actions were unreachable in-game while looking perfectly
    // configured. Asserted at the source level for the same reason as above.
    const kit = Deno.readTextFileSync(
        new URL("../packages/mysandkit.ts", import.meta.url).pathname,
    );
    assert(
        /onUpgrade: fn/.test(kit),
        "registerUpgrade no longer passes onUpgrade to the engine",
    );
    // Scoped to `registerUpgrade`, not the whole file: `registerUpgradeCategory`
    // *also* strips `onUpgradeKey`, and correctly — the engine's
    // `upgrades.registerCategory` takes `{ id, nameKey }` and has no callback slot,
    // so a category genuinely has no process. Asserting on the file would forbid
    // the right thing.
    //
    // Comments are stripped first, because the comment above that very strip
    // *names* `onUpgradeKey` — a raw match would fail on the note recording the fix.
    const at = kit.indexOf("export function registerUpgrade(");
    const fn = kit.slice(at, kit.indexOf("export function", at + 1))
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
    assert(
        !/onUpgradeKey/.test(fn),
        "registerUpgrade strips onUpgradeKey again — the callback would never be set",
    );
});

Deno.test("an item's use action is a compiled process, or nothing at all", () => {
    // A Consumable has no `ActionType`, so it must reach the game holding neither
    // a process nor any key that names one. The `else` branch deletes all of them;
    // if that list is narrowed, a Consumable ships a dead process — and the
    // pre-split spellings in particular would sail through the passthrough and be
    // handed to the engine as fields it has no meaning for.
    const kit = Deno.readTextFileSync(
        new URL("../packages/mysandkit.ts", import.meta.url).pathname,
    );
    assert(
        /for \(const k of \["actions", "handlerKey", "onUpgradeKey"\]\) delete out\[k\]/.test(
            kit,
        ),
        "the item path no longer clears every key that names a process",
    );
});

Deno.test("the 15 re-signed actions all take options in argument 3", () => {
    // The paired half of the migration. The `ANY` actions used to be
    // `(payload, extra)` and read their options from argument 2 — which the engine
    // never filled. The compiler passes `(payload, ctx, options)`, so every one of
    // them had to move to argument 3 *in the same change* that switched the call
    // sites. One of the two halves alone breaks the other.
    const src = Deno.readTextFileSync(new URL("./handlers.ts", import.meta.url).pathname);
    const stale = [...src.matchAll(/^ {4}(\w+): \((?:payload|structure|item), extra\)/gm)]
        .map((m) => m[1]);
    assertEquals(stale, [], "actions still reading options from argument 2");
    // And the canonical shape is what `compileProcess` actually calls.
    const proc = Deno.readTextFileSync(new URL("./process.ts", import.meta.url).pathname);
    assert(
        proc.includes("step.fn(payload, ctx, step.options)"),
        "the compiler no longer passes options third",
    );
});

Deno.test("a slot resolves exactly one function — the 1:1 the split removes", () => {
    // This is the invariant the whole plan is built to break, so it is pinned
    // here on purpose: after the split a *process* resolves N actions, and this
    // test should be deleted rather than relaxed.
    for (const key of Object.keys(IMPLEMENTED)) {
        assertEquals(
            typeof resolveAnyHandler(key),
            "function",
            `${key} does not resolve to a function`,
        );
    }
});

Deno.test("no call site is left where a returned value survives", () => {
    // This test used to assert the opposite: that `projectile` was the one slot
    // reading a return, which is what made the merge rule load-bearing. That slot
    // is gone — a projectile holds a single `ProjectileOption` whose return *is*
    // its configuration, compiled by `compileProjectile` and not by a process.
    //
    // So the claim is inverted and made stronger: no action returns a value into
    // any slot, and the seven options are outside this system entirely. The
    // vacuous-return list in the file header is therefore the whole of them.
    const returnsIntoVoidSlot = Object.keys(IMPLEMENTED).filter((key) => {
        const fn = fnFor(key);
        if (!fn) return false;
        return VOID_SLOTS.includes(IMPLEMENTED[key][0]) && probe(fn) === "value";
    });
    // These are the mis-slotted data factories named in the file header.
    assertEquals(
        returnsIntoVoidSlot.filter((k) => !VACUOUS_RETURNS.includes(k)),
        [],
        "an unlisted handler returns a value into a void slot",
    );
    // And the options are still value-returning — they are just not actions, so
    // `fnFor` does not find them and the count is taken from their own registry.
    const optionReturning = Object.keys(PROJECTILE_OPTIONS).filter(
        (key) => typeof resolveProjectileOption(key) === "function",
    );
    assertEquals(optionReturning.length, 7, "projectile options stopped existing");
    // The two systems must not share a key, which is the split's whole point.
    assertEquals(
        Object.keys(PROJECTILE_OPTIONS).filter((k) => k in IMPLEMENTED),
        [],
        "a projectile option is also an action",
    );
});

Deno.test("the vacuous returns are still vacuous", () => {
    // If this fails, the engine started honouring a return and the plan's merge
    // rule has to cover that slot after all. Better to hear about it here.
    for (const key of VACUOUS_RETURNS) {
        const fn = fnFor(key);
        assert(fn, `${key} is gone`);
        assertEquals(probe(fn), "value", `${key} no longer returns a value`);
        assert(
            VOID_SLOTS.includes(IMPLEMENTED[key][0]),
            `${key} is no longer on a void slot — the merge rule may now apply`,
        );
    }
});

Deno.test("a Consumable resolves no item action", () => {
    // ActionType is Weapon|Building|Tool|Mod — there is no Consumable, so no
    // handler can ever be dispatched for one. The split has to keep this.
    assertEquals(itemActionHandlersFor("Consumable"), []);
    assertEquals(itemActionHandlersFor("consumable"), [], "case-insensitive too");
    assert(itemActionHandlersFor("Tool").length > 0, "but a Tool does get actions");
});

Deno.test("every item action is offered to at least one non-Consumable type", () => {
    // Guards the filter the line above relies on: if `itemTypes` were tightened
    // so nothing matched, a Consumable would be the *only* type left and the
    // rule would hold for the wrong reason.
    const types = ["Weapon", "Building", "Tool", "Mod"];
    for (const m of itemActionHandlersFor("Tool")) {
        assert(
            types.some((t) => itemActionHandlersFor(t).some((x) => x.key === m.key)),
            `${m.key} is unreachable`,
        );
    }
});

Deno.test("every action reads its options from argument 3, not argument 2", () => {
    // **A second instance of the bug `processorConvert` had**, found by
    // `tools/analyze-scopes.ts` rather than by reading. The Process/Action split
    // re-signed the whole registry to `(payload, ctx, options)`, and three actions
    // were missed: they still read `(node, extra)`, so `extra` was bound to the
    // engine's *context* and their own options never arrived.
    //
    // The failure is silent and total. `techAppendUnlock` guards on `o.techId`;
    // receiving the context means `o.techId` is `undefined`, so it returned before
    // ever calling `appendUnlock`. All three looked correctly configured and did
    // nothing — the worst kind of bug, because nothing errors and nothing warns.
    //
    // So this is asserted behaviourally: call each one the way `compileProcess`
    // does, with a context that is *not* the options, and require that the API
    // call it makes reflects the options that were passed.
    const calls: { append?: unknown; level?: unknown; granted: number } = { granted: 0 };
    const prev = (globalThis as { sandkit?: unknown }).sandkit;
    (globalThis as { sandkit?: unknown }).sandkit = {
        api: {
            tech: {
                conservatory: {
                    appendUnlock: (id: unknown, u: unknown) => {
                        calls.append = [id, u];
                    },
                },
            },
            upgrades: {
                setLevelById: (i: unknown, u: unknown, l: unknown) => {
                    calls.level = [i, u, l];
                },
            },
            player: {
                inventory: {
                    addById: () => {
                        calls.granted++;
                    },
                },
            },
        },
    };
    // Deliberately not the options — this is the engine's context, which is what
    // argument 2 actually is at runtime.
    const ctx = { definitely: "not the options" };
    try {
        ANY_HANDLERS.techAppendUnlock({ id: "t1" }, ctx, {
            techId: "t1",
            structures: ["a"],
        });
        ANY_HANDLERS.techSetUpgradeLevel({ id: "t1" }, ctx, {
            itemId: "sword",
            upgradeId: "u1",
            level: 3,
        });
        ANY_HANDLERS.techGrantItem({ id: "t1" }, ctx, { itemId: "gem", count: 4 });
    } finally {
        if (prev === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = prev;
    }

    assertEquals(calls.append, ["t1", { structures: ["a"] }], "appendUnlock never fired");
    assertEquals(calls.level, ["sword", "u1", 3], "setLevelById never fired");
    assertEquals(calls.granted, 4, "addById takes one id, so count is a loop");
});
