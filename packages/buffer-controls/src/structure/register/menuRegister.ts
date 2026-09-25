/** */
import "@sandmd/sandkit";
import {
    buildMenuRender,
    buildSectionData,
    buildSectionTooltips,
    makeShape,
    sectionBuild,
} from "../defBuilders.ts";
import { drawBorder, drawIconAndReadout, readoutTileWidth } from "../render.ts";
import type { registerStructureOps } from "../register.ts";

export function registerMenuStructures(ops: registerStructureOps): void {
    // The menu entry owns its own readout layout.
    const readoutCells = ops.item.readoutCells;
    const showIcon = ops.item.showIcon;
    const tileWidth = readoutTileWidth({ readoutCells, showIcon });

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        drawIconAndReadout(structure, render, {
            spriteId: ops.item.spriteId,
            // Path structure: the readout shows the bound jsonBuffer path.
            text: ops.item.path,
            readoutCells,
            showIcon,
        });
        drawBorder(structure, render, ops.item.color, tileWidth);
        return true;
    };

    sandkit.api.structures.register({
        id: ops.typeId,
        categoryKey: "blocks",
        name: ops.item.label,
        description: ops.item.description,
        hideFromBuildMenu: false,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildMenuRender(ops.item),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item.path),
        draw,
    });

    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);
}
