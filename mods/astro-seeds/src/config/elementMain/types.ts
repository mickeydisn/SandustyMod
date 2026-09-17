/**
 * Main-thread catalogue types.
 *
 * One entry = the engine registration data for one element plus its contact
 * reactions. Worker-only profile data lives in `config/elementWorker`.
 */
import type { AstroElementSpec, ReactionSpec } from "../elementShared/types.ts";

/** = One grouped main-thread entry: registration spec + contact reactions. */
export interface AstroElementMain<ElType extends string> {
    spec: AstroElementSpec;
    reactions: ReactionSpec<ElType>[];
}
