import { ASTRO_FIELD } from "../shared/ids.ts";
import type { Ctx, Profile } from "./definition/types.ts";
import { WaterCfg } from "./definition/config.ts";
import { Grid } from "./utils/grid.ts";
import { GridNear } from "./utils/gridnear.ts";

export function runProfile(x: number, y: number, profile: Profile): boolean {
  if (!WaterCfg.modEnabled()) {
    return false;
  }
  if (!Grid.isTypeAt(x, y, profile.seedType)) {
    return false;
  }
  if (!GridNear.isNear(x, y, profile.liquidType)) {
    Grid.resetFieldAt(x, y, ASTRO_FIELD.AGE);
    return false;
  }

  let ctx: Ctx = {
    x,
    y,
    profile,
    dx: 0,
    dy: 0,
    age: Grid.readFieldAt(x, y, ASTRO_FIELD.AGE),
    blocked: false,
    tryInstant: false,
    stuck: false,
  };

  // Grow the seed until it is blocked or matched

  let delta = 0;
  let tag = "-";
  for (const fn of profile.grow) {
    const result = fn(ctx);
    if (ctx.blocked) {
      tag = result.tag || "blocked";
      break;
    }
    if (result.matched) {
      delta = result.delta || 0;
      tag = result.tag || "-";
      break;
    }
  }
  if (delta > 0) {
    ctx.age += delta;
    Grid.writeFieldAt(ctx.x, ctx.y, ASTRO_FIELD.AGE, ctx.age);
  }

  // Crystallize the seed if it is ready
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
      Grid.resetFieldAt(ctx.x, ctx.y, ASTRO_FIELD.AGE);
    }
  }

  // Move the seed to its new position
  for (const fn of profile.moves) {
    ctx = fn(ctx);
  }

  // Check if fall , to activate up particul :
  if (ctx.dx != 0 || ctx.dy != 0) {
    // update the position of the particul
    const r = Grid.swapCell(
      ctx.x,
      ctx.y,
      ctx.x + Math.min(1, Math.max(-1, ctx.dx)),
      ctx.y + Math.min(1, Math.max(-1, ctx.dy)),
      ctx.profile.liquidType,
    );
    ctx = r ? { ...ctx, x: r.x, y: r.y, dx: 0, dy: 0 } : ctx;
  }

  return true;
}
