/**
 * Shared elements barrel — grouped catalogue + resolved ids.
 * Import from here; do not reach into `catalogue.ts` / `resolve.ts` directly.
 */
export type {
    AstroElementSpec,
    ElementVisual,
    ReactionSpec,
    TAstroElementKey,
    TElementTypeIDs,
    TElementTypeKey,
    TVanillaElementKey,
} from "./types.ts";
export type { TElementType } from "@sandmd/types";
export { ASTRO_ELEMENT_BY_KEY, ASTRO_ELEMENTS, ASTRO_REACTIONS } from "./catalogue.ts";
export { ElementType } from "./resolve.ts";
