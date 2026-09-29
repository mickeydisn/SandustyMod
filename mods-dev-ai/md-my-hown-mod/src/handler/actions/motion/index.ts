/**
 * MOTION — velocity, duration, teleporting and particles, over a region.
 *
 * ## How this family differs from ELEMENT, and why
 *
 * The element family writes through `context.commit`, which takes a **batch**. The
 * engine applies one transaction, so a footprint write is atomic and a sorter can
 * never half-update. These actions cannot have that, and the reason is worth stating
 * rather than discovering:
 *
 * `commit` has exactly one payload — a list of cell mutations, and the only kinds the
 * engine knows are `create` and `remove` (the `.d.ts` types it `commit(mutations:
 * unknown)`, so the shape is not in the type system at all). Velocity, duration and
 * teleporting are **not** mutations. There is no `{ kind: "setVelocity" }`, and adding
 * one to a payload the engine will not read would be the worst kind of bug: it
 * compiles, it commits, it returns `true`, and nothing moves.
 *
 * So these go through `api.elements.*` instead. The cost is real and it is stated in
 * every doc string here:
 *
 * 1. **Not atomic.** One call per cell. A footprint write is N independent writes.
 * 2. **Deferred.** Main-entry writes apply at the flush, so a read in the same tick
 *    sees the **old** value. A program that sets a velocity and then counts is
 *    counting last tick's world.
 *
 * Both are properties of the engine, not of this code, and both are the price of the
 * capability. A "batched" version that lied about either would be worse than none.
 *
 * ## Which thread
 *
 * `api.structures.processing.register` is **Main-only** (availability matrix: Main ✓,
 * Worker —), and this mod ships **no** `workerEntry`, so every processor it registers
 * runs on Main. That is what makes `hostNs("elements")` reach the full namespace here
 * at all. The official examples rely on the same thing: `06-smart-conveyor-filter.md`
 * calls `setVelocityAtCell` and `23-sandstorm-engine.md` calls
 * `addParticleVelocityAtCell` from inside `process()`.
 *
 * If the mod ever adds a `workerEntry`, this whole file is what breaks, and the
 * symptom would be silent no-ops rather than an error.
 *
 * @module
 */
import { defineActions, hostNs } from "../../core/types.ts";
import { shapeSize } from "../../core/cell-region.ts";
import { regionFor } from "../element/index.ts";

/** A structure, as far as these actions are concerned. */
interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}

/** A 2D vector, as the engine's `Vector2`. */
interface Vector2 {
    x: number;
    y: number;
}

/**
 * Options for the motion family.
 *
 * The region options (`dx`/`dy`/`size`/`footprint`/`mx`/`my`) are deliberately **not**
 * re-declared: they are read by `regionFor`, which this family shares with the element
 * family, so there is one implementation of "where" and it cannot drift.
 */
interface MotionOptions {
    /** Velocity X. A float — velocity is not measured in cells. */
    vx?: unknown;
    /** Velocity Y. Negative is up. */
    vy?: unknown;
    /** Duration in simulation ticks, for `setDuration`. */
    ticks?: unknown;
    /** `true` also updates max duration, so a timed element re-arms each cycle. */
    rearm?: unknown;
    /** Destination offset from the region origin, for `teleportElement`. */
    tx?: unknown;
    ty?: unknown;
    /** Clamp for `addVelocity`, in cells per second. */
    maxSpeed?: unknown;
    /** Side for `findFreeCell`'s search square. */
    size?: unknown;
    /** `true` to convert a cell to a particle — read from the panel, so a string. */
    particle?: unknown;
}

/** A finite number, or `fallback`. `NaN` reaching the engine is not a cell. */
function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** `true` only for a genuine boolean or the panel's `"true"`. */
function flag(value: unknown): boolean {
    return value === true || value === "true";
}

/**
 * `api.elements`, or `undefined` on a thread that does not have it.
 *
 * `hostNs` returns an open record, so every member read here is optional-chained and
 * `typeof`-checked at the call site. That is the same shape `feel/index.ts` uses
 * (`hostNs("ui")?.toast?.(…)`), and it is deliberate: naming the type would mean
 * writing `any` in this file, and the point of `hostNs` is that exactly one file in
 * the action system casts.
 */
function elements() {
    return hostNs("elements");
}

/** A velocity vector, from `vx`/`vy`. */
function vectorOf(options: MotionOptions): Vector2 {
    return { x: num(options.vx), y: num(options.vy) };
}

/**
 * The cells a motion action touches.
 *
 * The range is resolved by the **shared** `regionFor`, so "the cell above me" means the
 * same thing in this family as in the element one. A clamp is reported once rather than
 * swallowed: a `size: 500` that quietly covered 64×64 would be a wrong answer dressed as
 * a right one.
 *
 * This file used to keep its own copy of the mask→cells conversion. Two copies of
 * "which cells does this mean" is two things to keep equal, and there is now one — the
 * `Range` that `regionFor` returns. An empty list means the address was refused, which
 * every caller already treats as "nothing to do", so the refusal needs no plumbing.
 */
function regionCells(
    structure: StructureLike | null,
    options: MotionOptions,
    label: string,
): { x: number; y: number }[] {
    const resolved = regionFor(structure ?? {}, options as never);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:process] ${label}: ${resolved.error}`);
        return [];
    }
    if (resolved.clamped) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: range clamped to 64×64 — this call covered ` +
                "less than you asked for",
        );
    }
    return resolved.range.map((cell) => ({ x: cell.x, y: cell.y }));
}

/**
 * Call an `api.elements` method on every cell in the region, and report whether any
 * call happened.
 *
 * One helper for all four write actions, because the loop, the missing-namespace check
 * and the "nothing to do" answer are identical in each — and the per-cell nature of the
 * write is the part that must not accidentally be made to look atomic.
 *
 * `call` receives the namespace as the same open record `hostNs` returns rather than a
 * named type. Naming it would put `any` in this file's signature, and the argument the
 * helper is given has to be able to hold the untyped namespace without re-declaring it.
 */
// deno-lint-ignore no-explicit-any -- the parameter is `hostNs`'s return type verbatim.
type ElementsNs = Record<string, any>;

function overRegion(
    structure: unknown,
    options: unknown,
    label: string,
    call: (api: ElementsNs, cell: { x: number; y: number }) => boolean,
): boolean {
    const s = (structure ?? null) as StructureLike | null;
    const api = elements();
    if (!s || !api) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: this thread has no api.elements, so nothing ` +
                "was changed",
        );
        return false;
    }
    let touched = 0;
    for (const cell of regionCells(s, (options ?? {}) as MotionOptions, label)) {
        if (call(api, cell)) touched++;
    }
    return touched > 0;
}

// ── The actions ──────────────────────────────────────────────────────────────

/**
 * Velocity, duration, teleporting and particles.
 *
 * Exported as one table for the `processing` signature, for the same reason the
 * element family is: they share one region resolver, and the role axis (which decides
 * the panel section) stays independent of the signature axis (which decides the
 * argument list).
 */
export const motionActions = defineActions({
    // ── SENSE ──────────────────────────────────────────────────────────────────

    /**
     * Reads a cell's particle velocity, and **binds** it.
     *
     * Returns the **speed** — the magnitude of the vector — rather than `{x, y}`,
     * because that is the number a program actually branches on ("is this moving fast
     * enough?"), and a bound value that is an object cannot be compared by any `decide`
     * step. `-1` means "no particle there": a speed is never negative, so it can never
     * be confused with a real answer of `0`.
     */
    getVelocity: {
        role: "sense",
        doc: "Reads the particle speed at the first cell of the region and returns it. " +
            "Bind it with As. Returns -1 when there is no particle to measure.",
        fn: (structure, _context, options) => {
            try {
                const s = (structure ?? null) as StructureLike | null;
                const api = elements();
                if (!s || !api?.getVelocityAtCell) return -1;
                const first = regionCells(s, (options ?? {}) as MotionOptions, "getVelocity")[0];
                if (!first) return -1;
                const v = api.getVelocityAtCell(first.x, first.y) as Vector2 | null | undefined;
                if (!v) return -1;
                return Math.hypot(num(v.x), num(v.y));
            } catch (e) {
                console.warn("[md-my-hown-mod:process] getVelocity failed", e);
                return -1;
            }
        },
    },

    /**
     * Finds a free cell near the structure, and **binds** it.
     *
     * The one action in either family whose engine signature is not a region:
     * `findFreeCellInStructure(x, y, size)` takes a **side**, not a rectangle. So `size`
     * here is the search square and the answer is a single cell.
     *
     * Returns that cell's **linear index** as a number, or `-1` for "nowhere free". A
     * pair of coordinates cannot be returned usefully — the context binds one value per
     * name and there is no tuple in the type system — so an index is the honest
     * single-number answer. Default size is the structure's own `shape`, so a 4×4
     * machine looks inside itself.
     */
    findFreeCell: {
        role: "sense",
        doc: "Finds a free cell within `size` cells of the structure. Returns its index " +
            "as a number, or -1 when the whole area is occupied.",
        fn: (structure, _context, options) => {
            try {
                const s = (structure ?? null) as StructureLike | null;
                const api = elements();
                if (!s || !api?.findFreeCellInStructure) return -1;
                const o = (options ?? {}) as MotionOptions;
                const own = shapeSize(s.shape);
                // An explicit `size` wins; otherwise the structure's own footprint, so a
                // 4×4 machine looks for room inside its 4×4 rather than in its own cell.
                const side = Math.max(1, Math.trunc(num(o.size, Math.max(own.width, own.height))));
                const found = api.findFreeCellInStructure(
                    num(s.x),
                    num(s.y),
                    side,
                ) as Vector2 | null | undefined;
                if (!found) return -1;
                return num(found.y) * side + num(found.x);
            } catch (e) {
                console.warn("[md-my-hown-mod:process] findFreeCell failed", e);
                return -1;
            }
        },
    },

    // ── ACT ────────────────────────────────────────────────────────────────────

    /**
     * Sets particle velocity on every cell in the region.
     *
     * **Particles only.** A falling grain of sand is moved by the physics solver and
     * ignores this, which is why the doc string says so in the panel: "set velocity" on
     * a structure that is not made of particles is the most likely misreading of the
     * whole family.
     */
    setVelocity: {
        role: "act",
        doc: "Sets the particle velocity (vx, vy) on every cell in the region. Only " +
            "affects particles — use toParticle to turn a cell into one first.",
        fn: (structure, _context, options) => {
            const v = vectorOf((options ?? {}) as MotionOptions);
            return overRegion(structure, options, "setVelocity", (api, cell) => {
                if (typeof api.setVelocityAtCell !== "function") return false;
                api.setVelocityAtCell(cell.x, cell.y, { x: v.x, y: v.y });
                return true;
            });
        },
    },

    /** Adds to particle velocity, optionally clamped to a maximum speed. */
    addVelocity: {
        role: "act",
        doc: "Adds (vx, vy) to the particle velocity in the region. Set maxSpeed to " +
            "clamp the result in cells per second.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as MotionOptions;
            const v = vectorOf(o);
            const max = num(o.maxSpeed, 0);
            return overRegion(structure, options, "addVelocity", (api, cell) => {
                if (typeof api.addParticleVelocityAtCell !== "function") return false;
                // Omitted rather than passed as 0: the engine reads a present 0 as a
                // real clamp and would stop the cell dead.
                if (max > 0) api.addParticleVelocityAtCell(cell.x, cell.y, v, max);
                else api.addParticleVelocityAtCell(cell.x, cell.y, v);
                return true;
            });
        },
    },

    /**
     * Sets how many ticks a cell's element has left.
     *
     * `rearm` also raises the element's **max** duration, which is what makes a timed
     * element fire again on the next cycle rather than expiring once and staying gone.
     */
    setDuration: {
        role: "act",
        doc: "Sets the remaining duration in ticks for every cell in the region. Set " +
            "rearm to also raise the maximum, so it fires again next cycle.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as MotionOptions;
            const ticks = Math.max(0, Math.trunc(num(o.ticks)));
            const rearm = flag(o.rearm);
            return overRegion(structure, options, "setDuration", (api, cell) => {
                if (typeof api.setDurationAtCell !== "function") return false;
                api.setDurationAtCell(cell.x, cell.y, ticks, { updateMax: rearm });
                return true;
            });
        },
    },

    /**
     * Moves whatever is in the region by an offset.
     *
     * `tx`/`ty` are offsets from the region's own origin, so `ty: 1` moves the content
     * **down** one — the region is read as a group and shifted, which is what makes this
     * a machine part rather than a per-cell shuffle. A cell whose destination is
     * occupied is left alone by the engine; that is not pre-checked here, because only
     * the engine knows what a blocked move does, and guessing would change the answer.
     */
    teleportElement: {
        role: "act",
        doc: "Moves everything in the region by the (tx, ty) offset. ty: 1 moves it down " +
            "one cell. Cells that would land on something are not moved.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const o = (options ?? {}) as MotionOptions;
            const api = elements();
            if (!s || typeof api?.teleportBetweenCells !== "function") {
                console.warn(
                    "[md-my-hown-mod:process] teleportElement: this thread has no " +
                        "teleportBetweenCells, so nothing moved",
                );
                return false;
            }
            const dx = Math.trunc(num(o.tx));
            const dy = Math.trunc(num(o.ty));
            // A zero offset would call the engine once per cell to achieve nothing.
            if (dx === 0 && dy === 0) return false;
            const cells = regionCells(s, o, "teleportElement");
            for (const cell of cells) {
                api.teleportBetweenCells(cell.x, cell.y, cell.x + dx, cell.y + dy);
            }
            return cells.length > 0;
        },
    },

    /**
     * Turns cells into flying particles with an initial velocity.
     *
     * The one that actually **launches** something. `setVelocity` on its own does
     * nothing to a non-particle, and that distinction is the whole reason this action
     * exists separately.
     */
    toParticle: {
        role: "act",
        doc: "Turns every cell in the region into a particle moving at (vx, vy). This is " +
            "what actually launches material — setVelocity alone will not move sand.",
        fn: (structure, _context, options) => {
            const v = vectorOf((options ?? {}) as MotionOptions);
            return overRegion(structure, options, "toParticle", (api, cell) => {
                if (typeof api.convertToParticleAtCell !== "function") return false;
                api.convertToParticleAtCell(cell.x, cell.y, { x: v.x, y: v.y });
                return true;
            });
        },
    },
});
