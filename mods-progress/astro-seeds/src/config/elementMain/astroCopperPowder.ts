import { MatterType } from "@sandmd/shared";
import { ASTRO_SEED_DENSITY } from "./constants.ts";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

export const astroCopperPowder = {
    spec: spec({
        key: "astroCopperPowder",
        slug: "astro-copper",
        name: "Astro Copper",
        description: "Powder from copper crystal + Fire.",
        colors: [[240, 80, 40], [180, 60, 20]],
        density: ASTRO_SEED_DENSITY,
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
