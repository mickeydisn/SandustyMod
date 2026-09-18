/**
 * Big Brother — mutable runtime state.
 *
 * Kept in one object so the channel arrays can be rebuilt in place when the
 * player changes settings, without module-level rebinding.
 */
import { DEFAULT_CHANNELS, DEFAULT_ZONE_TILES, TILE_PX } from "./constants.ts";

export interface RuntimeState {
    /** Active channel count (settings-driven). */
    channels: number;
    /** Capture zone edge in tiles (settings-driven). */
    zoneTiles: number;
    /** Feed canvas edge in px = `zoneTiles * TILE_PX`. */
    feedPx: number;
    /** `${MOD}.cam.${ch}` per channel. */
    camIds: string[];
    /** `${MOD}.screen.${ch}` per channel. */
    screenIds: string[];
    /** Off-screen feed canvas per channel. */
    feeds: Array<HTMLCanvasElement | null>;
    /** Per channel: true once a real world capture succeeded. */
    hadCopy: boolean[];
}

export const runtime: RuntimeState = {
    channels: DEFAULT_CHANNELS,
    zoneTiles: DEFAULT_ZONE_TILES,
    feedPx: DEFAULT_ZONE_TILES * TILE_PX,
    camIds: [],
    screenIds: [],
    feeds: [],
    hadCopy: [],
};
