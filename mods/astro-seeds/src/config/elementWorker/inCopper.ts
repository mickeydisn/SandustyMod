/**
 * Seed profiles in **liquid copper**.
 *
 * Astro Seed drifts, ages on floor/wall/crystal and crystallises into a copper
 * cross — copper is where the seed matures fastest.
 */
import { Crystallization, Grow, Move } from "@sandmd/element-profiles/worker";
import type { Profile } from "@sandmd/element-profiles/shared";
import { ASTRO_FIELD } from "../elementShared/ids.ts";
import { ElementType } from "../elementShared/resolve.ts";

export const astroSeedInCopper: Profile = {
    id: "astroSeed-in-copper",
    seedType: ElementType.astroSeed,
    liquidType: ElementType.liquidCopper,
    crystalType: ElementType.astroCopperCrystal,
    tickSpeed: 50,
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 40,
    moves: [
        Move.up(0),
        Move.side(25),
        Move.down(35),
    ],
    grow: [
        Grow.ageOnSurround(20, 4),
        Grow.instantChance(0),
        Grow.ageOnFloor(60),
        Grow.ageOnWall(70),
        Grow.ageOnCrystal(100),
    ],
    crystallization: [Crystallization.cross(2)],
};
