/**
 * Movement actions. Each factory returns a `MoveFn` that updates the Ctx's
 * accumulated (`dx`,`dy`) intent; the pipeline applies the final step.
 */
import {
    DELTAS_INDEX,
    DIR_NAME_MAP,
    type Direction,
    type DirectionName,
    type IDelta,
    type TElementType,
} from "@sandmd/shared";
import { Grid } from "../grid.ts";
import type { Ctx, MoveFn } from "../types.ts";
import { resolveNum } from "../resolve.ts";

export interface ColumnForceOpts {
    rateFn?: number | (() => number);
    matchTypes?: (TElementType | null)[];
    directions?: DirectionName[];
    rangeNFn?: number | (() => number);
    maxKFn?: number | (() => number);
    freeTypes?: (TElementType | null)[];
    excludeTypes?: (TElementType | null)[];
}

export interface MoveForceOpts {
    rate: number | (() => number);
    deltas: IDelta[];
    matchTypes: TElementType[];
    freeTypes: TElementType[];
    excludeTypes: TElementType[];
    cumul: boolean;
}

function random100(): number {
    return Math.random() * 100;
}

export const Move = {
    side(chanceFn: number | (() => number)): MoveFn {
        return (ctx) => {
            const chance = resolveNum(chanceFn);
            if (chance <= 0 || random100() >= chance) return ctx;
            const dir = Math.random() < 0.5 ? -1 : 1;
            return { ...ctx, dx: ctx.dx + dir };
        };
    },

    up(chanceFn: number | (() => number)): MoveFn {
        return (ctx) => {
            const chance = resolveNum(chanceFn);
            if (chance <= 0 || random100() >= chance) return ctx;
            return { ...ctx, dy: ctx.dy - 1 };
        };
    },

    down(chanceFn: number | (() => number)): MoveFn {
        return (ctx) => {
            const chance = resolveNum(chanceFn);
            if (chance <= 0 || random100() >= chance) return ctx;
            return { ...ctx, dy: ctx.dy + 1 };
        };
    },

    /**
     * Directional attraction on a list of deltas:
     *   - `rate`: 0 off; >0 attract; <0 push. The seed type is never a target.
     *   - `freeTypes`: cells the seed can pass through without counting as a hit.
     *   - `matchTypes`: hit set. Empty = "any type not in excludeTypes".
     * Walks `deltas` in order and applies the first hit (unless `cumul`).
     */
    forceDelta(opts: MoveForceOpts): MoveFn {
        return (ctx: Ctx) => {
            const rate = resolveNum(opts.rate);
            if (!rate) return ctx;
            if (random100() >= Math.min(100, Math.abs(rate))) return ctx;

            const f = rate > 0 ? 1 : -1;
            let countMatch = 0;
            for (const d of opts.deltas) {
                const dx = ctx.dx + Math.min(1, Math.max(-1, d.x)) * f;
                const dy = ctx.dy + Math.min(1, Math.max(-1, d.y)) * f;

                if (Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.freeTypes)) {
                    continue;
                }
                if (
                    opts.matchTypes.length > 0 &&
                    Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.matchTypes)
                ) {
                    countMatch += 1;
                    ctx = { ...ctx, dx, dy };
                } else if (
                    opts.matchTypes.length === 0 &&
                    !Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.excludeTypes)
                ) {
                    countMatch += 1;
                    ctx = { ...ctx, dx, dy };
                }
                if (!opts.cumul && countMatch > 0) break;
            }
            return ctx;
        };
    },

    /**
     * Column attract / push-back along a liquid. Casts a ray of `rangeN` cells
     * per compass direction and lets the first non-free occupant steer the seed.
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

            const freeList: TElementType[] = [
                ctx.profile.liquidType,
                ...freeTypes.filter((v) => v !== null),
            ];
            const matchList: TElementType[] = [
                ...matchTypes.filter((v) => v !== null),
            ];
            const excludeList: TElementType[] = [
                ctx.profile.seedType,
                ...excludeTypes.filter((v) => v !== null),
            ];

            if (directions.length === 0) return ctx;
            const dirs: Direction[] = [
                ...new Set(directions.map((d) => DIR_NAME_MAP[d]).flat()),
            ];

            for (const dir of dirs) {
                const d = DELTAS_INDEX[dir];
                const deltas = Array.from({ length: rangeN }, (_, n) => ({
                    x: d.x * -(n + 1),
                    y: d.y * -(n + 1),
                }));
                ctx = Move.forceDelta({
                    rate,
                    deltas,
                    freeTypes: freeList,
                    matchTypes: matchList,
                    excludeTypes: excludeList,
                    cumul: false,
                })(ctx);
            }
            return ctx;
        };
    },
};
