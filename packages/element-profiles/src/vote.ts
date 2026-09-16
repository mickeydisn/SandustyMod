/**
 * Vote matrix — the 5x5 accumulator that every move channel writes into and
 * the pipeline reduces ONCE per tick (centroid rule → one 8-way step).
 *
 * Same spirit as `Grid` and `GridNear`: a small stateless namespace over
 * engine-free data, so actions never hand-roll window indexing or masks.
 * A "channel" is one selection rule plus a signed weight; stacking channels
 * sums their stamped votes, which is what makes steering composable.
 */
import type { TElementType } from "@sandmd/shared";
import type { Ctx, SenseMatrix } from "./types.ts";
import { Sense } from "./sense.ts";

/** Per-offset multipliers: nested rows, flat row-major, or fn(ox, oy). */
export type VoteMask =
    | readonly (readonly number[])[]
    | readonly number[]
    | ((ox: number, oy: number) => number);

/** One channel, already resolved to numeric types + a compiled mask. */
export interface VoteChannel {
    /** Types that vote. Empty set = any type not in `exclude`. */
    match?: Set<number>;
    /** Types that never vote (callers add the seed type). */
    exclude?: Set<number>;
    /** When true, empty cells vote too. */
    matchEmpty?: boolean;
    /** Signed strength applied to every matching offset. */
    weight: number;
    /** Compiled per-offset multipliers (`Vote.mask`); null = all 1. */
    mask?: Float64Array | null;
}

export const Vote = {
    /** Zero the accumulator — the pipeline does this once per tick. */
    clear(votes: Float64Array): Float64Array {
        return votes.fill(0);
    },

    /**
     * Add `weight` at a window index. `-1` (what `Sense.index` returns for
     * offsets outside the window) is ignored, so callers never bound-check.
     * Index `0` IS a valid window cell (top-left of the 5x5).
     */
    add(votes: Float64Array, i: number, weight = 1): void {
        if (i >= 0 && weight !== 0) votes[i] += weight;
    },

    /** Add `weight` at window offset (`ox`,`oy`). Out of window = no-op. */
    addAt(votes: Float64Array, sense: SenseMatrix, ox: number, oy: number, weight = 1): void {
        Vote.add(votes, Sense.index(sense, ox, oy), weight);
    },

    /**
     * Reduce a type list to a lookup set. `0`/`null` entries are dropped —
     * `0` means "empty", which only `matchEmpty` may claim.
     */
    set(types?: readonly (TElementType | null | undefined)[] | TElementType | null): Set<number> {
        const out = new Set<number>();
        if (types == null) return out;
        const raw = typeof types === "number" ? [types] : types;
        for (const t of raw) {
            if (t != null && t !== 0) out.add(t);
        }
        return out;
    },

    /** True when at least one cell holds a vote. */
    any(votes: Float64Array): boolean {
        for (let i = 0; i < votes.length; i++) {
            if (votes[i] !== 0) return true;
        }
        return false;
    },

    /** Number of voting cells (channels never stamp the centre). */
    count(votes: Float64Array): number {
        let n = 0;
        for (let i = 0; i < votes.length; i++) {
            if (votes[i] !== 0) n++;
        }
        return n;
    },

    /**
     * Compile a mask once per window size into a flat lookup that `channel`
     * indexes directly — the per-tick path allocates nothing. Masks are
     * centre-cropped/padded with 0, so a 3x3 works inside the 5x5 window.
     * Returns `null` when the mask is absent or all-zero ("all offsets 1").
     */
    mask(mask: VoteMask | undefined, size: number): Float64Array | null {
        if (!mask) return null;
        const half = Math.floor(size / 2);
        const out = new Float64Array(size * size);
        let any = false;
        if (typeof mask === "function") {
            for (let oy = -half; oy <= half; oy++) {
                for (let ox = -half; ox <= half; ox++) {
                    if (ox === 0 && oy === 0) continue;
                    const v = mask(ox, oy);
                    out[(oy + half) * size + (ox + half)] = v;
                    if (v !== 0) any = true;
                }
            }
            return any ? out : null;
        }
        let rows: readonly (readonly number[])[];
        if (mask.length > 0 && Array.isArray(mask[0])) {
            rows = mask as readonly (readonly number[])[];
        } else {
            const arr = mask as readonly number[];
            const sq = Math.sqrt(arr.length);
            if (!Number.isInteger(sq) || sq < 2) return null; // all 1
            const built: number[][] = [];
            for (let r = 0; r < sq; r++) built.push(arr.slice(r * sq, (r + 1) * sq));
            rows = built;
        }
        let mw = 0;
        for (const r of rows) mw = Math.max(mw, r.length);
        if (rows.length === 0 || mw === 0) return null;
        const ox0 = half - Math.floor(mw / 2);
        const oy0 = half - Math.floor(rows.length / 2);
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const x = c + ox0;
                const y = r + oy0;
                if (x < 0 || y < 0 || x >= size || y >= size) continue;
                if (x === half && y === half) continue;
                const v = rows[r][c];
                out[y * size + x] = v;
                if (v !== 0) any = true;
            }
        }
        return any ? out : null;
    },

    /**
     * Stamp ONE channel into `ctx.votes`: every offset except the centre
     * whose cell matches (`match`, or any non-excluded type when `match` is
     * empty; empties only when `matchEmpty`) gets `weight x mask`.
     * Returns how many cells voted — `columnForce` uses this to honour `maxK`.
     */
    channel(ctx: Ctx, ch: VoteChannel): number {
        if (ch.weight === 0) return 0;
        const s = ctx.sense;
        const v = ctx.votes;
        const { match, exclude, matchEmpty = false, weight, mask } = ch;
        const anyType = !match || match.size === 0;
        let n = 0;
        for (let i = 0; i < v.length; i++) {
            if (i === s.center) continue;
            const m = mask ? mask[i] : 1;
            if (m === 0) continue;
            const t = s.cells[i];
            const hit = t == null || t === 0
                ? matchEmpty
                : anyType
                ? !(exclude?.has(t) ?? false)
                : match!.has(t);
            if (!hit) continue;
            v[i] += weight * m;
            n++;
        }
        return n;
    },

    /** Centroid reduce: offset-weighted vote vector → one 8-way step. */
    reduce(
        votes: Float64Array,
        size: number,
        center: number,
        threshold = 0,
    ): { dx: number; dy: number } {
        const half = Math.floor(size / 2);
        let vx = 0;
        let vy = 0;
        for (let i = 0; i < votes.length; i++) {
            if (i === center) continue;
            const s = votes[i];
            if (!s) continue;
            vx += s * ((i % size) - half);
            vy += s * (Math.floor(i / size) - half);
        }
        return {
            dx: Math.abs(vx) > threshold ? (vx > 0 ? 1 : -1) : 0,
            dy: Math.abs(vy) > threshold ? (vy > 0 ? 1 : -1) : 0,
        };
    },

    /** Raw (non-quantized) centroid vector — what the pipeline stores as memory. */
    vector(votes: Float64Array, size: number, center: number): { vx: number; vy: number } {
        const half = Math.floor(size / 2);
        let vx = 0;
        let vy = 0;
        for (let i = 0; i < votes.length; i++) {
            if (i === center) continue;
            const s = votes[i];
            if (!s) continue;
            vx += s * ((i % size) - half);
            vy += s * (Math.floor(i / size) - half);
        }
        return { vx, vy };
    },
};
