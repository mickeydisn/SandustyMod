/**
 * Crystallization actions. Each factory returns a `CrystallizeFn` that turns a
 * local region of the liquid (and the seed itself) into the profile's crystal
 * type, then resets the seed's age field.
 */
import "@sandmd/sandkit";
import type { TElementType } from "@sandmd/types";
import type { CrystallizeFn, Ctx } from "../types.ts";
import { Grid } from "../grid.ts";
import { GridNear } from "../near.ts";
import { resolveNum } from "../resolve.ts";

type Cell = { x: number; y: number };

function disk(cx: number, cy: number, liquid: TElementType, r: number): Cell[] {
    const cells: Cell[] = [];
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

function cross(cx: number, cy: number, liquid: TElementType, r: number): Cell[] {
    const cells: Cell[] = [];
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

function ring(cx: number, cy: number, liquid: TElementType, r: number): Cell[] {
    const cells: Cell[] = [];
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

function column(cx: number, cy: number, liquid: TElementType, r: number): Cell[] {
    const cells: Cell[] = [];
    for (let dy = -r; dy <= r; dy++) {
        if (dy === 0) continue;
        if (Grid.isTypeAt(cx, cy + dy, liquid)) cells.push({ x: cx, y: cy + dy });
    }
    return cells;
}

function commit(ctx: Ctx, cells: Cell[]): boolean {
    const { seedType, crystalType, ageField } = ctx.profile;
    if (seedType == null || !Grid.isTypeAt(ctx.x, ctx.y, seedType)) return false;
    if (cells.length < 1) return false;
    for (const c of cells) {
        sandkit.api.elements.replaceAtCell(c.x, c.y, crystalType);
    }
    sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, crystalType);
    Grid.resetFieldAt(ctx.x, ctx.y, ageField);
    return true;
}

export const Crystallization = {
    disk(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) =>
            commit(ctx, disk(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
    },
    cross(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) =>
            commit(ctx, cross(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
    },
    ring(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) =>
            commit(ctx, ring(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
    },
    column(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) =>
            commit(ctx, column(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
    },
    single(): CrystallizeFn {
        return (ctx) => {
            if (!GridNear.isNear(ctx.x, ctx.y, ctx.profile.liquidType)) return false;
            if (
                ctx.profile.seedType == null || !Grid.isTypeAt(ctx.x, ctx.y, ctx.profile.seedType)
            ) {
                return false;
            }
            if (ctx.profile.crystalType == null) return false;
            sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, ctx.profile.crystalType);
            Grid.resetFieldAt(ctx.x, ctx.y, ctx.profile.ageField);
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
