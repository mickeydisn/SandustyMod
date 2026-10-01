/**
 * The drawn-sprite draw function: paint a sprite the editor drew, from bytes.
 *
 * **Why this exists rather than naming the sprite in `render`.** `render.imageName`
 * asks the engine's graphics registry for a texture, and that registry is filled by
 * `api.sprites.load`, which is documented for *paths*. A sprite from the editor is a
 * base64 PNG in the config, not a file in the mod — there is no path to hand the
 * engine. The shipping mod this file's shape is modelled on works around it the same
 * way (`__scraped-mods/workshop/3791498201`), but by reading a texture some *other*
 * part of the mod already registered:
 *
 *     e.sandkit.graphics[SPRITE_ID].imageAsset   →   ctx.drawImage(...)
 *
 * That still needs the registry entry. So this builds the image itself, from the same
 * bytes, and owns it. It then does not matter whether `sprites.load` accepted the data
 * URL: if it did, the engine's copy is ignored and ours is used; if it did not, this
 * is the only copy, and the structure still draws.
 *
 * The cost is that this is a *canvas* draw and not a sprite in the game's eyes — the
 * structure has no entry in the sprite registry, so nothing else can name it.
 */
import { LOG } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { api } from "../../packages/mysandkit.ts";

/**
 * The image for one sprite id, once it has decoded.
 *
 * Module-level on purpose: this runs per structure per frame, and building an
 * `Image` each time would allocate one per frame per structure forever. The key
 * includes the source so re-drawing a sprite in the editor invalidates the cache —
 * otherwise the world would keep showing the first version drawn.
 */
const images = new Map<string, { src: string; image: unknown; failed: boolean }>();

/** Ids already reported as undecodable, so the warning is once, not per frame. */
const warned = new Set<string>();

/**
 * The base64 PNG for a sprite id, or undefined.
 *
 * Read from the config rather than from the sprite registry, because that is the
 * whole point: the registry is the thing that may not have it.
 */
export function sourceOf(spriteId: string): string | undefined {
    const sprites = loadConfig().sprites ?? [];
    const hit = sprites.find((s) => s?.id === spriteId);
    const src = hit?.source;
    return typeof src === "string" && src.startsWith("data:") ? src : undefined;
}

/**
 * A decoded image for `spriteId`, or undefined while it loads.
 *
 * `unknown` rather than `HTMLImageElement`: this module is imported by tests that
 * have no DOM, and naming the DOM type here would demand the DOM lib for them.
 */
function imageFor(spriteId: string): unknown {
    const src = sourceOf(spriteId);
    if (!src) return undefined;

    const cached = images.get(spriteId);
    if (cached?.src === src) return cached.failed ? undefined : cached.image;

    const ImageCtor = (globalThis as { Image?: new () => unknown }).Image;
    if (!ImageCtor) {
        // No DOM: a headless caller. Cache the failure so this is one lookup, not
        // one per frame, and say so once.
        if (!warned.has(spriteId)) {
            warned.add(spriteId);
            console.warn(`${LOG} drawn sprite ${spriteId}: no Image constructor`);
        }
        images.set(spriteId, { src, image: undefined, failed: true });
        return undefined;
    }

    const image = new ImageCtor() as {
        onload?: () => void;
        onerror?: () => void;
        src?: string;
    };
    images.set(spriteId, { src, image, failed: false });
    image.onload = () => {/* decoded; the cache already holds the element */};
    image.onerror = () => {
        const entry = images.get(spriteId);
        if (entry) entry.failed = true;
        if (!warned.has(spriteId)) {
            warned.add(spriteId);
            console.warn(`${LOG} drawn sprite ${spriteId}: the image failed to decode`);
        }
    };
    image.src = src;
    return image;
}

/** Drop cached images. Called when the sprite list changes. */
export function clearDrawnSpriteCache(): void {
    images.clear();
    warned.clear();
}
/**
 * Build the draw function for one structure's sprite id.
 *
 * Exported for `draw.test.ts`, which drives it against a fake canvas rather than a
 * real one — the point being that it must not touch anything but `drawImage`.
 */
export function makeDrawnSprite(
    spriteId: string | undefined,
    wCells: number,
    hCells: number,
) {
    return function drawDrawnSprite(
        _session: unknown,
        structure: { x?: number; y?: number },
        context: {
            ctx?: {
                save(): void;
                restore(): void;
                drawImage(...a: unknown[]): void;
                globalAlpha: number;
                globalCompositeOperation: string;
                filter: string;
                shadowBlur: number;
                shadowOffsetX: number;
                shadowOffsetY: number;
                shadowColor: string;
                imageSmoothingEnabled?: boolean;
            };
        },
    ): boolean {
        const ctx = context?.ctx;
        if (!ctx || !spriteId) return false;
        if (typeof structure?.x !== "number" || typeof structure?.y !== "number") {
            return false;
        }
        try {
            const image = imageFor(spriteId) as
                | { complete?: boolean }
                | undefined;
            if (!image) return true; // handled: nothing yet, but do not double-draw
            // `complete` is false until the bytes decode. Browsers make `drawImage`
            // on an incomplete image a silent no-op, so relying on that would hide
            // the first few frames of every sprite — including the reason for this
            // key, where the image is the only one there is.
            if (image.complete === false) return true;

            const rendering = (api.raw as
                | {
                    rendering?: {
                        getGridMetrics?: () => { cellSize?: number };
                        getDrawPositionAtCell?: (
                            x: number,
                            y: number,
                        ) => { x: number; y: number };
                    };
                }
                | undefined)?.rendering;
            const cellSize = rendering?.getGridMetrics?.()?.cellSize ?? 4;
            const at = rendering?.getDrawPositionAtCell?.(structure.x, structure.y) ??
                { x: structure.x * cellSize, y: structure.y * cellSize };

            ctx.save();
            // The same inherited-state trap the other renderers here guard against —
            // quoted at length in the header of `structures.ts`.
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            try {
                ctx.filter = "none";
            } catch { /* older canvas impls */ }
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowColor = "rgba(0,0,0,0)";
            // Pixel art: smoothing turns a 16px sprite into a grey smudge.
            try {
                if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = false;
            } catch { /* not every canvas impl has it */ }

            ctx.drawImage(
                image,
                at.x,
                at.y,
                Math.max(1, wCells) * cellSize,
                Math.max(1, hCells) * cellSize,
            );
            ctx.restore();
        } catch { /* never break the render loop */ }
        // True = handled. Returning false would let the engine draw `render.imageName`
        // underneath, and that id has no texture — so the sprite would appear twice
        // whenever `sprites.load` *did* accept the data URL.
        return true;
    };
}
