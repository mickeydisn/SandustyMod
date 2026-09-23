import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { spec } from "../elementShared/util.ts";
import type { AstroElementMain } from "./types.ts";

export const astroCopperCrystal: AstroElementMain<TElementKey> = {
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
} satisfies AstroElementMain<TElementKey>;
