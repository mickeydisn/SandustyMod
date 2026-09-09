/**
 * Register buffer-action structures ("action" category).
 *
 * These are clickable buttons the player places then activates:
 *   - +1 / -1 for each number path,
 *   - toggle for each bool path.
 *
 * Activation is wired through the signals interactable handler (docs_tech/13 §B3,
 * 14 §cheat-sheet): the engine draws a hover highlight around the structure and
 * cancels the default action for us. On click we read the current buffer value,
 * apply the op, write it back through the buffer (setPath + commit), which
 * triggers the value-structure refresh so every placed value structure updates
 * immediately.
 *
 * Signal model (check the bundle): `registerSenderType(type, getter)` only
 * registers *how* the output is computed — the getter is read when a wire is
 * first linked (bundle 63873). The propagation pass (`v(e)` on frame:update)
 * reads only the **cached** `link.on` value and never re-invokes the getter,
 * so a live sender must *push* its output through `signals.setAll(cell, on)`
 * whenever it changes (bundle 63921-63936) — this sets every outgoing link's
 * `.on` and marks each receiver dirty for re-application. This is exactly what
 * every vanilla signal device does. So we:
 *   1. register the getter (the "how"),
 *   2. on buffer change, call `setAll` for every placed action structure (the
 *      "when") — event-driven, no per-frame polling.
 *
 * The bound path + op travel in defaultData so copier duplicates keep working.
 */
import "@sandmd/sandkit";
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import { buildSectionTooltips, makeShape, sectionBuild } from "../shared.ts";
import { StructureLike } from "../../../../mysandkit/src/structure.ts";
import {
    ActionCatalogueItem,
    ActionOp,
    ActionRead,
    ActionRegisterResult,
    ActionWrite,
    applyAction,
} from "./actionRegister.ts";

export function registerActionNumberStructures(
    list: BuildList,
    spriteFor: (item: CatalogueItem) => string | undefined,
    read: ActionRead,
    write: ActionWrite,
): ActionRegisterResult {
    const modId = list.modId;
    const actionItems: { typeId: string; path: string }[] = [];

    const act = (structure: StructureLike, op: ActionOp): void => {
        const p = structure.data?.path;
        if (typeof p !== "string" || p.length === 0) return;
        write(p, applyAction(op, read(p)));
    };

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        _render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        // TODO:  need to move :
        const d = read(structure.data?.path as string);
        sandkit.api.structures.setSpritesheetIndexAtCell(
            structure.x,
            structure.y,
            d ? 1 : 0,
        );
        return false;
    };

    for (const item of list.catalogueItems as ActionCatalogueItem[]) {
        if (!item.tags?.includes("action")) continue;

        const typeId = list.structureType(item.id);
        const spriteId = spriteFor(item) ?? typeId;
        const op = item.action ?? "inc";
        const path = item.path ?? item.id;

        actionItems.push({ typeId, path });

        sandkit.api.structures.register({
            id: typeId,
            categoryKey: "blocks",
            name: item.label,
            description: item.description,
            hideFromBuildMenu: true,
            shape: makeShape(1, 1),
            ...sectionBuild.single(typeId),
            ...buildSectionTooltips(),
            render: {
                imageName: spriteId,
                size: { width: 16, height: 16 },
            },
            copyData: true,
            defaultData: { path, kind: item.kind ?? "string", op },
            draw,
        });

        // Click-to-activate:
        sandkit.api.signals?.interactables?.register?.(typeId, (structure) => {
            act(structure, op);
        });
    }

    console.log(`[${modId}] registered action structures (${actionItems.length} types)`);
    return { refreshSignals: () => {} };
}
