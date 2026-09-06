import { AlignMode, CatalogueItem } from "./types.ts";

export const DEFAULT_SPRITE_PX_PER_TILE = 16;

export const buildCustumDraw = (
    item: CatalogueItem,
) => {
    return (
        _state: unknown,
        structure: {
            x: number;
            y: number;
            type?: string;
            data: Record<string, unknown>;
        },
        render: { ctx?: CanvasRenderingContext2D },
    ) => {
        // assert
        const ctx = render?.ctx;
        if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
        if (!item.spriteId) return false;
        // core
        const image = sandkit.api.sprites?.getById(item.spriteId)?.imageAsset?.image;
        if (!image) return false;

        const origin = sandkit.api.rendering.getDrawPositionAtCell(
            structure.x,
            structure.y,
        );
        drawImageAligned(ctx, image as CanvasImageSource, origin, item);
        return true;
    };
};

// --

/**
 * Compute top-left draw position for a structure at cell (x,y).
 * Floor: sit on bottom of cell row (deco-objects baseline).
 * Wall: center in cell.
 */
function alignFromOrigin(
    cellOrigin: { x: number; y: number },
    size: { width: number; height: number },
    align: AlignMode = "floor",
): { x: number; y: number } {
    if (align === "wall" || align === "center") {
        return {
            x: cellOrigin.x + (DEFAULT_SPRITE_PX_PER_TILE - size.width) / 2,
            y: cellOrigin.y + (DEFAULT_SPRITE_PX_PER_TILE - size.height) / 2,
        };
    }

    // floor — baseline at bottom of placement cell
    return {
        x: cellOrigin.x,
        y: cellOrigin.y + DEFAULT_SPRITE_PX_PER_TILE - size.height,
    };
}

/** Draw image with optional horizontal mirror (deco-objects pattern). */
function drawImageAligned(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    origin: { x: number; y: number },
    item: CatalogueItem,
): void {
    const imagePos = alignFromOrigin(
        origin,
        item,
    );

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (item.isMirrored) {
        ctx.translate(imagePos.x + item.width, imagePos.y);
        ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, item.width, item.height);
    } else {
        ctx.drawImage(image, imagePos.x, imagePos.y, item.width, item.height);
    }
    ctx.restore();
}
