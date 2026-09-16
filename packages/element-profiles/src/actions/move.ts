/**
 * Move channels — the vote producers of the move phase.
 *
 * Every action here only *votes*: it stamps signed weights into `ctx.votes`
 * through `Vote.channel`. The pipeline reduces that matrix once per tick
 * (`Vote.reduce`, centroid rule) and performs a single 8-way swap, so no
 * action needs to know `dx`/`dy` or touch the engine.
 *
 * Naming: a move spec's fields sit inline on the spec (no nested `opts`):
 *   { kind: "channel", matchKeys: [...], weight: 1, mask: [...] }
 *
 * `Vote` (vote.ts) owns the matrix itself: masking, stamping and the
 * centroid reduce — this file only builds the channels.
 */
import type { Ctx, MoveFn } from "../types.ts";
import type { DirectionName, TElementType } from "@sandmd/shared";
import { resolveNum, roll } from "../resolve.ts";
import { Grid } from "../grid.ts";
import { Sense } from "../sense.ts";
import { Vote, type VoteMask } from "../vote.ts";

/** Ray settings for one direction group, resolved per tick. */
export interface ColumnForceOpts {
    /** 0 = off. Sign picks attract (+1) / repel (-1) stamping. */
    rateFn?: number | (() => number);
    /** Types that make the ray opaque and vote; empty = any non-excluded. */
    matchTypes?: readonly TElementType[];
    /** Compass groups to cast from. Default `["bottom"]`. */
    directions?: readonly CompassGroup[];
    /**
     * Max ray length in cells, clamped to the sense window: with the 5x5
     * window a ray can only reach 2 cells, so `rangeN > 2` behaves as 2.
     * Default 10.
     */
    rangeNFn?: number | (() => number);
    /** Max rays allowed to vote per tick. Default 3. */
    maxKFn?: number | (() => number);
    /** Extra transparent types (liquid is always transparent). */
    freeTypes?: readonly TElementType[];
    /** Types the ray never votes for (seed type is always excluded). */
    excludeTypes?: readonly TElementType[];
}

/** One vote channel: a selection rule, a signed weight, an optional mask. */
export interface ChannelOpts {
    /** Types that vote. Empty/omitted = any non-excluded type. */
    matchTypes?: readonly (TElementType | null | undefined)[] | TElementType | null;
    /** Types that never vote (seed type is always excluded). */
    excludeTypes?: readonly (TElementType | null | undefined)[] | TElementType | null;
    /** When true, empty cells vote as well. */
    matchEmpty?: boolean;
    /** Signed vote strength. Negative = repulsion. */
    weight: number | (() => number);
    /** Global multiplier on `weight` (0 = off). */
    rate?: number | (() => number);
    /** 0-100 chance gate per tick. */
    chance?: number | (() => number);
    /** Per-offset multipliers. Omit = all 1. Centre is always ignored. */
    mask?: VoteMask;
}

/** Vote-memory channel settings — see `Move.memory` and `Move.inertia`. */
export interface MemoryOpts {
    /** 0-100 chance gate per tick. Default 100. */
    chance?: number | (() => number);
    /** Signed alignment strength. Negative = anti-align (disperse). */
    weight: number | (() => number);
    /** Global multiplier on `weight` (0 = off). */
    rate?: number | (() => number);
    /** Per-offset multipliers over the 5x5 window. Omit = all 1. */
    mask?: VoteMask;
}

/**
 * Inertia channel settings — see `Move.inertia`. Same fields as
 * `MemoryOpts`; the vote shape comes from the seed's own stored vector.
 */
export interface InertiaOpts extends MemoryOpts {
    /**
     * `"full"` (default): signed dot gradient — cells ahead of the flow get
     * positive votes, cells behind get negative ones (momentum with pull).
     * `"ahead"`: only offsets in the flow hemisphere vote (pure drift).
     */
    mode?: "full" | "ahead";
}

/** Trailing eat intent, applied by the pipeline after a successful swap. */
export interface EatOpts {
    /** 0-100 chance per tick, rolled after the move happened. */
    chance: number | (() => number);
    /** What to put in the eaten cell. `null` = clear to empty. */
    replaceType?: TElementType | null;
}

/**
 * Compass groups understood by `columnForce` / `dirSteps`: every
 * `DirectionName` from `@sandmd/shared` (the single source of truth) plus
 * `"all"` for the full 8-way spread.
 */
export type CompassGroup = DirectionName | "all";

/** 8-neighbour offsets in `Move.random()` draw order (up, then clockwise). */
const DX8 = [0, 1, 1, 1, 0, -1, -1, -1];
const DY8 = [-1, -1, 0, 1, 1, 1, 0, -1];

/** Expand a compass group name into unit steps (8-way max). */
function dirSteps(name: CompassGroup): [number, number][] {
    switch (name) {
        case "top":
            return [[0, -1], [-1, -1], [1, -1]];
        case "bottom":
            return [[0, 1], [-1, 1], [1, 1]];
        case "left":
            return [[-1, 0], [-1, -1], [-1, 1]];
        case "right":
            return [[1, 0], [1, -1], [1, 1]];
        case "sides":
            return [[-1, 0], [1, 0]];
        case "cross":
            return [[1, 1], [-1, 1], [1, -1], [-1, -1]];
        default:
            return [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    }
}

/**
 * ColumnForce ray on the sense window: walk up to `rangeN` cells from the
 * seed along (`dx`,`dy`), skipping `free` cells; the first non-free cell
 * votes ±1 at its own window position when it is a match (or any non-free,
 * non-excluded type when `match` is empty).
 */
function columnRay(
    ctx: Ctx,
    dx: number,
    dy: number,
    rangeN: number,
    rate: number,
    match: Set<number>,
    free: Set<number>,
    exclude: Set<number>,
): boolean {
    const steps = Math.min(rangeN, ctx.sense.half);
    for (let n = 1; n <= steps; n++) {
        const ox = dx * n;
        const oy = dy * n;
        const t = Sense.at(ctx.sense, ox, oy);
        if (t === 0 || free.has(t)) continue; // transparent / empty: see through
        const hit = match.size > 0 ? match.has(t) : !exclude.has(t);
        if (hit) {
            Vote.add(ctx.votes, Sense.index(ctx.sense, ox, oy), rate > 0 ? 1 : -1);
            return true;
        }
        return false; // first opaque cell decides the ray
    }
    return false;
}

export const Move = {
    /** Vote one cell left or right (fair coin). */
    side(chanceFn: number | (() => number)): MoveFn {
        return (ctx) => {
            const chance = resolveNum(chanceFn);
            if (!roll(chance) || ctx.sense.half < 1) return ctx;
            const dir = Math.random() < 0.5 ? -1 : 1;
            Vote.addAt(ctx.votes, ctx.sense, dir, 0, 1);
            return ctx;
        };
    },

    /** Vote the cell above. */
    up(chanceFn: number | (() => number)): MoveFn {
        return (ctx) => {
            if (!roll(resolveNum(chanceFn)) || ctx.sense.half < 1) return ctx;
            Vote.addAt(ctx.votes, ctx.sense, 0, -1, 1);
            return ctx;
        };
    },

    /** Vote the cell below. */
    down(chanceFn: number | (() => number)): MoveFn {
        return (ctx) => {
            if (!roll(resolveNum(chanceFn)) || ctx.sense.half < 1) return ctx;
            Vote.addAt(ctx.votes, ctx.sense, 0, 1, 1);
            return ctx;
        };
    },

    /**
     * Random-matrix walk: one uniform draw over the window offsets allowed by
     * `mask` (default: the 8 neighbours), voting the picked cell. Same shape
     * as stacking `side`/`up`/`down`, but uniform across all allowed offsets.
     * The draw list is compiled once from the mask (centre always excluded).
     */
    random(chanceFn: number | (() => number), mask?: VoteMask): MoveFn {
        let dirs: number[] | null = null; // flat window indices
        return (ctx) => {
            if (!roll(resolveNum(chanceFn)) || ctx.sense.half < 1) return ctx;
            const s = ctx.sense;
            if (!dirs) {
                dirs = [];
                const m = mask ? Vote.mask(mask, s.size) : null;
                if (m) {
                    for (let i = 0; i < m.length; i++) {
                        if (m[i] !== 0) dirs.push(i);
                    }
                } else {
                    for (let k = 0; k < 8; k++) {
                        dirs.push((DY8[k] + s.half) * s.size + (DX8[k] + s.half));
                    }
                }
            }
            if (dirs.length === 0) return ctx;
            Vote.add(ctx.votes, dirs[Math.floor(Math.random() * dirs.length)], .1);
            return ctx;
        };
    },

    /**
     * Single-channel vote: every sense cell whose type matches adds
     * `weight x rate x mask` to the pipeline sum. One channel per call —
     * stack calls for multi-channel steering.
     *
     * Compilation is lazy (first tick): the type sets and the mask need the
     * live seed type and window size, and are then reused allocation-free.
     */
    channel(opts: ChannelOpts): MoveFn {
        let inited = false;
        let match = new Set<number>();
        let exclude = new Set<number>();
        let maskSize = -1;
        let mask: Float64Array | null = null;
        return (ctx: Ctx) => {
            if (!roll(resolveNum(opts.chance ?? 100))) return ctx;
            const weight = resolveNum(opts.weight) * resolveNum(opts.rate ?? 1);
            if (!weight) return ctx;
            if (!inited) {
                inited = true;
                match = Vote.set(opts.matchTypes);
                exclude = Vote.set(opts.excludeTypes);
                exclude.add(ctx.profile.seedType);
            }
            if (maskSize !== ctx.sense.size) {
                maskSize = ctx.sense.size;
                mask = Vote.mask(opts.mask, maskSize);
            }
            Vote.channel(ctx, {
                match,
                exclude,
                matchEmpty: opts.matchEmpty,
                weight,
                mask,
            });
            return ctx;
        };
    },

    /**
     * ColumnForce: cast rays in `directions` and let the first opaque cell
     * of each ray vote ±1. Stacking directions composes a force field.
     */
    columnForce(opts: ColumnForceOpts = {}): MoveFn {
        const {
            rateFn = 0,
            matchTypes = [],
            directions = ["bottom"],
            rangeNFn = 10,
            maxKFn = 3,
            freeTypes = [],
            excludeTypes = [],
        } = opts;

        return (ctx: Ctx) => {
            const rate = resolveNum(rateFn);
            const rangeN = resolveNum(rangeNFn);
            const maxK = resolveNum(maxKFn);
            if (!rate) return ctx;
            if (rangeN <= 0 || maxK <= 0) return ctx;
            if (!roll(Math.min(100, Math.abs(rate)))) return ctx;

            const free = Vote.set([ctx.profile.liquidType, ...freeTypes]);
            const match = Vote.set(matchTypes);
            const exclude = Vote.set([ctx.profile.seedType, ...excludeTypes]);
            // `maxK`: cap on rays that may vote per tick (deterministic order).
            let voted = 0;
            for (const name of directions) {
                if (voted >= maxK) break;
                for (const [dx, dy] of dirSteps(name)) {
                    if (voted >= maxK) break;
                    if (columnRay(ctx, dx, dy, rangeN, rate, match, free, exclude)) voted++;
                }
            }
            return ctx;
        };
    },

    /**
     * Trail-eat: deferred intent applied to the origin cell *after* a
     * successful move swap (see `runProfile`). Reads no engine state —
     * the pipeline applies it only when the centroid step actually moved.
     *
     * Multiple `trailEat` intents stack; each rolls its own chance.
     */
    trailEat(opts: EatOpts): MoveFn {
        const replaceType = opts.replaceType ?? null;
        return (ctx) => ({
            ...ctx,
            trailEat: [...ctx.trailEat, { chance: opts.chance, replaceType }],
        });
    },

    /**
     * Vote-memory channel: each neighbour's stored movement vector (written
     * by the pipeline to `profile.memField`/`memField+1` after its last swap)
     * is re-voted at that neighbour's offset, scaled by how aligned the
     * vector is with the offset direction:
     *   vote += weight * mask * (vx * signX + vy * signY)
     * so neighbours already flowing away in a direction reinforce moving that
     * way (flocking/flow alignment); opposing vectors cancel naturally.
     * Needs `memField` set on the owning Profile — a no-op otherwise.
     */
    memory(opts: MemoryOpts): MoveFn {
        let maskSize = -1;
        let mask: Float64Array | null = null;
        return (ctx: Ctx) => {
            const chance = resolveNum(opts.chance ?? 100);
            if (chance <= 0 || !roll(chance)) return ctx;
            const w = resolveNum(opts.weight) * resolveNum(opts.rate ?? 1);
            if (!w) return ctx;
            const f = ctx.profile.memField;
            if (f == null) return ctx;
            const s = ctx.sense;
            if (maskSize !== s.size) {
                maskSize = s.size;
                mask = Vote.mask(opts.mask, s.size);
            }
            for (let oy = -s.half; oy <= s.half; oy++) {
                for (let ox = -s.half; ox <= s.half; ox++) {
                    if (ox === 0 && oy === 0) continue;
                    const i = (oy + s.half) * s.size + (ox + s.half);
                    const m = mask ? mask[i] : 1;
                    if (m === 0) continue;
                    const vx = Grid.readFieldRawAt(ctx.x + ox, ctx.y + oy, f);
                    if (vx === 0) continue;
                    const vy = Grid.readFieldRawAt(ctx.x + ox, ctx.y + oy, f + 1);
                    if (vx === 0 && vy === 0) continue;
                    const align = (vx > 0 ? 1 : vx < 0 ? -1 : 0) * Math.sign(ox) +
                        (vy > 0 ? 1 : vy < 0 ? -1 : 0) * Math.sign(oy);
                    if (align === 0) continue;
                    ctx.votes[i] += w * m * align;
                }
            }
            return ctx;
        };
    },

    /**
     * Inertia channel — the self variant of `Move.memory`. Instead of
     * scanning neighbours, it reads the seed's OWN stored movement vector
     * (2 field reads, no window scan) and builds a vote matrix that matches
     * it: every offset votes by its normalized dot product with the vector,
     *
     *   vote += weight * mask * (ox * vx + oy * vy) / |v|
     *
     * which is a linear gradient pointing along last tick's flow — cells in
     * front of the motion are voted in, cells behind voted out (or skipped
     * with `mode: "ahead"`). Faster than `memory` (2 reads vs 2 x 24) and
     * gives straight-line persistence; combine both for flocking + inertia.
     * Needs `memField` set on the owning Profile — a no-op otherwise.
     */
    inertia(opts: InertiaOpts): MoveFn {
        let maskSize = -1;
        let mask: Float64Array | null = null;
        return (ctx: Ctx) => {
            const chance = resolveNum(opts.chance ?? 100);
            if (chance <= 0 || !roll(chance)) return ctx;
            const w = resolveNum(opts.weight) * resolveNum(opts.rate ?? 1);
            if (!w) return ctx;
            const f = ctx.profile.memField;
            if (f == null) return ctx;
            const vx = Grid.readFieldRawAt(ctx.x, ctx.y, f);
            if (vx === 0) return ctx;
            const vy = Grid.readFieldRawAt(ctx.x, ctx.y, f + 1);
            const mag = Math.sqrt(vx * vx + vy * vy);
            if (mag === 0) return ctx;
            const aheadOnly = opts.mode === "ahead";
            const s = ctx.sense;
            if (maskSize !== s.size) {
                maskSize = s.size;
                mask = Vote.mask(opts.mask, s.size);
            }
            for (let oy = -s.half; oy <= s.half; oy++) {
                for (let ox = -s.half; ox <= s.half; ox++) {
                    if (ox === 0 && oy === 0) continue;
                    const i = (oy + s.half) * s.size + (ox + s.half);
                    const m = mask ? mask[i] : 1;
                    if (m === 0) continue;
                    const dot = (ox * vx + oy * vy) / mag;
                    if (aheadOnly && dot <= 0) continue;
                    ctx.votes[i] += w * m * dot;
                }
            }
            return ctx;
        };
    },
};
