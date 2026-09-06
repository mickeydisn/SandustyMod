/**
 * Register decorative icon structures with aligned draw + copyData.
 */
import "@sandmd/sandkit";
import { structureTypeFor } from "@sandmd/catalogue";
import type { BuildList } from "@sandmd/catalogue";
import { computeAlignedRect, drawImageAligned, getGridMetrics } from "@sandmd/catalogue";
import { sectionBuild } from "./sectionStructure.ts";

export interface CatalogueItem {
    id: string;
    label: string;
    category: string;
    /** Native sprite pixel size. */
    width: number;
    height: number;
    /** Sprite id after load, or file path relative to mod assets. */
    spriteId?: string;
    description?: string;
    /** Extra payload copied onto structure.data. */
    data?: Record<string, unknown>;
}

// const PX = 16;

function normalizeMenuId(menuId: string): string {
    const slash = menuId.lastIndexOf("/");
    if (slash >= 0) return menuId.slice(slash + 1);
    const colon = menuId.lastIndexOf(":");
    if (colon >= 0) return menuId.slice(colon + 1);
    return menuId;
}

const MENU_OBJECT_ID = "icons";

function registerStructure(modId: string, item: CatalogueItem, striptId: string) {
    const typeId = structureTypeFor(modId, item.id);
    const isMenuItems = item.id == MENU_OBJECT_ID;

    const spriteId = striptId ?? typeId;

    const sectionName = isMenuItems
        ? {
            name: item.label ? item.label : item.id,
            description: item.description ?? "Decorative icon. No collision.",
            nameKey: item.label ? item.label : item.id,
            descriptionKey: "structures|exampleJunction|description",
        }
        : {
            name: item.label ? item.label : item.id,
            description: item.description ?? "Decorative icon. No collision.",
        };

    const sectionRender = isMenuItems
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
                // Reuses the same message key as the solid silo - it's a
                // generic "{material}: {amount}" template, nothing solid-silo
                // specific about it.
                messageKey: "{material}: {amount}",
                fields: [
                    { param: "material", field: "siloTypeName", fallback: "Empty" },
                    { param: "amount", field: "siloCount", round: true, fallback: 0 },
                ],
            },
        },
    };

    const sectionData = {
        copyData: true,
        defaultData: {
            spriteId,
            siloTypeName: "Empty",
            siloCount: 0,
        },
    };

    const draw = (
        _state: unknown,
        structure: {
            x: number;
            y: number;
            type?: string;
            data: Record<string, unknown>;
        },
        render: { ctx?: CanvasRenderingContext2D },
    ) => {
        const ctx = render?.ctx;
        if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
        const sid = spriteId;
        const image = sandkit.api.sprites?.getById(sid)?.imageAsset?.image;
        if (!image) return false;
        const origin = sandkit.api.rendering.getDrawPositionAtCell(
            structure.x,
            structure.y,
        );
        const metrics = getGridMetrics();
        const rect = computeAlignedRect(origin, {
            align: "floor",
            spritePixels: {
                width: item.width,
                height: item.height,
            },
            mirrored: false,
        }, metrics);
        drawImageAligned(ctx, image as CanvasImageSource, rect);
        return true;
    };

    /*
      const cellsW = Math.max(1, Math.ceil(item.width / PX));
      const cellsH = Math.max(1, Math.ceil(item.height / PX));
      const shape = Array.from(
        { length: cellsH },
        () => Array.from({ length: cellsW }, () => 1),
      );
      */
    sandkit.api.structures.register({
        id: typeId,
        categoryKey: "blocks",

        ...sectionName,
        // alwaysUnlocked: true,
        // rejectWhenBlocked: false,
        hideFromBuildMenu: false,
        ...sectionBuild.single(typeId),
        ...sectionRender,
        ...sectionTooltips,
        ...sectionData,
        // shape,
        draw: draw,
    });

    if (isMenuItems) {
        sandkit.api.player.buildings.unlockByType(typeId);
    }
}

export function registerIconStructures(
    list: BuildList,
    spriteMapIds: Record<string, string>,
): void {
    const modId = list.modId;
    const menuId = normalizeMenuId(list.menuId);

    for (const item of list.catalogueItems) {
        registerStructure(modId, item, spriteMapIds[item.id]);
    }
}

export function catalogueWithFiles(
    items: Array<CatalogueItem & { file?: string }>,
): CatalogueItem[] {
    return items.map(({ ...item }) => item);
}
