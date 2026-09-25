/**
 * Worker profile catalogue — the list of simulation behaviours the worker runs.
 *
 * This is the worker-side single source of truth. `worker/build.ts` consumes it
 * directly: one `element:update` hook per distinct `seedType`, then each tick is
 * dispatched to the first profile whose seed sits in its liquid.
 *
 * Add a profile to this list and the worker picks it up — there is no generic
 * factory and no spec DSL to keep in sync with the `Move`/`Grow`/
 * `Crystallization` API. Removing a line disables that behaviour.
 */
import type { Profile } from "@sandmd/element-profiles/shared";
import { PROFILE_IDS } from "../profileRuntime.ts";
import { astroSeedInCopper } from "./inCopper.ts";
import { astroCopperInLiquidGold, astroGoldInLiquidGold, astroSeedInGold } from "./inGold.ts";
import { astroCopperInWater, astroGoldInWater, astroSeedInWater } from "./inWater.ts";

export const ASTRO_PROFILES: readonly Profile[] = [
    // water
    astroSeedInWater,
    astroGoldInWater,
    astroCopperInWater,
    // liquid gold
    astroSeedInGold,
    astroGoldInLiquidGold,
    astroCopperInLiquidGold,
    // liquid copper
    astroSeedInCopper,
];

const profileIds = new Set(ASTRO_PROFILES.map((profile) => profile.id));
for (const id of PROFILE_IDS) {
    if (!profileIds.has(id)) {
        throw new Error(`Astro profile configuration is missing worker profile "${id}".`);
    }
}
for (const profile of ASTRO_PROFILES) {
    if (!(PROFILE_IDS as readonly string[]).includes(profile.id)) {
        throw new Error(`Astro worker profile "${profile.id}" has no buffer configuration.`);
    }
}
