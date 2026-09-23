/**
 * Main-thread entry — everything is assembled by the main builder.
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/modkit";

import { buildMain } from "./main/build.ts";
import { MOD_ID } from "./ids.ts";

try {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);

    buildMain();
} catch (e) {
    console.error("[astro.seeds] main failed:", e);
}
