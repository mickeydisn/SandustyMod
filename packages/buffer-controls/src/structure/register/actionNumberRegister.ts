/**
 * Number action structures — the +1 / -1 buttons for each number path.
 *
 * Only handles catalogue items tagged `action` of kind `number`; the boolean
 * toggle buttons live in `actionBooleanRegister.ts`. Like the boolean module it
 * registers a signal sender (the "how"), wires click-to-activate, and returns a
 * `refreshSignals` so the aggregator can push every placed number-action cell's
 * output on each buffer commit (the "when").
 */
import "@sandmd/sandkit";

import type { StructureLike } from "@sandmd/shared";
import {
    type ActionRegisterResult,
    applyAndPush,
    pathOf,
    refreshActionSignals,
    signalFor,
} from "./actionRegister.ts";
import { buildSectionData, buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import type { registerStructureOps } from "../register.ts";
import { drawBorder } from "../render.ts";

export function registerActionNumberStructures(
    ops: registerStructureOps,
): ActionRegisterResult {
    // Only number-paths carry +1 / -1 actions.
    const op = ops.item.action;
    if (op === undefined || op === "toggleNum" || op === "toggleRate") return;
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
    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);

    // Click-to-activate:
    sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
        applyAndPush(ops.read, ops.write, structure, op);
    });

    // Register how the signal is computed (the "how"); the engine seeds a freshly
    // linked wire with this value.
    sandkit.api.signals?.registerSenderType(
        ops.typeId,
        (structure: StructureLike) => signalFor(ops.read, structure),
    );

    // Event-driven "when": recompute + push every placed number-action structure.
    return () => refreshActionSignals(ops.read, ops.typeId);
}
