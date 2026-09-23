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

/** True when a feed canvas holds nothing (transparent black everywhere). */
function isBlank(frame: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
    try {
        const w = frame.width;
        const h = frame.height;
        if (!w || !h) return true;
        // Sample a few pixels; cheap and enough to detect a fresh/resized canvas.
        const sample = ctx.getImageData(0, 0, Math.min(w, 8), Math.min(h, 8)).data;
        for (let i = 3; i < sample.length; i += 4) {
            if (sample[i] !== 0) return false;
        }
        return true;
    } catch {
        return false;
    }
}

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
        const feed = ensureFeed(ch);
        if (!feed) continue;
        const hasCamera = listType(runtime.camIds[ch]).length > 0;
        if (feed.width !== runtime.feedPx || feed.height !== runtime.feedPx) {
            // Resizing a canvas wipes it.
            feed.width = runtime.feedPx;
            feed.height = runtime.feedPx;
            runtime.hadCopy[ch] = false;
        }
        if (!hasCamera) {
            // Channel without a camera must show NO SIGNAL — never a stale
            // live frame kept around from before the rebuild/resize.
            const ctx = feed.getContext("2d", { willReadFrequently: true });
            if (ctx) paintNoSignal(ctx, ch);
            runtime.hadCopy[ch] = false;
        } else {
            // Channel with a camera: force the next capture to repaint the
            // live schematic (canvas may hold NO SIGNAL or an old zone size).
            runtime.hadCopy[ch] = false;
        }
    }
}

/** Get (or lazily create) the feed canvas for a channel. */
export function ensureFeed(ch: number): HTMLCanvasElement | null {
    const existing = runtime.feeds[ch];
    if (existing) {
        // Zone size may have changed since the canvas was created; resize here
        // too so direct callers (render blit, capture) never use a stale size.
        // NOTE: resizing clears the canvas — the next captureChannel() call
        // repaints it (live schematic or NO SIGNAL); render just blits.
        if (existing.width !== runtime.feedPx || existing.height !== runtime.feedPx) {
            existing.width = runtime.feedPx;
            existing.height = runtime.feedPx;
            runtime.hadCopy[ch] = false;
        }
        return existing;
    }
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
    const canvas = ctx.canvas;
    const size = canvas?.width || runtime.feedPx;
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
        // No camera: the screen must show NO SIGNAL, not a frozen last frame.
        // `hadCopy` tracks "feed currently holds a live schematic".
        if (runtime.hadCopy[ch]) {
            runtime.hadCopy[ch] = false;
            paintNoSignal(ctx, ch);
        } else if (isBlank(frame, ctx)) {
            // Freshly resized / never-painted canvas: paint the placeholder.
            paintNoSignal(ctx, ch);
        }
        return;
    }

    // Camera present: repaint the live schematic every tick so screens follow
    // the world instead of freezing on the first frame.
    const zone = zoneOf(camera);
    const zoneCells = metrics().zoneCells;
    paintSchematic(ctx, zone.x, zone.y, zoneCells);
    runtime.hadCopy[ch] = true;
}

/** Capture every channel. */
export function captureAll(): void {
    for (let ch = 0; ch < runtime.channels; ch++) captureChannel(ch);
}
