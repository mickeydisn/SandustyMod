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
import { ActionRegisterResult } from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";

export function registerMenuStructures(ops: registerStructureOps): ActionRegisterResult | void {
    // The catalogue marks the picker entry with category "menu" (its tags are
    // "variables", so don't dispatch it to the variables register).
    if (ops.item.category !== "menu") return;

    // Menu entry keeps the legacy 8-cell readout + icon.
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
        ...buildMenuRender(ops.item, ops.item.spriteId),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item, ops.item.spriteId, {}),
        draw,
    });

    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);
}
