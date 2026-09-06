import { elementConfig } from "../shared/elementConfig.ts";
import { TElementType, TElementTypeIDs } from "../shared/elementTypes.ts";

function resolveType(ids: string[]): TElementType {
  for (const id of ids) {
    try {
      const t = sandkit.api.elements.getTypeFromId(id);
      if (t != null) return t;
    } catch {
      /* ignore */
    }
  }
  console.error("elementTypes.ts , resolveType Unknow: ", ids);
  return 0;
}

export const ElementType: TElementTypeIDs = {
  liquidGold: resolveType([
    "liquidGold",
    "liquidgold",
    "LiquidGold",
    "goldLiquid",
    "liquid_gold",
  ]),
  liquidCopper: resolveType([
    "liquidCopper",
    "liquidcopper",
    "LiquidCopper",
    "copperLiquid",
    "liquid_copper",
  ]),

  florinol: resolveType(["florinol", "Florinol", "florin", "Florin"]),
  voidPetal: resolveType([
    "voidPetal",
    "voidpetal",
    "VoidPetal",
    "void_petal",
    "petalium",
  ]),

  seedBase: resolveType(["seed", "Seed"]),
  fire: resolveType(["fire", "Fire"]),
  water: resolveType(["water", "Water"]),
  // mod types

  astroVoidSeed: 0,
  astroSeed: 0,

  astroGoldCrystal: 0,
  astroGoldPowder: 0,

  astroCopperCrystal: 0,
  astroCopperPowder: 0,

  astroWaterCrystal: 0,
  astroWaterPowder: 0,
};
