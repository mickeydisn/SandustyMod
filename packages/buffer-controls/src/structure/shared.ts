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
import type { CatalogueItem } from "@sandmd/catalogue";
import type { FieldKind } from "@sandmd/buffer";

export type { FieldKind };

/** Extra fields we attach to catalogue items generated from the JsonBuffer. */
export interface PathCatalogueItem extends CatalogueItem {
    kind?: FieldKind;
    /**
     * Real jsonBuffer path when the catalogue id is a *prefixed* display id
     * (e.g. the value registry uses `id = "value:volume"`, `path = "volume"`).
     * Falls back to `id` when omitted (the variables registry).
     */
    path?: string;
}

/** Kinds that produce a placeable structure (arrays/objects excluded for now). */
export const EXPOSED_KINDS: FieldKind[] = ["bool", "number", "string"];

/**
 * Convert a `listPaths` array-template path ("players[].name") into a real,
 * readable/writable path that targets the *first* element ("players[0].name").
 *
 * For arrays, listPaths summarizes the first element's shape and reports a "[]"
 * template — but getPath("players[].name") reads `players.name` (undefined),
 * while getPath("players[0].name") reads the first player's name ("Bob"). Binding
 * to index 0 is what makes array-derived values display and update correctly.
 */
export function resolveBindingPath(path: string): string {
    return path.replace(/\[\]/g, "[0]");
}

/** Pixels per world cell. */
export const CELL = 16;
/** Height of the readout rectangle. */
export const STRUCT_H = 16;
/** Width of the readout rectangle right of the icon (5 cells). */
export const RECT_W = 5 * 16;

/** Build the empty footprint shape for a width×height cell structure. */
export const makeShape = (x: number, y: number): number[][] =>
    Array.from({ length: x * 4 }, () => Array(y * 4).fill(0));

/**
 * Shared data payload carried by every buffer-controls structure instance.
 * `path` travels in defaultData so copier duplicates keep the binding. Optional
 * `extra` lets a register bake more fields (e.g. the value register's
 * `dataValue`).
 */
export function buildSectionData(
    item: PathCatalogueItem,
    spriteId: string,
    extra: Record<string, unknown> = {},
) {
    return {
        copyData: true,
        defaultData: {
            path: item.path ?? item.id,
            kind: item.kind ?? "string",
            spriteId,
            ...extra,
        },
    };
}

/** Tooltip shown while hovering a buffer-controls structure. */
export function buildSectionTooltips(): Record<string, unknown> {
    return {
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                // Generic "{field}: {field}" template — shows the bound
                // jsonBuffer path and its kind while hovering the structure.
                messageKey: "{material}: {amount}",
                fields: [
                    { param: "material", field: "path", fallback: "Unbound" },
                    { param: "amount", field: "kind", fallback: "string" },
                ],
            },
        },
    };
}

/** Menu entry render block (only applied to the unlocked menu structure). */
export function buildMenuRender(
    item: PathCatalogueItem,
    spriteId: string,
): Record<string, unknown> {
    return {
        render: {
            imageName: spriteId,
            size: { width: item.width, height: item.height },
            outline: true,
            ui: {
                imageName: spriteId,
                width: item.width,
                height: item.height,
                outline: true,
            },
        },
    };
}

/** Resolve the sprite id to a loaded canvas image, or undefined if not ready. */
function loadImage(spriteId: string): unknown {
    return sandkit.api.sprites?.getById(spriteId)?.imageAsset?.image;
}

export interface ReadoutOptions {
    spriteId: string;
    /** Text painted inside the readout rectangle. */
    text: string;
}

/**
 * Shared custom draw for a buffer-controls structure: the kind icon at the top
 * of the footprint plus a readout rectangle (1px #c1812e border, black fill)
 * with `text` inside. Both registers render through this, so the visual
 * language stays consistent while each register only picks the text to show.
 */
export function drawIconAndReadout(
    structure: { x: number; y: number; data: Record<string, unknown> },
    render: { ctx?: CanvasRenderingContext2D },
    opts: ReadoutOptions,
): boolean {
    const ctx = render?.ctx;
    if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
    const image = loadImage(opts.spriteId);
    if (!image) return false;
    const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Kind icon (16x16) at the top of the footprint.
    ctx.drawImage(image as CanvasImageSource, origin.x, origin.y, CELL, CELL);

    // Readout rectangle right of the icon:
    // 1px #c1812e outer border, 1px black inner border, black fill.
    const rx = origin.x + CELL;
    const ry = origin.y;
    const rw = RECT_W;
    const rh = STRUCT_H;
    ctx.fillStyle = "#000000"; // outer border
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = "#c1812e"; // inner border
    ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.fillStyle = "#000000"; // background
    ctx.fillRect(rx + 2, ry + 2, rw - 4, rh - 4);
    // Text: center-left inside the rectangle, color #c1812e.
    ctx.font = "9px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#c1812e";
    ctx.fillText(opts.text, rx + 6, ry + rh / 2, rw - 12);
    ctx.restore();
    return true;
}
