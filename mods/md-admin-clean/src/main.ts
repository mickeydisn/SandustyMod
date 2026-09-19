/**
 * Main-thread entry — everything is assembled by the main builder.
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/dev";

import { MOD_ID, VERSION } from "./ids.ts";
const api = sandkit.api;

const cleanModItem = (MOD_ID: string): void => {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);
};

function openDevTools(): void {
    try {
        const electron = (globalThis as { electron?: { openDevTools?: () => void } }).electron;
        electron?.openDevTools?.();
    } catch {
        /* devtools bridge unavailable — non-fatal */
    }
}

/**
 * Start the main
 */
try {
    api.events.on("game:ready", () => {
        api.ui.toast(`MD ADMIN v${VERSION}`, {});
    });

    openDevTools();
    console.log("GAME STATE", sandkit.state);

    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);

    cleanModItem("buffer-controls");
} catch (e) {
    console.error("[astro.seeds] main failed:", e);
}
