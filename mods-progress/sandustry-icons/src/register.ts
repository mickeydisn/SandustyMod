/**
 * Register decorative icon structures with aligned draw + copyData.
 */

import {
    buildCustomDraw,
    buildStructureDefinition,
    makeShape,
    typeOfCatalogueItem,
} from "@sandmd/catalogue";
import type { BuildList } from "@sandmd/catalogue";

const MENU_OBJECT_ID = "icons";

export function registerIconStructures(
    buildList: BuildList,
    spriteIds: Record<string, string>,
): void {
    const modId = buildList.modId;

    for (const item of buildList.catalogueItems) {
        for (const mirrored of [false, true]) {
            const typeId = typeOfCatalogueItem(modId, item.id, mirrored);
            const isMenu = !mirrored && item.id == MENU_OBJECT_ID;
            const spriteId = spriteIds[item.id];
            if (typeof spriteId !== "string") {
                throw new Error(`Icon sprite "${item.id}" was not loaded.`);
            }

            const def = buildStructureDefinition({
                id: typeId,
                name: item.label,
                def: {
                    nameKey: isMenu ? item.label : undefined,
                    description: isMenu ? item.description : undefined,
                    categoryKey: "blocks",
                    hideFromBuildMenu: !isMenu,
                    order: 0,
                    shape: makeShape(Math.round(item.width / 4), Math.round(item.height / 4)),
                    render: {
                        imageName: spriteId,
                        size: { width: item.width, height: item.height },
                    },
                    variants: [{ id: typeId, angles: [0] }],
                    buildModes: [
                        { type: "single" },
                        { type: "line", directions: ["horizontal", "vertical"] },
                        { type: "rectangle" },
                    ],
                },
                defaultData: {
                    itemId: item.id,
                    mirrored,
                    align: item.align,
                    width: item.width,
                    height: item.height,
                    spriteId,
                },
            });

            const customDraw = buildCustomDraw(item, spriteId);

            sandkit.api.structures.register({
                // alwaysUnlocked: true,
                // rejectWhenBlocked: false,
                ...def,
                draw: customDraw,
            });
            if (isMenu) {
                sandkit.api.player.buildings.unlockByType(typeId);
            }
        }
    }
}
