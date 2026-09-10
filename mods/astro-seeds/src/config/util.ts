/**
 * Astro-seeds element catalogue — grouped configuration.
 *
 * Single source of truth for every facet of an element: identity, visual,
 * physics, toolbox label and worker role. Add a field here and registration,
 * i18n, panel toolbox and profiles follow without a second source of truth.
 */
import { MOD_ID } from "./ids.ts";
import { safe } from "../shared/utils.ts";
import type { AstroElementSpec, ReactionSpec, TAstroElementKey } from "../shared/types.ts";

export function matterPowder(): number {
    const MatterType = safe(() => sandkit.enums?.MatterType) as Record<string, number> | null;
    return MatterType?.Powder ?? 8;
}

export function matterStatic(): number {
    const MatterType = safe(() => sandkit.enums?.MatterType) as Record<string, number> | null;
    return MatterType?.Static ?? 5;
}

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export function spec(entry: Omit<AstroElementSpec, "id"> & { slug: string }): AstroElementSpec {
    return { ...entry, id: `${MOD_ID}:${entry.slug}` };
}

/** Ordered catalogue — index order is the registration order. */
export const ASTRO_ELEMENTS: readonly AstroElementSpec[] = [
    spec({
        key: "astroVoidSeed",
        slug: "astro-void-seed",
        name: "Astro Void Seed",
        description: "Mix with Florinol → Astro Seed.",
        colors: [[80, 40, 140], [60, 20, 110], [100, 50, 160]],
        density: 90,
        metaColor: 0x50288c,
        matterType: matterPowder(),
        toolboxLabel: "Void Seed",
        isSeed: false,
        isCrystal: false,
    }),
    spec({
        key: "astroSeed",
        slug: "astro-seed",
        name: "Astro Seed",
        description: "Liquid Gold / Copper / Water → crystals.",
        colors: [[180, 220, 255], [140, 190, 255], [100, 160, 240], [220, 240, 255]],
        density: SEED_DENSITY,
        metaColor: 0x8ec8ff,
        matterType: matterPowder(),
        toolboxLabel: "Seed",
        isSeed: true,
        isCrystal: false,
    }),
    spec({
        key: "astroGoldCrystal",
        slug: "astro-gold-crystal",
        name: "Astro Gold Crystal",
        description: "From Liquid Gold. Burn → Astro Gold.",
        colors: [[210, 160, 255], [180, 120, 240], [230, 190, 255], [160, 90, 220]],
        density: 200,
        metaColor: 0xb478f0,
        matterType: matterStatic(),
        toolboxLabel: "Cry. Gold",
        isSeed: false,
        isCrystal: true,
    }),
    spec({
        key: "astroGoldPowder",
        slug: "astro-gold",
        name: "Astro Gold Powder",
        description: "Powder from gold crystal + Fire.",
        colors: [[180, 255, 90], [150, 230, 60]],
        density: SEED_DENSITY,
        metaColor: 0xb45af0,
        matterType: matterPowder(),
        toolboxLabel: "Astro Gold",
        isSeed: true,
        isCrystal: false,
    }),
    spec({
        key: "astroCopperCrystal",
        slug: "astro-copper-crystal",
        name: "Astro Copper Crystal",
        description: "From Liquid Copper. Burn → Astro Copper.",
        colors: [[200, 120, 80], [180, 90, 50], [220, 140, 90], [160, 70, 40]],
        density: 0,
        metaColor: 0xc87850,
        matterType: matterStatic(),
        toolboxLabel: "Cry. Copper",
        isSeed: false,
        isCrystal: true,
    }),
    spec({
        key: "astroCopperPowder",
        slug: "astro-copper",
        name: "Astro Copper",
        description: "Powder from copper crystal + Fire.",
        colors: [[240, 80, 40], [180, 60, 20]],
        density: SEED_DENSITY,
        metaColor: 0xb46428,
        matterType: matterPowder(),
        toolboxLabel: "Astro Copper",
        isSeed: true,
        isCrystal: false,
    }),
    spec({
        key: "astroWaterCrystal",
        slug: "astro-water-crystal",
        name: "Astro Water Crystal",
        description: "From Water (panel). Burn → Astro Water.",
        colors: [[60, 100, 155], [40, 90, 155], [0, 60, 155]],
        density: 0,
        metaColor: 0x8ec8ff,
        matterType: matterStatic(),
        toolboxLabel: "Cry. Water",
        isSeed: false,
        isCrystal: true,
    }),
    spec({
        key: "astroWaterPowder",
        slug: "astro-water",
        name: "Astro Water",
        description: "Powder from water crystal + Fire.",
        colors: [[180, 120, 155], [180, 90, 155], [220, 140, 155]],
        density: 280,
        metaColor: 0x8ec8ff,
        matterType: matterPowder(),
        toolboxLabel: "Astro Water",
        isSeed: true,
        isCrystal: false,
    }),
];

/** Key → spec lookup (registration, i18n, panel). */
export const ASTRO_ELEMENT_BY_KEY: Record<TAstroElementKey, AstroElementSpec> = Object.fromEntries(
    ASTRO_ELEMENTS.map((e) => [e.key, e]),
) as Record<TAstroElementKey, AstroElementSpec>;

/** Contact reactions described with keys — resolved to types at register time. */
export const ASTRO_REACTIONS: readonly ReactionSpec[] = [
    { inputA: "seedBase", inputB: "voidPetal", outputA: "astroVoidSeed", outputB: null },
    { inputA: "astroGoldCrystal", inputB: "fire", outputA: "astroGoldPowder", outputB: "fire" },
    { inputA: "astroVoidSeed", inputB: "florinol", outputA: "astroSeed", outputB: null },
    { inputA: "astroCopperCrystal", inputB: "fire", outputA: "astroCopperPowder", outputB: "fire" },
    { inputA: "astroWaterCrystal", inputB: "fire", outputA: "astroWaterPowder", outputB: "fire" },
];
