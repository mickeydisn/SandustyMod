/**
 * runProfile — the per-tick driver for an element Profile.
 *
 * Phase order: SENSE → GROW → CRYSTALLIZE (once mature) → MOVE.
 *
 * The pipeline samples ONE 5x5 element-type window (`Ctx.sense`) at tick
 * start — the only engine reads on the hot path. Every move fn adds its
 * single-channel votes into `Ctx.votes`; the pipeline reduces the summed
 * matrix with the centroid rule (score-weighted vector → one 8-way step)
 * and applies a single adjacent swap. Grow / trail-eat fns read the same
 * sense matrix instead of issuing their own reads.
 */
import type { Ctx, Profile, SenseMatrix } from "./types.ts";
import { Grid } from "./grid.ts";
import { resolveNum, roll } from "./resolve.ts";
import { Vote } from "./vote.ts";

export const SENSE_SIZE = 5;
const SENSE_N = SENSE_SIZE * SENSE_SIZE;
const SENSE_HALF = Math.floor(SENSE_SIZE / 2);
const SENSE_CENTER = SENSE_HALF * SENSE_SIZE + SENSE_HALF;

// Shared per-tick scratch (single-threaded worker: safe to reuse).
const senseCells = new Int32Array(SENSE_N);
const voteAcc = new Float64Array(SENSE_N);

function sampleSense(x: number, y: number): SenseMatrix {
    for (let dy = -SENSE_HALF; dy <= SENSE_HALF; dy++) {
        for (let dx = -SENSE_HALF; dx <= SENSE_HALF; dx++) {
            const i = (dy + SENSE_HALF) * SENSE_SIZE + (dx + SENSE_HALF);
            let t = 0;
            try {
                t = Grid.getTypeAt(x + dx, y + dy) ?? 0;
            } catch {
                t = 0;
            }
            senseCells[i] = t;
        }
    }
    return {
        size: SENSE_SIZE,
        half: SENSE_HALF,
        cells: senseCells,
        center: SENSE_CENTER,
    };
}

/** Centroid reduce: score-weighted vector → one 8-way step. Zero = no move. */
export function reduceVotes(
    votes: Float64Array,
    size: number,
    center: number,
    threshold: number,
): { dx: number; dy: number } {
    return Vote.reduce(votes, size, center, threshold);
}

/**
 * Run the grow/crystallize/move pipeline for one seed cell.
 * Returns true when the profile ran (caller should cancel the vanilla
 * update), false when the cell is not a valid seed-in-liquid (caller
 * should let the vanilla update run).
 */
export function runProfile(x: number, y: number, profile: Profile): boolean {
    // Sample the 5x5 sense window ONCE — the only neighbour reads this tick.
    // (Seed + liquid guards stay engine reads: they gate whether we run at all.)
    const sense = sampleSense(x, y);
    if (sense.cells[SENSE_CENTER] !== profile.seedType) return false;
    let liquidNear = false;
    for (let i = 0; i < SENSE_N; i++) {
        if (i !== SENSE_CENTER && sense.cells[i] === profile.liquidType) {
            liquidNear = true;
            break;
        }
    }
    if (!liquidNear) {
        Grid.resetFieldAt(x, y, profile.ageField);
        return false;
    }
    // Is valid but do nothing a this tick
    if (!roll(resolveNum(profile.tickSpeed))) return true;

    let ctx: Ctx = {
        x,
        y,
        profile,
        sense,
        votes: Vote.clear(voteAcc),
        age: Grid.readFieldAt(x, y, profile.ageField),
        blocked: false,
        tryInstant: false,
        stuck: false,
        trailEat: [],
    };

    // Grow until the seed is blocked or matched.
    let delta = 0;
    for (const fn of profile.grow) {
        const result = fn(ctx);
        if (ctx.blocked) break;
        if (result.matched) {
            delta = result.delta || 0;
            break;
        }
    }
    if (delta > 0) {
        ctx.age += delta;
        Grid.writeFieldAt(ctx.x, ctx.y, profile.ageField, ctx.age);
    }

    // Crystallize the seed if it is mature.
    const need = profile.growAge();
    if (need > 0 && ctx.age >= need) {
        let ok = false;
        for (const fn of profile.crystallization) {
            if (fn(ctx)) {
                ok = true;
                break;
            }
        }
        if (!ok) {
            Grid.resetFieldAt(ctx.x, ctx.y, profile.ageField);
        }
    }

    // MOVE: every move fn adds its single-channel votes into ctx.votes;
    // the pipeline reduces the summed matrix once (see `Vote.reduce`, which
    // also ignores the centre cell — a seed never votes for itself).
    //
    // Previous movement vector, read from the seed's own cell BEFORE any
    // swap — the engine's swap may not carry data fields, so reading after
    // the move would return the previous occupant's values.
    let pvx = 0;
    let pvy = 0;
    if (profile.memField != null) {
        pvx = Grid.readVecAt(ctx.x, ctx.y, profile.memField);
        pvy = Grid.readVecAt(ctx.x, ctx.y, profile.memField + 1);
    }
    for (const fn of profile.moves) {
        ctx = fn(ctx);
    }

    // Memory keeps the RAW vector — wall repulsion must survive in the flow
    // memory for bounce/steering — but the STEP direction is chosen only
    // among cells the seed can actually enter. A vote sitting on a blocked
    // cell can never become a legal step; letting it steer just aims the
    // single swap attempt at the wall (e.g. "down" into the floor), the
    // swap fails, and the legal directions (e.g. back up) are never tried.
    const tick = Vote.vector(ctx.votes, SENSE_SIZE, SENSE_CENTER);
    const passable = new Set<number>(ctx.profile.passableTypes ?? []);
    passable.add(ctx.profile.liquidType);
    const s = ctx.sense;
    for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const i = (oy + s.half) * s.size + (ox + s.half);
            if (!passable.has(s.cells[i] ?? 0)) ctx.votes[i] = 0;
        }
    }

    const { dx, dy } = Vote.reduce(ctx.votes, SENSE_SIZE, SENSE_CENTER, 0);

    // Step into the occupied/target cell (single adjacent step).
    let moved = false;
    if (dx !== 0 || dy !== 0) {
        const ox = ctx.x;
        const oy = ctx.y;
        const r = Grid.swapCell(
            ctx.x,
            ctx.y,
            ctx.x + dx,
            ctx.y + dy,
            ctx.profile.passableTypes
                ? [ctx.profile.liquidType, ...ctx.profile.passableTypes]
                : ctx.profile.liquidType,
        );
        if (r) {
            moved = true;
            // Move succeeded — apply deferred trail-eat to the vacated cell.
            for (const eat of ctx.trailEat) {
                if (roll(resolveNum(eat.chance))) Grid.eatAt(ox, oy, eat.replaceType);
            }
            ctx = { ...ctx, x: r.x, y: r.y };
        }
    }

    // Vote memory: integrate this tick's raw vote vector with the previous
    // one (written AFTER the swap so the memory sits on the seed's final
    // cell whether or not the engine's swap carries data fields).
    //
    //   v' = v * memDecay + votes
    //
    // `memDecay` (default 0 = old behaviour: memory is just this tick's
    // votes and wipes out on idle ticks) turns the stored vector into a
    // decaying velocity — the momentum `Move.inertia` reads back.
    //
    // Bounce: when the seed had a pending velocity but the reduce produced
    // no step while votes WERE cast (wall repulsion cancelled them, or the
    // target cell was blocked), flip the pending vector — a collision
    // reflection — so the next ticks push away from the surface.
    if (profile.memField != null) {
        const d = profile.memDecay ?? 0;
        // `tick` was captured before passability gating (raw votes).
        let vx = pvx * d + tick.vx;
        let vy = pvy * d + tick.vy;
        if (!moved && profile.memBounce && (pvx !== 0 || pvy !== 0) && Vote.any(ctx.votes)) {
            vx = -pvx * d;
            vy = -pvy * d;
        }
        Grid.writeVecAt(ctx.x, ctx.y, profile.memField, vx);
        Grid.writeVecAt(ctx.x, ctx.y, profile.memField + 1, vy);
    }

    // Final swap cell: the engine may revisit it later in this sweep — that
    // is vanilla behaviour, left untouched.
    return true;
}
