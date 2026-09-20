/**
 * Hidden World — runtime state for this session.
 */

import { DEFAULT_GHOST_ALPHA_PERCENT, DEFAULT_PARAMS } from "./constants.ts";
import type { HiddenWorldState } from "./types.ts";

export const runtime: HiddenWorldState = {
    seed: "",
    width: 0,
    height: 0,
    // Replaced (never mutated) on refresh — safe to share the default object.
    params: DEFAULT_PARAMS,
    data: null,
    alpha: DEFAULT_GHOST_ALPHA_PERCENT / 100,
    buildFailed: false,
    cache: null,
};
