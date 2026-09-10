/**
 * runProfile — the per-tick driver for an element Profile.
 *
 * Phase order: GROW → CRYSTALLIZE (once mature) → MOVE. The seed accumulates
 * age while it sits over its liquid; once the age reaches growAge() it attempts
 * to crystallize, otherwise it applies its movement directions in a single
 * adjacent-cell step.
 */
import type { Ctx, Profile } from "./types.ts";
import { Grid } from "./grid.ts";
import { GridNear } from "./near.ts";

export function runProfile(x: number, y: number, profile: Profile): boolean {
    if (!Grid.isTypeAt(x, y, profile.seedType)) return false;
    if (!GridNear.isNear(x, y, profile.liquidType)) {
        Grid.resetFieldAt(x, y, profile.ageField);
        return false;
    }

    let ctx: Ctx = {
        x,
        y,
        profile,
        dx: 0,
        dy: 0,
        age: Grid.readFieldAt(x, y, profile.ageField),
        blocked: false,
        tryInstant: false,
        stuck: false,
    };

    // Grow until the seed is blocked or matched.
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
        Grid.writeFieldAt(ctx.x, ctx.y, profile.ageField, ctx.age);
    }

    // Crystallize the seed if it is mature.
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
            Grid.resetFieldAt(ctx.x, ctx.y, profile.ageField);
        }
    }

    // Apply movement.
    for (const fn of profile.moves) {
        ctx = fn(ctx);
    }

    // Step into the occupied/target cell (single adjacent step).
    if (ctx.dx !== 0 || ctx.dy !== 0) {
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
