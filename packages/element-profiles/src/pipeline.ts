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
    for (const fn of profile.moves) {
        ctx = fn(ctx);
    }

    const { dx, dy } = Vote.reduce(ctx.votes, SENSE_SIZE, SENSE_CENTER, 0);

    // Step into the occupied/target cell (single adjacent step).
    if (dx !== 0 || dy !== 0) {
        const ox = ctx.x;
        const oy = ctx.y;
        const r = Grid.swapCell(
            ctx.x,
            ctx.y,
            ctx.x + dx,
            ctx.y + dy,
            ctx.profile.liquidType,
        );
        if (r) {
            // Move succeeded — apply deferred trail-eat to the vacated cell.
            for (const eat of ctx.trailEat) {
                if (roll(resolveNum(eat.chance))) Grid.eatAt(ox, oy, eat.replaceType);
            }
            ctx = { ...ctx, x: r.x, y: r.y };
        }
    }

    return true;
}
