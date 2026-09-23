import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

export const astroWaterPowder = {
    spec: spec({
        key: "astroWaterPowder",
        slug: "astro-water",
        name: "Astro Water",
        description: "Powder from water crystal + Fire.",
        colors: [[180, 120, 155], [180, 90, 155], [220, 140, 155]],
        density: 280,
        metaColor: 0x8ec8ff,
        matterType: MatterType.Powder,
        toolboxLabel: "Astro Water",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [{
        inputA: "astroWaterCrystal",
        inputB: "fire",
        outputA: "astroWaterPowder",
        outputB: "fire",
    }],
} satisfies AstroElementMain<TElementKey>;
