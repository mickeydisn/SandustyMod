import { ElementTypeInWorker as ElementType } from "../elementResolve.ts";
import { GrowFn, GrowResult } from "../definition/types.ts";
import { Grid } from "../utils/grid.ts";
import { GridNear, IDelta } from "../utils/gridnear.ts";

const GrowMatch = {
  noMatch(): GrowResult {
    return { matched: false, delta: 0, tag: null };
  },
  rate(rate: number, tag: string): GrowResult {
    if (rate <= 0) return GrowMatch.noMatch();
    return {
      matched: true,
      delta: Math.random() * 100 < rate ? 1 : 0,
      tag,
      rate,
    };
  },
};

function resolveNum(v: number | (() => number), d = 0): number {
  return typeof v === "function" ? v() : v;
}

export const Grow = {
  ageAlways(): GrowFn {
    return () => ({ matched: true, delta: 1, tag: "always" });
  },

  ageOnAir(rateFn: number | (() => number)): GrowFn {
    return (ctx) => {
      const hit = GridNear.isNearEmpty(ctx.x, ctx.y);
      if (!hit) return GrowMatch.noMatch();
      return GrowMatch.rate(resolveNum(rateFn), "air");
    };
  },

  ageOnFloor(rateFn: number | (() => number)): GrowFn {
    return (ctx) => {
      if (
        !Grid.isNotTypeAt(
          ctx.x,
          ctx.y + 1,
          [
            ctx.profile.seedType,
            ctx.profile.liquidType,
          ],
        )
      ) {
        return GrowMatch.noMatch();
      }
      return GrowMatch.rate(resolveNum(rateFn), "floor");
    };
  },

  ageOnWall(rateFn: number | (() => number)): GrowFn {
    return (ctx) => {
      const sideOffsets: IDelta[] = [
        { x: 1, y: 0 }, // RIGHT
        { x: -1, y: 0 }, // LEFT
      ];
      const hit = GridNear.isNotNear(
        ctx.x,
        ctx.y,
        [
          ctx.profile.seedType,
          ctx.profile.liquidType,
        ],
        sideOffsets,
      );
      if (!hit) return GrowMatch.noMatch();
      return GrowMatch.rate(resolveNum(rateFn), "wall");
    };
  },

  ageOnCrystal(rateFn: number | (() => number)): GrowFn {
    return (ctx) => {
      const c = ctx.profile.crystalType;
      if (c == null || !GridNear.isNear(ctx.x, ctx.y, c)) {
        return GrowMatch.noMatch();
      }
      return GrowMatch.rate(resolveNum(rateFn), "crystal");
    };
  },

  ageOnSurround(
    rateFn: number | (() => number),
    minCountFn: number | (() => number),
  ): GrowFn {
    return (ctx) => {
      const minCount = resolveNum(minCountFn, 6);
      const n = GridNear.countNear(ctx.x, ctx.y, ctx.profile.liquidType);
      if (n < minCount) return GrowMatch.noMatch();
      return GrowMatch.rate(resolveNum(rateFn), "surround");
    };
  },

  blockOnWater(): GrowFn {
    return (ctx) => {
      if (ctx.profile.liquidType === ElementType.water) {
        return GrowMatch.noMatch();
      }
      if (
        ElementType.water != null &&
        GridNear.isNear(ctx.x, ctx.y, ElementType.water)
      ) {
        ctx.blocked = true;
        return { matched: true, delta: 0, tag: "water-block" };
      }
      return GrowMatch.noMatch();
    };
  },

  instantChance(rateFn: number | (() => number)): GrowFn {
    return (ctx) => {
      const rate = resolveNum(rateFn);
      if (ctx.age === 0 && rate > 0 && Math.random() * 100 < rate) {
        ctx.tryInstant = true;
      }
      return GrowMatch.noMatch();
    };
  },
};
