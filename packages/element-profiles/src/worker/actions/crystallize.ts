/**
 * Crystallization actions. Each factory returns a `CrystallizeFn` that turns a
 * local region of the liquid (and the seed itself) into the profile's crystal
 * type, then resets the seed's age field.
 *
 * Shape matching reads the pipeline's sampled `Ctx.sense` window (offsets
 * clamped to the 5x5); only the final `replaceAtCell` writes touch the
 * engine, using ENGINE coordinates (sense offset + seed position).
 */
import "@sandmd/sandkit";
import type { CrystallizeFn, Ctx } from "../../shared/types.ts";
import { Grid } from "../utils/grid.ts";
import { Sense } from "../utils/sense.ts";
import { resolveNum } from "../../shared/num.ts";

type Off = { x: number; y: number };

function diskOffsets(r: number, senseHalf: number): Off[] {
    const cells: Off[] = [];
    const rr = Math.min(r, senseHalf);
    for (let dy = -rr; dy <= rr; dy++) {
        for (let dx = -rr; dx <= rr; dx++) {
            if (dx * dx + dy * dy > r * r + 0.5) continue;
            cells.push({ x: dx, y: dy });
        }
    }
    return cells;
}

function crossOffsets(r: number, senseHalf: number): Off[] {
    const cells: Off[] = [];
    const rr = Math.min(r, senseHalf);
    for (let i = 1; i <= rr; i++) {
        cells.push({ x: i, y: 0 }, { x: -i, y: 0 }, { x: 0, y: i }, { x: 0, y: -i });
    }
    return cells;
}

function ringOffsets(r: number, senseHalf: number): Off[] {
    const cells: Off[] = [];
    const rr = Math.min(r, senseHalf);
    const r2 = r * r;
    const i2 = Math.max(0, r - 1) ** 2;
    for (let dy = -rr; dy <= rr; dy++) {
        for (let dx = -rr; dx <= rr; dx++) {
            const d = dx * dx + dy * dy;
            if (d > r2 + 0.5 || d < i2 - 0.5) continue;
            cells.push({ x: dx, y: dy });
        }
    }
    return cells;
}

function columnOffsets(r: number, senseHalf: number): Off[] {
    const cells: Off[] = [];
    const rr = Math.min(r, senseHalf);
    for (let dy = -rr; dy <= rr; dy++) {
        if (dy === 0) continue;
        cells.push({ x: 0, y: dy });
    }
    return cells;
}

function commit(ctx: Ctx, offsets: Off[]): boolean {
    const { seedType, crystalType, ageField, liquidType } = ctx.profile;
    if (seedType == null || Sense.at(ctx.sense, 0, 0) !== seedType) return false;
    if (Grid.hasStructureAt(ctx.x, ctx.y)) return false;
    const targets: Off[] = [];
    for (const o of offsets) {
        if (!Sense.is(ctx.sense, o.x, o.y, liquidType)) continue;
        if (Grid.hasStructureAt(ctx.x + o.x, ctx.y + o.y)) continue;
        targets.push(o);
    }
    if (targets.length < 1) return false;
    for (const t of targets) {
        sandkit.api.elements.replaceAtCell(ctx.x + t.x, ctx.y + t.y, crystalType);
    }
    sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, crystalType);
    Grid.resetFieldAt(ctx.x, ctx.y, ageField);
    return true;
}

export const Crystallization = {
    disk(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) => commit(ctx, diskOffsets(resolveNum(radiusFn), ctx.sense.half));
    },
    cross(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) => commit(ctx, crossOffsets(resolveNum(radiusFn), ctx.sense.half));
    },
    ring(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) => commit(ctx, ringOffsets(resolveNum(radiusFn), ctx.sense.half));
    },
    column(radiusFn: number | (() => number)): CrystallizeFn {
        return (ctx) => commit(ctx, columnOffsets(resolveNum(radiusFn), ctx.sense.half));
    },
    single(): CrystallizeFn {
        return (ctx) => {
            if (!Sense.isNear(ctx.sense, ctx.profile.liquidType)) return false;
            if (
                ctx.profile.seedType == null || Sense.at(ctx.sense, 0, 0) !== ctx.profile.seedType
            ) {
                return false;
            }
            if (ctx.profile.crystalType == null) return false;
            if (Grid.hasStructureAt(ctx.x, ctx.y)) return false;
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
