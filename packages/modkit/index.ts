/**
 * `@sandmd/modkit` — shared plumbing every Sandustry mod needs.
 *
 * - `src/safe.ts`     — best-effort wrapper for the optional engine bridges.
 * - `src/settings.ts` — typed reader for the `configSchema` in `modinfo.json`.
 * - `src/cleanup.ts`  — prune / orphan / storage cleanup for a mod id.
 *
 * The mod stays responsible for its own `main()` / `teardown()`; these modules
 * only remove the boilerplate around them.
 */
export * from "./src/safe.ts";
export * from "./src/settings.ts";
export * from "./src/cleanup.ts";
