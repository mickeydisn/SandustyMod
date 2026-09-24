/**
 * excavated-all — static configuration.
 *
 * Ids, storage keys, log prefix, and tunables. Nothing here touches the
 * sandkit API — see `api.ts` for the live handle.
 */

/** Mod id — also the `api.storage` namespace and id prefix. */
export const MOD_ID = "excavated-all";

/** Keep in sync with `modinfo.json`. */
export const VERSION = "0.1.0";

/** Log prefix so every warning is attributable to this mod. */
export const LOG = `[${MOD_ID}]`;

/** The tool item players use to erase cells. */
export const ITEM_ID = `${MOD_ID}.excavator`;
export const ICON_SPRITE_ID = `${MOD_ID}.icon`;
export const ICON_PATH = "assets/icon.png";

/** `api.ui.overlays.register` id (hotbar slot). */
export const OVERLAY_ID = `${MOD_ID}.panel`;

/** Brush radius bounds (in cells). */
export const RADIUS_MIN = 1;
export const RADIUS_MAX = 48;
export const RADIUS_DEFAULT = 6;
export const RADIUS_STEP_FAST = 4;

/** Energy cost per fire (0 disables the check gracefully if energy API is absent). */
export const EXCAVATE_ENERGY = 0;

/** `api.storage` keys — filters/radius are remembered across reloads. */
export const STORE_KEY_RADIUS = "radius";
export const STORE_KEY_FILTERS = "filters";

/** Keyboard binding + fallback key for firing the brush. */
export const FIRE_BINDING_ID = `${MOD_ID}.fire`;
export const FIRE_KEY = "KeyX";
export const FIRE_KEY_LABEL = "X";

/** Hold-to-repeat cadence, matched to the materializer reference tool. */
export const FIRE_COOLDOWN_MS = 90;
export const HOLD_INTERVAL_MS = 110;

/** i18n key namespace. */
const NS = `mods|${MOD_ID}`;
export const KEY = {
    itemName: `${NS}|excavator|name`,
    itemDesc: `${NS}|excavator|desc`,
    bindingName: `${NS}|excavator|binding`,
} as const;

/** Max cells to scan outward from a hit cell to find a structure's full footprint. */
export const STRUCTURE_FOOTPRINT_SEARCH_RADIUS = 10;

/**
 * Terrain id fragments treated as "fixed" / normally indestructible
 * (bedrock-class map boundaries and similar). Matched case-insensitively
 * against the terrain's string id / name — see `engine.ts#isFixedTerrain`.
 *
 * These are only skipped when the "Unremovable" filter is OFF; with it ON
 * (the default) the tool forces them out too.
 */
export const FIXED_TERRAIN_HINTS: readonly string[] = [
    "bedrock",
    "blackrock",
    "divider",
    "border",
    "boundary",
    "void-wall",
    "map-edge",
];

/**
 * `CellType` values that are a structure's own mechanism rendered at the
 * terrain layer — conveyor belts, shakers, sliding blocks — rather than
 * ordinary diggable ground. See `docs_tech/TerrainID.md`:
 *
 *   SlidingBlock = 16, SlidingBlockLeft = 17, SlidingBlockRight = 18,
 *   ConveyorLeft = 19, ConveyorRight = 20, ShakerLeft = 21, ShakerRight = 22
 *
 * These are only touched when the "Structure" filter is on — clearing them
 * while leaving "Structure" off would strip a machine's moving part while
 * leaving the machine itself behind. See `engine.ts#isStructureTerrain`.
 */
export const STRUCTURE_TERRAIN_TYPES: readonly number[] = [16, 17, 18, 19, 20, 21, 22];

/** String-id fallback for engines that return names instead of the raw numeric CellType. */
export const STRUCTURE_TERRAIN_HINTS: readonly string[] = [
    "slidingblock",
    "conveyor",
    "shaker",
];

/** Filter categories exposed on the hotbar panel, in display order. */
export const FILTER_KEYS = [
    "terrain",
    "structure",
    "element",
    "unremovable",
] as const;

export type FilterKey = typeof FILTER_KEYS[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
    terrain: "Terrain",
    structure: "Structure",
    element: "Element",
    unremovable: "Fixed",
};

export const FILTER_TITLES: Record<FilterKey, string> = {
    terrain: "Clear diggable terrain (stone, dirt, ice, …)",
    structure: "Remove buildings (whole footprint) and their embedded terrain " +
        "(conveyors, shakers, sliding blocks)",
    element: "Remove simulated matter (sand, water, gas, …)",
    unremovable: "Also force-clear bedrock-class / normally indestructible terrain",
};

/** Default filter state: everything on — the tool removes all the things. */
export const DEFAULT_FILTERS: Record<FilterKey, boolean> = {
    terrain: true,
    structure: true,
    element: true,
    unremovable: true,
};

/**
 * `api.authorization` is query-only in this API (canBuildAtCell / canUseToolAtCell /
 * getZoneIdAtCell — no setter). There is no way to actually lift a zone's
 * restriction, so the excavator now simply respects it like any other tool:
 * cells the engine's own authorization check blocks are always skipped.
 */
export const RESPECT_AUTHORIZATION = true;
