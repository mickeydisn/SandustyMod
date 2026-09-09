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

import type { StructureLike } from "@sandmd/sandkit";
import { type ActionOp, ActionRegisterResult, applyAction } from "./actionRegister.ts";
import { buildSectionTooltips, makeShape, sectionBuild } from "../shared.ts";
import type { registerStructureOps } from "../register.ts";

export function registerActionNumberStructures(
    ops: registerStructureOps,
): ActionRegisterResult | void {
    // Only number-paths carry +1 / -1 actions.
    if (!ops.item.tags?.includes("action") || ops.item.kind !== "number") return;

    // How the sender cell's output is derived from the buffer (the "how").
    const computeSignal = (structure: StructureLike): boolean => {
        const p = structure.data?.path;
        if (typeof p !== "string" || p.length === 0) return false;
        return ops.read(p) ? true : false;
    };

    // Push a change: drive the sender cell output so outgoing links update and
    // receivers re-apply it next frame (setAll, bundle 63921-63936).
    const pushSignal = (structure: StructureLike): void => {
        sandkit.api.signals?.setOutputAtCell?.(structure.x, structure.y, computeSignal(structure));
    };

    const act = (structure: StructureLike, op: ActionOp): void => {
        const p = structure.data?.path;
        if (typeof p !== "string" || p.length === 0) return;
        ops.write(p, applyAction(op, ops.read(p)));
        pushSignal(structure);
    };

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        _render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        // TODO:  need to move :
        const d = ops.read(structure.data?.path as string);
        sandkit.api.structures.setSpritesheetIndexAtCell(
            structure.x,
            structure.y,
            d ? 1 : 0,
        );
        return false;
    };

    const actionItems: { typeId: string; path: string }[] = [];

    const spriteId = ops.spriteFor(ops.item) ?? ops.typeId;
    const op = ops.item.action ?? "inc";
    const path = ops.item.path ?? ops.item.id;

    actionItems.push({ typeId: ops.typeId, path });

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
            imageName: spriteId,
            size: { width: 16, height: 16 },
        },
        copyData: true,
        defaultData: { path, kind: ops.item.kind ?? "string", op },
        draw,
    });

    // Click-to-activate:
    sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
        act(structure, op);
    });

    // Register how the signal is computed (the "how"); the engine seeds a freshly
    // linked wire with this value.
    sandkit.api.signals?.registerSenderType(ops.typeId, (s: StructureLike) => computeSignal(s));

    // Event-driven "when": recompute + push every placed number-action structure.
    return {
        refreshSignals: (): void => {
            for (const a of actionItems) {
                sandkit.api.structures.forEachOfType(a.typeId, (structure) => {
                    pushSignal(structure);
                });
            }
        },
    };
}
