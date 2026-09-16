/**
 * @sandmd/element-profiles — a generic element-profile simulation core.
 *
 * Worker side: build `Profile`s from the action factories and drive them with
 * `runProfile`. Main side: import the `Profile`/`ForceConfig` types to edit the
 * same description from a panel. Reusable across mods that model "seed over a
 * liquid → grow → crystallize" behaviour.
 */
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

export { Grid } from "./grid.ts";
export { GridNear } from "./near.ts";
export { Sense } from "./sense.ts";
export { resolveNum } from "./resolve.ts";

export { Crystallization, Grow, Move } from "./actions/index.ts";
export type {
    ChannelOpts,
    ColumnForceOpts,
    CompassGroup,
    EatOpts,
    InertiaOpts,
    MemoryOpts,
    GrowEatOpts,
} from "./actions/index.ts";

export { reduceVotes, runProfile, SENSE_SIZE } from "./pipeline.ts";
export { Vote } from "./vote.ts";
export type { VoteChannel, VoteMask } from "./vote.ts";
