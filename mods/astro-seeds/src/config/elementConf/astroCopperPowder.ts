import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";

import { spec } from "../util.ts";
import { TElementKey } from "../keys.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

// ---------------------
// Vote-matrix masks. The pipeline samples a 5x5 window around the seed and
// sums every channel into it, so a 3x3 mask is centre-cropped into that
// window — each entry is the multiplier of the cell at that offset.
// ---------------------
const MASK_CROSS = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]; // orthogonal neighbours
const MASK_DIAGONAL = [[1, 0, 1], [0, 0, 0], [1, 0, 1]]; // diagonal neighbours
// Gravity probe: the two cells straight below the seed, near row weighted
// heavier than the far one, so a column of liquid gold pulls the seed down.
const MASK_GRAVITY = [
    [0, 0, 0, 0, 0],
    [0, 0, 0.5, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0.5, 0, 0],
];

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
        inputB: "water",
        outputA: "astroCopperPowder",
        outputB: "water",
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
        },
        {
            id: "astroCopper-in-liquid-gold",
            seedKey: "astroCopperPowder",
            liquidKey: "liquidGold",
            crystalKey: "astroCopperCrystal",
            growAge: 10,
            moves: [
                // Jitter — uniform random draw over the 8 neighbours.
                { kind: "random", chance: 80 },
                // Gravity — liquid gold below pulls the seed down.
                {
                    kind: "channel",
                    chance: 1,
                    matchKeys: ["liquidGold"],
                    weight: 1,
                    mask: MASK_GRAVITY,
                },
                // Lattice — own kind repels orthogonally but attracts
                // diagonally, so copper settles into diagonal chains instead
                // of stacking into a solid blob.
                {
                    kind: "channel",
                    chance: 90,
                    matchKeys: ["astroCopperPowder"],
                    weight: -5,
                    mask: MASK_CROSS,
                },
                {
                    kind: "channel",
                    chance: 90,
                    matchKeys: ["astroCopperPowder"],
                    weight: 5,
                    mask: MASK_DIAGONAL,
                },
                // Cluster — any nearby gold powder pulls this copper in.
                { kind: "channel", chance: 90, matchKeys: ["astroGoldPowder"], weight: 5 },
            ],
            grow: [],
            crystallization: [],
        },
    ],
} satisfies AstroElementConfig<TElementKey>;
