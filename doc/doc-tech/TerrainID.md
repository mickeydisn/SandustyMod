/** Terrain / special cell kinds in the simulation grid. */
export enum CellType {
    Empty = 0,
    Element = 1,
    Dirt = 2,
    SporeSoil = 3,
    Fog = 4,
    FogJetpackBlock = 5,
    FogWater = 6,
    FreezingIceSoil = 7,
    Divider = 8,
    Grass = 9,
    Moss = 10,
    GoldSoil = 11,
    Petal = 12,
    FogLava = 13,
    Fluxite = 14,
    Block = 15,
    SlidingBlock = 16,
    SlidingBlockLeft = 17,
    SlidingBlockRight = 18,
    ConveyorLeft = 19,
    ConveyorRight = 20,
    ShakerLeft = 21,
    ShakerRight = 22,
    Stone = 23,
    VelocitySoaker = 24,
    Ice = 25,
    Grower = 26,
    NascentWater = 27,
    SandiumSoil = 28,
    Obsidian = 29,
    Crackstone = 30,
}



Source: `resources/bundle.0.5.4.js:11370-11575` and additional terrain registrations around
`resources/bundle.0.5.4.js:97790-118620`. The HSL column is the terrain renderer's explicit
`colorHSL`, where present; otherwise the hex is the metadata color only.

| Color     | Terrain            | Renderer HSL   | Purpose                             |
| --------- | ------------------ | -------------- | ----------------------------------- |
| `#808080` | Stone              | `0, 0, 66`     | Base stone terrain                  |
| `#8b5a2b` | Divider            | `30, 100, 50`  | Breakable divider                   |
| `#926426` | Dirt               | —              | Diggable terrain; can output Sand   |
| `#228b22` | Grass              | `94, 45, 48`   | Diggable terrain; can output Sand   |
| `#1dae1d` | Moss               | `100, 72, 47`  | Flammable terrain                   |
| `#daa520` | Gold Soil          | `60, 100, 50`  | Gold-bearing terrain                |
| `#ff69b4` | Petal              | —              | Petalium-bearing terrain            |
| `#556b2f` | Spore Soil         | —              | Seed-bearing terrain                |
| `#708090` | Fog                | —              | Fog terrain                         |
| `#5dcfd6` | Jetpack Fog        | —              | Fog variant with patterned backdrop |
| `#4682b4` | Water Fog          | —              | Water-fog terrain                   |
| `#b22222` | Lava Fog           | —              | Lava-fog terrain                    |
| `#add8e6` | Freezing Ice Soil  | `180, 100, 90` | Freezing-ice-bearing terrain        |
| `#8a2be2` | Fluxite            | `287, 100, 44` | Fluxite terrain                     |
| `#afeeee` | Ice                | `199, 99, 90`  | Ice terrain                         |
| `#8b0000` | Sandium Soil       | `0, 100, 32`   | Sandium-bearing terrain             |
| `#2b2b2b` | Obsidian / Scoria  | `0, 100, 15`   | Dense dark terrain                  |
| `#fffab3` | Crackstone         | `52, 100, 85`  | Explosive/dynamite terrain          |
| `#4a3728` | Dissolving Terrain | —              | Terrain variant                     |
| `#8b7355` | Puff Mushroom      | —              | Terrain variant                     |
| `#0094b3` | Crystal            | —              | Crystal terrain                     |
| `#eed975` | Dune               | `50, 80, 70`   | Sand-colored terrain                |
| `#222222` | Bedrock            | `0, 0, 0`      | Immutable deep terrain              |
| `#181c20` | Blackrock          | `210, 14, 11`  | Dark rock terrain                   |
| `#141414` | Blackrock variant  | —              | Dark-rock fallback/variant          |
| `#19e680` | Glass Terrain      | `150, 80, 50`  | Glass terrain                       |
| `#339999` | Florinol Soil      | `270, 50, 40`  | Florinol-bearing terrain            |
| `#4a40b0` | Auralite Crystal   | `250, 60, 50`  | Auralite-bearing terrain            |
| `#b6bcc1` | Shatterstone       | `207, 8, 73`   | Breakable pale stone                |
