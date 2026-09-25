/**
 * Shared features for the buffer-controls structure registers.
 *
 * Both the "path" register (variables category) and the "value" register (value
 * category) build their structure from the same skeleton: a kind icon plus a
 * readout rectangle. The only thing that differs between the two registers is
 * the text painted inside that rectangle — the bound jsonBuffer path
 * (variables) vs. the live buffer value (value).
 *
 * Everything the registers have in common lives here, so a change to the
 * footprint, layout, tooltip, or render behaviour updates both at once.
 */
import "@sandmd/sandkit";
import { adjustHSL } from "@sandmd/shared";
import { CELL } from "../const.ts";

export interface ReadoutOptions {
    spriteId: string;
    /** Text painted inside the readout rectangle. */
    text: string;
    /**
     * Width of the readout rectangle, in cells.
     * Pass the width explicitly for the structure being rendered.
     */
    readoutCells: number;
    /** Draw the 16x16 kind icon left of the readout. */
    showIcon: boolean;
}

/** Total footprint width in cells: icon (0 or 1) + readout cells. */
export function readoutTileWidth(
    opts: Pick<ReadoutOptions, "readoutCells" | "showIcon">,
): number {
    const cells = Math.max(1, Math.floor(opts.readoutCells));
    return (opts.showIcon ? 1 : 0) + cells;
}

/** Resolve the sprite id to a loaded canvas image, or undefined if not ready. */
function loadImage(spriteId: string): unknown {
    return sandkit.api.sprites?.getById(spriteId)?.imageAsset?.image;
}

/**
 * Shared custom draw for a buffer-controls structure: optionally the kind icon
 * plus a readout rectangle (1px #c1812e border, black fill) with `text` inside.
 * Both registers render through this, so the visual language stays consistent
 * while each register only picks the text, width (`readoutCells`) and icon
 * (`showIcon`) to show.
 */
export function drawIconAndReadout(
    structure: { x: number; y: number },
    render: { ctx?: CanvasRenderingContext2D },
    opts: ReadoutOptions,
): boolean {
    const ctx = render?.ctx;
    if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
    const showIcon = opts.showIcon;
    const image = showIcon ? loadImage(opts.spriteId) : undefined;
    if (showIcon && !image) return false;
    const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const cells = Math.max(1, Math.floor(opts.readoutCells));

    if (showIcon) {
        // Kind icon (16x16) at the top of the footprint.
        ctx.drawImage(image as CanvasImageSource, origin.x, origin.y, CELL, CELL);
    }

    // Readout rectangle right of the icon (or at the origin when no icon):
    // 1px #c1812e outer border, 1px black inner border, black fill.
    const rx = origin.x + (showIcon ? CELL : 0);
    const ry = origin.y;
    const rw = cells * CELL;
    const rh = CELL;
    ctx.fillStyle = "#da9c0a"; // outer border
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = "#edab11"; // inner border
    ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.fillStyle = "#000000"; // background
    ctx.fillRect(rx + 2, ry + 2, rw - 4, rh - 4);
    // Text: center-left inside the rectangle, color #edab11.
    ctx.font = "9px monospace";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(opts.text, rx + rw / 2, ry + rh / 2, rw - 12);
    ctx.restore();
    return true;
}

/**
 * Shared custom draw for a buffer-controls structure: the kind icon at the top
 * of the footprint plus a readout rectangle (1px #c1812e border, black fill)
 * with `text` inside. Both registers render through this, so the visual
 * language stays consistent while each register only picks the text to show.
 */
export function drawBorder(
    structure: { x: number; y: number },
    render: { ctx?: CanvasRenderingContext2D },
    color: string,
    tileWidth: number,
): boolean {
    const ctx = render?.ctx;
    if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
    const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Readout rectangle right of the icon:
    // 1px #c1812e outer border, 1px black inner border, black fill.
    const rx = origin.x;
    const ry = origin.y;
    const rw = tileWidth * CELL;
    const rh = CELL;
    ctx.strokeStyle = adjustHSL(color, { l: -80 });
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.strokeStyle = color; // outer border
    ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.restore();
    return true;
}
