/**
 * Growth actions. Each factory returns a `GrowFn` that reports whether the
 * seed "matured" this tick (and by how much age) or explicitly says no-match.
 */
import type { IDelta, TElementType } from "@sandmd/types";
import type { GrowFn, GrowResult } from "../types.ts";
import { Grid } from "../grid.ts";
import { GridNear } from "../near.ts";
import { resolveNum } from "../resolve.ts";

const noMatch = (): GrowResult => ({ matched: false, delta: 0, tag: null });

function rate(rate: number, tag: string): GrowResult {
    if (rate <= 0) return noMatch();
    return {
        matched: true,
        delta: Math.random() * 100 < rate ? 1 : 0,
        tag,
        rate,
    };
}

export const Grow = {
    ageAlways(): GrowFn {
        return () => ({ matched: true, delta: 1, tag: "always" });
    },

    ageOnAir(rateFn: number | (() => number)): GrowFn {
        return (ctx) =>
            GridNear.isNearEmpty(ctx.x, ctx.y) ? rate(resolveNum(rateFn), "air") : noMatch();
    },

    ageOnFloor(rateFn: number | (() => number)): GrowFn {
        return (ctx) => {
            const under = !Grid.isNotTypeAt(ctx.x, ctx.y + 1, [
                ctx.profile.seedType,
                ctx.profile.liquidType,
            ]);
            return under ? noMatch() : rate(resolveNum(rateFn), "floor");
        };
    },

    ageOnWall(rateFn: number | (() => number)): GrowFn {
        return (ctx) => {
            const sideOffsets: IDelta[] = [
                { x: 1, y: 0 }, // RIGHT
                { x: -1, y: 0 }, // LEFT
            ];
            return GridNear.isNotNear(
                    ctx.x,
                    ctx.y,
                    [ctx.profile.seedType, ctx.profile.liquidType],
                    sideOffsets,
                )
                ? rate(resolveNum(rateFn), "wall")
                : noMatch();
        };
    },

    ageOnCrystal(rateFn: number | (() => number)): GrowFn {
        return (ctx) =>
            ctx.profile.crystalType != null &&
                GridNear.isNear(ctx.x, ctx.y, ctx.profile.crystalType)
                ? rate(resolveNum(rateFn), "crystal")
                : noMatch();
    },

    ageOnSurround(
        rateFn: number | (() => number),
        minCountFn: number | (() => number),
    ): GrowFn {
        return (ctx) => {
            const minCount = resolveNum(minCountFn, 6);
            const n = GridNear.countNear(ctx.x, ctx.y, ctx.profile.liquidType);
            return n >= minCount ? rate(resolveNum(rateFn), "surround") : noMatch();
        };
    },

    /**
     * Hard-block growth while the seed touches `blockType`, unless that type is
     * the profile's own liquid (its normal medium). Marks the Ctx blocked so the
     * pipeline stops growing this tick.
     */
    blockOn(blockType: TElementType | null): GrowFn {
        return (ctx) => {
            if (ctx.profile.liquidType === blockType) return noMatch();
            if (blockType != null && GridNear.isNear(ctx.x, ctx.y, blockType)) {
                ctx.blocked = true;
                return { matched: true, delta: 0, tag: "blocked" };
            }
            return noMatch();
        };
    },

    instantChance(rateFn: number | (() => number)): GrowFn {
        return (ctx) => {
            const rate = resolveNum(rateFn);
            if (ctx.age === 0 && rate > 0 && Math.random() * 100 < rate) {
                ctx.tryInstant = true;
            }
            return noMatch();
        };
    },
};
