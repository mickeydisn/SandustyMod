/**
 * Big Brother — the off-screen feed canvases.
 *
 * One canvas per channel. A camera fills it with a per-cell schematic of its
 * capture zone; an empty channel keeps the "NO SIGNAL" placeholder.
 */
import { listType } from "./api.ts";
import { colorAtCell } from "./colors.ts";
import { CHANNEL_HEX, MOD, TILE_PX } from "./constants.ts";
import { metrics, zoneOf } from "./geometry.ts";
import { runtime } from "./state.ts";

const CELL_DRAW_PX = 4;

/**
 * Rebuild the channel id arrays, feed slots and canvas sizes from the current
 * settings. Existing canvases are kept (and resized) so live screens do not
 * flicker to black when the channel count or zone size changes.
 */
export function rebuildChannelArrays(): void {
    const prevFeeds = runtime.feeds;
    const prevHadCopy = runtime.hadCopy;
    const prevChannels = prevFeeds.length;

    runtime.camIds = [];
    runtime.screenIds = [];
    for (let ch = 0; ch < runtime.channels; ch++) {
        runtime.camIds.push(`${MOD}.cam.${ch}`);
        runtime.screenIds.push(`${MOD}.screen.${ch}`);
    }

    runtime.feeds = [];
    runtime.hadCopy = [];
    for (let ch = 0; ch < runtime.channels; ch++) {
        runtime.feeds.push(ch < prevChannels ? prevFeeds[ch] : null);
        runtime.hadCopy.push(ch < prevChannels ? prevHadCopy[ch] ?? false : false);
    }

    runtime.feedPx = runtime.zoneTiles * TILE_PX;
    for (let ch = 0; ch < runtime.channels; ch++) {
        const ctx = ensureFeed(ch)?.getContext("2d", { willReadFrequently: true }) ?? null;
        if (ctx) paintNoSignal(ctx, ch);
    }
}

/** Get (or lazily create) the feed canvas for a channel. */
export function ensureFeed(ch: number): HTMLCanvasElement | null {
    const existing = runtime.feeds[ch];
    if (existing) return existing;
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = runtime.feedPx;
    canvas.height = runtime.feedPx;
    runtime.feeds[ch] = canvas;
    paintNoSignal(canvas.getContext("2d", { willReadFrequently: true }), ch);
    return canvas;
}

/** Static placeholder drawn when a channel has no camera. */
export function paintNoSignal(ctx: CanvasRenderingContext2D | null, ch: number): void {
    if (!ctx) return;
    const size = runtime.feedPx;
    const color = CHANNEL_HEX[ch % CHANNEL_HEX.length];

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 30; i++) {
        ctx.fillRect((i * 17 + ch * 9) % size, (i * 13 + ch * 5) % size, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = "bold 12px monospace";
    ctx.fillText("NO SIGNAL", 8, 44);
    ctx.fillStyle = "#889";
    ctx.font = "10px monospace";
    ctx.fillText(`CH ${ch}`, 8, 60);
}

/** Paint one channel's capture zone as a per-cell schematic. */
export function paintSchematic(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    zoneCells: number,
): void {
    for (let ty = 0; ty < zoneCells; ty++) {
        for (let tx = 0; tx < zoneCells; tx++) {
            ctx.fillStyle = colorAtCell(originX + tx, originY + ty);
            ctx.fillRect(tx * CELL_DRAW_PX, ty * CELL_DRAW_PX, CELL_DRAW_PX, CELL_DRAW_PX);
        }
    }
}

/** Capture one channel's feed from its camera (best-effort). */
export function captureChannel(ch: number): void {
    const frame = ensureFeed(ch);
    if (!frame) return;
    const ctx = frame.getContext("2d");
    if (!ctx) return;

    const camera = listType(runtime.camIds[ch])[0];
    if (!camera) {
        if (runtime.hadCopy[ch]) {
            runtime.hadCopy[ch] = false;
            paintNoSignal(ctx, ch);
        }
        return;
    }

    const zone = zoneOf(camera);
    const zoneCells = metrics().zoneCells;
    if (!runtime.hadCopy[ch]) paintSchematic(ctx, zone.x, zone.y, zoneCells);
}

/** Capture every channel. */
export function captureAll(): void {
    for (let ch = 0; ch < runtime.channels; ch++) captureChannel(ch);
}
