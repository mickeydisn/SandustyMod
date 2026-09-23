import { DEFAULT_GHOST_ALPHA_PERCENT, DEFAULT_PARAMS } from "./constants.ts";
import type { HiddenWorldState } from "./types.ts";

export const runtime: HiddenWorldState = {
  seed: "",
  width: 0,
  height: 0,
  params: DEFAULT_PARAMS,
  data: null,
  skyDistance: null,
  alpha: DEFAULT_GHOST_ALPHA_PERCENT / 100,
  buildFailed: false,
  cache: null,
  explored: null,
  tags: null,
  /** Preview / ghost visual: show exploration tag colors */
  showTagsOverlay: true,
  cacheTags: true,
};
