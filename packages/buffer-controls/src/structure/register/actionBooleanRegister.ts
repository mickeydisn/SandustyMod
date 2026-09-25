/** */
import "@sandmd/sandkit";
import { buildSectionData, buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import type { StructureLike } from "@sandmd/shared";
import {
    type ActionRegisterResult,
    applyAndPush,
    pathOf,
    refreshActionSignals,
    signalFor,
} from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";
import { drawBorder } from "../render.ts";

export function registerBooleanActionStructures(
    ops: registerStructureOps,
): ActionRegisterResult {
    const op = ops.item.action;
    if (op === undefined || op === "toggleRate") return;
    const path = ops.item.path;

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        const structurePath = pathOf(structure);
        if (structurePath === undefined) return false;
        const value = ops.read(structurePath);
        sandkit.api.structures.setSpritesheetIndexAtCell(
            structure.x,
            structure.y,
            value ? 1 : 0,
        );
        drawBorder(structure, render, ops.item.color, 1);
        return false;
    };

    sandkit.api.structures.register({
        id: ops.typeId,
        categoryKey: "blocks",
        name: ops.item.label,
        description: ops.item.description,
        hideFromBuildMenu: true,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildSectionTooltips(),
        render: {
            imageName: ops.item.spriteId,
            size: { width: 16, height: 16 },
        },
        ...buildSectionData(path),
        draw,
    });
    sandkit.api.player.buildings.unlockByType(ops.typeId);

    sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
        applyAndPush(ops.read, ops.write, structure, op);
    });
    sandkit.api.signals?.registerSenderType(
        ops.typeId,
        (structure: StructureLike) => signalFor(ops.read, structure),
    );

    return () => refreshActionSignals(ops.read, ops.typeId);
}
