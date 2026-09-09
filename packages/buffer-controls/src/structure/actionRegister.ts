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
 * The bound path + op travel in defaultData so copier duplicates keep working.
 */
import "@sandmd/sandkit";
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import type { FieldKind } from "./shared.ts";
import { buildSectionTooltips, makeShape, sectionBuild } from "./shared.ts";
import { StructureLike } from "../../../mysandkit/src/structure.ts";

export type ActionOp = "inc" | "dec" | "toggle";

export interface ActionCatalogueItem extends CatalogueItem {
    action?: ActionOp;
    /** Real jsonBuffer path this action writes to (already index-resolved). */
    path?: string;
    kind?: FieldKind;
}

/** Read the current buffer value for a path. */
export type ActionRead = (path: string) => unknown;
/** Write a new value to the buffer and publish/commit it. */
export type ActionWrite = (path: string, value: unknown) => void;

/** Label shown in the picker / tooltip for each op. */
export const ACTION_LABEL: Record<ActionOp, string> = {
    inc: "+1",
    dec: "-1",
    toggle: "toggle",
};

/** Compute the buffer mutation for an op given the current value. */
export function applyAction(op: ActionOp, current: unknown): unknown {
    switch (op) {
        case "inc":
            return (Number(current) || 0) + 1;
        case "dec":
            return (Number(current) || 0) - 1;
        case "toggle":
            return !current;
    }
}

export function registerActionStructures(
    list: BuildList,
    spriteFor: (item: CatalogueItem) => string | undefined,
    read: ActionRead,
    write: ActionWrite,
): void {
    const modId = list.modId;

    for (const item of list.catalogueItems as ActionCatalogueItem[]) {
        if (!item.tags?.includes("action")) continue;

        const typeId = list.structureType(item.id);
        const spriteId = spriteFor(item) ?? typeId;
        const op = item.action ?? "inc";
        const path = item.path ?? item.id;

        const draw = (
            _state: unknown,
            _structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
            _render: { ctx?: CanvasRenderingContext2D },
        ): boolean => {
            const d = read(_structure.data?.path as string);
            sandkit.api.structures.setSpritesheetIndexAtCell(
                _structure.x,
                _structure.y,
                d ? 1 : 0,
            );
            return false;
        };

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

        sandkit.api.events.on("structures:placed", (payload: unknown) => {
            console.log("structures:placed", payload);
            // @ts-ignore payload
            const payloads: StructureLike[] = payload.structures as never;
            for (const p of payloads) {
                console.log("---structures:placed", p, typeId);
                if (p.type == typeId) {
                    console.log("------structures:placed Eq");
                    sandkit.api.structures.setSpritesheetIndexAtCell(
                        p.x,
                        p.y,
                        p.data.dataValue ? 1 : 0,
                    );
                }
            }
        });
        // Click-to-activate: engine draws hover highlight + cancels the default
        // action (docs_tech/14 Q7). `structure` has live data for this instance.
        sandkit.api.signals?.interactables?.register?.(typeId, (structure) => {
            const p = structure.data?.path;
            if (typeof p !== "string" || p.length === 0) return;
            write(p, applyAction(op, read(p)));
        });

        sandkit.api.signals?.targets?.register(
            typeId,
            (
                s: StructureLike,
                _payload: { combined: boolean; inputCount: number; onCount: number },
            ) => {
                console.log("Targets --- ", s);
            },
        );

        sandkit.api.signals?.registerSenderType(typeId, (s: StructureLike) => {
            const d = read(s.data?.path as string);
            return d ? true : false;
        });
    }

    console.log(`[${modId}] registered action structures`);
}
