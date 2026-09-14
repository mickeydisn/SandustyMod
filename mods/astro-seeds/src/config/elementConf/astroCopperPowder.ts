import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";

import { spec } from "../util.ts";
import { TElementKey } from "../catalogue.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export const astroCopperPowder = {
    spec: spec({
        key: "astroCopperPowder",
        slug: "astro-copper",
        name: "Astro Copper",
        description: "Powder from copper crystal + Fire.",
        colors: [[240, 80, 40], [180, 60, 20]],
        density: SEED_DENSITY,
        metaColor: 0xb46428,
        matterType: MatterType.Powder,
        toolboxLabel: "Astro Copper",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [{
        inputA: "astroCopperCrystal",
        inputB: "fire",
        outputA: "astroCopperPowder",
        outputB: "fire",
    }],
    profiles: [
        {
            id: "astroCopper-in-water",
            seedKey: "astroCopperPowder",
            liquidKey: "water",
            crystalKey: "astroCopperCrystal",
            growAge: 10,
            moves: [
                { kind: "up", chance: 5 },
                { kind: "side", chance: 5 },
                { kind: "down", chance: 5 },
                {
                    kind: "columnForce",
                    opts: { rate: -80, rangeN: 8, maxK: 1, directions: ["top", "bottom", "sides"] },
                },
                {
                    kind: "columnForce",
                    opts: {
                        rate: 30,
                        rangeN: 2,
                        maxK: 1,
                        directions: ["top", "bottom", "sides", "cross"],
                        matchKeys: ["astroGoldPowder"],
                    },
                },
                {
                    kind: "columnForce",
                    opts: {
                        rate: -20,
                        rangeN: 4,
                        maxK: 1,
                        directions: ["top", "bottom", "sides", "cross"],
                        matchKeys: ["astroCopperPowder"],
                    },
                },
            ],
            grow: [],
            crystallization: [],
        },
    ],
} satisfies AstroElementConfig<TElementKey>;
