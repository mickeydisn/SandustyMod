import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

export const astroGoldCrystal = {
    spec: spec({
        key: "astroGoldCrystal",
        slug: "astro-gold-crystal",
        name: "Astro Gold Crystal",
        description: "From Liquid Gold. Burn → Astro Gold.",
        colors: [[210, 160, 255], [180, 120, 240], [230, 190, 255], [160, 90, 220]],
        density: 200,
        metaColor: 0xb478f0,
        matterType: MatterType.Static,
        toolboxLabel: "Cry. Gold",
        isSeed: false,
        isCrystal: true,
    }),
    reactions: [],
} satisfies AstroElementMain<TElementKey>;
