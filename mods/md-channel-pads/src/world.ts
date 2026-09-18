/**
 * Channel Pads — world/cell math and the teleport itself.
 *
 * `api.teleportZones` is an internal (state, …) facade and hard-crashes from mod
 * code, so travel is done with the public `player.setPositionAtWorld` /
 * `player.setVelocity`, landed on a clear cell beside the destination pad.
 */
import { api, toast } from "./api.ts";
import { CHANNEL_COLORS, FALLBACK_COLOR, KEY, LOG } from "./constants.ts";
import { runtime } from "./state.ts";
import type { PadStructure } from "./types.ts";

/** Fallback cell size when the legacy config is unavailable. */
const DEFAULT_CELL_SIZE = 4;

/** World px per cell. */
export function cellSize(): number {
    try {
        return api.config?.getLegacy?.()?.cellSize ?? DEFAULT_CELL_SIZE;
    } catch {
        return DEFAULT_CELL_SIZE;
    }
}

/** Game time when available, else the wall clock. */
export function nowMs(): number {
    try {
        return api.time?.getElapsedMs?.() ?? api.time?.getTimeMs?.() ?? Date.now();
    } catch {
        return Date.now();
    }
}

/** World px at the top-left of a cell. */
export function worldAt(cellX: number, cellY: number): { x: number; y: number } {
    const cs = cellSize();
    return { x: cellX * cs, y: cellY * cs };
}

/** True when the player hitbox fits at a world position. */
export function isClear(wx: number, wy: number): boolean {
    try {
        if (typeof api.player.isPositionClearAtWorld !== "function") return true;
        return api.player.isPositionClearAtWorld(wx, wy) !== false;
    } catch {
        return true;
    }
}

/**
 * Land beside / above the dest pad so we never spawn inside the structure
 * (that is what used to ping-pong — and crash via internal teleportZones).
 */
export function landingWorld(dest: { x: number; y: number }): { x: number; y: number } {
    const offsets: Array<[number, number]> = [
        [0, -2],
        [0, -1],
        [-1, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
        [0, 0],
    ];
    for (const [dx, dy] of offsets) {
        const { x, y } = worldAt(dest.x + dx, dest.y + dy);
        if (isClear(x, y)) return { x, y };
    }
    return worldAt(dest.x, dest.y - 2);
}

/** True when the player is on (or within one cell of) a pad. */
export function standingOn(structure: PadStructure): boolean {
    try {
        if (api.player.isCollidingWithCell(structure.x, structure.y)) return true;
    } catch {
        /* ignore */
    }
    try {
        if (api.player.isWithinRadiusOfCell?.(structure.x, structure.y, 1)) return true;
    } catch {
        /* ignore */
    }
    return false;
}

/** Short channel-coloured flash at a cell. */
export function flash(cellX: number, cellY: number, ch: number): void {
    try {
        const cs = cellSize();
        api.lights?.temporary?.createAtWorld?.(cellX * cs + cs / 2, cellY * cs + cs / 2, {
            durationMs: 220,
            brightness: 2.2,
            size: 56,
            color: CHANNEL_COLORS[ch] ?? FALLBACK_COLOR,
        });
    } catch {
        /* lights optional */
    }
}

/** Move the player to a pad's landing spot, flash it and start the cooldown. */
export function teleportTo(dest: { x: number; y: number }, ch: number): boolean {
    const land = landingWorld(dest);
    try {
        if (typeof api.player.setPositionAtWorld === "function") {
            api.player.setPositionAtWorld(land.x, land.y);
        } else if (typeof api.player.setPosition === "function") {
            api.player.setPosition(land.x, land.y);
        } else {
            toast(KEY.toastFail, { channel: ch });
            return false;
        }
    } catch (err) {
        console.warn(`${LOG} setPositionAtWorld`, err);
        toast(KEY.toastFail, { channel: ch });
        return false;
    }

    try {
        api.player.setVelocity?.(0, 0);
    } catch {
        /* ignore */
    }

    flash(dest.x, dest.y, ch);
    runtime.skipUntilLeave = { ch, x: dest.x, y: dest.y };
    runtime.lastJumpAt[ch] = nowMs();
    return true;
}
