import { MatterType } from "@sandmd/shared";
import { ElementConfig } from "../../shared/types.ts";
import { spec } from "../util.ts";

export const astroWaterCrystal: ElementConfig = {
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
};
