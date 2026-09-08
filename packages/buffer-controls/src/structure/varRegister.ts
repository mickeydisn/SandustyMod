/**
 * Register buffer-path structures ("variables" category).
 *
 * Every path in the JsonBuffer record becomes a placeable structure:
 *  - one single unlocked "menu" entry opens the picker (render sprite),
 *  - one structure per path, hidden from the build menu, whose custom `draw`
 *    paints the kind icon + the record path as text.
 * The path/kind travel in `defaultData` so copier duplicates keep the binding.
 *
 * The shared structure skeleton (render, tooltip, data, footprint, draw) is
 * grouped in ./shared.ts — the value register (./valueRegister.ts) reuses it.
 */
import "@sandmd/sandkit";
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import type { PathCatalogueItem } from "./shared.ts";
import {
    buildMenuRender,
    buildSectionData,
    buildSectionTooltips,
    drawIconAndReadout,
    makeShape,
} from "./shared.ts";
import { sectionBuild } from "./sectionStructure.ts";

export type { PathCatalogueItem } from "./shared.ts";

export function registerPathStructures(
    list: BuildList,
    spriteFor: (item: CatalogueItem) => string | undefined,
): void {
    const modId = list.modId;
    let count = 0;

    for (const item of list.catalogueItems as PathCatalogueItem[]) {
        // Value and action structures live in their own categories and are
        // handled by registerValueStructures() / registerActionStructures() —
        // keep them out of the path register.
        if (item.category === "value" || item.category === "action") continue;
        count++;

        const isMenu = item.id === list.menuId;
        const typeId = list.structureType(item.id);
        const spriteId = spriteFor(item) ?? typeId;

        const draw = (
            _state: unknown,
            structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
            render: { ctx?: CanvasRenderingContext2D },
        ): boolean =>
            drawIconAndReadout(structure, render, {
                spriteId,
                // Path structure: the readout shows the bound jsonBuffer path.
                text: String(structure.data?.path ?? item.label ?? item.id),
            });

        sandkit.api.structures.register({
            id: typeId,
            categoryKey: "blocks",
            name: item.label,
            description: isMenu
                ? item.description
                : `${item.kind ?? "string"} — linked to jsonBuffer path "${item.path ?? item.id}".`,
            hideFromBuildMenu: !isMenu,
            shape: makeShape(1, 1),
            ...sectionBuild.single(typeId),
            ...(isMenu ? buildMenuRender(item, spriteId) : {}),
            ...buildSectionTooltips(),
            ...buildSectionData(item, spriteId),
            draw,
        });

        if (isMenu) {
            sandkit.api.player.buildings.unlockByType(typeId);
        }
    }

    console.log(`[${modId}] registered ${count} buffer structures`);
}
