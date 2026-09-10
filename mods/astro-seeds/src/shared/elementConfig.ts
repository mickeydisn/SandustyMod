/**
 * Back-compat shim — prefer `shared/elements/index.ts` (grouped catalogue).
 * Kept so existing imports keep working during migration.
 */
export type { TAstroElementKey } from "./elements/index.ts";
export type { TAstroElementKey as TAstroElementTypeKey } from "./elements/index.ts";
export { ASTRO_ELEMENT_BY_KEY as elementConfig } from "./elements/catalogue.ts";
