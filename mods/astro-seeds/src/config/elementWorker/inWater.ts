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
import { Crystallization, Grow, Move } from "@sandmd/element-profiles/worker";
import type { Profile } from "@sandmd/element-profiles/shared";
import { ASTRO_FIELD } from "../elementShared/ids.ts";
import { ElementType } from "../elementShared/resolve.ts";

// ==========================
// ASTRO SEED — drifts down, matures into a gold crystal disk.
export const astroSeedInWater: Profile = {
    id: "astroSeed-in-water",
    seedType: ElementType.astroSeed,
    liquidType: ElementType.water,
    crystalType: ElementType.astroGoldCrystal,
    tickSpeed: 50,
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 150,
    moves: [
        Move.side(15),
        Move.down(20),
    ],
    grow: [Grow.ageOnSurround(100, 4)],
    crystallization: [Crystallization.disk(1)],
};

// ==========================
// ASTRO GOLD POWDER — jitters, then column forces spread the family out.
export const astroGoldInWater: Profile = {
    id: "astroGold-in-water",
    seedType: ElementType.astroGoldPowder,
    liquidType: ElementType.water,
    crystalType: ElementType.astroGoldCrystal,
    tickSpeed: 50,
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 10,
    moves: [
        Move.up(8),
        Move.side(8),
        Move.down(8),
        // Broad repulsion from any ray hit.
        Move.columnForce({
            rateFn: -30,
            rangeNFn: 4,
            maxKFn: 1,
            directions: ["top", "bottom", "sides"],
        }),
        // Own kind pushes back.
        Move.columnForce({
            rateFn: -20,
            rangeNFn: 2,
            maxKFn: 1,
            directions: ["top", "bottom", "sides"],
            matchTypes: [ElementType.astroGoldPowder],
        }),
        // Copper pulls gold in.
        Move.columnForce({
            rateFn: 80,
            rangeNFn: 5,
            maxKFn: 1,
            directions: ["top", "bottom", "sides"],
            matchTypes: [ElementType.astroCopperPowder],
        }),
    ],
    grow: [],
    crystallization: [],
};

// ==========================
// ASTRO COPPER POWDER — jitters, repels its own kind, seeks gold.
export const astroCopperInWater: Profile = {
    id: "astroCopper-in-water",
    seedType: ElementType.astroCopperPowder,
    liquidType: ElementType.water,
    crystalType: ElementType.astroCopperCrystal,
    tickSpeed: 50,
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 10,
    moves: [
        Move.up(5),
        Move.side(10),
        Move.down(5),
        Move.columnForce({
            rateFn: -30,
            rangeNFn: 4,
            maxKFn: 1,
            directions: ["top", "bottom", "sides"],
        }),
        Move.columnForce({
            rateFn: 20,
            rangeNFn: 2,
            maxKFn: 1,
            directions: ["top", "bottom", "sides", "cross"],
            matchTypes: [ElementType.astroGoldPowder],
        }),
        Move.columnForce({
            rateFn: -40,
            rangeNFn: 4,
            maxKFn: 1,
            directions: ["top", "bottom", "sides"],
            matchTypes: [ElementType.astroCopperPowder],
        }),
        Move.columnForce({
            rateFn: 40,
            rangeNFn: 4,
            maxKFn: 1,
            directions: ["cross"],
            matchTypes: [ElementType.astroCopperPowder],
        }),
    ],
    grow: [],
    crystallization: [],
};
