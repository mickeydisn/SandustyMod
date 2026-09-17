/**
 * Worker-thread entry — hands the astro profile list to the shared
 * element-profiles worker builder (hooks + dispatch + physics handling).
 */
import { buildElementWorker } from "@sandmd/element-profiles/worker";
import { ASTRO_PROFILES } from "../config/elementWorker/catalogue.ts";
import { MOD_ID, VERSION } from "../config/elementShared/ids.ts";

export function buildWorker(): void {
    const { seedTypes } = buildElementWorker(ASTRO_PROFILES);
    console.log(`[${MOD_ID} v${VERSION}] worker loaded`, seedTypes);
}
