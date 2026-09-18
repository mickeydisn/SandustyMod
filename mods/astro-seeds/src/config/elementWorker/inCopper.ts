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
import { live } from "./live.ts";

const ID = "InCopper-ASeed";
export const astroSeedInCopper: Profile = {
    id: ID,
    seedType: ElementType.astroSeed,
    liquidType: ElementType.liquidCopper,
    crystalType: ElementType.astroCopperCrystal,
    tickSpeed: () => live(ID, "tickSpeed", 50),
    enabled: () => live(ID, "enabled", true),
    growEnabled: () => live(ID, "growEnabled", false),
    crystallizationEnabled: () => live(ID, "crystalEnabled", false),
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 40,
    moves: [
        Move.up(0),
        Move.side(() => live(ID, "moveSide", 25)),
        Move.down(() => live(ID, "moveDown", 35)),
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
