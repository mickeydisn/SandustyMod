import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

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
        inputB: "water",
        outputA: "astroCopperPowder",
        outputB: "water",
    }],
} satisfies AstroElementMain<TElementKey>;
