/**
 * Toggle number actions — the sign toggle (`toggleNum`) and the rate stepper
 * (`toggleRate`) for each number path.
 *
 * Same wiring as the boolean toggle (`actionBooleanRegister.ts`), but the art
 * is a value-selected spritesheet:
 *   - `toggleNum`: always 3 frames — 0 = `0`, 1 = `> 0`, 2 = `< 0`
 *     (default `assets/types/tognum.png`; mods may override it per path with
 *     their own `tag`-matched entry, e.g. `assets/buffers/tognum-*.png`).
 *     Clicking writes `0` when the value is `0` and `-value` otherwise.
 *   - `toggleRate`: any N-frame `tognum-*-rate.png` following the N-frame
 *     rule — frame 0 is `<= 0`, the last frame is `>= 100`, and the `N - 2`
 *     middle frames split `(0, 100)` evenly (6 frames: `<=0` / `>0` /
 *     `>=25` / `>=50` / `>=75` / `>=100`; 7 frames: `<=0` / `>0` / `>=20` /
 *     `>=40` / `>=60` / `>=80` / `>=100`). The frame count comes from the
 *     matched sprite entry's `frames`; clicking cycles the
 *     sheet's stops, wrapping back to 0 past 100.
 *
 * Each toggle exists only where the mod's sprite config declares it — a
 * number has no toggle behaviour by default. Both mutations live in
 * `applyAction(…)` (`./actionRegister.ts`).
 */
import "@sandmd/sandkit";
import { buildSectionData, buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import type { StructureLike } from "@sandmd/shared";
import {
    type ActionRegisterResult,
    applyToggleAndPush,
    pathOf,
    refreshActionSignals,
    signalFor,
    toggleRateFrame,
} from "./actionRegister.ts";
import type { registerStructureOps } from "../register.ts";
import { drawBorder } from "../render.ts";

/** Spritesheet frame for a number value: 0 neutral, `> 0` green, `< 0` red. */
export function toggleNumberFrame(value: unknown): number {
    const n = Number(value) || 0;
    return n === 0 ? 0 : n > 0 ? 1 : 2;
}

export function registerActionToggleNumberStructures(
    ops: registerStructureOps,
): ActionRegisterResult {
    // Only the toggle ops of number paths are owned here; the +1 / -1 / ±10
    // buttons belong to actionNumberRegister.ts.
    const op = ops.item.action;
    if (op !== "toggleNum" && op !== "toggleRate") return;
    const path = ops.item.path;
    let frames: number;
    if (ops.item.action === "toggleRate") {
        if (ops.item.frames === undefined) {
            throw new Error(`Rate action for "${path}" must declare a frame count.`);
        }
        frames = ops.item.frames;
    } else {
        frames = 3;
    }

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
            op === "toggleRate" ? toggleRateFrame(value, frames) : toggleNumberFrame(value),
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

    // Click-to-activate: applies the toggle op to the bound buffer path.
    sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
        applyToggleAndPush(ops.read, ops.write, structure, op, frames);
    });

    // Register how the signal is computed (the "how").
    sandkit.api.signals?.registerSenderType(
        ops.typeId,
        (structure: StructureLike) => signalFor(ops.read, structure),
    );

    // Event-driven "when": recompute + push every placed sign-toggle structure.
    return () => refreshActionSignals(ops.read, ops.typeId);
}
