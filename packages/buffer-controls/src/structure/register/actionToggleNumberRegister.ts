/**
 * Sign-toggle number actions — the "±" button for each number path.
 *
 * Same wiring as the boolean toggle (`actionBooleanRegister.ts`), but the art
 * is a 3-frame spritesheet selected from the current value:
 *   frame 0 = `0`, frame 1 = `> 0`, frame 2 = `< 0` (default
 * `assets/types/tognum.png`; mods may override it per path with their own
 * `tag`-matched entry, e.g. `assets/buffers/tognum-*.png`).
 *
 * Clicking writes `0` when the value is `0` (nothing to flip) and `-value`
 * otherwise — the mutation itself lives in `applyAction("toggleNum", …)`.
 */
import "@sandmd/sandkit";
import { buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import type { StructureLike } from "@sandmd/shared";
import { ActionRegisterResult, applyAction } from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";
import { drawBorder } from "../render.ts";

/** Spritesheet frame for a number value: 0 neutral, `> 0` green, `< 0` red. */
export function toggleNumberFrame(value: unknown): number {
    const n = Number(value) || 0;
    return n === 0 ? 0 : n > 0 ? 1 : 2;
}

export function registerActionToggleNumberStructures(
    ops: registerStructureOps,
): ActionRegisterResult | void {
    // Only the sign-toggle op of number paths is owned here; the +1 / -1
    // buttons belong to actionNumberRegister.ts.
    if (!ops.item.tags?.includes("action") || ops.item.kind !== "number") return;
    if (ops.item.action !== "toggleNum") return;

    const actionItems: { typeId: string; path: string }[] = [];

    // How the signal output is derived from the buffer (the "how") — non-zero
    // values drive the sender output high, exactly like the other actions.
    const computeSignal = (structure: StructureLike): boolean => {
        const p = structure.data?.path;
        if (typeof p !== "string" || p.length === 0) return false;
        return ops.read(p) ? true : false;
    };

    // Push a change: drive the sender cell output so outgoing links update and
    // receivers re-apply it next frame.
    const pushSignal = (structure: StructureLike): void => {
        sandkit.api.signals?.setOutputAtCell?.(structure.x, structure.y, computeSignal(structure));
    };

    const act = (structure: StructureLike): void => {
        const p = structure.data?.path;
        if (typeof p !== "string" || p.length === 0) return;
        ops.write(p, applyAction("toggleNum", ops.read(p)));
        pushSignal(structure);
    };

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        // Live sign → spritesheet frame (0 / >0 / <0).
        const d = ops.read(structure.data?.path as string);
        sandkit.api.structures.setSpritesheetIndexAtCell(
            structure.x,
            structure.y,
            toggleNumberFrame(d),
        );
        drawBorder(structure, render, ops.item.color, 1);
        return false;
    };

    const op = "toggleNum" as const;
    const path = ops.item.path;

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
            imageName: ops.item.spriteId,
            size: { width: 16, height: 16 },
        },
        copyData: true,
        defaultData: { path, kind: ops.item.kind ?? "number", op },
        draw,
    });
    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);

    // Click-to-activate: flips the sign of the bound buffer path.
    sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
        act(structure);
    });

    // Register how the signal is computed (the "how").
    sandkit.api.signals?.registerSenderType(ops.typeId, (s: StructureLike) => computeSignal(s));

    // Event-driven "when": recompute + push every placed sign-toggle structure.
    return {
        refreshSignals: (): void => {
            for (const a of actionItems) {
                sandkit.api.structures.forEachOfType(a.typeId, (structure: StructureLike) => {
                    pushSignal(structure);
                });
            }
        },
    };
}
