export type TElementType = number;

/** Built-in element type ids (prefer API string ids when registering mods). */
export enum ElementType {
    Sand = 1,
    Particle = 2,
    Water = 3,
    WetSand = 4,
    Sandium = 5,
    Residue = 6,
    Gold = 7,
    Gloom = 8,
    Shake = 9,
    Steam = 10,
    Fire = 11,
    FreezingIce = 12,
    Flame = 13,
    BurntResidue = 14,
    Seed = 15,
    WetSeed = 16,
    Seedling = 17,
    Petalium = 18,
    Lava = 19,
    Basalt = 20,
}

/** Physical behaviour category for elements (mirrors shared API enum). */
export enum MatterType {
    Solid = 1,
    Liquid = 2,
    Particle = 3,
    Gas = 4,
    Static = 5,
    Slushy = 6,
    Wisp = 7,
    Powder = 8,
}
