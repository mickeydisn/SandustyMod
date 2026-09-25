/** */
import "@sandmd/sandkit";
import { buildSectionData, buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import type { registerStructureOps } from "../register.ts";
import { drawBorder, drawIconAndReadout, readoutTileWidth } from "../render.ts";

export function registerPathStructures(ops: registerStructureOps): void {
    // Path readouts stay wide (paths are long) — overridable via `readoutCells`
    // on the catalogue item; `showIcon` toggles the kind icon.
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
        description: `${ops.item.kind} — linked to jsonBuffer path "${ops.item.path}".`,
        hideFromBuildMenu: true,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item.path),
        draw,
    });
    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);
}
