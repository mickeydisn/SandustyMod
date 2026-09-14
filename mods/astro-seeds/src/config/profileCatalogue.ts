/**
 * Astro-seeds profile catalogue — one grouped spec per seed behaviour.
 *
 * Each entry groups every aspect of an element's simulation. The generic
 * `createElementProfileFactory` builds the lazy closures, so adding a
 * conf = adding one spec object. Reusable via createProfileFactories.
 */
import { Profile } from "@sandmd/element-profiles";
import { forceEntries, WaterCfg } from "../worker/config.ts";
import type { ProfileSpec } from "../worker/elementProfileFactory.ts";
import {
    createElementProfileFactory,
    createProfileFactories,
} from "../worker/elementProfileFactory.ts";
import { ASTRO_ELEMENTS, TElementKey } from "./catalogue.ts";
import { AstroElementConfig } from "../element/types.ts";

export const PROFILE_SPECS: readonly ProfileSpec<TElementKey>[] = (
    ASTRO_ELEMENTS as readonly AstroElementConfig<TElementKey>[]
).flatMap((el) => el.profiles ?? []);

/** Generic-built factories — reusable with any conf via createProfileFactories. */
export const profileFactories = createProfileFactories(PROFILE_SPECS);

export const PROFILES: Record<string, () => Profile> = profileFactories as Record<
    string,
    () => Profile
>;

export const profiles: (() => Profile)[] = Object.values(
    profileFactories,
);

// Legacy named accessors (delegate to the generic builder).
export const profileGold = () => createElementProfileFactory(PROFILE_SPECS[0])();
export const profileCopper = () => createElementProfileFactory(PROFILE_SPECS[1])();
export const profileGoldPowder = () => createElementProfileFactory(PROFILE_SPECS[2])();
export const profileCopperPowder = () => createElementProfileFactory(PROFILE_SPECS[3])();
export const profileWater = () => createElementProfileFactory(PROFILE_SPECS[4])();
