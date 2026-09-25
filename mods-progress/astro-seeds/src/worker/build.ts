/**
 * Worker-thread entry — hands the astro profile list to the shared
 * element-profiles worker builder (hooks + dispatch + physics handling).
 *
 * Live config: the profile literals themselves read `profiles.<id>.*` from the
 * profile-config JsonBuffer via the getters in `./live.ts` — there is no
 * wrapper or sync layer here. `profileBuffer()` is touched once at startup so
 * a broken shared-buffer setup is reported early, before the hooks register.
 */
import { buildElementWorker } from "@sandmd/element-profiles/worker";
import { ASTRO_PROFILES } from "../config/elementWorker/catalogue.ts";
import { MOD_ID, VERSION } from "../ids.ts";
import { profileBuffer } from "../config/elementWorker/live.ts";

export function buildWorker(): void {
    // Touch the buffer handle once so shared-memory setup problems are visible.
    // Profile readers use the typed PROFILE_DEFAULTS record if the handle is
    // temporarily unavailable.
    profileBuffer();

    const { seedTypes } = buildElementWorker(ASTRO_PROFILES);
    console.log(`[${MOD_ID} v${VERSION}] worker loaded`, seedTypes);
}
