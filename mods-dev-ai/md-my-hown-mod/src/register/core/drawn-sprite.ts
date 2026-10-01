
import { LOG } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { api } from "../../packages/mysandkit.ts";


const images = new Map<string, { src: string; image: unknown; failed: boolean }>();


const warned = new Set<string>();


export function sourceOf(spriteId: string): string | undefined {
    const sprites = loadConfig().sprites ?? [];
    const hit = sprites.find((s) => s?.id === spriteId);
    const src = hit?.source;
    return typeof src === "string" && src.startsWith("data:") ? src : undefined;
}


function imageFor(spriteId: string): unknown {
    const src = sourceOf(spriteId);
    if (!src) return undefined;

    const cached = images.get(spriteId);
    if (cached?.src === src) return cached.failed ? undefined : cached.image;

    const ImageCtor = (globalThis as { Image?: new () => unknown }).Image;
    if (!ImageCtor) {
        
        
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
    image.onload = () => {};
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


export function clearDrawnSpriteCache(): void {
    images.clear();
    warned.clear();
}

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
            if (!image) return true; 
            
            
            
            
            if (image.complete === false) return true;

            const cellSize = api.rendering.getGridMetrics()?.cellSize ?? 4;
            const at = api.rendering.getDrawPositionAtCell(structure.x, structure.y) ??
                { x: structure.x * cellSize, y: structure.y * cellSize };

            ctx.save();
            
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            try {
                ctx.filter = "none";
            } catch {  }
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowColor = "rgba(0,0,0,0)";
            
            try {
                if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = false;
            } catch {  }

            ctx.drawImage(
                image,
                at.x,
                at.y,
                Math.max(1, wCells) * cellSize,
                Math.max(1, hCells) * cellSize,
            );
            ctx.restore();
        } catch {  }
        
        
        
        return true;
    };
}
