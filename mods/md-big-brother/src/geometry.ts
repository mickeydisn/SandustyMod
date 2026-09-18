/**
 * Big Brother — grid geometry.
 *
 * The world map is stored per 4×4 px cell; a tile is 16×16 px, so one tile is
 * a 4×4 group of cells. These helpers convert structure cells to world/canvas
 * coordinates and describe the capture zone.
 */
import { api } from "./api.ts";
import { CELL_PX, TILE_PX } from "./constants.ts";
import { runtime } from "./state.ts";
import type { CamStructure } from "./types.ts";

/** The snap grid is 4×4 px (same as a map cell). */
export const SNAP_PX = CELL_PX;

export interface Metrics {
    cell: number;
    snap: number;
    tilePx: number;
    /** Capture-zone edge in cells. */
    zoneCells: number;
}

export interface Corner {
    id: number;
    name: string;
    /** Zone offset from the camera cell, in cells. */
    dx: number;
    dy: number;
}

export interface Zone {
    /** Top-left cell of the capture zone. */
    x: number;
    y: number;
    corner: Corner;
}

export function metrics(): Metrics {
    return {
        cell: CELL_PX,
        snap: SNAP_PX,
        tilePx: TILE_PX,
        zoneCells: runtime.zoneTiles * CELL_PX,
    };
}

/** The four capture corners, swinging around the camera cell. */
export function corners(): Corner[] {
    const span = (runtime.zoneTiles - 1) * SNAP_PX;
    return [
        { id: 0, name: "top-left", dx: 0, dy: 0 },
        { id: 1, name: "top-right", dx: -span, dy: 0 },
        { id: 2, name: "bottom-right", dx: -span, dy: -span },
        { id: 3, name: "bottom-left", dx: 0, dy: -span },
    ];
}

/** Capture zone for a camera, based on its stored `corner`. */
export function zoneOf(camera: CamStructure): Zone {
    const list = corners();
    const corner = list[(camera.data?.corner ?? 0) % list.length];
    return {
        x: camera.x + corner.dx,
        y: camera.y + corner.dy,
        corner,
    };
}

/** Zone rectangle in world px, from its top-left cell. */
export function zoneWorldRect(originX: number, originY: number): {
    x: number;
    y: number;
    w: number;
    h: number;
} {
    const { cell, zoneCells, tilePx } = metrics();
    const w = zoneCells * cell || runtime.zoneTiles * tilePx;
    return { x: originX * cell, y: originY * cell, w, h: w };
}

/** World px → canvas px, preferring the host renderer transform. */
export function drawPosWorld(wx: number, wy: number): { x: number; y: number } {
    try {
        const atWorld = api.rendering.getDrawPositionAtWorld;
        if (atWorld) return atWorld(wx, wy);
    } catch {
        /* fall through */
    }
    try {
        const atCell = api.rendering.getDrawPositionAtCell;
        if (atCell) return atCell(wx / metrics().cell, wy / metrics().cell);
    } catch {
        /* fall through */
    }
    return { x: wx, y: wy };
}

/** A square, zero-filled structure shape of `tiles` tiles per side. */
export function tileShape(tiles: number): number[][] {
    const n = tiles * SNAP_PX;
    const row = new Array<number>(n).fill(0);
    return Array.from({ length: n }, () => row.slice());
}
