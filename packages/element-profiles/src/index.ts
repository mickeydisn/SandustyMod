/**
 * @sandmd/element-profiles — a generic element-profile simulation core.
 *
 * Prefer the scoped entry points so each bundle only pulls what it needs:
 * - `@sandmd/element-profiles/shared` — engine-free types + numeric helpers
 * - `@sandmd/element-profiles/main`   — element / reaction / tech registration
 * - `@sandmd/element-profiles/worker` — actions, pipeline, profile dispatch
 *
 * This root entry re-exports all three for convenience (and backwards
 * compatibility). Importing it pulls in the worker actions too, so a main-thread
 * bundle should import `.../main` instead.
 */
export * from "./shared/index.ts";
export * from "./main/index.ts";
export * from "./worker/index.ts";
