import { ProfileSpec } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

export const profileAstroSeedInCopper: ProfileSpec<TElementKey> = {
    id: "astroSeed-in-copper",
    seedKey: "astroSeed",
    liquidKey: "liquidCopper",
    crystalKey: "astroCopperCrystal",
    growAge: 40,
    moves: [
        { kind: "up", chance: 0 },
        { kind: "side", chance: 25 },
        { kind: "down", chance: 35 },
    ],
    grow: [
        // { kind: "blockOn", blockKey: "water" },
        { kind: "instantChance", rate: 0 },
        { kind: "ageOnFloor", rate: 60 },
        { kind: "ageOnWall", rate: 70 },
        // { kind: "ageOnAir", rate: 30 },
        { kind: "ageOnCrystal", rate: 100 },
    ],
    crystallization: [{ kind: "cross", radius: 1 }],
};

/*
export const profileAstroCopperPowderInCopper: ProfileSpec<TElementKey> = {

};

export const profileAstroGoldPowderInCopper: ProfileSpec<TElementKey> = {

};
*/
