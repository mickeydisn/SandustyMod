import { ASTRO_FIELD } from "../../shared/ids.ts";
import { TElementType } from "../../shared/elementTypes.ts";
import { CrystallizeFn } from "../definition/types.ts";
import { log } from "../definition/config.ts";
import { Grid } from "../utils/grid.ts";
import { GridNear } from "../utils/gridnear.ts";

function resolveNum(v: number | (() => number)): number {
  return typeof v === "function" ? v() : v;
}

function disk(cx: number, cy: number, liquid: TElementType, r: number) {
  const cells: { x: number; y: number }[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + 0.5) continue;
      if (Grid.isTypeAt(cx + dx, cy + dy, liquid)) {
        cells.push({ x: cx + dx, y: cy + dy });
      }
    }
  }
  return cells;
}

function cross(cx: number, cy: number, liquid: TElementType, r: number) {
  const cells: { x: number; y: number }[] = [];
  for (let i = 1; i <= r; i++) {
    for (
      const [x, y] of [
        [cx + i, cy],
        [cx - i, cy],
        [cx, cy + i],
        [cx, cy - i],
      ] as const
    ) {
      if (Grid.isTypeAt(x, y, liquid)) cells.push({ x, y });
    }
  }
  return cells;
}

function ring(cx: number, cy: number, liquid: TElementType, r: number) {
  const cells: { x: number; y: number }[] = [];
  const r2 = r * r;
  const i2 = Math.max(0, r - 1) ** 2;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dy * dy;
      if (d > r2 + 0.5 || d < i2 - 0.5) continue;
      if (Grid.isTypeAt(cx + dx, cy + dy, liquid)) {
        cells.push({ x: cx + dx, y: cy + dy });
      }
    }
  }
  return cells;
}

function column(cx: number, cy: number, liquid: TElementType, r: number) {
  const cells: { x: number; y: number }[] = [];
  for (let dy = -r; dy <= r; dy++) {
    if (dy === 0) continue;
    if (Grid.isTypeAt(cx, cy + dy, liquid)) cells.push({ x: cx, y: cy + dy });
  }
  return cells;
}

function commit(
  cx: number,
  cy: number,
  profile: {
    seedType: TElementType;
    crystalType: TElementType;
    id: string;
  },
  cells: { x: number; y: number }[],
  label: string,
): boolean {
  if (!Grid.isTypeAt(cx, cy, profile.seedType)) {
    return false;
  }
  if (cells.length < 1) {
    log("grow ABORT", label, "no liquid — seed RESET", cx, cy);
    return false;
  }
  let n = 0;
  for (const c of cells) {
    sandkit.api.elements.replaceAtCell(c.x, c.y, profile.crystalType);
    n++;
  }
  sandkit.api.elements.replaceAtCell(cx, cy, profile.crystalType);
  n++;
  Grid.resetFieldAt(cx, cy, ASTRO_FIELD.AGE);
  log("GREW", profile.id, label, "at", cx, cy, "cells=", n);
  return true;
}

export const Crystallization = {
  disk(radiusFn: number | (() => number)): CrystallizeFn {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      const cells = disk(ctx.x, ctx.y, ctx.profile.liquidType, r);
      return commit(ctx.x, ctx.y, ctx.profile, cells, "disk");
    };
  },
  cross(radiusFn: number | (() => number)): CrystallizeFn {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      return commit(
        ctx.x,
        ctx.y,
        ctx.profile,
        cross(ctx.x, ctx.y, ctx.profile.liquidType, r),
        "cross",
      );
    };
  },
  ring(radiusFn: number | (() => number)): CrystallizeFn {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      return commit(
        ctx.x,
        ctx.y,
        ctx.profile,
        ring(ctx.x, ctx.y, ctx.profile.liquidType, r),
        "ring",
      );
    };
  },
  column(radiusFn: number | (() => number)): CrystallizeFn {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      return commit(
        ctx.x,
        ctx.y,
        ctx.profile,
        column(ctx.x, ctx.y, ctx.profile.liquidType, r),
        "column",
      );
    };
  },
  single(): CrystallizeFn {
    return (ctx) => {
      if (!GridNear.isNear(ctx.x, ctx.y, ctx.profile.liquidType)) {
        return false;
      }
      if (
        ctx.profile.seedType == null ||
        !Grid.isTypeAt(ctx.x, ctx.y, ctx.profile.seedType)
      ) {
        return false;
      }
      if (ctx.profile.crystalType == null) return false;
      sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, ctx.profile.crystalType);
      Grid.resetFieldAt(ctx.x, ctx.y, ASTRO_FIELD.AGE);
      log("GREW", ctx.profile.id, "single at", ctx.x, ctx.y);
      return true;
    };
  },
  fromShapeIndex(
    shapeFn: number | (() => number),
    radiusFn: number | (() => number),
  ): CrystallizeFn {
    return (ctx) => {
      const shape = resolveNum(shapeFn);
      const r = resolveNum(radiusFn);
      if (shape === 1) return Crystallization.cross(() => r)(ctx);
      if (shape === 2) return Crystallization.ring(() => r)(ctx);
      if (shape === 3) return Crystallization.column(() => r)(ctx);
      if (shape === 4) return Crystallization.single()(ctx);
      return Crystallization.disk(() => r)(ctx);
    };
  },
};
