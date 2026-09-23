import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

export const astroWaterCrystal = {
    spec: spec({
        key: "astroWaterCrystal",
        slug: "astro-water-crystal",
        name: "Astro Water Crystal",
        description: "From Water (panel). Burn → Astro Water.",
        colors: [[60, 100, 155], [40, 90, 155], [0, 60, 155]],
        density: 0,
        metaColor: 0x8ec8ff,
        matterType: MatterType.Static,
        toolboxLabel: "Cry. Water",
        isSeed: false,
        isCrystal: true,
    }),
    reactions: [],
} satisfies AstroElementMain<TElementKey>;
