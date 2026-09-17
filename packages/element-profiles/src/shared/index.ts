/**
 * `@sandmd/element-profiles/shared` — engine-free vocabulary and helpers.
 *
 * Safe to import from either thread (and from type-only positions): nothing in
 * here touches `sandkit.api` or `@sandmd/sandkit` at module scope.
 */
export type { ElementMain, ElementSpec, ElementVisual, ReactionSpec } from "./element.ts";
export type {
    ColumnForceEntry,
    CrystallizeFn,
    Ctx,
    ForceConfig,
    GrowFn,
    GrowResult,
    MoveFn,
    Profile,
    SenseMatrix,
    TrailEat,
    Vec2,
} from "./types.ts";
export { resolveNum, roll } from "./num.ts";
export { safe } from "./util.ts";
