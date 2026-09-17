import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

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
} satisfies AstroElementMain<TElementKey>;
