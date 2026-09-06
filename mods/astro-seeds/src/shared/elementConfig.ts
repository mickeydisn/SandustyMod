import { TAstroElementTypeKey } from "./elementTypes.ts";
import { MOD_ID } from "./ids.ts";

function safe<T>(fn: () => T, fallback: T | null = null): T | null {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
const MatterType = safe(() => sandkit.enums?.MatterType) || {};
const MT_POWDER = (MatterType as Record<string, number>).Powder ?? 8;
const MT_STATIC = (MatterType as Record<string, number>).Static ?? 5;

// Extract density:
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export type TElementConfig = {
  id: string;
  name: string;
  description: string;
  colors: number[][];
  density: number;
  metaColor: number;
  matterType: number;
};

export const elementConfig: Record<TAstroElementTypeKey, TElementConfig> = {
  astroVoidSeed: {
    id: `${MOD_ID}:astro-void-seed`,
    name: "Astro Void Seed",
    description: "Mix with Florinol → Astro Seed.",
    colors: [[80, 40, 140], [60, 20, 110], [100, 50, 160]],
    density: 90,
    metaColor: 0x50288c,
    matterType: MT_POWDER,
  },
  astroSeed: {
    id: `${MOD_ID}:astro-seed`,
    name: "Astro Seed",
    description: "Liquid Gold / Copper / Water → crystals.",
    colors: [
      [180, 220, 255],
      [140, 190, 255],
      [100, 160, 240],
      [220, 240, 255],
    ],
    density: SEED_DENSITY,
    metaColor: 0x8ec8ff,
    matterType: MT_POWDER,
  },
  astroGoldCrystal: {
    id: `${MOD_ID}:astro-gold-crystal`,
    name: "Astro Gold Crystal",
    description: "From Liquid Gold. Burn → Astro Gold.",
    colors: [[210, 160, 255], [180, 120, 240], [230, 190, 255], [160, 90, 220]],
    density: 200,
    metaColor: 0xb478f0,
    matterType: MT_STATIC,
  },
  astroGoldPowder: {
    id: `${MOD_ID}:astro-gold`,
    name: "Astro Gold Powder",
    description: "Powder from gold crystal + Fire.",
    colors: [[180, 255, 90], [150, 230, 60]], // [[180, 90, 255], [150, 60, 230], [200, 120, 255], [130, 40, 210]],
    density: SEED_DENSITY,
    metaColor: 0xb45af0,
    matterType: MT_POWDER,
  },
  astroCopperCrystal: {
    id: `${MOD_ID}:astro-copper-crystal`,
    name: "Astro Copper Crystal",
    description: "From Liquid Copper. Burn → Astro Copper.",
    colors: [[200, 120, 80], [180, 90, 50], [220, 140, 90], [160, 70, 40]],
    density: 0,
    metaColor: 0xc87850,
    matterType: MT_STATIC,
  },
  astroCopperPowder: {
    id: `${MOD_ID}:astro-copper`,
    name: "Astro Copper",
    description: "Powder from copper crystal + Fire.",
    colors: [[240, 80, 40], [180, 60, 20]], // , [200, 120, 50], [160, 80, 30]],
    density: SEED_DENSITY,
    metaColor: 0xb46428,
    matterType: MT_POWDER,
  },
  astroWaterCrystal: {
    id: `${MOD_ID}:astro-water-crystal`,
    name: "Astro Water Crystal",
    description: "From Water (panel). Burn → Astro Water.",
    colors: [[60, 100, 155], [40, 90, 155], [0, 60, 155]],
    density: 0,
    metaColor: 0x8ec8ff,
    matterType: MT_STATIC,
  },
  astroWaterPowder: {
    id: `${MOD_ID}:astro-water`,
    name: "Astro Water",
    description: "Powder from water crystal + Fire.",
    colors: [[180, 120, 155], [180, 90, 155], [220, 140, 155]],
    density: 280,
    metaColor: 0x8ec8ff,
    matterType: MT_POWDER,
  },
};
