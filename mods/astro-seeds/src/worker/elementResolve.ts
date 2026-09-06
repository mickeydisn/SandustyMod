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

export const ElementTypeInWorker: TElementTypeIDs = {
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

  astroVoidSeed: resolveType([elementConfig.astroVoidSeed.id]),
  astroSeed: resolveType([elementConfig.astroSeed.id]),

  astroGoldCrystal: resolveType([elementConfig.astroGoldCrystal.id]),
  astroGoldPowder: resolveType([elementConfig.astroGoldPowder.id]),

  astroCopperCrystal: resolveType([elementConfig.astroCopperCrystal.id]),
  astroCopperPowder: resolveType([elementConfig.astroCopperPowder.id]),

  astroWaterCrystal: resolveType([elementConfig.astroWaterCrystal.id]),
  astroWaterPowder: resolveType([elementConfig.astroWaterPowder.id]),
};

console.log("ElementTypeInWorker", ElementTypeInWorker);
