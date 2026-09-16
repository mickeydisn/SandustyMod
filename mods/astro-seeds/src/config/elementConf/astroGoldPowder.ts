import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

import { spec } from "../util.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

// ---------------------
// Vote-matrix masks. The pipeline samples a 5x5 window around the seed and
// sums every channel into it, so a 3x3 mask is centre-cropped into that
// window — each entry is the multiplier of the cell at that offset.
// ---------------------
const MASK_CROSS = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]; // orthogonal neighbours
// Gravity probe: the two cells straight below the seed, near row weighted
// heavier than the far one, so a column of liquid gold pulls the seed down.
const MASK_GRAVITY = [
    [0, 0, 0, 0, 0],
    [0, 0, .5, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0.5, 0, 0],
];

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
        },
        {
            id: "astroGold-in-liquid-gold",
            seedKey: "astroGoldPowder",
            liquidKey: "liquidGold",
            crystalKey: "astroGoldCrystal",
            growAge: 10,
            moves: [
                // Jitter — uniform random draw over the 8 neighbours.
                { kind: "trailEat", chance: 1, replaceKey: "sand" },
                // Jitter — uniform random draw over the 8 neighbours.
                { kind: "random", chance: 80 },
                // Gravity — liquid gold below pulls the seed down.
                {
                    kind: "channel",
                    chance: 1,
                    matchKeys: ["liquidGold"],
                    weight: .2,
                    mask: MASK_GRAVITY,
                },
                {
                    kind: "channel",
                    matchKeys: ["empty"],
                    chance: 100,
                    weight: 5,
                },
                // Dispersed — own kind beside it pushes back (orthogonal only,
                // so diagonal neighbours stay free to settle).
                {
                    kind: "channel",
                    chance: 10,
                    matchKeys: ["astroGoldPowder"],
                    weight: -1,
                    mask: MASK_CROSS,
                },
                // Cluster — any nearby copper powder pulls this gold in.
                { kind: "channel", chance: 20, matchKeys: ["astroCopperPowder"], weight: -2 },
            ],
            grow: [],
            crystallization: [],
        },
    ],
} satisfies AstroElementConfig<TElementKey>;
