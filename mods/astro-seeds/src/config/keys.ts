/**
 * Element keys used across the mod.
 *
 * `TVanillaElementKey` are built-in engine ids this mod reacts to / reads.
 * `TAddedElementKey` are the astro family this mod registers itself.
 * Kept in their own file so the element catalogue never has to import from a
 * module that reads the catalogue (avoids an import-order dependency).
 */
export type TVanillaElementKey =
    | "liquidGold"
    | "liquidCopper"
    | "florinol"
    | "voidPetal"
    | "seedBase"
    | "fire"
    | "water";

export type TAddedElementKey =
    | "astroVoidSeed"
    | "astroSeed"
    | "astroGoldCrystal"
    | "astroGoldPowder"
    | "astroCopperCrystal"
    | "astroCopperPowder"
    | "astroWaterCrystal"
    | "astroWaterPowder";

export type TElementKey = TVanillaElementKey | TAddedElementKey;