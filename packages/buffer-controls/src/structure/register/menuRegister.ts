/** */
import "@sandmd/sandkit";
import {
    buildMenuRender,
    buildSectionData,
    buildSectionTooltips,
    drawIconAndReadout,
    makeShape,
    sectionBuild,
} from "../shared.ts";
import { ActionRegisterResult } from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";

export type { PathCatalogueItem } from "../shared.ts";

export function registerMenuStructures(ops: registerStructureOps): ActionRegisterResult | void {
    // The catalogue marks the picker entry with category "menu" (its tags are
    // "variables", so don't dispatch it to the variables register).
    if (ops.item.category !== "menu") return;
    const spriteId = ops.spriteFor(ops.item) ?? ops.typeId;

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean =>
        drawIconAndReadout(structure, render, {
            spriteId,
            // Path structure: the readout shows the bound jsonBuffer path.
            text: String(structure.data?.path ?? ops.item.label ?? ops.item.id),
        });

    sandkit.api.structures.register({
        id: ops.typeId,
        categoryKey: "blocks",
        name: ops.item.label,
        description: ops.item.description,
        hideFromBuildMenu: false,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildMenuRender(ops.item, spriteId),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item, spriteId),
        draw,
    });

    // Unlock the buildings ( show in the menu )
    sandkit.api.player.buildings.unlockByType(ops.typeId);
}
