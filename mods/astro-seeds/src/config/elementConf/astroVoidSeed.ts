import { MatterType } from "@sandmd/shared";
import { AstroElementConfig } from "../../element/types.ts";
import { TElementKey } from "../catalogue.ts";

import { spec } from "../util.ts";

export const astroVoidSeed = {
    spec: spec({
        key: "astroVoidSeed",
        slug: "astro-void-seed",
        name: "Astro Void Seed",
        description: "Mix with Florinol → Astro Seed.",
        colors: [[80, 40, 140], [60, 20, 110], [100, 50, 160]],
        density: 90,
        metaColor: 0x50288c,
        matterType: MatterType.Powder,
        toolboxLabel: "Void Seed",
        isSeed: false,
        isCrystal: false,
    }),
    reactions: [{
        inputA: "seedBase",
        inputB: "voidPetal",
        outputA: "astroVoidSeed",
        outputB: null,
    }],
} satisfies AstroElementConfig<TElementKey>;
