import { ProfileSpec } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

export const profileAstroSeedInGold: ProfileSpec<TElementKey> = {
    id: "astroSeed-in-gold",
    seedKey: "astroSeed",
    liquidKey: "liquidGold",
    crystalKey: "astroGoldCrystal",
    growAge: 150,
    moves: [
        { kind: "side", chance: 15 },
        { kind: "down", chance: 20 },
    ],
    grow: [{ kind: "ageOnSurround", rate: 100, minCount: 4 }],
    crystallization: [{ kind: "disk", radius: 1 }],
};

export const profileAstroCopperPowderInGold: ProfileSpec<TElementKey> = {};

export const profileAstroGoldPowderInGold: ProfileSpec<TElementKey> = {};
