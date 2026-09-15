/**
 * Main-thread entry — everything is assembled by the main builder.
 */
import "@sandmd/sandkit";
import { buildMain } from "./main/build.ts";

try {
    buildMain();
} catch (e) {
    console.error("[astro.seeds] main failed:", e);
}
