/**
 * ELEMENT — atomic transformations of the grid, over a region.
 *
 * The family the brief asked for: *transform, replace, empty, create, count* — and the
 * matrix that makes them all one action rather than one action per cell.
 *
 * ## The write path: `api.grid.mutate`, not `context.commit`
 *
 * This family used to stage `{kind, cellX, cellY}` objects and hand them to
 * `context.commit`, and that was correct — it is the path two real workshop mods use.
 * It was replaced because the engine has a better one, and the evidence is in the
 * declarations rather than in guesswork:
 *
 * - `context.commit(mutations: unknown): void` is typed as **`unknown`**, described only
 *   as a "Mutation writer payload accepted by the runtime". Two real mods use
 *   `{kind: "create", cellX, cellY, elementType}` and
 *   `{kind: "remove", cellX, cellY, expectedElementType}` — and **nothing else**. There is
 *   no evidence the payload takes an options bag, so putting `durationTicks` on a commit
 *   mutation would be inventing a field the engine has never heard of: it would commit,
 *   return, and do nothing.
 * - `api.grid.mutate((writer) => …)` is **typed**, Main-only, and documented as running
 *   "a coherent write batch" for "state-dependent grid writes". Its writer is
 *   `createAtCell(x, y, type, options?: ElementCreateOptions)` — a real options bag with
 *   `durationTicks`, `density`, `data`, `dataFields`, `isFreeFalling` and `particle`.
 *
 * So the reads and the writes moved apart, and each went where it is actually typed:
 *
 * | | before | after |
 * | --- | --- | --- |
 * | reads | `ctx.getResolvedTypeAtCell` | **unchanged** — still the context |
 * | writes | `ctx.commit(mutations[])` | `api.grid.mutate(writer => …)` |
 * | atomicity | one transaction | one transaction, **and coherent reads** |
 * | create options | none | `ElementCreateOptions` |
 * | thread | any with a context | **Main only** |
 *
 * The coherence is the real gain, and it is strictly stronger than what it replaced. The
 * old `expectedElementType` field existed to close the gap between reading a cell and
 * committing its removal a tick later; `mutate` removes the gap, because the read and the
 * write are the same atomic step. Compare-and-remove is now **structural** rather than a
 * field, and it covers creates too, which the field never did.
 *
 * Two costs, both real: the family is now **Main-only**, and `mutate` returns `void`
 * where `commit` returned a boolean — so an action's `true` means "cells were **queued**",
 * not "the engine accepted them".
 *
 * ## What still cannot be batched
 *
 * **Velocity, teleporting and particle conversion are not in this file.** The writer has
 * no velocity methods — only `elements.createAtCell` / `replaceAtCell` / `removeAtCell`
 * and the terrain equivalents — so there is no way to express a velocity inside a
 * coherent batch. They live in `../motion/index.ts` and pay for it with per-cell,
 * deferred writes. That trade is documented there; this boundary is why the two families
 * are two files.
 *
 * The one overlap is `ElementCreateOptions.particle`, which *can* spawn a cell already
 * moving, atomically. So a timed, already-launched element is expressible in **both**
 * families, by different means, with different atomicity — see `createOptions`.
 *
 * ## The region is the point
 *
 * Each action takes `dx`/`dy` (an offset) **or** a matrix position, and works on a
 * `CellRegion` from `../../core/cell-region.ts`. `processorConvert` — "replace the
 * cell above the structure" — is therefore `replaceElement` with `dy: -1`, and a 4×4
 * sorter is `countElements` over `footprint`. Same action, different region.
 *
 * @module
 */
import { defineActions, hostNs } from "../../core/types.ts";
import {
    around,
    type CellRegion,
    cellsOf,
    footprint,
    isOccupied,
    MAX_SCAN_SIDE,
    rect,
} from "../../core/cell-region.ts";
// `CellMutation` is deliberately **not** imported. It used to be, and the import going
// unused is the point: the element family no longer stages mutation objects, so it does
// not need their shape. The type still lives in `act/index.ts` because the three
// original `processor*` actions still write through `context.commit` — that path is
// unchanged, and `ctx.commit` remains the right call for an action the engine's own
// `commit` payload already models.
import type { ProcessingContext } from "../act/index.ts";

/** A structure, as far as these actions are concerned. */
interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}

/** The options every element action shares. */
interface ElementOptions {
    /** Offset from the structure's own cell. The region origin when no size is given. */
    dx?: unknown;
    dy?: unknown;
    /** Region side. 0 or absent means the single cell at the offset. */
    size?: unknown;
    /** `from` for `transformElement`; blank means "whatever element is there". */
    from?: unknown;
    /** `to` for `transformElement` — the element it becomes. */
    to?: unknown;
    /**
     * The element to look for, write or count. A **string id** — the engine's
     * `getResolvedTypeAtCell` returns the same string for an id-registered type, which
     * is what `isElementAtCell` already relies on.
     */
    element?: unknown;
    /** `true` = work over my own footprint matrix, occupied cells only. */
    footprint?: unknown;
    /** Matrix column, when addressing the footprint directly. */
    mx?: unknown;
    /** Matrix row, when addressing the footprint directly. */
    my?: unknown;
    // ── `ElementCreateOptions` fields, from the `api.grid.mutate` writer ─────────
    // Only the four with a machine-shaped use; see `createOptions`.
    /** Sets max *and* remaining duration at creation, atomically with the write. */
    durationTicks?: unknown;
    /** Overrides element density. */
    density?: unknown;
    /** Spawn already free-falling rather than resting. */
    freeFalling?: unknown;
    /** Velocity X for a `particle` spawn. See `createOptions`. */
    vx?: unknown;
    /** Velocity Y for a `particle` spawn. Negative is up. */
    vy?: unknown;
}

/** A number, or `fallback`. `NaN` must never reach the engine: it is not a cell. */
function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** The cell the structure occupies, read defensively. */
function origin(structure: StructureLike | null): { x: number; y: number } {
    return { x: num(structure?.x), y: num(structure?.y) };
}

/**
 * The region an action works on, from `dx`/`dy`/`size`/`footprint`/`mx`/`my`.
 *
 * Four cases, ordered so the options compose the way an author reads them:
 *
 * 1. `mx`/`my` given → that **one cell of the footprint matrix**. This is the literal
 *    "the element at matrix x, y".
 * 2. `footprint` → the whole matrix, occupied cells only.
 * 3. `size` > 1 → a square of that side, centred on the offset. An absent `size` → a
 *    single cell, which is why every action works with no options at all.
 *
 * A `size` past `MAX_SCAN_SIDE` is clamped **and reported**: a count over 40,000 cells
 * on a 100 ms tick looks exactly like a hung game, and a count that quietly covered a
 * fraction of what was asked for is a wrong answer rather than a slow one.
 */
export function regionFor(
    structure: StructureLike | null,
    options: ElementOptions,
): { region: CellRegion; clamped: boolean } {
    const { x, y } = origin(structure);
    const dx = num(options.dx);
    const dy = num(options.dy);

    if (options.mx !== undefined || options.my !== undefined) {
        return { region: rect(x + num(options.mx), y + num(options.my), 1, 1), clamped: false };
    }
    if (options.footprint === true) {
        return { region: footprint(x, y, structure?.shape), clamped: false };
    }
    const size = Math.abs(num(options.size));
    if (size > 1) {
        const side = Math.min(size, MAX_SCAN_SIDE);
        return { region: around(x + dx, y + dy, side), clamped: size > MAX_SCAN_SIDE };
    }
    return { region: rect(x + dx, y + dy, 1, 1), clamped: false };
}

/**
 * Every cell the action should touch.
 *
 * A region whose mask has holes keeps only its occupied cells — the difference between
 * a footprint and a bounding box, and for an L-shaped structure the difference between
 * touching 5 cells and touching 9.
 *
 * Exported because it is the canonical "which cells does this region mean" answer, and
 * two other families now need it: MOTION keeps its own near-identical copy, and STRUCTURE
 * imports this one. The duplication in MOTION is noted there and left alone — collapsing
 * it is a refactor of working, tested code, not part of adding a third family.
 */
export function targets(region: CellRegion): { x: number; y: number }[] {
    if (region.mask.some((row) => row.some((bit) => bit === 0))) return cellsOf(region);
    const out: { x: number; y: number }[] = [];
    for (let row = 0; row < region.height; row++) {
        for (let col = 0; col < region.width; col++) {
            if (isOccupied(region, col, row)) out.push({ x: region.x + col, y: region.y + row });
        }
    }
    return out;
}

/** The one-time line for a clamped scan, or `""`. */
function clampNote(clamped: boolean, label: string): string {
    return clamped
        ? `[md-my-hown-mod:process] ${label}: region clamped to ${MAX_SCAN_SIDE}×${MAX_SCAN_SIDE} — the count below covers less than you asked for`
        : "";
}

/** The element id an option names, or `""`. */
function elementOf(options: ElementOptions): string {
    return String(options.element ?? "");
}

/**
 * The element writer half of `api.grid.mutate`'s callback.
 *
 * The engine types it as `GridMutationWriterElements`
 * (`grid.d.ts:166-189`). Only three methods, and the mod cannot import that type — the
 * engine's `.d.ts` files are not in this mod's dependency graph — so it is declared
 * here as the shape it is used through, which is the same compromise `hostNs` makes.
 */
interface ElementWriter {
    createAtCell: (x: number, y: number, type: string, options?: unknown) => void;
    replaceAtCell: (x: number, y: number, type: string, options?: unknown) => void;
    removeAtCell: (x: number, y: number, options?: unknown) => void;
}

/**
 * The shared body of every **write** action: resolve, then one coherent batch.
 *
 * ## Reads happen *inside* the batch
 *
 * This is the whole reason `mutate` exists rather than a bare loop of
 * `api.elements.*` calls. The engine documents it for "state-dependent grid writes",
 * and its own example reads a cell inside the callback before deciding to write it. So
 * the read, the decision and the write for a cell are one atomic step: the value the
 * action decided on is the value the engine writes over.
 *
 * The previous path could not do that. `context.commit` took a list of mutations that
 * had already been decided, so every read happened in a *separate* tick from the write
 * — which is why the old code needed `expectedElementType` to guard the gap, and why
 * the guard was worth a paragraph of comment. There is no gap here to guard.
 *
 * ## What it costs
 *
 * - **Main-only.** `api.grid.mutate` is ✓ Main / — Worker. The element family used to
 *   run on any thread that delivered a processing context, and now does not. It is the
 *   same Main-only assumption the motion family already rests on.
 * - **No acknowledgement.** `mutate` returns `void`, where `commit` returned a
 *   boolean. The return here therefore means "cells were **queued**", not "the engine
 *   accepted them" — a weaker claim, and the one thing this migration cannot preserve.
 * - **No `expectedElementType`.** The writer's `removeAtCell` takes only
 *   `ElementRemovalOptions` (`skipCollectorCheck`). Compare-and-remove is expressed
 *   structurally instead: the read and the remove are the same atomic step, which is
 *   what the field was emulating in the first place.
 */
function writeCells(
    structure: unknown,
    context: unknown,
    options: unknown,
    label: string,
    decide: (
        writer: ElementWriter,
        cell: { x: number; y: number },
        current: unknown,
        empty: boolean,
    ) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    const ctx = context as ProcessingContext | null;
    // Narrowed by assignment rather than by a second `typeof` on the call: the
    // optional-chain check above does not narrow a property access, so `grid.mutate`
    // stays "possibly undefined" for the compiler even though it was just tested.
    const mutate = hostNs("grid")?.mutate;
    // Hoisted out of the callback: TypeScript does not carry an optional-chained
    // narrowing into a closure, so testing it outside and calling it inside is both the
    // way to satisfy the compiler and the honest shape — the method is captured once,
    // so a context that swapped it mid-batch could not change behaviour halfway.
    const readType = ctx?.getResolvedTypeAtCell;
    const isEmpty = ctx?.isCellEmptyAtCell;
    if (!s || typeof readType !== "function" || typeof mutate !== "function") {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.grid.mutate on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as ElementOptions;
    const { region, clamped } = regionFor(s, o);
    const note = clampNote(clamped, label);
    if (note) console.warn(note);
    const cells = targets(region);

    // Counted rather than returned by the engine: `mutate` is `void`, so this is the
    // only honest signal available. It says the batch was **submitted**, which is a
    // weaker claim than `commit`'s "it landed" and is documented as such at the call.
    let queued = 0;
    mutate((writer: { elements: ElementWriter }) => {
        for (const cell of cells) {
            // Inside the batch, so each read sees the writes before it in the same
            // batch. Two actions over overlapping regions in one process therefore
            // compose, where the old read-then-commit form would have read stale.
            const empty = isEmpty ? isEmpty(cell.x, cell.y) : false;
            const current = empty ? null : readType(cell.x, cell.y);
            if (decide(writer.elements, cell, current, empty)) queued++;
        }
    });
    return queued > 0;
}

/**
 * The `ElementCreateOptions` a set of options asks for, or `undefined` for none.
 *
 * Only the fields with a machine-shaped use are exposed. `dataFields` 1–4 and
 * `skipCollectorCheck` are deliberately left out: they are engine internals a process
 * author has no way to reason about, and an option that is present in the registry but
 * does nothing is worse than one that is absent.
 *
 * `durationTicks` is the one this migration exists for. It sets **both** max and
 * remaining duration, so a spawned element expires on a schedule the process controls
 * — and, unlike `setDuration` in the motion family, it is set at creation and therefore
 * lands **atomically with the create**, in the same transaction, with no window where
 * the cell exists untimed.
 */
function createOptions(options: ElementOptions): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    const ticks = num(options.durationTicks);
    if (ticks > 0) out.durationTicks = ticks;
    const density = Number(options.density);
    if (Number.isFinite(density) && density > 0) out.density = density;
    if (options.freeFalling === true) out.isFreeFalling = true;
    // `particle: { velocity }` spawns **already moving**. This is the only way to launch
    // material in a single atomic call, and it is why the motion family's `toParticle`
    // is not the only route to a flying cell.
    const vx = Number(options.vx);
    const vy = Number(options.vy);
    if (Number.isFinite(vx) && Number.isFinite(vy) && (vx !== 0 || vy !== 0)) {
        out.particle = { velocity: { x: vx, y: vy } };
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

// ── The actions ──────────────────────────────────────────────────────────────

/**
 * The atomic element actions.
 *
 * Exported as **one** table for the `processing` signature. They are declared under
 * `sense`/`act` by role but filed together, because they are one family sharing one
 * region resolver and one write path — the same reasoning as `processorScan` living in
 * `act/index.ts` under a `sense` role: the **role** says what it is for, the **file**
 * says where its signature puts it, and those are independent axes.
 */
export const elementActions = defineActions({
    // ── SENSE ──────────────────────────────────────────────────────────────────

    /**
     * Reads the element at a cell, and **binds** it.
     *
     * The complement of `isElementAtCell`: that one answers a yes/no about an element
     * whose id you already know, this one tells you *what is there* so a later step can
     * act on the answer. Returns the id, or `""` for an empty cell.
     */
    readElement: {
        role: "sense",
        doc: "Reads the element at the cell and returns its id. Bind it with As, then " +
            "use {{name}} in a later step.",
        fn: (structure, context, options) => {
            try {
                const s = structure as StructureLike | null;
                const ctx = context as ProcessingContext | null;
                if (!s || !ctx?.getResolvedTypeAtCell) return "";
                const { region } = regionFor(s, (options ?? {}) as ElementOptions);
                const first = targets(region)[0];
                if (!first) return "";
                const found = ctx.getResolvedTypeAtCell(first.x, first.y);
                return found === undefined || found === null ? "" : String(found);
            } catch (e) {
                console.warn("[md-my-hown-mod:process] readElement failed", e);
                return "";
            }
        },
    },

    /**
     * Counts cells holding an element, over the region.
     *
     * The one that makes a matrix useful: a 4×4 sorter asks "how many of my 16 cells
     * hold dirt?" rather than sixteen separate questions. Returns a **number**, so it
     * compares directly — `8` is truthy, `0` is not.
     */
    countElements: {
        role: "sense",
        doc: "Counts cells holding `element` in the region. Returns a number — bind it " +
            "with As to compare against a threshold.",
        fn: (structure, context, options) => {
            try {
                const s = structure as StructureLike | null;
                const ctx = context as ProcessingContext | null;
                if (!s || !ctx?.getResolvedTypeAtCell) return 0;
                const o = (options ?? {}) as ElementOptions;
                const want = elementOf(o);
                const { region, clamped } = regionFor(s, o);
                const note = clampNote(clamped, "countElements");
                if (note) console.warn(note);
                let n = 0;
                for (const cell of targets(region)) {
                    if (ctx.getResolvedTypeAtCell(cell.x, cell.y) === want) n++;
                }
                return n;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] countElements failed", e);
                return 0;
            }
        },
    },

    /**
     * Counts **empty** cells — the region's free space.
     *
     * Not `countElements` with a blank `element`: `getResolvedTypeAtCell` returns a
     * *terrain* type as readily as an element, so an empty cell is not an element with
     * an empty id. Only `isCellEmptyAtCell` answers this, and a machine that fills its
     * own footprint needs it.
     */
    countEmpty: {
        role: "sense",
        doc: "Counts cells in the region that hold neither element nor terrain. This is " +
            "the free space.",
        fn: (structure, context, options) => {
            try {
                const s = structure as StructureLike | null;
                const ctx = context as ProcessingContext | null;
                if (!s || !ctx?.isCellEmptyAtCell) return 0;
                const { region } = regionFor(s, (options ?? {}) as ElementOptions);
                let n = 0;
                for (const cell of targets(region)) {
                    if (ctx.isCellEmptyAtCell(cell.x, cell.y)) n++;
                }
                return n;
            } catch (e) {
                console.warn("[md-my-hown-mod:process] countEmpty failed", e);
                return 0;
            }
        },
    },

    // ── ACT ────────────────────────────────────────────────────────────────────

    /**
     * Writes an element over the region, whatever was there.
     *
     * One `create` mutation per cell, because `create` **overwrites** — that is the
     * engine's own behaviour and the reason `processorConvert` works at all.
     * `replaceElement` with `element` set and no offsets is `processorConvert` with
     * `dy: -1`; this one is parameterised.
     */
    /**
     * Writes an element over the region, whatever was there.
     *
     * `replaceAtCell` rather than `createAtCell`, even though both overwrite: the
     * writer distinguishes them and the honest call is the one that says "I mean to
     * replace". The engine's `create` on `context.commit` did both, which is why the
     * old `replaceElement` and `createElement` shared a mutation kind and differed only
     * in whether they checked first. Here the two are different calls.
     */
    replaceElement: {
        role: "act",
        doc: "Writes `element` over every cell in the region, replacing what was there.",
        fn: (structure, context, options) => {
            const o = (options ?? {}) as ElementOptions;
            const want = elementOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] replaceElement: no element set");
                return false;
            }
            const opts = createOptions(o);
            return writeCells(
                structure,
                context,
                options,
                "replaceElement",
                (writer, cell) => {
                    writer.replaceAtCell(cell.x, cell.y, want, opts);
                    return true;
                },
            );
        },
    },

    /**
     * Writes an element only into **empty** cells.
     *
     * One `isCellEmptyAtCell` call per cell is the whole difference from
     * `replaceElement`, and it is the difference between a machine that fills gaps and
     * one that bulldozes.
     *
     * The emptiness test rather than "the id is not already mine", because a cell
     * holding a *terrain* is not empty but is also not this element — and overwriting
     * bedrock is the one thing a fill should never do silently.
     *
     * The test now runs **inside** the batch, so the emptiness it checks and the create
     * it guards are the same atomic step. There is no tick in between for the simulation
     * to fill the cell.
     */
    createElement: {
        role: "act",
        doc: "Writes `element` into every **empty** cell in the region, leaving anything " +
            "already there alone.",
        fn: (structure, context, options) => {
            const o = (options ?? {}) as ElementOptions;
            const want = elementOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] createElement: no element set");
                return false;
            }
            const opts = createOptions(o);
            return writeCells(
                structure,
                context,
                options,
                "createElement",
                (writer, cell, _current, empty) => {
                    if (!empty) return false;
                    writer.createAtCell(cell.x, cell.y, want, opts);
                    return true;
                },
            );
        },
    },

    /**
     * Empties the region.
     *
     * A compare-and-remove — `expectedElementType` is what was read, not a blind
     * `remove`. Over a footprint, read-then-remove in the same tick, the blind form
     * would delete whatever the simulation moved into the cell in between; the compare
     * form is the engine's own atomicity rather than a lock we would have to hold.
     */
    /**
     * Empties the region.
     *
     * The compare-and-remove guard is now **structural** rather than a field. The old
     * path read every cell, then committed `{kind: "remove", expectedElementType}` in a
     * later tick, and the field existed to close the gap: without it, a cell the
     * simulation refilled in between would have been emptied by mistake.
     *
     * Here there is no gap to close. The read that decides and the `removeAtCell` that
     * acts on it are the **same atomic step** inside one `api.grid.mutate` batch, which
     * is strictly stronger than the field: the old guard only protected removals, and
     * only because it was the one mutation kind that had it.
     */
    emptyCells: {
        role: "act",
        doc: "Removes the element from every cell in the region, but only if the cell " +
            "still holds what was read.",
        fn: (structure, context, options) => {
            return writeCells(
                structure,
                context,
                options,
                "emptyCells",
                (writer, cell, _current, empty) => {
                    if (empty) return false;
                    writer.removeAtCell(cell.x, cell.y);
                    return true;
                },
            );
        },
    },

    /**
     * **Transforms** an element: where the region holds `from`, it becomes `to`.
     *
     * The action the brief names, and the one that turns a process into a *machine*:
     * it is conditional, so the same process can mean "dirt becomes sand" over one
     * footprint and "sand becomes dirt" over another by changing two ids.
     *
     * A blank `from` means "anything at all", which makes this a normaliser — every
     * element in the region becomes `to`. That is a real mode rather than a forgotten
     * field, and it is the only way to express it without a second action. A cell
     * already holding `to` is skipped: it would be a valid mutation, but one that
     * fires every tick forever for no change.
     */
    transformElement: {
        role: "act",
        doc: "Where the region holds `from`, writes `to`. Leave `from` blank to convert " +
            "whatever element is there.",
        fn: (structure, context, options) => {
            const o = (options ?? {}) as ElementOptions;
            // `to`, not `element`. This is the one action in the family that names its
            // target differently, because it names **two** elements and calling the
            // output one of them would leave the input nameless. `elementOf` is for
            // the single-element actions; reading it here would make the field the
            // panel shows (`To element`) the one the action ignores.
            const to = String(o.to ?? "");
            if (!to) {
                console.warn("[md-my-hown-mod:process] transformElement: no target element set");
                return false;
            }
            const from = String(o.from ?? "");
            const opts = createOptions(o);
            return writeCells(
                structure,
                context,
                options,
                "transformElement",
                (writer, cell, current, empty) => {
                    if (empty) return false;
                    if (from && current !== from) return false;
                    if (current === to) return false;
                    writer.createAtCell(cell.x, cell.y, to, opts);
                    return true;
                },
            );
        },
    },
});
