/**
 * LOGIC — the piece the other six roles were missing.
 *
 * A process could *set* a variable (a step's `as`), *reuse* one, and act on a single
 * cell, but it could not repeat anything. This family is the repeat: the five walks of
 * `../core/positions.ts`. There is no sixth.
 *
 * What it deliberately cannot do is test-and-return an arbitrary value, or loop over
 * anything but a range. Both would put control flow in a tick handler, and both produce
 * code the panel cannot explain — an author cannot see where a `while` ends, but they
 * *can* see that a range is 3×3.
 *
 * A walk is written directly against the element family's own primitives — `cellReaders`
 * to ask a cell, `writeCells` to change one — so it inherits that family's batch
 * atomicity instead of reimplementing it. The alternative, "run action X at every cell"
 * by resolving X by key, was built first and thrown away: these actions are
 * `payload`-signed, so argument 2 is the engine's *extra* bag, not the cell context a
 * `processing`-signed body expects — and it left the walk unmeasurable, since a key
 * read out of a recording proxy does not resolve.
 *
 * @module
 */
import {
    cellReaders,
    type ElementOptions,
    walkRangeFor,
    writeCells,
} from "../element/index.ts";
import { defineActions, hostNs } from "../../core/types.ts";
import { positionsOver, type Positions } from "../../core/positions.ts";

/** The options every walk takes: the element family's, plus what the walks add. */
interface LogicOptions extends ElementOptions {
    /**
     * The content to test a cell against — **or** the type to write, for `forEach`.
     *
     * One name for both directions on purpose. "Does this range hold water" and
     * "make this range sand" ask about the same thing, and an author who has to
     * remember two spellings for one concept will use the wrong one.
     */
    element?: unknown;
    /** The type a guarded `forEach` writes, when it differs from the tested one. */
    to?: unknown;
    /**
     * The guard: only cells already holding this type are touched.
     *
     * Unset means "every cell", which is the right default for a walk that has
     * nothing to test — but it is also the default that would overwrite the world
     * if an author left it blank by accident, so `to` is what the doc leads with.
     */
    when?: unknown;
    /** `true` to also require the cell to be non-empty. Off by default. */
    onlyEmpty?: unknown;
}

/**
 * The list a walk covers, or `null` when the address is refused.
 *
 * `walkRangeFor` and not `regionFor`, and that is the whole of the matrix fix: a walk
 * is "every cell in a range", so naming one cell of the shape matrix is a
 * contradiction, and it is reported rather than quietly reduced to a single cell.
 */
function walkOf(structure: unknown, options: LogicOptions): Positions | null {
    const resolved = walkRangeFor(structure as never, options);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:logic] ${resolved.error}`);
        return null;
    }
    return positionsOver(resolved.range, resolved.clamped);
}

/**
 * Report a cap rather than answering a question about fewer cells than asked.
 *
 * A silent cap is the one failure mode of a range walk that is *not* self-evident.
 * `count` returns a number, the number is plausible, and it is wrong — and the
 * author has no other way to learn the region was 64×64 rather than 200×200.
 */
function warnClamp(what: string, list: Positions, options: LogicOptions): void {
    if (!list.clamped) return;
    console.warn(
        `[md-my-hown-mod:logic] ${what}: a range of ${Number(options.size ?? 1)} cells ` +
            `per side was capped at ${list.requested} cells — the answer covers the ` +
            "capped range only",
    );
}

/**
 * A predicate answering "does this cell hold the named type?".
 *
 * `null` when the engine cannot be asked at all — no `StructureProcessingContext` and
 * no `api.elements` on this thread. That is different from a cell holding something
 * else, and the difference matters: `any` and `count` would silently answer "no" in the
 * first case while `all` answered "yes", so the caller refuses instead.
 */
function typeTest(
    context: unknown,
    wanted: string,
    onlyEmpty: boolean,
): ((cell: { x: number; y: number }) => boolean) | null {
    const readers = cellReaders(context);
    if (!readers) return null;
    return ({ x, y }) => {
        if (onlyEmpty && readers.isEmpty && !readers.isEmpty(x, y)) return false;
        return readers.readType(x, y) === wanted;
    };
}

export const logicActions = defineActions({
    /**
     * `any` — "is there **one** cell in this range holding this type?"
     *
     * ```json
     * { "key": "logicAny", "as": "wet", "options": { "size": 5, "element": "water" } }
     * { "key": "toast",                   "options": { "message": "{{wet}}" } }
     * ```
     *
     * `as` captures the answer, so a later step reads `{{wet}}`. Short-circuits on the
     * first hit, so a 64×64 range that finds water in its second cell costs two reads.
     */
    logicAny: {
        role: "logic",
        doc: "fn(size?, element, …) → true when **any** cell in the range holds that " +
            "element. Bind the answer with the step's As field.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const wanted = String(o.element ?? "");
                if (!wanted) return false;
                const list = walkOf(structure, o);
                if (!list) return false;
                warnClamp("logicAny", list, o);
                const test = typeTest(context, wanted, o.onlyEmpty === true);
                return test ? list.any(test) : false;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] any failed", e);
                return false;
            }
        },
    },

    /**
     * `all` — "does **every** cell in the range hold this type?"
     *
     * Vacuously `true` over an empty region, which is the collection convention and
     * the mathematically correct answer. It is worth stating rather than assuming:
     * a range that resolved to nothing is "all water" by this rule, and `all` is
     * the one walk where that is a trap.
     */
    logicAll: {
        role: "logic",
        doc: "fn(size?, element, …) → true when **all** cells in the range hold that element.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const wanted = String(o.element ?? "");
                const list = walkOf(structure, o);
                if (!list) return false;
                warnClamp("logicAll", list, o);
                const test = typeTest(context, wanted, o.onlyEmpty === true);
                return test ? list.all(test) : false;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] all failed", e);
                return false;
            }
        },
    },

    /** `count` — "how **many** cells hold it?" The workhorse measure. */
    logicCount: {
        role: "logic",
        doc: "fn(size?, element, …) → how **many** cells in the range hold that " +
            "element. Bind the number with the step's As field.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const wanted = String(o.element ?? "");
                if (!wanted) return 0;
                const list = walkOf(structure, o);
                if (!list) return 0;
                warnClamp("logicCount", list, o);
                const test = typeTest(context, wanted, o.onlyEmpty === true);
                return test ? list.count(test) : 0;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] count failed", e);
                return 0;
            }
        },
    },

    /**
     * `sum` — "what do these cells add **up** to?"
     *
     * The only walk not about a type: a total needs a number and a cell does not have
     * one, so this sums terrain **hit points** — the engine's one per-cell numeric
     * reading. "How much ore is left in this 5×5" is the question, and it is the
     * question a mine actually has.
     *
     * A cell with no terrain contributes **0**, not the `-1` `terrainHitPoints` uses
     * for "no value". One cell's answer is worth distinguishing; inside a total, `-1`
     * would drag the sum towards zero for every empty cell, which is a wrong number
     * rather than a missing one.
     */
    logicSum: {
        role: "logic",
        doc: "fn(size?, …) → the total terrain hit points in the range. A cell with " +
            "no terrain counts as 0.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const list = walkOf(structure, o);
                if (!list) return 0;
                warnClamp("logicSum", list, o);
                // The context's own reader is preferred for the same reason the
                // element family prefers it: inside a batch it sees staged writes.
                const fromCtx = (context as {
                    getTerrainHitPointsAtCell?: (x: number, y: number) => number;
                } | null)?.getTerrainHitPointsAtCell;
                const api = hostNs("terrains");
                const read = typeof fromCtx === "function"
                    ? fromCtx
                    : typeof api?.getDataAtCell === "function"
                    ? (x: number, y: number) => {
                        const data = api.getDataAtCell(x, y) as
                            | { hitPoints?: unknown; hp?: unknown }
                            | null
                            | undefined;
                        const hp = data?.hitPoints ?? data?.hp;
                        return typeof hp === "number" ? hp : 0;
                    }
                    : null;
                if (!read) return 0;
                return list.sum(({ x, y }) => {
                    const n = Number(read(x, y));
                    return Number.isFinite(n) && n > 0 ? n : 0;
                });
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] sum failed", e);
                return 0;
            }
        },
    },

    /**
     * `forEach` — "write this type at **every** cell in the range."
     *
     * The only write walk, and the only place in the system with a condition inside a
     * loop — `isTypeAtCell == True => UpdateAtCell`, generalised from one cell to a
     * range:
     *
     * ```json
     * { "key": "logicForEach", "options": {
     *       "size": 3,
     *       "when": "water",   // only cells holding water
     *       "to":   "sand" }   // become sand
     * }
     * ```
     *
     * `when` is a **single** guard, read **per cell**. Single because a guard that could
     * branch or nest would be a `while` with extra steps. Per cell because the cell is
     * what changed: testing once would make "replace water in the 3×3 around me" mean
     * "if any cell is water, replace every cell" — plausible-looking and wrong.
     */
    logicForEach: {
        role: "logic",
        doc: "fn(size?, to, …) → writes an element at **every** cell in the range. " +
            "Set `when` to only touch cells already holding another element.",
        fn: (structure, context, options) => {
            try {
                const o = (options ?? {}) as LogicOptions;
                const to = String(o.to ?? o.element ?? "");
                if (!to) return 0;
                const when = o.when === undefined ? "" : String(o.when);
                // Counts what the batch **queued**, which is what `writeCells` can
                // honestly claim — the engine's `mutate` returns `void`, so neither
                // "submitted" nor "accepted" is knowable from here.
                let changed = 0;
                writeCells(structure, context, o, "logicForEach", (writer, cell, current) => {
                    if (when && current !== when) return false;
                    writer.createAtCell(cell.x, cell.y, to);
                    changed++;
                    return true;
                });
                return changed;
            } catch (e) {
                console.warn("[md-my-hown-mod:logic] forEach failed", e);
                return 0;
            }
        },
    },
});
