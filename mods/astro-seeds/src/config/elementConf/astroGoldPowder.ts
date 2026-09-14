import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";
import { TElementKey } from "../catalogue.ts";

import { spec } from "../util.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export const astroGoldPowder = {
    spec: spec({
        key: "astroGoldPowder",
        slug: "astro-gold",
        name: "Astro Gold Powder",
        description: "Powder from gold crystal + Fire.",
        colors: [[180, 255, 90], [150, 230, 60]],
        density: SEED_DENSITY,
        metaColor: 0xb45af0,
        matterType: MatterType.Powder,
        toolboxLabel: "Astro Gold",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [{
        inputA: "astroGoldCrystal",
        inputB: "fire",
        outputA: "astroGoldPowder",
        outputB: "fire",
    }],
    profiles: [
        {
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
                    opts: { rate: -80, rangeN: 8, maxK: 1, directions: ["top", "bottom", "sides"] },
                },
                {
                    kind: "columnForce",
                    opts: {
                        rate: -10,
                        rangeN: 2,
                        maxK: 1,
                        directions: ["top", "bottom", "sides", "cross"],
                        matchKeys: ["astroGoldPowder"],
                    },
                },
                {
                    kind: "columnForce",
                    opts: {
                        rate: 90,
                        rangeN: 6,
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
