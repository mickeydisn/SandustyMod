/**
 * md-random-artefact — static configuration.
 */
import type { SettingsSchema } from "@sandmd/modkit";

export const MOD_ID = "md-random-artefact";
export const VERSION = "0.4.2";
export const LOG = `[${MOD_ID}]`;

export const STORAGE_KEYS: readonly string[] = [
    `${MOD_ID}:artefactProgress`,
];

export const SETTINGS = {
    enabled: { type: "boolean", default: true },
} as const satisfies SettingsSchema;

/** Catalogue category for every structure in this mod. */
export const CATEGORY_KEY = "Artefact";

// ── Structure ids ───────────────────────────────────────────────────────────

export const GENERATOR_ID = `${MOD_ID}:generator`;
export const ARTEFACT_ID = `${MOD_ID}:artefact`;
/** @deprecated removed — kept so old saves do not crash if referenced */
export const DISPLAY_ID = `${MOD_ID}:display`;

/** Material-selector structure id for an element. */
export function materialStructureId(elementId: string): string {
    return `${MOD_ID}:material-${elementId}`;
}

// ── Materials the generator can eat (one picked per cycle) ──────────────────

export interface EatMaterial {
    /** Game element id. */
    id: string;
    /** Display label for tooltips. */
    label: string;
    /**
     * Resource weight (inverse of progress value per cell):
     * progress += Math.round(cells / mult)
     * copper ×0.5 → each cell worth ×2; sand ×5 → each cell worth /5.
     */
    mult: number;
}

/**
 * Generator picks **one** of these per cycle and only eats that element.
 * Weight inverted for progress: gold×1, copper×0.5 (→×2), sand×5 (→/5).
 */
export const EAT_MATERIALS: readonly EatMaterial[] = [
    { id: "gold", label: "Gold", mult: 1 },
    { id: "copper", label: "Copper", mult: 0.5 },
    { id: "sand", label: "Sand", mult: 5 },
];

/** Progress required before the generator becomes "active" (ready to spawn). */
export const MAX_PROGRESS = 50;

/** Max cells of the active material eaten per tick. */
export const GENERATOR_EAT_COUNT = 4;

/** 4×4 of 0 + useRawShape. */
export const GENERATOR_SIZE = 4;

/** Cell offset from structure origin to footprint center (4×4 → +2,+2). */
export const GENERATOR_CENTER_OFFSET = 2;

/**
 * Structure.x/y are already in the same cell space as terrains/elements.
 * Keep at 1 (×4 was wrong — it pushed zones outside the map).
 */
export const STRUCTURE_TO_TERRAIN_SCALE = 1;

export const GENERATOR_INTERVAL_MS = 200;
export const ARTEFACT_INTERVAL_MS = 150;

/** Only one creator (generator) may be placed in the world. */
export const MAX_CREATORS = 1;

/**
 * Max live artefacts at once. If at limit, spawn fails and retries next
 * opportunity (click or signal tick).
 */
export const MAX_ARTEFACTS = 5;

// ── Artefact (spawned, not player-placeable) ────────────────────────────────

export const PRODUCEABLE_ELEMENTS: readonly string[] = [
    "sand",
    "redsand",
    "wetsand",
    "seed",
];

export const ARTEFACT_COUNT_MIN = 500;
export const ARTEFACT_COUNT_MAX = 5000;
export const ARTEFACT_EMIT_PER_TICK = 2;

/**
 * Clean-circle radius (cells).
 * Spawn rejected if any structure or auth-blocked cell is inside.
 */
export const CLEAR_RADIUS = 4;

/** Max Chebyshev distance from generator center for artefact spawn. */
export const SPAWN_MAX_DISTANCE = 4;

export const RESPECT_AUTHORIZATION = true;
export const SPAWN_ATTEMPTS = 120;

// ── Display ─────────────────────────────────────────────────────────────────

export const DISPLAY_RANGE = 5;
export const DISPLAY_INTERVAL_MS = 500;

// ── Terrain Collector (manual only — paints terrain from icon image) ────────

export const TERRAIN_COLLECTOR_ID = `${MOD_ID}:terrain-collector`;

/** Only one terrain collector on the map. */
export const MAX_TERRAIN_COLLECTORS = 1;

/** Own charge threshold (independent from structure artefact generator). */
export const TERRAIN_MAX_PROGRESS = 40;

/** Own eat materials / weights (inverse: progress += cells / mult). */
export const TERRAIN_EAT_MATERIALS: readonly EatMaterial[] = [
    { id: "gold", label: "Gold", mult: 1 },
    { id: "copper", label: "Copper", mult: 0.5 },
    { id: "sand", label: "Sand", mult: 5 },
];

export const TERRAIN_EAT_COUNT = 4;
export const TERRAIN_INTERVAL_MS = 200;

/**
 * Painted zone size in **cells** (matches Dicebear size=64 → 1 px = 1 cell).
 * Described as a free 4×4 tile block of 16-cell tiles = 64×64 cells.
 */
export const TERRAIN_ZONE_SIZE = 64;

/** Random ± offset (cells) applied to terrain stamp origin around the collector. */
export const TERRAIN_SPAWN_JITTER = 100;

/**
 * Thickness in cells of the **erase** ring, painted just outside the moss
 * outline. Cells in this band get their element removed and their terrain
 * removed (set to Empty) instead of being painted.
 *
 * Band layout, by Manhattan distance `d` from the nearest glyph pixel:
 *   d = 0                      → fill   (dirt)
 *   d = 1                      → outline (moss)   ← the original 1px ring
 *   d = 2 … 1+ERASE_RING_SIZE   → erase  (empty)   ← the new ring
 *   anything further            → untouched
 */
export const TERRAIN_ERASE_RING_SIZE = 3;

/**
 * Terrains applied from the icon (game CellType names — not element ids).
 * Fill = dirt; outline = moss (hiden-word-2 style ids).
 */
export const TERRAIN_FILL_ID = "dirt";
export const TERRAIN_OUTLINE_ID = "moss";

/** Alias lists used when resolving terrain types (see hiden-word-2 materialize). */
export const TERRAIN_FILL_ALIASES: readonly string[] = ["dirt", "Dirt", "soil", "Soil", "sand"];
export const TERRAIN_OUTLINE_ALIASES: readonly string[] = ["moss", "Moss"];

/** Dicebear icon URL template. */
/** Dicebear rotate must be >= 0; map negative degrees to 360 + rotate. */
export function terrainRotateForApi(rotate: number): number {
    const r = Math.round(rotate) % 360;
    return r < 0 ? 360 + r : r;
}

export const TERRAIN_ICON_URL = (seed: number, rotate: number) => {
    const rot = terrainRotateForApi(rotate);
    return `https://api.dicebear.com/9.x/icons/png?size=${TERRAIN_ZONE_SIZE}&backgroundColor=000000&seed=${seed}&rotate=${rot}`;
};

export const TERRAIN_SEED_MIN = 1;
export const TERRAIN_SEED_MAX = 140;
export const TERRAIN_ROTATE_MIN = -30;
export const TERRAIN_ROTATE_MAX = 30;

/**
 * Legacy threshold (unused by classifier).
 * Classifier treats luma > 40 as glyph fill (Dicebear icons are colored, not pure white).
 */
export const TERRAIN_WHITE_LUMA = 40;

// ── Buffer (JsonMapBuffer) ──────────────────────────────────────────────────

export const MAP_KEY = `${MOD_ID}:artefactProgress`;

export interface ArtefactProgress {
    /** Cumulative value eaten toward MAX_PROGRESS. */
    progress: number;
    /** 0 = charging, 1 = active (ready to spawn). */
    active: number;
    /** How many creator (generator) structures are currently placed. */
    nbCreatorPlace: number;
    /** How many artefact structures are currently alive. */
    nbArtefactPlace: number;
    /**
     * Index into EAT_MATERIALS for the material chosen this cycle.
     * Stored as int for the counter map.
     */
    materialIndex: number;

    // Terrain collector (separate charge)
    terrainProgress: number;
    terrainActive: number;
    nbTerrainCollectorPlace: number;
    terrainMaterialIndex: number;
}

export function materialByIndex(index: number): EatMaterial {
    const i = ((index % EAT_MATERIALS.length) + EAT_MATERIALS.length) % EAT_MATERIALS.length;
    return EAT_MATERIALS[i]!;
}
