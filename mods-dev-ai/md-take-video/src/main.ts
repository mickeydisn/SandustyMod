/**
 * md-take-video — source note
 *
 * The shipped entry is the self-contained `../main.js` (no deno/modkit dependency
 * so the folder can be dropped into the game mods directory as-is).
 *
 * This file documents the lifecycle expected by the md-admin-clean template:
 *
 *   main()     — register bindings, inject React panel, install crop outline
 *   teardown() — stop recorder, unregister overlay, clear listeners
 *
 * Enable/disable is driven by configSchema.enabled (polled + boot check).
 *
 * For a future workspace build against @sandmd/modkit, re-export the same
 * surface and point deno.json build:main at a thin wrapper that imports the
 * logic from a modular tree.
 */

export const MOD_ID = "md-take-video";
export const VERSION = "1.0.0";

/** Runtime entry lives in ../main.js */
