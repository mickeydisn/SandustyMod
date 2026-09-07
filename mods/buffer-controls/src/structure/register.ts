/**
 * Register buffer-path structures.
 *
 * Every path in the JsonBuffer record becomes a placeable structure:
 *  - one single unlocked "menu" entry opens the picker (render sprite),
 *  - one structure per path, hidden from the build menu, whose custom `draw`
 *    paints the kind icon (assets/types/*.png) + the record path as text.
 * The path/kind travel in `defaultData` so copier duplicates keep the binding.
 */
import "@sandmd/sandkit";
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import { sectionBuild } from "./sectionStructure.ts";

/** Extra field we attach to catalogue items generated from the JsonBuffer. */
export type FieldKind = "bool" | "number" | "string" | "array" | "object";
export interface PathCatalogueItem extends CatalogueItem {
    kind?: FieldKind;
}

/** Ids under assets/types/, loaded by main via loadSpriteMap. */
export const KIND_SPRITE_KEY: Partial<Record<FieldKind, string>> = {
    bool: "bolean",
    number: "number",
    string: "string",
};

/** Kinds that produce a placeable structure (arrays/objects excluded for now). */
export const EXPOSED_KINDS: FieldKind[] = ["bool", "number", "string"];

const CELL = 16;
/** Structure footprint: 1 cell wide × 6 cells tall (6 × 15px). */
const STRUCT_H = 16;
/** Readout rectangle right of the icon. */
const RECT_W = 5 * 16;

export function registerPathStructures(
    list: BuildList,
    spriteFor: (item: CatalogueItem) => string | undefined,
): void {
    const modId = list.modId;

    for (const item of list.catalogueItems as PathCatalogueItem[]) {
        const isMenu = item.id === list.menuId;
        const typeId = list.structureType(item.id);
        const spriteId = spriteFor(item) ?? typeId;

        const menuRender = isMenu
            ? {
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
            }
            : {};

        const sectionTooltips = {
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

        const sectionData = {
            copyData: true,
            defaultData: {
                path: item.id,
                kind: item.kind ?? "string",
                spriteId,
            },
        };

        const draw = (
            _state: unknown,
            structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
            render: { ctx?: CanvasRenderingContext2D },
        ): boolean => {
            const ctx = render?.ctx;
            if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
            const image = sandkit.api.sprites?.getById(spriteId)?.imageAsset?.image;
            if (!image) return false;
            const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // Kind icon (16x16) at the top of the 1x6 footprint.
            ctx.drawImage(image as CanvasImageSource, origin.x, origin.y, CELL, CELL);

            // Readout rectangle right of the icon, spanning the 1x6 footprint:
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

            // Path text: center-left inside the rectangle, color #c1812e.
            const path = String(structure.data?.path ?? item.label ?? item.id);
            ctx.font = "9px monospace";
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillStyle = "#c1812e";
            ctx.fillText(path, rx + 6, ry + rh / 2, rw - 12);
            ctx.restore();
            return true;
        };

        const makeShape = (x: number, y: number) =>
            Array.from({ length: x }, () => Array(y).fill(0));

        sandkit.api.structures.register({
            id: typeId,
            categoryKey: "blocks",
            name: item.label,
            description: isMenu
                ? "Buffer Controls — opens the variable picker."
                : `${item.kind ?? "string"} — linked to jsonBuffer path "${item.id}".`,
            hideFromBuildMenu: !isMenu,
            // 1 wide × 6 tall footprint ( *4 = the shape array must be).
            shape: isMenu ? makeShape(4, 4) : makeShape(1 * 4, 6 * 4),
            ...sectionBuild.single(typeId),
            ...menuRender,
            ...sectionTooltips,
            ...sectionData,
            draw,
        });

        if (isMenu) {
            sandkit.api.player.buildings.unlockByType(typeId);
        }
    }

    console.log(`[${modId}] registered ${list.catalogueItems.length} buffer structures`);
}
