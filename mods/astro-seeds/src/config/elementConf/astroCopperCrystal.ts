import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";
import { spec } from "../util.ts";
import { TElementKey } from "../keys.ts";

export const astroCopperCrystal: AstroElementConfig<TElementKey> = {
    spec: spec({
        key: "astroCopperCrystal",
        slug: "astro-copper-crystal",
        name: "Astro Copper Crystal",
        description: "From Liquid Copper. Burn → Astro Copper.",
        colors: [[200, 120, 80], [180, 90, 50], [220, 140, 90], [160, 70, 40]],
        density: 0,
        metaColor: 0xc87850,
        matterType: MatterType.Static,
        toolboxLabel: "Cry. Copper",
        isSeed: false,
        isCrystal: true,
    }),
    reactions: [],
} satisfies AstroElementConfig<TElementKey>;
