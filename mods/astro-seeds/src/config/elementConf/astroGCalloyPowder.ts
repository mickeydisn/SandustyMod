import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

import { spec } from "../util.ts";
import { InWaterProfile } from "../elementProfile/inWater.ts";
import { InGoldProfile } from "../elementProfile/inGold.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export const astroGCalloyPowder = {
    spec: spec({
        key: "astroGCalloyPowder",
        slug: "astro-gc-alloy",
        name: "Astro GC Alloy Powder",
        description: "Powder from ...",
        colors: [[100, 155, 10], [60, 130, 0]],
        density: SEED_DENSITY,
        metaColor: 0x943aA0,
        matterType: MatterType.Powder,
        toolboxLabel: "Astro GC Alloy",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [],
    profiles: [
        // InWaterProfile.astroGoldPowder,
        // InGoldProfile.astroGCalloy,
    ],
} satisfies AstroElementConfig<TElementKey>;
