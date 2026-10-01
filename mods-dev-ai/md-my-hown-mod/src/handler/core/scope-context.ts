/**
 * What each **scope** actually hands a process, and what it is therefore allowed to
 * name.
 *
 * This table answers the question a scope selector asks first: *if I pick
 * `processing`, what can my process see?* It is also the input to the panel's
 * dynamic context list — the read-only half of that list is generated from here, so
 * it cannot disagree with the runtime.
 *
 * ## Every row is measured, not guessed
 *
 * Each `from` is a path in the engine's own `.d.ts`, and a test in
 * `../test/scope-context.test.ts` checks the claims below against the shipped types.
 * A seed table that drifts from the engine is **worse than no table**: it offers an
 * author a variable that is always `undefined`, and the failure looks like a bug in
 * their process rather than a lie in this file.
 *
 * The sources:
 *
 * - `signals.interactables.register(type, (structure) => …)` — structures.d.ts
 * - `signals.targets.register(type, (structure, payload) => …)` — signals.d.ts
 * - `processing.register(type, { intervalMs, process(structure, context) })`
 * - `triggers.register(triggerId, { interval, callback: () => void })`
 * - `StructureProcessingContext` — the four members below, structures.d.ts
 *
 * ## Two rows that are easy to get wrong
 *
 * - **`trigger` gets almost nothing.** `callback: () => void` takes no arguments at
 *   all, so there is no `tick` count handed to a step — a count has to be the mod's
 *   own, kept in a closure. A seed table that invented `tick` would be the single
 *   most tempting lie to tell here, so `trigger` carries no engine seed at all.
 * - **`modifier` keeps `args` opaque.** It is the only scope where the context is
 *   the engine's own intercepted call frame, so the payload shape belongs to the
 *   hook, not to this table.
 *
 * @module
 */
import { cellAt, cellsOf, footprint, type ShapeMatrix } from "./cell-region.ts";

import { api } from "./types.ts";
import type { CallSite } from "./types.ts";

/** One seed, and where the engine really gets it from. */
export interface ContextSeed {
    /** The name steps refer to it by, e.g. `structure.x` or `commit`. */
    name: string;
    /** What the value is, in one line. Shown in the panel's context list. */
    doc: string;
    /** The engine path it is read from, for the "where does this come from" line. */
    from: string;
}

/** The seeds one scope delivers, in the order the panel lists them. */
export const SCOPE_CONTEXT: Record<CallSite, ContextSeed[]> = {
    /**
     * The richest scope, and the only one with a first-class context object. A
     * processor gets the structure **and** the `StructureProcessingContext` — which
     * is where `commit` comes from, and the reason `act` actions can write cells.
     */
    processing: [
        {
            name: "structure.x",
            doc: "The structure's cell X.",
            from: "process(structure, context)",
        },
        {
            name: "structure.y",
            doc: "The structure's cell Y.",
            from: "process(structure, context)",
        },
        { name: "structure.type", doc: "The structure's type ref.", from: "Structure.type" },
        { name: "structure.data", doc: "The instance's own data bag.", from: "Structure.data" },
        {
            name: "context.getResolvedTypeAtCell",
            doc: "fn(x, y) → the element or terrain type at a cell, or null.",
            from: "StructureProcessingContext",
        },
        {
            name: "context.isCellEmptyAtCell",
            doc: "fn(x, y) → true when the cell holds neither element nor terrain.",
            from: "StructureProcessingContext",
        },
        {
            name: "context.commit",
            doc: "fn(mutations) → queues grid changes for the main thread.",
            from: "StructureProcessingContext",
        },
        // The two enable/disable members, which the engine's own
        // `api.structures.definition.md` §"processing.register" lists and this table
        // was **missing**. They are the cheapest atomic element action there is — a
        // switch that stops a processor running on one cell — and their absence is the
        // clearest example of why the drift test in `../test/scope-context.test.ts`
        // checks the engine rather than trusting this file.
        {
            name: "context.isEnabledAtCell",
            doc: "fn(x, y) → true when processing runs at that cell.",
            from: "StructureProcessingContext",
        },
        {
            name: "context.setEnabledAtCell",
            doc: "fn(x, y, on) → turns processing on or off at that cell (Main only).",
            from: "StructureProcessingContext",
        },
        // ── The footprint matrix ──
        //
        // `StructureDefinition.shape` is a `number[][]` — the cell footprint, 1 =
        // occupied. It lives on the **definition**, not the instance, so a process
        // reaches it by looking the type up rather than reading it off `structure`.
        // These four seeds are that lookup, done once per invocation, so no step has
        // to.
        {
            name: "structure.shape",
            doc: "The structure's footprint matrix, 1 = occupied. 1×1 when it has no shape.",
            from: "getDefinitionByType(structure.type).shape",
        },
        {
            name: "structure.matrixSize",
            doc: "{ width, height } of the footprint, in cells.",
            from: "getDefinitionByType(structure.type).shape",
        },
        {
            name: "structure.cellAt",
            doc: "fn(mx, my) → { cellX, cellY } for a cell of the matrix. The bridge " +
                "from matrix x,y to grid x,y.",
            from: "structure.x + mx, structure.y + my",
        },
        {
            name: "structure.footprint",
            doc: "every occupied cell of the matrix, top-left to bottom-right.",
            from: "getDefinitionByType(structure.type).shape",
        },
    ],

    /**
     * A click on a structure. One argument, so `structure` and nothing else.
     * `targets.register` does deliver a second `payload`, but the *interactable* slot
     * this mod uses does not — and inventing a `payload` seed for a call site whose
     * documented signature has one argument is exactly the drift this file prevents.
     */
    signal: [
        { name: "structure.x", doc: "The structure's cell X.", from: "handler(structure)" },
        { name: "structure.y", doc: "The structure's cell Y.", from: "handler(structure)" },
        { name: "structure.type", doc: "The structure's type ref.", from: "Structure.type" },
        { name: "structure.data", doc: "The instance's own data bag.", from: "Structure.data" },
    ],

    /**
     * **No seeds.** `callback: () => void` is called with no arguments, so there is
     * nothing to name. Not an omission — it is the shape of the call site, and a
     * trigger step is expected to write a `vars` entry the next step reads.
     */
    trigger: [],

    /**
     * Item use. The first argument is the item's own state — which does carry a
     * position, unlike the engine hooks — and the second is the action that fired.
     */
    itemAction: [
        { name: "state.x", doc: "The item's cell X.", from: "handleAction(state, action)" },
        { name: "state.y", doc: "The item's cell Y.", from: "handleAction(state, action)" },
        {
            name: "action.type",
            doc: "The action being performed.",
            from: "handleAction(state, action)",
        },
    ],

    /** An engine hook: the engine's own call frame, opaque on purpose. */
    modifier: [
        {
            name: "args",
            doc: "The intercepted arguments, as the engine passed them.",
            from: "intercept(args, ctx)",
        },
        { name: "ctx", doc: "The hook's own context.", from: "intercept(args, ctx)" },
    ],

    /** An upgrade being applied. The item instance is the only argument. */
    upgrade: [
        { name: "item.type", doc: "The upgraded item's type.", from: "onUpgrade(item)" },
    ],

    /** A key press. The key code, and nothing else. */
    behavior: [
        { name: "key", doc: "The key that was pressed.", from: "onDownKey(key) / onUpKey(key)" },
    ],
};

/**
 * Read one property, tolerating an engine object that throws on access.
 *
 * This exists because of a regression this module caused and a test caught. The
 * seeding below runs **outside** the per-step `try` in `compileProcess` — it has to,
 * since the context is created before the first step. So a read of the engine's own
 * payload that threw would escape the isolation the compiler promises and take down
 * a game tick. The pre-existing "one action throwing does not stop the ones after it"
 * test is what noticed, using a `Proxy` whose every property read throws.
 *
 * Reading defensively costs one helper call per seed and turns a tick-killing throw
 * into a seed that is simply absent — which `hasVar` can already report, and which
 * is exactly the state a step can test for.
 */
function safeRead(source: unknown, key: string): unknown {
    if (!source || typeof source !== "object") return undefined;
    try {
        return (source as Record<string, unknown>)[key];
    } catch {
        return undefined;
    }
}

/** The seeds one call site really delivered, keyed by the names in `SCOPE_CONTEXT`. */
function readSeeds(
    callSite: CallSite,
    args: readonly unknown[],
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    switch (callSite) {
        case "signal":
        case "processing": {
            const s = args[0];
            out["structure.x"] = safeRead(s, "x");
            out["structure.y"] = safeRead(s, "y");
            out["structure.type"] = safeRead(s, "type");
            out["structure.data"] = safeRead(s, "data");
            if (callSite === "processing") {
                const c = args[1];
                out["context.getResolvedTypeAtCell"] = safeRead(c, "getResolvedTypeAtCell");
                out["context.isCellEmptyAtCell"] = safeRead(c, "isCellEmptyAtCell");
                out["context.commit"] = safeRead(c, "commit");
                out["context.isEnabledAtCell"] = safeRead(c, "isEnabledAtCell");
                out["context.setEnabledAtCell"] = safeRead(c, "setEnabledAtCell");
                // The footprint, which needs a **lookup** — `shape` is on the
                // definition, not the instance. Done here, once per invocation, so a
                // 4×4 structure costs one lookup per tick rather than one per step.
                Object.assign(out, footprintSeeds(s));
            }
            break;
        }
        case "itemAction": {
            out["state.x"] = safeRead(args[0], "x");
            out["state.y"] = safeRead(args[0], "y");
            out["action.type"] = safeRead(args[1], "type");
            break;
        }
        case "modifier": {
            out.args = args[0];
            out.ctx = args[1];
            break;
        }
        case "upgrade":
            out["item.type"] = safeRead(args[0], "type");
            break;
        case "behavior":
            out.key = args[0];
            break;
        // A trigger callback takes no arguments, so there is nothing to seed. Said
        // explicitly rather than left to fall through, because "no seeds" is a claim
        // this module makes and it should be visible where the claim lives.
        case "trigger":
            break;
    }
    return out;
}

/**
/**
 * The four footprint seeds, read off a structure instance.
 *
 * `shape` lives on the **definition**, so this is a lookup — and the one place a
 * lookup happens. Everything downstream (the element actions, the panel's context
 * list) reads the seeds instead of repeating it, so a structure with no registered
 * definition is a single missed case here rather than an `undefined` surfacing in
 * every action that touches a matrix.
 *
 * **No shape is not a failure.** A structure with no `shape` is a 1×1 footprint, which
 * is what the engine means by it — and is the common case, since most structures are a
 * single tile. Returning nothing here would make the matrix actions silently dead on
 * exactly the structures an author is most likely to try them on first.
 */
function footprintSeeds(structure: unknown): Record<string, unknown> {
    const x = Number(safeRead(structure, "x")) || 0;
    const y = Number(safeRead(structure, "y")) || 0;
    let shape: ShapeMatrix | undefined;
    try {
        const type = safeRead(structure, "type");
        // `getDefinitionByType` takes a **type ref**, which is what `structure.type`
        // is. Guarded on both the namespace and the function, because a worker
        // registration can reach seeding without the structures API being present.
        const lookup = api?.structures?.getDefinitionByType;
        if (typeof lookup === "function" && type !== undefined) {
            shape = lookup(type)?.shape as ShapeMatrix | undefined;
        }
    } catch {
        // A structure whose type is not registered. Treated as no shape, below.
        shape = undefined;
    }
    const region = footprint(x, y, shape);
    return {
        "structure.shape": region.mask,
        "structure.matrixSize": { width: region.width, height: region.height },
        "structure.cellAt": (col: number, row: number) => cellAt(region, col, row),
        "structure.footprint": cellsOf(region),
    };
}

/**
 * Read a seed's own value off the engine's arguments.
 *
 * The table above is documentation; **this** is the runtime. Both are kept because
 * they answer different questions — "what can I name?" and "what is it?" — and a
 * process needs both: the panel lists from the first, the runtime fills from the
 * second.
 *
 * A seed the engine did not deliver is **absent** rather than present-and-
 * `undefined`, so `hasVar` can tell "not here at this site" from "here, and it
 * happens to be undefined" — the difference between a step that should not run and
 * one that should.
 */
export function seedsFor(
    callSite: CallSite,
    args: readonly unknown[],
): Record<string, unknown> {
    const read = readSeeds(callSite, args);
    // Only keep the names this scope actually offers. A seed table that is the source
    // of truth for the panel must also be the source of truth for the runtime, or
    // the two drift and the panel offers a name the context never has.
    const offered = new Set(scopeSeedNames(callSite));
    for (const name of Object.keys(read)) {
        if (!offered.has(name) || read[name] === undefined) delete read[name];
    }
    return read;
}

/** Every seed name one scope offers — the keys, for a picker or a test. */
export function scopeSeedNames(callSite: CallSite): string[] {
    return (SCOPE_CONTEXT[callSite] ?? []).map((s) => s.name);
}
