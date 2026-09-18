/**
 * Channel Pads — mutable runtime state.
 *
 * Two pieces of cross-module state: the per-channel jump timestamp and the
 * landing pad we should ignore until the player walks off it.
 */

/** Where we last dropped the player, so we do not ping-pong back instantly. */
export interface SkipTarget {
    ch: number;
    x: number;
    y: number;
}

export interface RuntimeState {
    /** Last jump time per channel (ms). */
    lastJumpAt: Partial<Record<number, number>>;
    /** Landing pad to ignore until the player leaves it, or null. */
    skipUntilLeave: SkipTarget | null;
}

export const runtime: RuntimeState = {
    lastJumpAt: {},
    skipUntilLeave: null,
};
