/** */
import "@sandmd/sandkit";
import {
    buildSectionTooltips,
    buildValueSectionData,
    makeShape,
    sectionBuild,
} from "../defBuilders.ts";
import type { registerStructureOps } from "../register.ts";
import type { FieldKind } from "../../types.ts";
import { drawBorder, drawIconAndReadout, readoutTileWidth } from "../render.ts";

/** One registered value structure: its type id maps back to a buffer path. */
export interface ValueStructureEntry {
    typeId: string;
    path: string;
    kind: FieldKind;
}

/** Format the raw buffer value for the readout rectangle. */
export function formatBufferValue(value: unknown, kind: FieldKind): string {
    if (kind === "string") {
        if (typeof value !== "string") {
            throw new Error(`Expected string buffer value, received ${typeof value}.`);
        }
        return value;
    }
    if (kind === "number") {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(`Expected finite number buffer value, received ${String(value)}.`);
        }
        return String(value);
    }
    if (kind === "bool") {
        if (typeof value !== "boolean") {
            throw new Error(`Expected boolean buffer value, received ${typeof value}.`);
        }
        return String(value);
    }
    throw new Error(`Unsupported buffer field kind: ${kind}.`);
}

export function registerValueStructures(ops: registerStructureOps): ValueStructureEntry {
    const kind = ops.item.kind;
    const path = ops.item.path;
    const value = formatBufferValue(ops.read(path), kind);
    const readoutCells = ops.item.readoutCells;
    const showIcon = ops.item.showIcon;
    const tileWidth = readoutTileWidth({ readoutCells, showIcon });

    const draw = (
        _state: unknown,
        structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
        render: { ctx?: CanvasRenderingContext2D },
    ): boolean => {
        const liveValue = structure.data?.dataValue;
        drawIconAndReadout(structure, render, {
            spriteId: ops.item.spriteId,
            // Value structure: the readout shows the last buffer value,
            // refreshed on every buffer update via setData({ dataValue }).
            text: typeof liveValue === "string" ? liveValue : value,
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
        ...buildValueSectionData(path, value),
        draw,
    });
    // Unlock the buildings
    sandkit.api.player.buildings.unlockByType(ops.typeId);

    return { typeId: ops.typeId, path, kind };
}
