/** */
import "@sandmd/sandkit";
import { buildSectionData, buildSectionTooltips, makeShape, sectionBuild } from "../defBuilders.ts";
import type { registerStructureOps } from "../register.ts";
import type { FieldKind } from "../../types.ts";
import {
    drawBorder,
    drawIconAndReadout,
    readoutTileWidth,
    VALUE_READOUT_CELLS,
} from "../render.ts";

/** One registered value structure: its type id maps back to a buffer path. */
export interface ValueStructureEntry {
    typeId: string;
    path: string;
    kind: FieldKind;
}

/** Everything the value register produces for the aggregator. */
export interface ValueRegisterResult {
    entries: ValueStructureEntry[];
}

/** Format the raw buffer value for the readout rectangle. */
export function formatBufferValue(value: unknown, kind: FieldKind): string {
    if (kind === "string") return String(value ?? "");
    if (kind === "number") return String(value ?? 0);
    return String(value ?? false); // bool
}

export function registerValueStructures(ops: registerStructureOps): ValueRegisterResult | void {
    if (!ops.item.tags?.includes("value")) return;

    const entries: ValueStructureEntry[] = [];

    const kind = ops.item.kind ?? "string";
    const path = ops.item.path ?? ops.item.id;
    const value = formatBufferValue(ops.read(path), kind);
    // Per-kind readout width (bool: 2, number: 4, string/var: 8) — overridable
    // via `readoutCells` on the catalogue item; `showIcon` toggles the icon.
    const readoutCells = ops.item.readoutCells ?? VALUE_READOUT_CELLS[kind] ?? 8;
    const showIcon = ops.item.showIcon ?? true;
    const tileWidth = readoutTileWidth({ readoutCells, showIcon });

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        drawIconAndReadout(structure, render, {
            spriteId: ops.item.spriteId,
            // Value structure: the readout shows the last buffer value,
            // refreshed on every buffer update via setData({ dataValue }).
            text: String(structure.data?.dataValue ?? value),
            readoutCells,
            showIcon,
        });
        drawBorder(structure, render, ops.item.color, tileWidth);
        return true;
    };

    sandkit.api.structures.register({
        id: ops.typeId,
        categoryKey: "blocks",
        name: ops.item.label,
        description: `live value — linked to jsonBuffer path "${path}".`,
        hideFromBuildMenu: true,
        shape: makeShape(1, 1),
        ...sectionBuild.single(ops.typeId),
        ...buildSectionTooltips(),
        ...buildSectionData(ops.item, ops.item.spriteId, { dataValue: value }),
        draw,
    });
    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);

    entries.push({ typeId: ops.typeId, path, kind });

    return { entries };
}
