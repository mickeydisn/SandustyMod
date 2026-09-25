import { MatterType } from "@sandmd/shared";
import { ASTRO_SEED_DENSITY } from "./constants.ts";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

export const astroGCalloyPowder = {
    spec: spec({
        key: "astroGCalloyPowder",
        slug: "astro-gc-alloy",
        name: "Astro GC Alloy Powder",
        description: "Powder from ...",
        colors: [[100, 155, 10], [60, 130, 0]],
        density: ASTRO_SEED_DENSITY,
        metaColor: 0x943aA0,
        matterType: MatterType.Powder,
        toolboxLabel: "Astro GC Alloy",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [],
} satisfies AstroElementMain<TElementKey>;
