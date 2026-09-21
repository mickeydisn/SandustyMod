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
/** Manifest tool — paints real terrain from the hidden matrix in a circle. */
export const MATERIALIZER_ITEM_ID = `${MOD}.materializer`;
export const MATERIALIZER_ICON_SPRITE_ID = `${MOD}.materializerIcon`;
export const MATERIALIZER_ICON_PATH = "assets/lens.png";
export const MATERIALIZER_OVERLAY_ID = `${MOD}.materializer`;
export const MATERIALIZER_RADIUS_MIN = 2;
export const MATERIALIZER_RADIUS_MAX = 24;
export const MATERIALIZER_RADIUS_DEFAULT = 6;
export const MATERIALIZER_ENERGY = 8;
export const EXPLORER_ITEM_ID = `${MOD}.explorer`;
export const EXPLORER_ICON_SPRITE_ID = `${MOD}.explorerIcon`;
export const EXPLORER_ICON_PATH = "assets/lens.png";
export const EXPLORER_OVERLAY_ID = `${MOD}.explorer`;
export const EXPLORER_RADIUS_MIN = 1;
export const EXPLORER_RADIUS_MAX = 16;
export const EXPLORER_RADIUS_DEFAULT = 4;
export const EXPLORER_ENERGY = 4;
/** Extra cells around fog / materialize border that become explored. */
export const EXPLORE_BORDER_PX = 2;
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
  [TERRAIN.TUNNEL]: "fog (tunnel)",
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
  [TERRAIN.TUNNEL]: [0, 0, 0, 0], // fog void — black transparent
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
  materializerName: `${NS}|materializer|name`,
  materializerDesc: `${NS}|materializer|desc`,
  explorerName: `${NS}|explorer|name`,
  explorerDesc: `${NS}|explorer|desc`,
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
    surfaceKeepPercent: 0,
  },
  explorationEnabled: false,
  modifiers: [
    {
      id: "liq-water",
      kind: "liquid",
      enabled: true,
      name: "Underground Water",
      liquidType: "water",
      minDepth: 4,
      bounds: { top: 20, bottom: 90, left: 0, right: 100 },
    },
    {
      id: "liq-lava",
      kind: "liquid",
      enabled: true,
      name: "Deep Lava",
      liquidType: "lava",
      minDepth: 6,
      bounds: { top: 50, bottom: 100, left: 0, right: 100 },
    },
    {
      id: "liq-surface",
      kind: "liquid",
      enabled: true,
      name: "Surface Water",
      liquidType: "surface",
      minDepth: 3,
      bounds: { top: 0, bottom: 20, left: 0, right: 100 },
    },
    {
      id: "wall-moss",
      kind: "wall",
      enabled: true,
      name: "Tunnel Moss Roof",
      inBorderOf: [1],
      typeToReplace: [2],
      replaceBy: 7,
      nearMask: [1, 0, 0, 0],
      bounds: { top: 5, bottom: 25, left: 0, right: 100 },
      growSize: 4,
    },
    {
      id: "wall-grass",
      kind: "wall",
      enabled: true,
      name: "Sky Grass",
      inBorderOf: [1],
      typeToReplace: [0],
      replaceBy: 8,
      nearMask: [0, 0, 1, 0],
      bounds: { top: 0, bottom: 15, left: 0, right: 100 },
      growSize: 0,
    },
    {
      id: "wall-redsand",
      kind: "wall",
      enabled: true,
      name: "Cave Redsand Roof",
      inBorderOf: [1],
      typeToReplace: [3],
      replaceBy: 9,
      nearMask: [1, 0, 0, 0],
      bounds: { top: 35, bottom: 70, left: 0, right: 100 },
      growSize: 5,
    },
    {
      id: "form-spore",
      kind: "form",
      enabled: true,
      name: "Spore Soil",
      inBorderOf: [3],
      replaceBy: 10,
      bounds: { top: 40, bottom: 75, left: 0, right: 100 },
      growSize: 8,
      scatterPercent: 35,
    },
    {
      id: "form-frost",
      kind: "form",
      enabled: true,
      name: "Frost Bed",
      inBorderOf: [4, 2],
      replaceBy: 12,
      bounds: { top: 20, bottom: 55, left: 0, right: 100 },
      growSize: 5,
      scatterPercent: 40,
    },
    {
      id: "form-crack",
      kind: "form",
      enabled: true,
      name: "Crackstone",
      inBorderOf: [2],
      replaceBy: 13,
      bounds: { top: 50, bottom: 80, left: 10, right: 90 },
      growSize: 4,
      scatterPercent: 30,
    },
  ],
};


/** Selectable terrain codes for wall/form UI (id + label + css color). */
export const CODE_OPTIONS: { id: number; label: string; color: string }[] = [
  { id: 0, label: "sky", color: "#1a1a22" },
  { id: 1, label: "rock/stone", color: "#808080" },
  { id: 2, label: "fog/tunnel", color: "#000000" },
  { id: 3, label: "cave/dirt", color: "#926426" },
  { id: 4, label: "water", color: "#4682b4" },
  { id: 5, label: "lava", color: "#b22222" },
  { id: 6, label: "surface water", color: "#6600ff" },
  { id: 7, label: "moss", color: "#1dae1d" },
  { id: 8, label: "grass", color: "#228b22" },
  { id: 9, label: "redsand", color: "#8b0000" },
  { id: 10, label: "spore soil", color: "#556b2f" },
  { id: 11, label: "ice", color: "#afeeee" },
  { id: 12, label: "frost bed", color: "#add8e6" },
  { id: 13, label: "crackstone", color: "#fffab3" },
];


/**
 * Hidden matrix code → real Sandustry terrain id.
 * null = empty (fog/tunnel/sky → no solid terrain on the live map).
 */
export const MATERIALIZE_MAP: Record<number, string | null> = {
  [TERRAIN.SKY]: null,
  [TERRAIN.ROCK]: "stone",
  [TERRAIN.TUNNEL]: null, // fog void → empty when made real
  [TERRAIN.CAVE]: "dirt",
  [TERRAIN.FOG_WATER]: "water", // best-effort; may be fog-water type
  [TERRAIN.FOG_LAVA]: "lava",
  [TERRAIN.SURFACE_WATER]: "water",
  [TERRAIN.MOSS]: "moss",
  [TERRAIN.GRASS]: "grass",
  [TERRAIN.REDSAND_SOIL]: "redsoil",
  [TERRAIN.SPORE_SOIL]: "sporesoil",
  [TERRAIN.ICE]: "ice",
  [TERRAIN.FROST_BED]: "ice",
  [TERRAIN.CRACKSTONE]: "stone",
};
