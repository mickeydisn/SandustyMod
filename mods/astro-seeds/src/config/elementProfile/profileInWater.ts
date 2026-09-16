import { ProfileSpec } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

export const profileAstroSeedInWater: ProfileSpec<TElementKey> = {
    id: "astroSeed-in-sand",
    seedKey: "astroSeed",
    liquidKey: "water",
    crystalKey: "astroGoldCrystal",
    growAge: 150,
    moves: [
        { kind: "side", chance: 15 },
        { kind: "down", chance: 20 },
    ],
    grow: [{ kind: "ageOnSurround", rate: 100, minCount: 4 }],
    crystallization: [{ kind: "disk", radius: 1 }],
};

export const profileAstroCopperPowderInWater: ProfileSpec<TElementKey> = {
    id: "astroCopper-in-water",
    seedKey: "astroCopperPowder",
    liquidKey: "water",
    crystalKey: "astroCopperCrystal",
    growAge: 10,
    moves: [
        { kind: "up", chance: 5 },
        { kind: "side", chance: 10 },
        { kind: "down", chance: 5 },
        {
            kind: "columnForce",
            rate: -30,
            rangeN: 4,
            maxK: 1,
            directions: ["top", "bottom", "sides"],
        },
        {
            kind: "columnForce",
            rate: 20,
            rangeN: 2,
            maxK: 1,
            directions: ["top", "bottom", "sides", "cross"],
            matchKeys: ["astroGoldPowder"],
        },
        {
            kind: "columnForce",
            rate: -40,
            rangeN: 4,
            maxK: 1,
            directions: ["top", "bottom", "sides"],
            matchKeys: ["astroCopperPowder"],
        },
        {
            kind: "columnForce",
            rate: 40,
            rangeN: 4,
            maxK: 1,
            directions: ["cross"],
            matchKeys: ["astroCopperPowder"],
        },
    ],
    grow: [],
    crystallization: [],
};

export const profileAstroGoldPowderInWater: ProfileSpec<TElementKey> = {
    id: "astroGold-in-water",
    seedKey: "astroGoldPowder",
    liquidKey: "water",
    crystalKey: "astroGoldCrystal",
    growAge: 10,
    moves: [
        { kind: "up", chance: 8 },
        { kind: "side", chance: 8 },
        { kind: "down", chance: 8 },
        {
            kind: "columnForce",
            rate: -30,
            rangeN: 4,
            maxK: 1,
            directions: ["top", "bottom", "sides"],
        },
        {
            kind: "columnForce",
            rate: -20,
            rangeN: 2,
            maxK: 1,
            directions: ["top", "bottom", "sides"],
            matchKeys: ["astroGoldPowder"],
        },
        {
            kind: "columnForce",
            rate: 80,
            rangeN: 5,
            maxK: 1,
            directions: ["top", "bottom", "sides"],
            matchKeys: ["astroCopperPowder"],
        },
    ],
    grow: [],
    crystallization: [],
};
