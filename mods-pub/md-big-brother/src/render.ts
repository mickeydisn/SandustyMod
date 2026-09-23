/**
 * Big Brother — overlay painting and structure draw hooks.
 *
 * The overlay runs every `frame:render`: dashed capture-zone outlines around
 * cameras, and the live feed blitted onto every screen. `drawCamera` /
 * `drawScreen` are the placement previews (structure `draw` hooks).
 */
import { api, channelFromId, listType } from "./api.ts";
import { CHANNEL_HEX, LOG } from "./constants.ts";
import { ensureFeed } from "./feeds.ts";
import { drawPosWorld, metrics, zoneOf, zoneWorldRect } from "./geometry.ts";
import { runtime } from "./state.ts";
import type { CamStructure, DrawingContext } from "./types.ts";

/** Fill/outline alpha used behind a screen feed. */
const SCREEN_BACKDROP = "rgba(20,20,20,0.3)";

function colorFor(ch: number): string {
    return CHANNEL_HEX[ch % CHANNEL_HEX.length];
}

/**
 * Structure `draw` hooks receive (`structure, ctx`) or (`type, structure, ctx`)
 * depending on the engine build; normalise both into one shape.
 */
function normalizeDraw(
    a: unknown,
    b: unknown,
    c: unknown,
): { structure: CamStructure | null; ctx: DrawingContext | null } {
    if (c && typeof c === "object" && ("ctx" in c || "placing" in c || "tilemap" in c)) {
        return { structure: (b ?? null) as CamStructure | null, ctx: c as DrawingContext };
    }
    return { structure: (a ?? null) as CamStructure | null, ctx: (b ?? null) as DrawingContext };
}

/** Dashed outline + corner handle marking a camera's capture zone. */
export function strokeZoneOn(g: CanvasRenderingContext2D, camera: CamStructure, ch: number): void {
    const zone = zoneOf(camera);
    const rect = zoneWorldRect(zone.x, zone.y);
    const a = drawPosWorld(rect.x, rect.y);
    const b = drawPosWorld(rect.x + rect.w, rect.y + rect.h);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.max(4, Math.abs(b.x - a.x));
    const h = Math.max(4, Math.abs(b.y - a.y));

    g.save();
    g.strokeStyle = colorFor(ch);
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.setLineDash([]);

    // Corner handle shows which capture corner the camera is on.
    const handle = 6;
    const corner = (camera.data?.corner ?? 0) % 4;
    const hx = corner === 0 || corner === 3 ? x : x + w - handle;
    const hy = corner === 0 || corner === 1 ? y : y + h - handle;
    g.fillStyle = colorFor(ch);
    g.fillRect(hx, hy, handle, handle);
    g.restore();
}

/** Blit a channel feed onto one screen structure, edge to edge. */
export function blitScreenOn(g: CanvasRenderingContext2D, screen: CamStructure, ch: number): void {
    const { cell, zoneCells } = metrics();
    const span = zoneCells * cell;
    const a = drawPosWorld(screen.x * cell, screen.y * cell);
    const b = drawPosWorld(screen.x * cell + span, screen.y * cell + span);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.max(8, Math.abs(b.x - a.x));
    const h = Math.max(8, Math.abs(b.y - a.y));
    const feed = ensureFeed(ch);

    g.save();
    // Half-transparent backdrop so empty feed pixels composite onto it.
    g.fillStyle = SCREEN_BACKDROP;
    g.fillRect(x, y, w, h);
    if (feed) {
        g.imageSmoothingEnabled = false;
        g.drawImage(feed, x, y, w, h);
    }
    // Colored border per channel.
    g.strokeStyle = colorFor(ch);
    g.lineWidth = 3;
    g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    g.restore();
}

/** Paint every camera zone and screen feed on the overlay. */
export function paintOverlay(): void {
    try {
        api.rendering.withOverlayContext((g) => {
            if (!g) return;
            for (let ch = 0; ch < runtime.channels; ch++) {
                for (const camera of listType(runtime.camIds[ch])) strokeZoneOn(g, camera, ch);
                for (const screen of listType(runtime.screenIds[ch])) blitScreenOn(g, screen, ch);
            }
        });
    } catch (err) {
        console.warn(`${LOG} overlay`, err);
    }
}

/** Placement preview for a camera. */
export function drawCamera(a: unknown, b: unknown, c: unknown): boolean {
    try {
        const { structure, ctx } = normalizeDraw(a, b, c);
        if (structure && ctx?.ctx && ctx.placing) {
            const ch = structure.data?.channel ?? channelFromId(structure.type, runtime.camIds);
            if (ch != null) strokeZoneOn(ctx.ctx, structure, ch);
        }
    } catch (err) {
        console.warn(`${LOG} camera draw`, err);
    }
    return false;
}

/** Placement preview for a screen. */
export function drawScreen(a: unknown, b: unknown, c: unknown): boolean {
    try {
        const { structure, ctx } = normalizeDraw(a, b, c);
        if (structure && ctx?.ctx && ctx.placing) {
            const ch = structure.data?.channel ?? channelFromId(structure.type, runtime.screenIds);
            if (ch != null) blitScreenOn(ctx.ctx, structure, ch);
        }
    } catch (err) {
        console.warn(`${LOG} screen draw`, err);
    }
    return false;
}
