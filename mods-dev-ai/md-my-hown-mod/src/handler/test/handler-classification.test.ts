/**
 * Phase 0 of PLAN.md: freeze the current dispatch contract.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    ANY_ACTIONS,
    MODIFIER_ACTIONS,
    PROCESSING_ACTIONS,
    resolveAction,
} from "../actions/index.ts";
import { HANDLER_META, type HandlerSlot, itemActionHandlersFor } from "../core/handler-registry.ts";
import { PROJECTILE_OPTIONS, resolveProjectileOption } from "../projectile-option/index.ts";
import { slotsFor } from "../core/scope.ts";

/** The six role folders, for the source-level checks below. */
const ACTION_DIRS = [
    "actions/sense",
    "actions/decide",
    "actions/act",
    "actions/remember",
    "actions/feel",
    "actions/connect",
] as const;

// ── The inventory ────────────────────────────────────────────────────────────

/** Implemented handler → the slots it is offered in. */
const IMPLEMENTED: Record<string, HandlerSlot[]> = {
    // The first action that exists because the process context does. It is a `sense`
    // in the processing-signature table, so it appears in `PROCESSING_ACTIONS` while
    // its role is still `sense` — the two axes being independent, in practice rather
    // than only in the type.
    isElementAtCell: ["processing"],
    // The element family. Seven actions, one slot — `processing` is the only call site
    // that delivers a `StructureProcessingContext`, and therefore the only one where a
    // cell can be read or changed at all. Listed together because they are one family
    // and an author reaches for them together.
    readElement: ["processing"],
    countElements: ["processing"],
    countEmpty: ["processing"],
    replaceElement: ["processing"],
    createElement: ["processing"],
    emptyCells: ["processing"],
    removeElement: ["processing"],
    transformElement: ["processing"],
    // The motion family. Same slot for the same reason — `processing` is where a
    // `StructureProcessingContext` is delivered — but a different *reason* from the
    // element seven: they do not use that context at all. They reach
    // `api.elements.*`, so they would work from any call site that had the api, and
    // the measured scope is `["pos"]` rather than `["pos", "cell"]`. That is worth
    // noticing: the motion family is the first in this system whose dependence on the
    // processing slot is incidental rather than structural.
    getVelocity: ["processing"],
    findFreeCell: ["processing"],
    setVelocity: ["processing"],
    addVelocity: ["processing"],
    setDuration: ["processing"],
    teleportElement: ["processing"],
    toParticle: ["processing"],
    // The structure family: eighteen actions, all registered for the `processing` slot and
    // nothing else. Recorded here in full because this list is what the inventory test
    // checks for completeness, and because "all eighteen, one slot" is the same
    // uniformity the class table shows — there is no call site outside a processor tick
    // that hands over a position and reaches `api.structures`.
    structureType: ["processing"],
    hasStructure: ["processing"],
    isStructureType: ["processing"],
    isMyType: ["processing"],
    isBlockedByPlayer: ["processing"],
    isLauncher: ["processing"],
    isStructureEnabled: ["processing"],
    countStructures: ["processing"],
    structureData: ["processing"],
    mapSpritesheetValue: ["processing"],
    buildStructure: ["processing"],
    removeStructure: ["processing"],
    removeStructures: ["processing"],
    setStructureEnabled: ["processing"],
    setSpritesheetIndex: ["processing"],
    setSpritesheetByValue: ["processing"],
    setStructureData: ["processing"],
    pushStructure: ["processing"],
    // The terrain family: eleven actions, `processing` slot only, for the same reason as
    // the other three cell families — a processor tick is the only call site that hands
    // over a position and expects the world to change.
    terrainType: ["processing"],
    hasTerrain: ["processing"],
    isTerrainType: ["processing"],
    terrainHitPoints: ["processing"],
    terrainTypeHandle: ["processing"],
    countTerrain: ["processing"],
    createTerrain: ["processing"],
    replaceTerrain: ["processing"],
    removeTerrain: ["processing"],
    damageTerrain: ["processing"],
    setTerrainHitPoints: ["processing"],
    // The element data slots. Every slot, because a slot is per-cell state reached
    // through `api.elements` and not through the processing context, so these need
    // nothing but a position — which is what the scope table records, and it is why
    // they work in an item use or a hook as well as in a processor.
    readDataField: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    writeDataField: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    // ── The buffer family ─────────────────────────────────────────────────────
    //
    // Not a "family" in the sense the ones above are: these three write to the
    // mod's own shared slots rather than to a structure's data bag, so they are
    // filed here rather than beside `structureWriteData`.
    //
    // The position is load-bearing, mechanically and not by taste:
    // `CONTEXT_READABLE` is compared element-by-element against
    // `Object.keys(IMPLEMENTED)`, so a row added here has to be reflected in that
    // list at the same place or the diff names a key that is in both sets.
    //
    // All six slots for all three, which is the same claim the scope table makes:
    // a slot needs nothing the call site delivers, so a buffer action is legal
    // wherever a process can run.
    bufferRead: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    bufferWrite: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    bufferIncrement: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    noop: ["signal", "trigger", "processing", "upgrade", "modifier", "itemAction"],
    itemDefault: ["itemAction"],
    processorNoop: ["processing"],
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
    // The live half of a `senderType` signal, so it runs wherever a signal does and
    // wherever a processor does — the engine hands both a structure with a position.
    signalOutput: ["signal", "processing"],
    structureInspect: ["signal"],
    structureReadData: ["signal"],
    structureWriteData: ["signal"],
    triggerLog: ["trigger"],
    triggerTick: ["signal"],
    // Both of these were `["signal", "processing", "modifier"]`, and both lost the
    // **itemAction** slot to a wrong `pos: false` in `CALL_SITE_SCOPE` — an action named
    // for an item that could not run on an item. They are back, because an item use does
    // have a position: the engine hands over its state, and
    // `api.input.getMouseCellPosition()` ("the cell under the cursor", `input.d.ts:37`)
    // is ambient. `anchorFor` in `core/cell-region.ts` is what reads it.
    itemExcavate: ["signal", "processing", "modifier", "itemAction"],
    itemShoot: ["signal", "processing", "modifier", "itemAction"],
    processorLog: ["processing"],
    processorLift: ["processing"],
    processorConvert: ["processing"],
    processorCount: ["processing"],
    // Was also "trigger". It reads structure.x/y to find the network, and a trigger
    // sends nothing, so that entry could only ever return early.
    energyGenerateWhileHeld: ["processing"],
    // `trigger` is not offered: it delivers no payload, and this action needs a
    // position for the network it draws from.
    energyConsumePerRun: ["processing", "signal", "modifier"],
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

    // Added with the `feel/` folder. `toast` reads only its own options, so it fits
    // anywhere including `trigger` — the one site that delivers no payload at all.
    // `particles` needs a position, so it is limited to the sites that hand one
    // over. `canRunAt` re-derives both from `ACTION_SCOPE`; these rows only say
    // where the picker offers them. (`behavior` is a call site but not a slot.)
    toast: ["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"],
    particles: ["signal", "processing", "modifier"],

    // The three modifier actions. They were absent from this table before, on the
    // grounds that `fnFor` could not see them: they live in `MODIFIER_ACTIONS` as
    // `{ kind, fn }` objects rather than bare functions, and the old lookup only
    // consulted the other two registries. `fnFor` now uses `resolveAction`, so they
    // are reachable and therefore have to be listed — which is why this table is 41
    // and not 38.
    logArgs: ["modifier"],
    identity: ["modifier"],
    logBuildingPayload: ["modifier"],

    // The logic family: the five range walks.
    //
    // The four readers are offered every slot that hands over a position, and the
    // asymmetry is the interesting part. `trigger` is absent because the engine
    // calls a trigger's callback with **literally nothing** — `registerTrigger` puts
    // `extra` in the registration, not in the call — so a walk there would anchor
    // its range to a cursor fallback rather than to anything the author chose.
    // `upgrade` and `behavior` are absent for the same reason: an item instance and
    // a key code are not positions.
    logicAny: ["signal", "processing", "itemAction", "modifier"],
    logicAll: ["signal", "processing", "itemAction", "modifier"],
    logicCount: ["signal", "processing", "itemAction", "modifier"],
    logicSum: ["signal", "processing", "itemAction", "modifier"],
    // `logicForEach` gets `processing` **only**, and this is the clearest statement
    // of the `commit` need anywhere in the codebase. It writes through
    // `api.grid.mutate`, whose callback reads the batch's staged writes through the
    // `StructureProcessingContext` — the one member no other call site delivers. So
    // a tool can *ask* what is under the cursor (`logicAny` and friends) and cannot
    // atomically rewrite it. That is a real limit of the engine, not a choice, and
    // `scope.test.ts` re-derives it from the code.
    logicForEach: ["processing"],
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
    // Today **9 of 41** satisfy it. That is the point of the test: the rule is a
    // design rule, not a description, and adopting it means deciding what to do
    // with the other 32. If this number moves, the plan's Phase 2 scope moved
    // with it.
    //
    // (It was 5 of 39. `feel/` added `toast` and `particles`; and four actions
    // that *were* api-bound were measuring as if they were not — see the
    // `valueOf` note on the fake below.)
    const API_CALLING: Record<string, string> = {
        energyGenerateWhileHeld: "energy",
        energyConsumePerRun: "energy",
        techAppendUnlock: "tech",
        techSetUpgradeLevel: "upgrades",
        techGrantItem: "player",
        itemExcavate: "grid",
        itemShoot: "projectiles",
        toast: "ui",
        particles: "effects",
        // The one action that makes a `senderType` signal a live sensor. It was
        // missing entirely, which is why a config could register three senders and
        // publish nothing: `registerSenderType` only seeds a wire as it is drawn.
        signalOutput: "signals",
        // The structure family: 18 actions, all reaching `api.structures`. The only
        // family where the count of actions and the count of namespaces move in
        // lockstep, because there is exactly one namespace to reach and no member of
        // the family reaches anything else. `processing` is a sub-namespace, so it
        // counts as the parent — the same call the `ACTION_APIS` table records.
        structureType: "structures",
        hasStructure: "structures",
        isStructureType: "structures",
        isMyType: "structures",
        isBlockedByPlayer: "structures",
        isLauncher: "structures",
        isStructureEnabled: "structures",
        countStructures: "structures",
        structureData: "structures",
        mapSpritesheetValue: "structures",
        buildStructure: "structures",
        removeStructure: "structures",
        removeStructures: "structures",
        setStructureEnabled: "structures",
        setSpritesheetIndex: "structures",
        setSpritesheetByValue: "structures",
        setStructureData: "structures",
        pushStructure: "structures",
        // The terrain family, and the first family whose members **disagree** about which
        // namespace they reach. Eight record `terrains`; the three batched writes record
        // `grid`, because `api.grid.mutate` and its `terrains` writer is what they call —
        // `api.terrains.createAtCell` exists and is not what they use.
        //
        // That disagreement is the point. It proves the map is read from what an action
        // really touches rather than from which folder it lives in, and it is why the fake
        // below must carry **both** namespaces: a family recorded entirely as `terrains`
        // would have let those three reach `grid` unrecorded, and the namespace set would
        // have quietly lost `grid`.
        terrainType: "terrains",
        hasTerrain: "terrains",
        isTerrainType: "terrains",
        terrainHitPoints: "terrains",
        terrainTypeHandle: "terrains",
        countTerrain: "terrains",
        createTerrain: "grid",
        replaceTerrain: "grid",
        removeTerrain: "grid",
        damageTerrain: "terrains",
        setTerrainHitPoints: "terrains",
    };
    const touched = new Set<string>();
    const fake: Record<string, unknown> = {};
    for (
        const ns of [
            "energy",
            "tech",
            "upgrades",
            "player",
            "grid",
            "projectiles",
            "ui",
            "effects",
            // New for the structure family. Added to the fake rather than relying on the
            // missing-property fallback, because a proxy records on *any* property read
            // and a missing namespace would be recorded as a read too — which would make
            // this test pass for the wrong reason. It has to be a real namespace here.
            "structures",
            // Same for the terrain family, and the same reasoning. `grid` was already
            // above, so the three batched writes are already covered — but the other eight
            // reach a namespace nothing had reached before, and without it the proxy would
            // be read as an undeclared property and this test would still pass.
            "terrains",
            // `signals`, for the same reason: it is a namespace no action reached
            // before `signalOutput` did, and a missing one would be recorded by the
            // proxy as a read anyway — so the test would pass for the wrong reason
            // and the action would look api-bound without ever touching an engine.
            "signals",
        ]
    ) {
        // A proxy that records the namespace on any property read, so an action
        // that reaches for `api.energy.consume` registers "energy" whether or not
        // the leaf method exists.
        //
        // `valueOf` returns 1 and `Symbol.toPrimitive` is absent for the same
        // reason as everywhere else in this codebase: without them `Number(...)`
        // is `NaN`, an action guarding on `if (!amount) return` returns before it
        // ever reaches the api, and this test reports a real api call as none.
        fake[ns] = new Proxy(function () {}, {
            get: (_t, p) => {
                if (typeof p === "string") touched.add(ns);
                if (p === Symbol.toPrimitive) return undefined;
                if (p === "valueOf" || p === "toString") return () => 1;
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
    // And the honest headline: 9 of 44 actions call an API at all.
    //
    // (Was 5 of 39. The `feel/` folder added `toast` and `particles`, and four
    // actions that *were* api-bound measured as if they were not — the `valueOf`
    // false negative above. The jump is the measurement getting more honest, not
    // nine actions suddenly growing an api call.)
    //
    // `9 of 44` rather than `9 of 37`: the seven element actions **diluted** the
    // ratio without touching the numerator, and that is the correct outcome. They
    // reach the grid through `ctx.commit`, not through `api.elements`, so the API
    // count is a real statement about a shrinking share of the catalogue.
    //
    // Then 44 → 51 with the motion family, which is the opposite move: all seven DO
    // reach `api.elements`, so the catalogue is 51 and the numerator is still 9 —
    // because `API_CALLING` records the *set of namespaces* reached, not the number of
    // actions, and all seven reach the one namespace. A single new namespace would
    // have moved the first assertion; a seventh action on an existing one does not.
    // 9 → 10 namespaces, 51 → 69 actions. The structure family is the first addition to
    // have moved **both** counts at once, and the reason is worth being explicit about:
    // the previous three families all reached namespaces that already existed
    // (`elements`, `grid`), so a seventh action on an existing namespace left the
    // numerator where it was. `structures` is a genuinely new namespace, and 18 actions
    // on it moved the second figure by more than any single change so far.
    // Both counts move, and for the first time **the numerator moves with them**: 9 -> 27
    // actions, catalogue 51 -> 69. The previous three families all reached namespaces that
    // already existed, so adding a seventh action on an existing one left the numerator
    // where it was. `structures` is a new namespace and all eighteen reach it.
    //
    // The two figures measure different things and are easy to confuse: this is a count
    // of **actions** in `API_CALLING`, not of namespaces. The unique namespaces behind it
    // went 8 -> 9, which is the assertion just above.
    // 80 → 84: `processorScan` was removed (−1) and the five range walks arrived (+5).
    //
    // The numerator does not move, and that is the point worth recording. All three
    // namespaces the walks reach — `elements`, `terrains`, `grid` — were already
    // counted, so adding five more actions against them is the same "existing
    // namespace" outcome the element, motion and terrain families each produced. The
    // structure family was the only change so far that moved the numerator, because
    // `api.structures` was genuinely new.
    // 84 → 87: the three buffer actions arrived.
    //
    // Neither the numerator nor the denominator of the namespace share moves,
    // because the buffer family calls no `api.*` namespace at all — it reaches
    // shared memory through a handle built at construction. That is the same
    // reason the three are absent from `API_CALLING`, and it is worth pairing the
    // two facts: 3 actions added, 0 namespaces, because a slot is not a service.
    //
    // 87 → 89 with the two element data-slot actions, and the *numerator* holds at
    // 38. `api.elements` was already in the share — the motion family calls it —
    // so these two add actions against an existing namespace rather than a new one.
    // That is the same outcome every family so far has produced, and it is what
    // makes the axis less informative than it looks: `api` counts "calls the
    // engine", and the write path and the effect are what actually separate the
    // families.
    // 38 → 39 with `signalOutput`, and unlike the three families above this one moves
    // **both** counts: `api.signals` is a namespace nothing had reached, and one
    // action is all it took. The pattern the comment above keeps describing — "an
    // action on an existing namespace does not move the numerator" — is about actions
    // being added; it does not apply when the namespace itself is new.
    assertEquals(Object.keys(API_CALLING).length, 39);
    //   89 → 90 with `removeElement`, which is filed against `api.grid.mutate` like
    //   the rest of the element writers — the same "adds an action against an
    //   existing namespace" outcome every family so far has produced.
    // 90 → 91 with `signalOutput`. One action, and it is the smallest thing that can
    // close a real gap: a `senderType` signal registered but had no way to publish,
    // so three senders sat inert while looking correctly set up.
    assertEquals(Object.keys(IMPLEMENTED).length, 91);
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
    // This asserted three call sites, then two, then **one** — and each drop was a
    // fix rather than a loss:
    //
    //   - the third was `triggerScan`, which is filed `cell` and reads a position,
    //     but a trigger callback is called with no arguments — so it could never do
    //     the cell scan its own doc comment describes.
    //   - the second was `itemAction`, and it went with the five `excavation*`
    //     presets. They were the only `cell` actions offered there, and they were
    //     offered on a slot that discards their return: they could not do anything.
    //     They are `ExcavationOptionFn`s now, in `../excavation-option/`, which is
    //     not a call site at all.
    //
    // It is **four** now, and this time the old warning does not apply — so the
    // warning is what changed, not the invariant. The four are the logic family's
    // read-only walks (`logicAny`, `logicAll`, `logicCount`, `logicSum`) plus
    // `signal` and `modifier` as slots those and the element readers share.
    //
    // What used to make `type: "cell"` single-site was that every member of the
    // family needed a `StructureProcessingContext` — either to commit a write or to
    // read a cell — and only `process()` delivers one. The walks broke that: they
    // read through `cellReaders`, which falls back to the ambient
    // `api.elements` / `api.terrains` readers, so they need a **position** and
    // nothing else. A position is what `signal`, `itemAction` and `modifier` all
    // have. So this is a new capability, not a `type`/`slots` disagreement:
    // "reads a cell" and "has a cursor" are now enough, and before this change they
    // were not.
    //
    // `logicForEach` is deliberately **not** among them. It is filed `cell` and is
    // offered `processing` only, because it writes through the batch path and
    // inherits its context dependency — the old rule, still exactly true of it.
    assertEquals(
        [...cellSpans].sort(),
        ["itemAction", "modifier", "processing", "signal"],
        'type:"cell" spans a different set of call sites than the scope rule allows',
    );
    // A call-site label and an API label in one field, both still load-bearing.
    assert(byType.has("processor"), "the call-site label went away");
    assert(byType.has("tech"), "the API-ish label went away");
});

/**
 * Handlers that return a value into a slot that throws it away. Named so the
 * regression is loud: if one is re-slotted, or if the engine starts honouring the
 * return, this list is wrong and someone should look.
 *
 * These are the **factory** actions — the energy storage descriptors and the item
 * baseline. They do not act; they *build the options object* something else
 * registers with, and that object is the value. A returned value on a void slot is
 * the whole point for them.
 *
 * The five excavation profiles were on this list and are **not** any more: they are
 * `ExcavationOptionFn`s now, in `../excavation-option/`, for the same reason the
 * projectile presets are not here. As actions they sat on `itemAction`, which
 * discards a return, so they could not do anything. `itemExcavate` and `itemShoot`
 * were also on it while they were stubs that returned a literal; they dig and shoot
 * for real now. An action that performs its effect and returns nothing is the normal
 * shape, and keeping either set here would have hidden a real change.
 *
 * `isElementAtCell` is **not** here, and its absence is the point of it. It also
 * returns a value into a void slot, but unlike the energy descriptors its return is
 * *meant* to be read — a later step binds it with `as` and quotes it as `{{name}}`.
 * That only works because the compiler captures it before the slot discards it, so
 * this list is about returns that go nowhere, not returns that exist.
 */
const VACUOUS_RETURNS = [
    "energyDefault",
    "energyBank",
    "energyWire",
    "energyConductor",
    "energyNetwork",
    "itemDefault",
    // The four `act` element actions return a boolean "did the write land". A void
    // slot discards it, and — unlike `CONTEXT_READABLE` below — nothing can bind it:
    // a boolean says the commit was accepted, which is a fact about the engine's
    // plumbing rather than a fact about the grid the process is reasoning about. A
    // process that wanted to know would re-read the cell, which is the honest way to
    // learn what is now there.
    "replaceElement",
    "createElement",
    "emptyCells",
    "removeElement",
    "transformElement",
    // The five `act` motion actions, for exactly the same reason. Each returns a
    // boolean "did anything happen", which a void slot discards and which nothing can
    // usefully bind: the answer is about whether the engine accepted the call, not
    // about the world. And it is *less* informative here than in the element family —
    // the motion writes are per-cell and deferred, so `true` means "N calls were made"
    // rather than "one transaction landed", which is a weaker claim than the name
    // suggests and another reason not to let a program branch on it.
    "setVelocity",
    "addVelocity",
    "setDuration",
    "teleportElement",
    "toParticle",
];

/**
 * Actions whose return the **process context** reads, as opposed to discards.
 *
 * The counterpart to `VACUOUS_RETURNS`, and the reason that list is not the whole
 * story any more. A step binds one of these with `as`; a later step quotes it as
 * `{{name}}`. The slot still discards the value — no engine call site reads a
 * return — but the compiler captures it on the way past, so the return is *used*.
 *
 * Whether one of these is actually bound is a property of the process that
 * references it, not of the action, which is why this is a named set rather than a
 * universal claim. An unbound one is simply a `sense` action whose result nobody
 * asked for — harmless, and not something this file can rule on.
 */
const CONTEXT_READABLE = [
    "isElementAtCell",
    // The three `sense` element actions. Each returns something the compiler can bind:
    // `readElement` an id, `countElements` and `countEmpty` a number. The four `act`
    // ones are **not** here, and the distinction is the point — a boolean "did it
    // land" is a diagnostic, not a value a process can reason with, so putting it on
    // this list would stretch the claim from "the return is readable" to "the return
    // is meaningful".
    "readElement",
    "countElements",
    "countEmpty",
    // The two `sense` motion actions, for the same reason and with the same
    // discipline. `getVelocity` returns a **speed** and `findFreeCell` an **index**,
    // both scalars, and both are chosen so a `decide` step can compare them: an object
    // or a coordinate pair would be bindable but not decidable, which is a weaker kind
    // of readable and would not deserve a place on this list.
    "getVelocity",
    "findFreeCell",
    // **All eighteen** structure actions, and unlike the two families above that is the
    // whole family rather than a curated subset — because every one of them returns
    // something.
    //
    // I first listed only the four returning a meaningful scalar and left the other
    // fourteen out, reasoning that a boolean "did it land" is a diagnostic rather than a
    // value to reason with. The test disagreed, and it was right: this list is
    // **exhaustive**, not a shortlist. Its claim is "the compiler can capture this
    // return", which is a property of the *slot* and not of the value's usefulness — and
    // the four `act` element actions return exactly the boolean I had just argued was
    // unbindable, and have been listed here all along.
    //
    // So the distinction I drew does not exist. There is one kind of entry: an action
    // that returns a value. Whether that value is *worth* binding is a judgement about a
    // program, and it belongs in the doc strings — which is where the "false means no"
    // reading of the booleans is already written.
    "structureType",
    "hasStructure",
    "isStructureType",
    "isMyType",
    "isBlockedByPlayer",
    "isLauncher",
    "isStructureEnabled",
    "countStructures",
    "structureData",
    "mapSpritesheetValue",
    "buildStructure",
    "removeStructure",
    "removeStructures",
    "setStructureEnabled",
    "setSpritesheetIndex",
    "setSpritesheetByValue",
    "setStructureData",
    "pushStructure",
    // The terrain family, all eleven — and like the structure family this list is
    // **exhaustive**, not curated. Every one of these returns something: the reads their
    // value, and the three batched writes return whether cells were *queued* (a weaker
    // claim, since `api.grid.mutate` is `void`, but still a value the compiler can carry).
    "terrainType",
    "hasTerrain",
    "isTerrainType",
    "terrainHitPoints",
    "terrainTypeHandle",
    "countTerrain",
    "createTerrain",
    "replaceTerrain",
    "removeTerrain",
    "damageTerrain",
    "setTerrainHitPoints",
    // `readDataField` returns a slot's number, so it is bindable with `as` and
    // belongs here on the same terms as the sense element actions above: a
    // **scalar** a `decide` step can compare. Its effect is recorded as `reads`
    // rather than `returns` because the number is a fact about the cell rather than
    // a value the action manufactured — the two are not exclusive, and this list is
    // the one that records the "and it is bindable" half.
    //
    // It sits here, after the terrain family, because the assertion above compares
    // this list against `Object.keys(IMPLEMENTED)` in order and the row is declared
    // there. The list reads by family; this entry's position is the registry's.
    "readDataField",
    // `bufferRead`, and it earns its place on the same terms as `getVelocity` and
    // `findFreeCell`: it returns a **scalar** — whatever the slot holds, and a
    // slot's type is one of number, bool or string — which is the shape a `decide`
    // step can compare. A read that returned an object would be bindable but not
    // decidable, which this list's own rule calls a weaker kind of readable.
    //
    // It sits between the cell families and the logic walks for a mechanical
    // reason rather than a thematic one: the assertion below compares this list
    // against `Object.keys(IMPLEMENTED)` **in order**, and the buffer row is
    // declared there between the terrain family and the logic family. The list
    // otherwise reads by family; this entry's position is the registry's.
    "bufferRead",
    // The logic family, last: the five range walks. They are the only actions in
    // the catalogue that are a *generalisation* of another family rather than a
    // member of one — each is the element family's read or write applied to every
    // cell of a range — so they belong after all four cell families both in the
    // registry and here. `logicSum` is also the only action in the list whose
    // subject is terrain rather than elements, for the same reason the terrain
    // family is separate: a total needs a number and a cell does not have one.
    "logicAny",
    "logicAll",
    "logicCount",
    "logicSum",
    "logicForEach",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Call an action with nulls and report what it produced. */
/**
 * Call an action the way `compileProcess` does, and report whether it returned a
 * value.
 *
 * The arguments are **recording proxies, not `null`** — and that is the whole
 * reason this function can answer anything. Two separate guards silently eat the
 * call otherwise:
 *
 *   - `fn(null, …)` makes `if (!p) return` fire in any action that needs a
 *     position, so `itemExcavate` and `particles` never reach the grid;
 *   - `options` as `null` makes `Number(o.amount ?? 0)` be `0`, so
 *     `if (!amount) return` fires in the energy actions.
 *
 * Either one produces "this action calls nothing" — a wrong answer rather than a
 * missing one, which is much harder to notice than a crash. Same fix as the
 * `valueOf` note in `measureActionDeps`.
 */
function probe(fn: (...a: unknown[]) => unknown): "void" | "value" {
    const realLog = console.log;
    // Several actions log on the way in; the noise would bury the failures.
    console.log = () => {};
    /** Truthy, and coerces to 1 so a numeric guard passes. */
    const usable = new Proxy(function () {} as object, {
        get: (_t, p) => {
            if (p === Symbol.toPrimitive) return undefined;
            if (p === "valueOf" || p === "toString") return () => 1;
            return usable;
        },
        apply: () => undefined,
    });
    try {
        return fn(usable, usable, usable) === undefined ? "void" : "value";
    } finally {
        console.log = realLog;
    }
}

/**
 * The action for a key, whatever its signature.
 *
 * Was `ANY_ACTIONS[key] ?? PROCESSING_ACTIONS[key]`, which silently returned
 * `undefined` for the three modifier actions — they live in `MODIFIER_ACTIONS` as
 * `{ kind, fn }` objects, not bare functions. That made the two probes below skip
 * `logArgs`, `identity` and `logBuildingPayload` and report a smaller set than the
 * catalogue holds. `resolveAction` is the one lookup that covers all three.
 */
const fnFor = (key: string): ((...a: unknown[]) => unknown) | undefined =>
    resolveAction(key) as ((...a: unknown[]) => unknown) | undefined;

// ── Tests ────────────────────────────────────────────────────────────────────

Deno.test("every declared action key resolves", () => {
    // Was `resolveAnyHandler`, the pre-split lookup. It is gone now, and the test
    // that pinned it is the proof: it existed to assert the two resolvers did not
    // disagree about what exists. With one table and one `resolveAction` they
    // cannot — so the invariant is checked directly instead, including the three
    // modifier actions that `resolveAnyHandler` never found, because its `else`
    // branch ran before the modifier unwrap.
    const missing = HANDLER_META
        .map((m) => m.key)
        .filter((k) => typeof resolveAction(k) !== "function");
    assertEquals(missing, [], `unreachable: ${missing.join(", ")}`);

    // The modifier actions resolve through the same entry point, `kind` and all.
    for (const key of ["logArgs", "identity", "logBuildingPayload"]) {
        assertEquals(
            typeof resolveAction(key),
            "function",
            `${key} is a modifier action and must resolve like any other`,
        );
    }
});

Deno.test("the inventory is complete — no handler escaped classification", () => {
    // A new handler added without a line above would otherwise be silently
    // unclassified, and the rest of this file would keep passing.
    //
    // All three registries, because they are now one catalogue: `MODIFIER_ACTIONS`
    // used to be left out because `fnFor` could not see it, and that exclusion is
    // what let three actions sit outside this table without anything failing.
    const live = new Set([
        ...Object.keys(ANY_ACTIONS),
        ...Object.keys(PROCESSING_ACTIONS),
        ...Object.keys(MODIFIER_ACTIONS),
    ]);
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
    // `ANY_ACTIONS` entry with `slots: ["projectile"]`; all three of those facts
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
            !Object.hasOwn(ANY_ACTIONS, key),
            `${key} is back in the action registry`,
        );
        assert(
            !Object.hasOwn(PROCESSING_ACTIONS, key),
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

Deno.test("the inventory's declared slots match the registry table", () => {
    // The table records what a human wrote; `HANDLER_META.slots` is now **derived** from
    // the scope model and no longer reads this. So the comparison that still means
    // something is against `declaredSlots` — and the two are allowed to differ, which
    // is exactly the drift the next test measures.
    for (const [key, slots] of Object.entries(IMPLEMENTED)) {
        const meta = HANDLER_META.find((m) => m.key === key);
        assert(meta, `${key} has no HANDLER_META entry`);
        assertEquals(
            [...(meta.declaredSlots ?? meta.slots)].sort(),
            [...slots].sort(),
            `${key} is slotted differently in the registry`,
        );
    }
});

Deno.test("every slot offered is one the action can actually serve", () => {
    // The guarantee that matters now that the slots are derived. It used to be
    // impossible to state — the registry decided, so asking was circular.
    //
    // `logicForEach` is the witness worth keeping: it writes through `api.grid.mutate`
    // and so needs the processing context, which makes it the one walk offered in
    // exactly one slot. If a future change widened it, this is what would notice.
    for (const m of HANDLER_META) {
        for (const slot of m.slots) {
            assert(
                slotsFor(m.key).includes(slot as never),
                `${m.key} is offered in "${slot}" but its needs do not include it`,
            );
        }
    }
    assertEquals(
        HANDLER_META.find((m) => m.key === "logicForEach")?.slots,
        ["processing"],
        "a commit-writing walk belongs in one slot only",
    );
});

Deno.test("no declared entry falls back to its hand-written slots", () => {
    // The fallback in `HANDLER_META` exists so a missing scope entry cannot make an
    // action vanish from every picker silently. This is what says it never happens.
    const fellBack = HANDLER_META.filter((m) =>
        [...(m.declaredSlots ?? [])].join() === m.slots.join() &&
        !slotsFor(m.key).length
    );
    assertEquals(fellBack.map((m) => m.key), [], "an action has no derived slots at all");
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
    const here = new URL("../../register/", import.meta.url).pathname;
    const src = Deno.readTextFileSync(here + "the-rest.ts");
    const compiles = (src.match(/compileProcess\(/g) ?? []).length;
    // Was five. Then four, when the projectile site moved to `compileProjectile` — a
    // different compiler for a different kind of thing. Then **one**: the four process
    // sites now go through `compileEntryProcess`, which is the only reader of both a
    // `processId` and a legacy `actions` array. The single remaining `compileProcess`
    // is the input-binding site, which stores a bare key and is not a process at all.
    //
    // So this count is now a check that the *reference* path is used everywhere, and a
    // regression to `actionRefsOf` in one of the four would not change it — which is
    // why the count below is what actually holds the line.
    assertEquals(
        compiles,
        1,
        "only the input-binding site compiles inline (a bare key, not a process)",
    );
    // The one that matters: every process slot resolves through the shared reader.
    assertEquals(
        (src.match(/compileEntryProcess\(/g) ?? []).length,
        3,
        "processing, signal, trigger must go through compileEntryProcess",
    );
    // Scoped to **code**, not the whole file: `actionRefsOf` is named twice in the
    // input-binding comment below, where the history of that site is worth recording,
    // and a grep over the raw source would match the explanation of why the site does
    // not use it.
    const code = src
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//"))
        .join("\n");
    assert(
        !/actionRefsOf/.test(code),
        "a registration site still reads the legacy actions array directly",
    );
    assert(
        !/actions:\s*\[/.test(code),
        "a registration site still builds an actions array",
    );
    assert(
        (src.match(/compileProjectile\(/g) ?? []).length === 1,
        "the projectile site no longer compiles an option",
    );
    // And no site resolves a bare key any more — that is the old 1:1 shape.
    assertEquals(
        (src.match(/resolveAction/g) ?? []).length,
        0,
        "a registration site still resolves a single key",
    );
});

Deno.test("the upgrade slot is wired, which it never was", () => {
    // `registerUpgrade` destructured `onUpgradeKey` out and never set `onUpgrade`,
    // so all 7 upgrade actions were unreachable in-game while looking perfectly
    // configured. Asserted at the source level for the same reason as above.
    const kit = Deno.readTextFileSync(
        new URL("../../packages/mysandkit.ts", import.meta.url).pathname,
    );
    assert(
        /onUpgrade: compiled\.fn/.test(kit),
        "registerUpgrade no longer passes onUpgrade to the engine",
    );
    // The item slot is the other engine-shaped register function, and the one that
    // cannot take a registry — it reads the boot-installed one. Asserted so that
    // moving it back onto a raw `actions` read is caught here rather than by an item
    // silently doing nothing in-game.
    assert(
        /compileEntryProcess\(def as Record<string, unknown>, "itemAction"\)/.test(kit),
        "registerItem no longer compiles through the shared reader",
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
        new URL("../../packages/mysandkit.ts", import.meta.url).pathname,
    );
    assert(
        /for \(const k of \["actions", "handlerKey", "onUpgradeKey"\]\) delete out\[k\]/.test(
            kit,
        ),
        "the item path no longer clears every key that names a process",
    );
});

Deno.test("every action reads its options from argument 3, not argument 2", () => {
    // The paired half of the migration. The `ANY` actions used to be
    // `(payload, extra)` and read their options from argument 2 — which the engine
    // never filled. The compiler passes `(payload, ctx, options)`, so every one of
    // them had to move to argument 3 *in the same change* that switched the call
    // sites. One of the two halves alone breaks the other.
    //
    // Scans every role folder, not the one file this used to live in. A check that
    // only reads `act/` would pass while `connect/` still read argument 2.
    const stale: string[] = [];
    for (const dir of ACTION_DIRS) {
        const src = Deno.readTextFileSync(
            new URL(`../${dir}/index.ts`, import.meta.url).pathname,
        );
        for (const m of src.matchAll(/^ {4}(\w+): \(\w+, (\w+)\)/gm)) {
            if (m[2] !== "options") stale.push(`${dir}: ${m[1]}`);
        }
    }
    assertEquals(stale, [], `actions still reading options from argument 2: ${stale.join(", ")}`);
    // And the canonical shape is what `compileProcess` actually calls. The third
    // argument is the **resolved** options — `value`, not `step.options` — because
    // `{{name}}` references are substituted per step, per invocation, against that
    // run's own context. Passing the raw bag here would silently reintroduce the
    // literal `{{…}}` text into every wired parameter.
    const proc = Deno.readTextFileSync(new URL("../core/process.ts", import.meta.url).pathname);
    assert(
        proc.includes("step.fn(payload, ctx, value, context)"),
        "the compiler no longer passes resolved options third",
    );
});

Deno.test("a slot resolves exactly one function — the 1:1 the split removes", () => {
    // This is the invariant the whole plan is built to break, so it is pinned
    // here on purpose: after the split a *process* resolves N actions, and this
    // test should be deleted rather than relaxed.
    for (const key of Object.keys(IMPLEMENTED)) {
        assertEquals(
            typeof resolveAction(key),
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
    // These are the mis-slotted data factories named in the file header, plus the
    // actions whose return the **process context** can capture.
    //
    // That second set is why this assertion is no longer "nothing at all returns
    // into a void slot". `isElementAtCell` does, and it is not a defect: a step binds
    // it with `as` and a later step quotes `{{name}}`, so its return is read by the
    // compiler *before* the slot discards it. Whether a given action's return is
    // actually used is a property of the process that references it, not of the
    // action — which is exactly why the claim has to name the set rather than assert
    // a universal.
    assertEquals(
        returnsIntoVoidSlot.filter((k) => !VACUOUS_RETURNS.includes(k)),
        CONTEXT_READABLE,
        "an unlisted handler returns a value into a void slot",
    );
    // And the context-readable ones really are bindable: each one returns something
    // when handed a context, which is what `as` captures.
    for (const key of CONTEXT_READABLE) {
        const fn = fnFor(key);
        assert(fn, `${key} is gone`);
        assertEquals(probe(fn), "value", `${key} no longer returns a value to bind`);
    }
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
        ANY_ACTIONS.techAppendUnlock({ id: "t1" }, ctx, {
            techId: "t1",
            structures: ["a"],
        });
        ANY_ACTIONS.techSetUpgradeLevel({ id: "t1" }, ctx, {
            itemId: "sword",
            upgradeId: "u1",
            level: 3,
        });
        ANY_ACTIONS.techGrantItem({ id: "t1" }, ctx, { itemId: "gem", count: 4 });
    } finally {
        if (prev === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = prev;
    }

    assertEquals(calls.append, ["t1", { structures: ["a"] }], "appendUnlock never fired");
    assertEquals(calls.level, ["sword", "u1", 3], "setLevelById never fired");
    assertEquals(calls.granted, 4, "addById takes one id, so count is a loop");
});
