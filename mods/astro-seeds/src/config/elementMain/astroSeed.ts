import { MatterType } from "@sandmd/shared";
import { spec } from "../elementShared/util.ts";
import type { TElementKey } from "../elementShared/keys.ts";
import type { AstroElementMain } from "./types.ts";

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
} satisfies AstroElementMain<TElementKey>;
