/**
 * Seed profiles in **water**.
 *
 * Plain `Profile` objects built straight from the `Move`/`Grow`/
 * `Crystallization` actions — no declarative spec layer, no generic factory.
 * The worker resolves element types through `ElementType` and drops this list
 * into its dispatch table (`worker/build.ts`).
 *
 * Only `astroSeedInWater` is wired in `./catalogue.ts`. The two powder-in-water
 * profiles below are kept as ready-to-enable variants (they were disabled in the
 * previous catalogue too) — add them to `ASTRO_PROFILES` to turn them on.
 */
import { Crystallization, Grow } from "@sandmd/element-profiles/worker";
import type { Profile } from "@sandmd/element-profiles/shared";
import { ElementType } from "../elementShared/resolve.ts";
import { buildElementProfie } from "./defBuilder.ts";

// ==========================
// ASTRO SEED — drifts down, matures into a gold crystal disk.
// Every knob reads the profile-config buffer live (`profiles.<id>.*`).
const ID_ASeed = "InWater-ASeed";
export const astroSeedInWater: Profile = {
    ...buildElementProfie(ID_ASeed),
    seedType: ElementType.astroSeed,
    liquidType: ElementType.water,
    crystalType: ElementType.astroGoldCrystal,
    grow: [Grow.ageOnSurround(100, 4)],
    crystallization: [Crystallization.disk(1)],
};

// ==========================
// ASTRO GOLD POWDER — jitters, then column forces spread the family out.
const ID_AGold = "InWater-AGold";
export const astroGoldInWater: Profile = {
    ...buildElementProfie(ID_AGold),
    seedType: ElementType.astroGoldPowder,
    liquidType: ElementType.water,
    crystalType: ElementType.astroGoldCrystal,
    grow: [],
    crystallization: [],
};

// ==========================
// ASTRO COPPER POWDER — jitters, repels its own kind, seeks gold.
const ID_ACopper = "InWater-ACopper";
export const astroCopperInWater: Profile = {
    ...buildElementProfie(ID_ACopper),
    seedType: ElementType.astroCopperPowder,
    liquidType: ElementType.water,
    crystalType: ElementType.astroCopperCrystal,
    grow: [],
    crystallization: [],
};
