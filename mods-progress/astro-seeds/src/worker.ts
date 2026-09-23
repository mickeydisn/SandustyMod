/**
 * Worker entry — Sandustry simulation thread. Assembly happens in buildWorker().
 * Build: deno task build:worker
 */
import "@sandmd/sandkit";
import { buildWorker } from "./worker/build.ts";

try {
    buildWorker();
} catch (e) {
    console.error("[astro.seeds] worker failed:", e);
}
