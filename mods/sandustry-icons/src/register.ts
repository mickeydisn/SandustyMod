/**
 * Register decorative icon structures with aligned draw + copyData.
 */

import { buildCustumDraw, buildStructureDefinition } from "@sandmd/catalogue";
import type { BuildList } from "@sandmd/catalogue";

const MENU_OBJECT_ID = "icons";

const MIRROR_SUFFIX = "~mirrored";

function structureTypeFor(modId: string, itemId: string, mirrored = false): string {
    return `${modId}:item/${itemId}${mirrored ? MIRROR_SUFFIX : ""}`;
}

export function registerIconStructures(
    buildList: BuildList,
    spriteIds: Record<string, string>,
): void {
    const modId = buildList.modId;

    for (const item of buildList.catalogueItems) {
        for (const mirrored of [false, true]) {
            const typeId = structureTypeFor(modId, item.id, mirrored);
            const isMenu = !mirrored && item.id == MENU_OBJECT_ID;
            const spriteId = spriteIds[item.id] ?? typeId;

            const def = buildStructureDefinition({
                id: typeId,
                name: item.label,
                spriteId,
                renderSize: { width: item.width, height: item.height },
                def: {
                    nameKey: isMenu ? item.label : undefined,
                    description: isMenu ? item.description : undefined,
                    categoryKey: "blocks",
                    order: 0,
                    buildModes: [
                        { type: "single" },
                        { type: "line", directions: ["horizontal", "vertical"] },
                        { type: "rectangle" },
                    ],
                },
                defaultData: {
                    itemId: item.id,
                    mirrored,
                    align: item.align ?? "floor",
                    width: item.width,
                    height: item.height,
                    spriteId,
                },
            });

            const custumDraw = buildCustumDraw(item);

            sandkit.api.structures.register({
                // alwaysUnlocked: true,
                // rejectWhenBlocked: false,
                hideFromBuildMenu: false,
                ...def,
                draw: custumDraw,
            });
            if (isMenu) {
                sandkit.api.player.buildings.unlockByType(typeId);
            }
        }
    }
}
