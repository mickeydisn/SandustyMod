/**
 * Register buffer-value structures ("value" category).
 *
 * These share the exact structure skeleton as the "variables" path structures
 * (kind icon + readout rectangle), but the readout paints the CURRENT value of
 * the bound jsonBuffer path instead of the path itself.
 *
 * The live value is carried on `structure.data.dataValue`. It is baked into
 * `defaultData` once at register time, then refreshed whenever the JsonBuffer
 * updates — registerBufferControls subscribes to the buffer and, inside the
 * event handler, iterates every placed value structure
 * (api.structures.forEachOfType) calling setData({ dataValue }) with the value
 * of that structure's path. The draw only ever reads
 * `structure.data.dataValue`, so it always shows the last buffer value.
 */
import "@sandmd/sandkit";
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import type { FieldKind, PathCatalogueItem } from "./shared.ts";
import { buildSectionData, buildSectionTooltips, drawIconAndReadout, makeShape } from "./shared.ts";
import { sectionBuild } from "./sectionStructure.ts";

/** One registered value structure: its type id maps back to a buffer path. */
export interface ValueStructureEntry {
    typeId: string;
    path: string;
    kind: FieldKind;
}

/** Format the raw buffer value for the readout rectangle. */
export function formatBufferValue(value: unknown, kind: FieldKind): string {
    if (kind === "string") return String(value ?? "");
    if (kind === "number") return String(value ?? 0);
    return String(value ?? false); // bool
}

export function registerValueStructures(
    list: BuildList,
    spriteFor: (item: CatalogueItem) => string | undefined,
    readValue: (path: string) => unknown,
): ValueStructureEntry[] {
    const entries: ValueStructureEntry[] = [];
    const modId = list.modId;

    for (const item of list.catalogueItems as PathCatalogueItem[]) {
        if (item.category !== "value") continue;

        const typeId = list.structureType(item.id);
        const spriteId = spriteFor(item) ?? typeId;
        const kind = item.kind ?? "string";
        const path = item.path ?? item.id;
        const value = formatBufferValue(readValue(path), kind);

        const draw = (
            _state: unknown,
            structure: { x: number; y: number; type?: string; data: Record<string, unknown> },
            render: { ctx?: CanvasRenderingContext2D },
        ): boolean =>
            drawIconAndReadout(structure, render, {
                spriteId,
                // Value structure: the readout shows the last buffer value,
                // refreshed on every buffer update via setData({ dataValue }).
                text: String(structure.data?.dataValue ?? value),
            });

        sandkit.api.structures.register({
            id: typeId,
            categoryKey: "blocks",
            name: item.label,
            description: `live value — linked to jsonBuffer path "${path}".`,
            hideFromBuildMenu: true,
            shape: makeShape(1, 1),
            ...sectionBuild.single(typeId),
            ...buildSectionTooltips(),
            ...buildSectionData(item, spriteId, { dataValue: value }),
            draw,
        });

        entries.push({ typeId, path, kind });
    }

    console.log(`[${modId}] registered ${entries.length} value structures`);
    return entries;
}
