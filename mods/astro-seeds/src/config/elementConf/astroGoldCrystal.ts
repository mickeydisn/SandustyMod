import { MatterType } from "@sandmd/shared";
import { ElementConfig } from "../../shared/types.ts";
import { spec } from "../catalogue.ts";

export const astroGoldCrystal: ElementConfig = {
    spec: spec({
        key: "astroGoldCrystal",
        slug: "astro-gold-crystal",
        name: "Astro Gold Crystal",
        description: "From Liquid Gold. Burn → Astro Gold.",
        colors: [[210, 160, 255], [180, 120, 240], [230, 190, 255], [160, 90, 220]],
        density: 200,
        metaColor: 0xb478f0,
        matterType: MatterType.,
        toolboxLabel: "Cry. Gold",
        isSeed: false,
        isCrystal: true,
    }),
    reactions: [],
};
