/**
 * `@sandmd/element-profiles/main` — main-thread element registration.
 *
 * Import this from a mod's main entry. It deliberately pulls in no worker code,
 * so the simulation actions never reach the main bundle.
 */
export { buildElementMain, elementDescriptionKey, elementNameKey } from "./build.ts";
export type { ElementMainConfig, ElementMainResult, TechNodeConfig } from "./types.ts";
