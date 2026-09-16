/**
 * Growth actions. Each factory returns a `GrowFn` that reports whether the
 * seed "matured" this tick (and by how much age) or explicitly says no-match.
 * All neighbour reads go through the pipeline's sampled `Ctx.sense` window —
 * zero engine reads on the hot path. Eating still mutates via `Grid.eatAt`
 * (deferred engine writes are part of the sim contract).
 */
import type { TElementType } from "@sandmd/shared";
import type { GrowFn, GrowResult } from "../types.ts";
import { Grid } from "../grid.ts";
import { Sense } from "../sense.ts";
import { resolveNum } from "../resolve.ts";

export interface GrowEatOpts {
    /** 0-100 chance per tick. Number or live `() => number`. */
    chance: number | (() => number);
    /**
     * What to put in the eaten neighbour cell. `null` (default) = clear
     * to empty via `removeAtCell`, otherwise `replaceAtCell(type)`.
     */
    replaceType?: TElementType | null;
    /**
     * Which neighbour types count as food. Defaults to the profile's own
     * `liquidType` (one random adjacent liquid cell is eaten).
     */
    matchTypes?: TElementType | TElementType[] | null;
}

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
        return (ctx) => Sense.isNearEmpty(ctx.sense) ? rate(resolveNum(rateFn), "air") : noMatch();
    },

    ageOnFloor(rateFn: number | (() => number)): GrowFn {
        return (ctx) => {
            const below = Sense.at(ctx.sense, 0, 1);
            const solid = below !== 0 &&
                below !== ctx.profile.seedType &&
                below !== ctx.profile.liquidType;
            return solid ? rate(resolveNum(rateFn), "floor") : noMatch();
        };
    },

    ageOnWall(rateFn: number | (() => number)): GrowFn {
        return (ctx) => {
            const hit = [Sense.at(ctx.sense, 1, 0), Sense.at(ctx.sense, -1, 0)].some((t) =>
                t !== 0 && t !== ctx.profile.seedType && t !== ctx.profile.liquidType
            );
            return hit ? rate(resolveNum(rateFn), "wall") : noMatch();
        };
    },

    ageOnCrystal(rateFn: number | (() => number)): GrowFn {
        return (ctx) =>
            ctx.profile.crystalType != null &&
                Sense.isNear(ctx.sense, ctx.profile.crystalType)
                ? rate(resolveNum(rateFn), "crystal")
                : noMatch();
    },

    ageOnSurround(
        rateFn: number | (() => number),
        minCountFn: number | (() => number),
    ): GrowFn {
        return (ctx) => {
            const minCount = resolveNum(minCountFn, 6);
            const n = Sense.count(ctx.sense, ctx.profile.liquidType);
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
            if (blockType != null && Sense.isNear(ctx.sense, blockType)) {
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

    /**
     * Eat a random neighbouring cell from the sense matrix and report it as
     * growth. Picks one uniform-random window cell (excl. centre) whose type
     * is in `matchTypes` (default: the profile's `liquidType`), rolls
     * `chance`, then clears it or replaces it via `Grid.eatAt` using ENGINE
     * coordinates (sense offset + seed position).
     * Returns `matched: true, delta: 1` on success so it composes with the
     * first-match grow chain and actually ages the seed.
     */
    eat(opts: GrowEatOpts): GrowFn {
        const replaceType = opts.replaceType ?? null;
        return (ctx) => {
            const chance = resolveNum(opts.chance);
            if (chance <= 0 || Math.random() * 100 >= chance) return noMatch();
            const match = opts.matchTypes ?? ctx.profile.liquidType;
            if (match == null) return noMatch();
            const off = Sense.random(ctx.sense, match);
            if (!off) return noMatch();
            Grid.eatAt(ctx.x + off.x, ctx.y + off.y, replaceType);
            return { matched: true, delta: 1, tag: "eat", rate: chance };
        };
    },
};
