/** [hue 0-360, saturation 0-100, lightness 0-100] */
export type HSL = readonly [h: number, s: number, l: number];

export interface TerrainColor {
    /** Metadata color. */
    readonly hex: string;
    /** Renderer `colorHSL`, when the terrain defines one. */
    readonly hsl?: HSL;
}

/**
 * Terrain colors, from resources/bundle.0.5.4.js:11370-11575
 * (plus registrations around 97790-118620).
 */
export const TERRAIN_COLORS = {
    // Base terrain
    Stone: { hex: "#808080", hsl: [0, 0, 66] },
    Divider: { hex: "#8b5a2b", hsl: [30, 100, 50] },
    Dirt: { hex: "#926426" },
    Grass: { hex: "#228b22", hsl: [94, 45, 48] },
    Moss: { hex: "#1dae1d", hsl: [100, 72, 47] },

    // Resource-bearing
    GoldSoil: { hex: "#daa520", hsl: [60, 100, 50] },
    Petal: { hex: "#ff69b4" },
    SporeSoil: { hex: "#556b2f" },
    FreezingIceSoil: { hex: "#add8e6", hsl: [180, 100, 90] },
    SandiumSoil: { hex: "#8b0000", hsl: [0, 100, 32] },
    FlorinolSoil: { hex: "#339999", hsl: [270, 50, 40] },
    AuraliteCrystal: { hex: "#4a40b0", hsl: [250, 60, 50] },

    // Fog
    Fog: { hex: "#708090" },
    JetpackFog: { hex: "#5dcfd6" },
    WaterFog: { hex: "#4682b4" },
    LavaFog: { hex: "#b22222" },

    // Special
    Fluxite: { hex: "#8a2be2", hsl: [287, 100, 44] },
    Ice: { hex: "#afeeee", hsl: [199, 99, 90] },
    Crackstone: { hex: "#fffab3", hsl: [52, 100, 85] },
    Crystal: { hex: "#0094b3" },
    GlassTerrain: { hex: "#19e680", hsl: [150, 80, 50] },
    Shatterstone: { hex: "#b6bcc1", hsl: [207, 8, 73] },
    DissolvingTerrain: { hex: "#4a3728" },
    PuffMushroom: { hex: "#8b7355" },
    Dune: { hex: "#eed975", hsl: [50, 80, 70] },

    // Dark / immutable
    Obsidian: { hex: "#2b2b2b", hsl: [0, 100, 15] },
    Bedrock: { hex: "#222222", hsl: [0, 0, 0] },
    Blackrock: { hex: "#181c20", hsl: [210, 14, 11] },
    BlackrockVariant: { hex: "#141414" },
} as const satisfies Record<string, TerrainColor>;

export type TerrainName = keyof typeof TERRAIN_COLORS;

/** Returns a CSS color string, preferring the renderer HSL over the hex fallback. */
export function terrainCss(name: TerrainName): string {
    const c: TerrainColor = TERRAIN_COLORS[name];
    return c.hsl ? `hsl(${c.hsl[0]} ${c.hsl[1]}% ${c.hsl[2]}%)` : c.hex;
}

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
