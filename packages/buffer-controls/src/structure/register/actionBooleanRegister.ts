/** */
import "@sandmd/sandkit";
import { buildSectionTooltips, makeShape, sectionBuild } from "../shared.ts";
import type { StructureLike } from "../../../../mysandkit/src/structure.ts";
import { type ActionOp, ActionRegisterResult, applyAction } from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";

export function registerBooleanActionStructures(
    ops: registerStructureOps,
): ActionRegisterResult | void {
    // Only boolean-paths carry a toggle action.
    if (!ops.item.tags?.includes("action") || ops.item.kind !== "bool") return;

    const actionItems: { typeId: string; path: string }[] = [];

    // How the signal output is derived from the buffer (the "how"). Registered
    // via registerSenderType so the engine can seed a freshly linked wire with
    // the right `.on` (bundle 63873), and reused by push() below. Independent of
    // the per-item op/sprite, so it is defined once for all action types.
    const computeSignal = (structure: StructureLike): boolean => {
        const p = structure.data?.path;
        if (typeof p !== "string" || p.length === 0) return false;
        return ops.read(p) ? true : false;
    };

    // Push-a-change helper: drive a sender cell's output to `on`, updating every
    // outgoing link and marking receivers dirty (setAll, bundle 63921-63936).
    // This is what makes receivers recompute their combined value next frame.
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
        const d = ops.read(structure.data?.path as string);
        sandkit.api.structures.setSpritesheetIndexAtCell(
            structure.x,
            structure.y,
            d ? 1 : 0,
        );
        return false;
    };
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

    // Click-to-activate: engine draws hover highlight + cancels the default
    // action (docs_tech/14 Q7). `structure` has live data for this instance.
    // After writing to the buffer we immediately push the new output so the
    // click alone updates the signal (the vanilla switch does the same).
    sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
        act(structure, op);
    });

    // Register how the signal is computed (the "how"). The engine invokes
    // this when a wire is linked to that cell.
    sandkit.api.signals?.registerSenderType(ops.typeId, (s: StructureLike) => computeSignal(s));

    // Event-driven "when": recompute + push for every placed action structure.
    // Not per-frame polling — callers invoke this on each buffer commit.
    const refreshSignals = (): void => {
        for (const a of actionItems) {
            sandkit.api.structures.forEachOfType(a.typeId, (structure) => {
                pushSignal(structure);
            });
        }
    };
    return { refreshSignals };
}
