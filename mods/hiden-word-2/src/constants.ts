/**
 * Hiden Word 2 — static config.
 * Generation is a cleaned port of hidden-word + missing sandgenerator-web stages
 * (sky-distance seal, fluids, wall grow, form grow) as CPU approximations.
 */

import { MOD_ID } from "./ids.ts";
import type { GenerationParams, Rgba } from "./types.ts";

export const MOD = MOD_ID;
export const ITEM_ID = `${MOD}.lens`;
export const ICON_SPRITE_ID = `${MOD}.lensIcon`;
export const ICON_PATH = "assets/lens.png";
/** Map Viewer tool — opens full-map preview + config overlay. */
export const VIEWER_ITEM_ID = `${MOD}.mapViewer`;
export const VIEWER_ICON_SPRITE_ID = `${MOD}.mapViewerIcon`;
export const VIEWER_ICON_PATH = "assets/lens.png"; // reuse until dedicated icon
export const STORAGE_KEY_SEED = "hiddenSeed";
export const OVERLAY_ID = `${MOD}.params`;
export const VIEWER_OVERLAY_ID = `${MOD}.mapViewer`;
export const FALLBACK_CELLS = { width: 640, height: 360 };
export const LOG = "[hiden-word-2]";

export const NOISE_ZOOM_2D = 2;
export const NOISE_ZOOM_1D = 2;
export const SKYLINE_FIXED = { Phase: 0, Amp: 1 } as const;

export const TUNNEL_WAVES: readonly (readonly [number, number])[] = [
  [0.0075, 0.5],
  [0.015, 0.5],
  [0.05, 0.1],
  [0.09, 0.05],
];
export const CAVE_WAVES: readonly (readonly [number, number])[] = [
  [0.006, 0.5],
  [0.012, 0.5],
  [0.04, 0.1],
  [0.1, 0.02],
];

/** Matrix codes — base + sandgenerator materials. */
export const TERRAIN = {
  SKY: 0,
  ROCK: 1,
  TUNNEL: 2,
  CAVE: 3,
  FOG_WATER: 4,
  FOG_LAVA: 5,
  SURFACE_WATER: 6,
  MOSS: 7,
  GRASS: 8,
  REDSAND_SOIL: 9,
  SPORE_SOIL: 10,
  ICE: 11,
  FROST_BED: 12,
  CRACKSTONE: 13,
} as const;

export const CODE_LABELS: Record<number, string> = {
  [TERRAIN.SKY]: "sky",
  [TERRAIN.ROCK]: "rock",
  [TERRAIN.TUNNEL]: "tunnel",
  [TERRAIN.CAVE]: "cave",
  [TERRAIN.FOG_WATER]: "water",
  [TERRAIN.FOG_LAVA]: "lava",
  [TERRAIN.SURFACE_WATER]: "surface water",
  [TERRAIN.MOSS]: "moss",
  [TERRAIN.GRASS]: "grass",
  [TERRAIN.REDSAND_SOIL]: "redsand soil",
  [TERRAIN.SPORE_SOIL]: "spore soil",
  [TERRAIN.ICE]: "ice",
  [TERRAIN.FROST_BED]: "frost bed",
  [TERRAIN.CRACKSTONE]: "crackstone",
};

/** Paint map: terrain id or null = transparent. */
export const CODE_TERRAIN: Record<number, string | null> = {
  [TERRAIN.SKY]: null,
  [TERRAIN.ROCK]: "stone",
  [TERRAIN.TUNNEL]: null,
  [TERRAIN.CAVE]: "dirt",
  [TERRAIN.FOG_WATER]: null, // painted via FALLBACK colors (fluids)
  [TERRAIN.FOG_LAVA]: null,
  [TERRAIN.SURFACE_WATER]: null,
  [TERRAIN.MOSS]: "moss",
  [TERRAIN.GRASS]: null,
  [TERRAIN.REDSAND_SOIL]: "redsoil",
  [TERRAIN.SPORE_SOIL]: null,
  [TERRAIN.ICE]: "ice",
  [TERRAIN.FROST_BED]: null,
  [TERRAIN.CRACKSTONE]: null,
};

export const FALLBACK_CODE_COLORS: Record<number, Rgba> = {
  [TERRAIN.SKY]: [0, 0, 0, 0],
  [TERRAIN.ROCK]: [0x80, 0x80, 0x80, 255],
  [TERRAIN.TUNNEL]: [0, 0, 0, 0],
  [TERRAIN.CAVE]: [0x92, 0x64, 0x26, 255],
  [TERRAIN.FOG_WATER]: [0x99, 0x66, 0xff, 200],
  [TERRAIN.FOG_LAVA]: [0xff, 0x66, 0x00, 220],
  [TERRAIN.SURFACE_WATER]: [0x66, 0x00, 0xff, 180],
  [TERRAIN.MOSS]: [0x00, 0xe0, 0x00, 255],
  [TERRAIN.GRASS]: [0x00, 0xff, 0x00, 255],
  [TERRAIN.REDSAND_SOIL]: [0xff, 0x55, 0x00, 255],
  [TERRAIN.SPORE_SOIL]: [0xff, 0xff, 0x00, 255],
  [TERRAIN.ICE]: [0x66, 0xcc, 0xff, 255],
  [TERRAIN.FROST_BED]: [0x99, 0xff, 0xff, 255],
  [TERRAIN.CRACKSTONE]: [0xcd, 0x8b, 0x8b, 255],
};

export const TERRAIN_META_NAMES: Record<string, string> = {
  stone: "Stone",
  dirt: "Dirt",
  moss: "Moss",
  redsoil: "Redsoil",
  ice: "Ice",
};
export const TERRAIN_NAME_KEY_PREFIX = "terrains";

export const DEFAULT_GHOST_ALPHA_PERCENT = 45;
export const GHOST_ALPHA_PERCENT_MIN = 5;
export const GHOST_ALPHA_PERCENT_MAX = 100;

const NS = "mods|hidenword2";
export const KEY = {
  itemName: `${NS}|lens|name`,
  itemDesc: `${NS}|lens|desc`,
  viewerName: `${NS}|viewer|name`,
  viewerDesc: `${NS}|viewer|desc`,
} as const;

/** Full default params including stage toggles + tunables. */
export const DEFAULT_PARAMS: GenerationParams = {
  sky: {
    bigWave: { periodCells: 1200, amplitudePercent: 15 },
    mediumWave: { periodCells: 800, amplitudePercent: 25 },
    lowWave: { periodCells: 400, amplitudePercent: 5 },
    roughness: { periodCells: 200, amplitudePercent: 3 },
  },
  baseHeightPercent: 55,
  tunnel: {
    enabled: true,
    thicknessPercent: 20,
    definitionPercent: 85,
    offsetX: 20,
    offsetY: -50,
  },
  cave: {
    enabled: true,
    thicknessPercent: 25,
    definitionPercent: 70,
    offsetX: 0,
    offsetY: -40,
  },
  // --- missing sandgenerator stages ---
  seal: {
    enabled: true,
    maxIterations: 400, // web uses 400 sky-distance propagations
    sealTunnels: true,
    sealCaves: true,
    diagonal: false,
    surfaceKeepPercent: 5, // top 5% of height: never seal openings
  },
  fluids: {
    enabled: true,
    water: true,
    lava: true,
    surfaceWater: true,
    waterMinDepth: 4,
    lavaMinDepth: 6,
    surfaceWaterDepth: 3,
  },
  wallGrow: {
    enabled: true,
    // Add more rules here — each is one sandgenerator-style WallGrow entry
    rules: [
      {
        enabled: true,
        name: "Tunnel Moss Roof",
        inBorderOf: [1], // ROCK
        typeToReplace: [2], // TUNNEL
        replaceBy: 7, // MOSS
        nearMask: [1, 0, 0, 0], // up only
        minDistPercent: 4,
        thicknessPercent: 8,
        growSize: 4,
      },
      {
        enabled: true,
        name: "Sky Grass",
        inBorderOf: [1], // ROCK
        typeToReplace: [0], // SKY
        replaceBy: 8, // GRASS
        nearMask: [0, 0, 1, 0], // down = rock under sky
        minDistPercent: 0,
        thicknessPercent: 5,
        growSize: 0,
      },
      {
        enabled: true,
        name: "Cave Redsand Roof",
        inBorderOf: [1], // ROCK
        typeToReplace: [3], // CAVE
        replaceBy: 9, // REDSAND
        nearMask: [1, 0, 0, 0],
        minDistPercent: 20,
        thicknessPercent: 15,
        growSize: 5,
      },
    ],
  },
  formGrow: {
    enabled: true,
    rules: [
      {
        enabled: true,
        name: "Spore Soil",
        inBorderOf: [3], // CAVE
        replaceBy: 10, // SPORE
        minDistPercent: 30,
        thicknessPercent: 20,
        growSize: 8,
      },
      {
        enabled: true,
        name: "Frost Bed",
        inBorderOf: [4, 2], // FOG_WATER, TUNNEL
        replaceBy: 12, // FROST_BED
        minDistPercent: 15,
        thicknessPercent: 25,
        growSize: 5,
      },
      {
        enabled: true,
        name: "Crackstone",
        inBorderOf: [2], // TUNNEL
        replaceBy: 13, // CRACKSTONE
        minDistPercent: 45,
        thicknessPercent: 15,
        growSize: 4,
      },
    ],
  },
};
