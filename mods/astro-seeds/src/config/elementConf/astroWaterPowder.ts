import { MatterType } from "@sandmd/shared";
import { ElementConfig } from "../../shared/types.ts";
import { spec } from "../util.ts";

export const astroWaterPowder: ElementConfig = {
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
};
