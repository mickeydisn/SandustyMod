import { MatterType } from "@sandmd/shared";
import { ASTRO_SEED_DENSITY } from "./constants.ts";
import { spec } from "../elementShared/util.ts";
import type { TElementKey } from "../elementShared/keys.ts";
import type { AstroElementMain } from "./types.ts";

export const astroSeed = {
    spec: spec({
        key: "astroSeed",
        slug: "astro-seed",
        name: "Astro Seed",
        description: "Liquid Gold / Copper / Water → crystals.",
        colors: [[80, 120, 155], [40, 90, 155], [0, 60, 140]],
        density: ASTRO_SEED_DENSITY,
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
