import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

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
} satisfies AstroElementMain<TElementKey>;
