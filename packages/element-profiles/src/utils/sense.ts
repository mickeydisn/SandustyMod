/**
 * Sense-matrix helpers — read neighbour types from the pipeline's sampled
 * 5x5 window (`Ctx.sense`) instead of hitting the engine per cell.
 *
 * Coordinates are window offsets `ox,oy ∈ [-half..half]`; use the named
 * helpers (`at`, `is`, `count`, `random`) rather than indexing by hand.
 */
import type { SenseMatrix } from "../types.ts";
import type { TElementType } from "@sandmd/shared";

function idx(s: SenseMatrix, ox: number, oy: number): number {
    return (oy + s.half) * s.size + (ox + s.half);
}

function inWindow(s: SenseMatrix, ox: number, oy: number): boolean {
    return ox >= -s.half && ox <= s.half && oy >= -s.half && oy <= s.half;
}

export const Sense = {
    /** Window index of offset (`ox`,`oy`), or `-1` when outside the window. */
    index(s: SenseMatrix, ox: number, oy: number): number {
        return inWindow(s, ox, oy) ? idx(s, ox, oy) : -1;
    },

    /** Type at offset (`0` = empty). Out of window → 0. */
    at(s: SenseMatrix, ox: number, oy: number): TElementType {
        if (!inWindow(s, ox, oy)) return 0 as TElementType;
        return s.cells[idx(s, ox, oy)] as TElementType;
    },

    /** True when the offset cell's type is in `match` (0 never matches). */
    is(
        s: SenseMatrix,
        ox: number,
        oy: number,
        match: TElementType[] | TElementType,
    ): boolean {
        if (!inWindow(s, ox, oy)) return false;
        const t = s.cells[idx(s, ox, oy)];
        if (t == null || t === 0) return false;
        const list = typeof match === "number" ? [match] : match;
        return list.includes(t as TElementType);
    },

    /** True when the offset cell is empty (type 0/null). */
    isEmpty(s: SenseMatrix, ox: number, oy: number): boolean {
        if (!inWindow(s, ox, oy)) return false;
        const t = s.cells[idx(s, ox, oy)];
        return t == null || t === 0;
    },

    /** Count offsets whose type is in `match` (0 never counts). */
    count(
        s: SenseMatrix,
        match: TElementType[] | TElementType,
        offsets?: readonly { x: number; y: number }[],
    ): number {
        const list = typeof match === "number" ? [match] : match;
        let n = 0;
        if (offsets) {
            for (const o of offsets) {
                if (!inWindow(s, o.x, o.y)) continue;
                const t = s.cells[idx(s, o.x, o.y)];
                if (t != null && t !== 0 && list.includes(t as TElementType)) n++;
            }
            return n;
        }
        for (let i = 0; i < s.cells.length; i++) {
            if (i === s.center) continue;
            const t = s.cells[i];
            if (t != null && t !== 0 && list.includes(t as TElementType)) n++;
        }
        return n;
    },

    /** True when any window cell (excl. centre) matches. */
    isNear(s: SenseMatrix, match: TElementType[] | TElementType): boolean {
        const list = typeof match === "number" ? [match] : match;
        for (let i = 0; i < s.cells.length; i++) {
            if (i === s.center) continue;
            const t = s.cells[i];
            if (t != null && t !== 0 && list.includes(t as TElementType)) return true;
        }
        return false;
    },

    /** True when any window cell (excl. centre) is empty. */
    isNearEmpty(
        s: SenseMatrix,
        offsets?: readonly { x: number; y: number }[],
    ): boolean {
        if (offsets) {
            for (const o of offsets) {
                if (this.isEmpty(s, o.x, o.y)) return true;
            }
            return false;
        }
        for (let i = 0; i < s.cells.length; i++) {
            if (i === s.center) continue;
            const t = s.cells[i];
            if (t == null || t === 0) return true;
        }
        return false;
    },

    /**
     * Uniform-random offset (excl. centre) whose type is in `match`.
     * Returns null when nothing matches.
     */
    random(
        s: SenseMatrix,
        match: TElementType[] | TElementType,
    ): { x: number; y: number } | null {
        const list = typeof match === "number" ? [match] : match;
        let pick = -1;
        let n = 0;
        for (let i = 0; i < s.cells.length; i++) {
            if (i === s.center) continue;
            const t = s.cells[i];
            if (t == null || t === 0 || !list.includes(t as TElementType)) continue;
            n++;
            // Reservoir sampling: uniform pick in a single pass.
            if (Math.random() * n < 1) pick = i;
        }
        if (pick < 0) return null;
        return {
            x: (pick % s.size) - s.half,
            y: Math.floor(pick / s.size) - s.half,
        };
    },
};
