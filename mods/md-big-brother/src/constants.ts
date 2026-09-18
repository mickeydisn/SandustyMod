/**
 * Big Brother — static configuration.
 *
 * Everything here is a compile-time constant: mod id, sprite/feed geometry,
 * channel palette, defaults and the i18n key map. Runtime, settings-driven
 * values live in `state.ts`.
 */

/** Mod id — used for structure ids, sprite ids and i18n keys. */
export const MOD = "md-big-brother";

/** A tile is 16×16 px on screen. */
export const TILE_PX = 16;

/** The world grid is 4×4 px per cell (see `geometry.metrics`). */
export const CELL_PX = 4;

/** One camera per channel; extra placements are rejected. */
export const MAX_CAMERAS = 1;

/** Capture throttle inside `frame:render` (~10 fps). */
export const CAPTURE_MS = 100;

export const DEFAULT_CHANNELS = 4;
export const DEFAULT_ZONE_TILES = 6;
export const MIN_CHANNELS = 1;
export const MAX_CHANNELS = 10;
export const MIN_ZONE_TILES = 2;
export const MAX_ZONE_TILES = 30;

/** Up to 10 channel colours. Only the first `channels` are ever used. */
export const CHANNEL_HEX: readonly string[] = [
    "#3de0ff",
    "#ff3d9a",
    "#ffc93d",
    "#7dff3d",
    "#ff8c3d",
    "#a855f7",
    "#3dd1ff",
    "#ff6b3d",
    "#3dff7d",
    "#ff3dbd",
];

/** i18n keys, namespaced under `mods|bigbrother|…`. */
const NS = "mods|bigbrother";
export const KEY = {
    pack: `${NS}|pack`,
    camDesc: `${NS}|cam|desc`,
    screenDesc: `${NS}|screen|desc`,
    toastCamFull: `${NS}|toast|camFull`,
    toastCorner: `${NS}|toast|corner`,
    toastWaiting: `${NS}|toast|waiting`,
    tooltipCam: `${NS}|tooltip|cam`,
    tooltipScreen: `${NS}|tooltip|screen`,
    camName: (ch: number) => `${NS}|cam|${ch}|name`,
    screenName: (ch: number) => `${NS}|screen|${ch}|name`,
} as const;

/** Log prefix so every warning is attributable to this mod. */
export const LOG = "[big-brother]";
