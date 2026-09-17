/**
 * `@sandmd/element-profiles/worker` — simulation actions, pipeline and the
 * `element:update` dispatcher.
 *
 * Import this from a mod's worker entry and from the files that author
 * `Profile`s. Shared vocabulary (`Profile`, `ElementSpec`, …) lives in
 * `@sandmd/element-profiles/shared`.
 */
export { buildElementWorker } from "./build.ts";
export type { ElementWorkerResult } from "./build.ts";

export { Grid } from "./utils/grid.ts";
export { GridNear } from "./utils/near.ts";
export { Sense } from "./utils/sense.ts";
export { Vote } from "./utils/vote.ts";
export type { VoteChannel, VoteMask } from "./utils/vote.ts";

export { Crystallization, Grow, Move } from "./actions/index.ts";
export type {
    ChannelOpts,
    ColumnForceOpts,
    CompassGroup,
    EatOpts,
    GrowEatOpts,
    InertiaOpts,
    MemoryOpts,
} from "./actions/index.ts";

export { reduceVotes, runProfile, SENSE_SIZE } from "./pipeline.ts";
