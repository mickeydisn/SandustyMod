/** */
import "@sandmd/sandkit";
import { buildSectionData, buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import { ActionRegisterResult } from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";
import { drawBorder, drawIconAndReadout } from "../render.ts";

export function registerPathStructures(ops: registerStructureOps): ActionRegisterResult | void {
    // Real bound paths are tagged "variables"; the picker menu also carries that
    // tag, so skip it here (the menu module owns category "menu").
    if (!ops.item.tags?.includes("variables") || ops.item.category === "menu") return;

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        drawIconAndReadout(structure, render, {
            spriteId: ops.item.spriteId,
            // Path structure: the readout shows the bound jsonBuffer path.
            text: String(structure.data?.path ?? ops.item.label ?? ops.item.id),
        });
        drawBorder(structure, render, ops.item.color, 9);
        return true;
    };

    sandkit.api.structures.register({
        id: ops.typeId,
        categoryKey: "blocks",
        name: ops.item.label,
        description: `${ops.item.kind ?? "string"} — linked to jsonBuffer path "${
            ops.item.path ?? ops.item.id
        }".`,
        hideFromBuildMenu: true,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item, ops.item.spriteId),
        draw,
    });
    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);
}
