/**
 * Shared features for the buffer-controls structure registers.
 *
 * Both the "path" register (variables category) and the "value" register (value
 * category) build their structure from the same skeleton: a kind icon plus a
 * readout rectangle. The only thing that differs between the two registers is
 * the text painted inside that rectangle — the bound jsonBuffer path
 * (variables) vs. the live buffer value (value).
 *
 * Everything the registers have in common lives here, so a change to the
 * footprint, layout, tooltip, or render behaviour updates both at once.
 */
import "@sandmd/sandkit";
import { makeShape as makeGridShape } from "@sandmd/catalogue";
import { PathCatalogueItem } from "../types.ts";

/** Build the engine's 4×4-subcell shape for a width×height cell structure. */
export const makeShape = (x: number, y: number): number[][] => makeGridShape(x * 4, y * 4);

/**
 * Convert a `listPaths` array-template path ("players[].name") into a real,
 * readable/writable path that targets the *first* element ("players[0].name").
 *
 * For arrays, listPaths summarizes the first element's shape and reports a "[]"
 * template — but getPath("players[].name") reads `players.name` (undefined),
 * while getPath("players[0].name") reads the first player's name ("Bob"). Binding
 * to index 0 is what makes array-derived values display and update correctly.
 */
export function resolveBindingPath(path: string): string {
    return path.replace(/\[\]/g, "[0]");
}

/**
 * Shared data payload carried by every buffer-controls structure instance.
 * `path` travels in defaultData so copier duplicates keep the binding. Optional
 * `extra` lets a register bake more fields (e.g. the value register's
 * `dataValue`).
 */
export function buildSectionData(
    item: PathCatalogueItem,
    spriteId: string,
    extra: Record<string, unknown>,
) {
    return {
        copyData: true,
        defaultData: {
            path: item.path,
            kind: item.kind,
            spriteId,
            ...extra,
        },
    };
}

/** Tooltip shown while hovering a buffer-controls structure. */
export function buildSectionTooltips(): Record<string, unknown> {
    return {
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                // Generic "{field}: {field}" template — shows the bound
                // jsonBuffer path and its kind while hovering the structure.
                messageKey: "{path}",
                fields: [
                    { param: "path", field: "path" },
                ],
            },
        },
    };
}

/** Menu entry render block (only applied to the unlocked menu structure). */
export function buildMenuRender(
    item: PathCatalogueItem,
    spriteId: string,
): Record<string, unknown> {
    return {
        render: {
            imageName: spriteId,
            size: { width: item.width, height: item.height },
            outline: true,
            ui: {
                imageName: spriteId,
                width: item.width,
                height: item.height,
                outline: true,
            },
        },
    };
}

/**
 * Minimal build-modes / variants block for buffer-controls structures.
 *
 * Every structure here is placed "single" (one cell, no rotation), so the three
 * registers share one definition instead of repeating the block per structure.
 */
export const sectionBuild = {
    single: (typeId: string) => ({
        buildModes: [{ type: "single" }],
        variants: [{ id: typeId, angles: [0] }],
    }),
};
