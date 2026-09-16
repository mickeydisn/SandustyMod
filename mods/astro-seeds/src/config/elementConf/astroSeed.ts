import { MatterType } from "@sandmd/shared";
import { spec } from "../util.ts";
import { AstroElementConfig } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export const astroSeed = {
    spec: spec({
        key: "astroSeed",
        slug: "astro-seed",
        name: "Astro Seed",
        description: "Liquid Gold / Copper / Water → crystals.",
        colors: [[180, 220, 255], [140, 190, 255], [100, 160, 240], [220, 240, 255]],
        density: SEED_DENSITY,
        metaColor: 0x8ec8ff,
        matterType: MatterType.Powder,
        toolboxLabel: "Seed",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [{
        inputA: "astroVoidSeed",
        inputB: "florinol",
        outputA: "astroSeed",
        outputB: null,
    }],
    profiles: [
        {
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
        },
        {
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
        },
        {
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
                { kind: "ageOnSurround", rate: 20, minCount: 4 },
                { kind: "instantChance", rate: 0 },
                { kind: "ageOnFloor", rate: 60 },
                { kind: "ageOnWall", rate: 70 },
                // { kind: "ageOnAir", rate: 30 },
                { kind: "ageOnCrystal", rate: 100 },
            ],
            crystallization: [{ kind: "cross", radius: 2 }],
        },
    ],
} satisfies AstroElementConfig<TElementKey>;
