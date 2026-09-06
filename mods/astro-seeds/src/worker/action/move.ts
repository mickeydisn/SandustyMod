import { TElementType } from "../../shared/elementTypes.ts";
import { Grid } from "../utils/grid.ts";
import {
  DELTAS_INDEX,
  DIR_NAME_MAP,
  DirectionName,
  IDelta,
  MoveDirection,
} from "../utils/gridnear.ts";
import { Ctx, MoveFn } from "../definition/types.ts";

// ---------

export interface ColumnForceOpts {
  rateFn?: number | (() => number);
  matchTypes?: (TElementType | null)[];
  directions?: DirectionName[];
  rangeNFn?: number | (() => number);
  maxKFn?: number | (() => number);
  freeTypes?: (TElementType | null)[];
  excludeTypes?: (TElementType | null)[];
}

// ---------

function resolveNum(
  v: number | (() => number) | undefined,
  d: number = 0,
): number {
  if (d === undefined) d = 0;
  if (v === undefined) return d;
  return typeof v === "function" ? v() : v;
}

export interface MoveForceOpts {
  rate: number | (() => number);
  deltas: IDelta[];
  matchTypes: TElementType[];
  freeTypes: TElementType[];
  excludeTypes: TElementType[];
  cumul: boolean;
}

export const Move = {
  side(chanceFn: number | (() => number)): MoveFn {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (chance <= 0 || Math.random() * 100 >= chance) return ctx;
      const dir = Math.random() < 0.5 ? -1 : 1;
      // const r = Grid.swapInto(ctx.x, ctx.y, ctx.x + dir, ctx.y, ctx.profile.liquidType);
      // return r ? { ...ctx, x: r.x, y: r.y } : ctx;
      return { ...ctx, dx: ctx.dx + dir };
    };
  },

  up(chanceFn: number | (() => number)): MoveFn {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (chance <= 0 || Math.random() * 100 >= chance) return ctx;
      // const r = Grid.swapInto(ctx.x, ctx.y, ctx.x, ctx.y - 1, ctx.profile.liquidType);
      // return r ? { ...ctx, x: r.x, y: r.y } : ctx;
      return { ...ctx, dy: ctx.dy - 1 };
    };
  },

  down(chanceFn: number | (() => number)): MoveFn {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (chance <= 0 || Math.random() * 100 >= chance) return ctx;
      // const r = Grid.swapInto(ctx.x, ctx.y, ctx.x, ctx.y + 1, ctx.profile.liquidType);
      // return r ? { ...ctx, x: r.x, y: r.y } : ctx;
      return { ...ctx, dy: ctx.dy + 1 };
    };
  },

  /**
   * Elements Attraction Force:
   * Param:
   *   - rate: 0 off; >0 attract; <0 push. Seed always excluded from match.
   *   - deltas: List of deltat to check , whil hit the first one
   *   - freeTypes:  List of type the particul can go thouw , must be fill.
   *   - matchTypes: List of type the particul that count as hit. empty = [] = match any not in exclude.
   *   - excludeTypes: in case of hit all , you can exclude some element .
   *
   * Loop in deltas to find the first match to it.
   *    t = typeAt(postion + delta)
   *
   *    if t in freeTypes : continue
   *
   *    if matchTypes.lengh > 0 :
   *      if t in matchTypes : return  Force(d, rate)
   *
   *    if matchTypes.lengh == 0 :
   *      if t in excludeTypes : return NoForce()
   *      else : return Force(d, rate)
   */
  forceDelta(opts: MoveForceOpts = {
    rate: 0,
    deltas: [],
    freeTypes: [],
    matchTypes: [],
    excludeTypes: [],
    cumul: false,
  }): MoveFn {
    return (ctx: Ctx) => {
      // Assert
      opts.rate = resolveNum(opts.rate);
      if (!opts.rate) return ctx;

      const chance = Math.min(100, Math.abs(opts.rate));
      if (Math.random() * 100 >= chance) return ctx;

      const f = opts.rate > 0 ? 1 : opts.rate < 0 ? -1 : 0;

      let countMatch = 0;
      for (const d of opts.deltas) {
        const dx = ctx.dx + Math.min(1, Math.max(-1, d.x)) * f;
        const dy = ctx.dx + Math.min(1, Math.max(-1, d.y)) * f;

        if (Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.freeTypes)) {
          continue;
        }

        if (
          opts.matchTypes.length > 0 &&
          Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.matchTypes)
        ) {
          countMatch += 1;
          ctx = { ...ctx, dx: dx, dy: dy };
        }

        if (
          opts.matchTypes.length == 0 &&
          !Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.excludeTypes)
        ) {
          countMatch += 1;
          ctx = { ...ctx, dx: dx, dy: dy };
        }
        if (!opts.cumul && countMatch > 0) {
          break;
        }
      }
      return ctx;
    };
  },

  /**
   * Column attract / push-back along liquid.
   * rate 0 off; >0 attract; <0 push. Seed always excluded from match.
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
      // Assert
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
      const dirs: MoveDirection[] = [
        ...new Set(
          directions.map((d: DirectionName) => DIR_NAME_MAP[d]).flat(),
        ),
      ];

      for (const dir of dirs) {
        const d = DELTAS_INDEX[dir];
        const deltas = Array.from({ length: rangeN }, (_, n) => ({
          x: d.x * -(n + 1),
          y: d.y * -(n + 1),
        }));
        ctx = Move.forceDelta({
          rate: rate,
          deltas: deltas,
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
