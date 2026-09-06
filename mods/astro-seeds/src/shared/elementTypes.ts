export type TElementType = number;

export type TValliaElementTypeKey =
  | "liquidGold"
  | "liquidCopper"
  | "florinol"
  | "voidPetal"
  | "seedBase"
  | "fire"
  | "water";
export type TAstroElementTypeKey =
  | "astroVoidSeed"
  | "astroSeed"
  | "astroGoldCrystal"
  | "astroGoldPowder"
  | "astroCopperCrystal"
  | "astroCopperPowder"
  | "astroWaterCrystal"
  | "astroWaterPowder";

export type TElementTypeKey = TValliaElementTypeKey | TAstroElementTypeKey;

export type TElementTypeIDs = Record<TElementTypeKey, TElementType>;
