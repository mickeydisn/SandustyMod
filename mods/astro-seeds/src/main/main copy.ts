/**
 * Main-thread entry — elements, reactions, config panel.
 */
import { MOD_ID, VERSION } from "../shared/ids.ts";
import {
  ASTRO_COPPER_CRYSTAL_ID,
  ASTRO_COPPER_ID,
  ASTRO_GOLD_CRYSTAL_ID,
  ASTRO_GOLD_ID,
  ASTRO_SEED_ID,
  ASTRO_VOID_SEED_ID,
  ASTRO_WATER_CRYSTAL_ID,
  ASTRO_WATER_ID,
} from "../shared/elementTypes.ts";
import { TElementType } from "../shared/elementTypes.ts";
import { mountPanel, pushBuffer } from "./panel.ts";

const api = sandkit.api;

function safe<T>(fn: () => T, fallback: T | null = null): T | null {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function resolveType(ids: string[]): TElementType | null {
  for (const id of ids) {
    const t = safe(() => api.elements.getTypeFromId(id));
    if (t != null) return t;
  }
  return null;
}

const seedBase = resolveType(["seed", "Seed"]);
const voidPetalType = resolveType([
  "voidPetal",
  "voidpetal",
  "VoidPetal",
  "void_petal",
  "petalium",
]);
const florinolType = resolveType(["florinol", "Florinol", "florin", "Florin"]);
const liquidCopperType = resolveType([
  "liquidCopper",
  "liquidcopper",
  "LiquidCopper",
  "copperLiquid",
  "liquid_copper",
]);
const fireType = resolveType(["fire", "Fire"]);

const MatterType = safe(() => sandkit.enums?.MatterType) || {};
const MT_POWDER = (MatterType as Record<string, number>).Powder ?? 8;
const MT_STATIC = (MatterType as Record<string, number>).Static ?? 5;

const LIQUID_COPPER_DENSITY = (() => {
  const def = liquidCopperType != null
    ? safe(() => api.elements.getDefinitionByType?.(liquidCopperType!) ?? null)
    : null;
  return def && typeof def.density === "number" ? def.density : 150;
})();
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

api.i18n.register("en", {
  [`${ASTRO_VOID_SEED_ID}|name`]: "Void Seed",
  [`${ASTRO_VOID_SEED_ID}|description`]: "Mix with Florinol → Astro Seed.",
  [`${ASTRO_SEED_ID}|name`]: "Astro Seed",
  [`${ASTRO_SEED_ID}|description`]: "Liquid Gold / Copper / Water → crystals.",
  [`${ASTRO_GOLD_CRYSTAL_ID}|name`]: "Astro Gold Crystal",
  [`${ASTRO_GOLD_CRYSTAL_ID}|description`]:
    "From Liquid Gold. Burn → Astro Gold.",
  [`${ASTRO_GOLD_ID}|name`]: "Astro Gold",
  [`${ASTRO_GOLD_ID}|description`]: "Powder from gold crystal + Fire.",
  [`${ASTRO_COPPER_CRYSTAL_ID}|name`]: "Astro Copper Crystal",
  [`${ASTRO_COPPER_CRYSTAL_ID}|description`]:
    "From Liquid Copper. Burn → Astro Copper.",
  [`${ASTRO_COPPER_ID}|name`]: "Astro Copper",
  [`${ASTRO_COPPER_ID}|description`]: "Powder from copper crystal + Fire.",
  [`${ASTRO_WATER_CRYSTAL_ID}|name`]: "Astro Water Crystal",
  [`${ASTRO_WATER_CRYSTAL_ID}|description`]:
    "From Water (panel). Burn → Astro Water.",
  [`${ASTRO_WATER_ID}|name`]: "Astro Water",
  [`${ASTRO_WATER_ID}|description`]: "Powder from water crystal + Fire.",
  [`${MOD_ID}.tech.name`]: "Astro Seeds",
  [`${MOD_ID}.tech.description`]: "Seed–crystal profiles over liquids.",
});

function reg(
  id: string,
  colors: number[][],
  density: number,
  metaColor: number,
  matterType: number,
): TElementType {
  return api.elements.register({
    id,
    nameKey: `${id}|name`,
    descriptionKey: `${id}|description`,
    colors: { variants: colors },
    density,
    metaColor,
    matterType,
  }).elementType;
}

const voidSeed = reg(
  ASTRO_VOID_SEED_ID,
  [[80, 40, 140], [60, 20, 110], [100, 50, 160]],
  90,
  0x50288c,
  MT_POWDER,
);
const seed = reg(
  ASTRO_SEED_ID,
  [[180, 220, 255], [140, 190, 255], [100, 160, 240], [220, 240, 255]],
  SEED_DENSITY,
  0x8ec8ff,
  MT_POWDER,
);
const goldCrystal = reg(
  ASTRO_GOLD_CRYSTAL_ID,
  [[210, 160, 255], [180, 120, 240], [230, 190, 255], [160, 90, 220]],
  200,
  0xb478f0,
  MT_STATIC,
);
const gold = reg(
  ASTRO_GOLD_ID,
  [[180, 90, 255], [150, 60, 230], [200, 120, 255], [130, 40, 210]],
  310,
  0xb45af0,
  MT_POWDER,
);
const copperCrystal = reg(
  ASTRO_COPPER_CRYSTAL_ID,
  [[200, 120, 80], [180, 90, 50], [220, 140, 90], [160, 70, 40]],
  0,
  0xc87850,
  MT_STATIC,
);
const copper = reg(
  ASTRO_COPPER_ID,
  [[180, 100, 40], [150, 60, 20], [200, 120, 50], [160, 80, 30]],
  280,
  0xb46428,
  MT_POWDER,
);
const waterCrystal = reg(
  ASTRO_WATER_CRYSTAL_ID,
  [[60, 100, 155], [40, 90, 155], [0, 60, 155]],
  0,
  0x8ec8ff,
  MT_STATIC,
);
const waterPowder = reg(
  ASTRO_WATER_ID,
  [[180, 120, 155], [180, 90, 155], [220, 140, 155]],
  280,
  0x8ec8ff,
  MT_POWDER,
);

for (
  const t of [
    voidSeed,
    seed,
    goldCrystal,
    gold,
    copperCrystal,
    copper,
    waterCrystal,
    waterPowder,
  ]
) {
  safe(() => api.discoveries.addElementByType(t));
}

if (seedBase != null && voidPetalType != null) {
  safe(() =>
    api.reactions.registerContact({
      inputA: seedBase,
      inputB: voidPetalType,
      outputA: voidSeed,
      outputB: null,
    })
  );
}
if (voidSeed != null && florinolType != null) {
  safe(() =>
    api.reactions.registerContact({
      inputA: voidSeed,
      inputB: florinolType,
      outputA: seed,
      outputB: null,
    })
  );
}
if (fireType != null) {
  safe(() =>
    api.reactions.registerContact({
      inputA: goldCrystal,
      inputB: fireType,
      outputA: gold,
      outputB: fireType,
    })
  );
  safe(() =>
    api.reactions.registerContact({
      inputA: copperCrystal,
      inputB: fireType,
      outputA: copper,
      outputB: fireType,
    })
  );
  safe(() =>
    api.reactions.registerContact({
      inputA: waterCrystal,
      inputB: fireType,
      outputA: waterPowder,
      outputB: fireType,
    })
  );
}

mountPanel();
pushBuffer();

// MESSAGE TO USER
safe(() =>
  api.events.on("game:ready", () => {
    api.ui.toast(`Astro Seeds v${VERSION} — Alt+A panel`, {});
  })
);

console.log(`[${MOD_ID} v${VERSION}] main loaded seedDensity=${SEED_DENSITY}`);
