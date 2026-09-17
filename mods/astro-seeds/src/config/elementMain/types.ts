/**
 * Main-thread catalogue entry: the astro registration spec + contact reactions.
 *
 * Structurally an `ElementMain<TElementKey>` from `@sandmd/element-profiles`;
 * the astro spec adds the panel/catalogue extras on top of `ElementSpec`.
 */
import type { AstroElementSpec, ReactionSpec } from "../elementShared/types.ts";

export interface AstroElementMain<ElType extends string> {
    spec: AstroElementSpec;
    reactions: ReactionSpec<ElType>[];
}
