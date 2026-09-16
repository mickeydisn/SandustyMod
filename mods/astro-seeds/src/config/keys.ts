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
    | "water"
    | "sand";

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

/*
### Sand :id=sand
### Particle :id=particle
### Water :id=water
### WetSand :id=wetsand
### Sandium :id=sandium
### Residue :id=residue
### Gold :id=gold
### Gloom :id=gloom
### Shake :id=shake
### Steam :id=steam
### Fire :id=fire
### FreezingIce :id=freezingice
### Flame :id=flame
### BurntResidue :id=burntresidue
### Seed :id=seed
### WetSeed :id=wetseed
### Seedling :id=seedling
### Petalium :id=petalium
### Lava :id=lava
### Basalt :id=basalt
*/
