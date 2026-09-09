/** */
import "@sandmd/sandkit";
import {
    buildSectionData,
    buildSectionTooltips,
    drawIconAndReadout,
    makeShape,
    sectionBuild,
} from "../shared.ts";
import { ActionRegisterResult } from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";

export type { PathCatalogueItem } from "../shared.ts";

export function registerPathStructures(ops: registerStructureOps): ActionRegisterResult | void {
    // Real bound paths are tagged "variables"; the picker menu also carries that
    // tag, so skip it here (the menu module owns category "menu").
    if (!ops.item.tags?.includes("variables") || ops.item.category === "menu") return;
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
        description: `${ops.item.kind ?? "string"} — linked to jsonBuffer path "${
            ops.item.path ?? ops.item.id
        }".`,
        hideFromBuildMenu: true,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item, spriteId),
        draw,
    });
}
