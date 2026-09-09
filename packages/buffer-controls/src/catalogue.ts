/**
 * Build the buffer-controls BuildList from a jsonBuffer record.
 *
 * Every scalar path (bool / number / string) becomes a catalogue item, grouped
 * in the three category tabs:
 *   - variables — one item per path,
 *   - value     — one item per path (live readout),
 *   - action    — +1 / -1 for numbers, toggle for booleans.
 * Plus a single unlocked menu entry that opens the picker.
 *
 * `listPaths` reports array leaves as "[]" templates (e.g. "players[].name"), so
 * each bound path is resolved to index 0 via resolveBindingPath — that is what
 * makes "players[0].name" read/write the first player's name.
 */
import type { BuildList, CatalogueCategory, CatalogueItem } from "@sandmd/catalogue";
import { createBuildList } from "@sandmd/catalogue";
import type { BufferControlsConfig } from "./types.ts";
import {
    EXPOSED_KINDS,
    type FieldKind,
    type PathCatalogueItem,
    resolveBindingPath,
} from "./structure/shared.ts";
import type { ActionCatalogueItem, ActionOp } from "./structure/actionRegister.ts";
import { ACTION_LABEL } from "./structure/actionRegister.ts";

const CELL = 16;
/** Variable/value structures are 1 cell wide × 6 cells tall. */
const ITEM_HEIGHT = 6 * 15;
const VALUE_PREFIX = "value:";
const ACTION_PREFIX = "action:";

/** One bound field: an index-resolved, readable/writable jsonBuffer path. */
export interface BoundField {
    path: string;
    kind: FieldKind;
}

/** Resolve a config sprite entry id to the asset file path. */
export type FilePathFor = (spriteEntryId: string) => string;

export interface CatalogueResult {
    list: BuildList;
    /** Number of scalar paths exposed. */
    pathCount: number;
}

const menuItem = (
    menuItemId: string,
    menu: BufferControlsConfig["menu"],
    filePathFor: FilePathFor,
): CatalogueItem => ({
    id: menuItemId,
    label: menu.label,
    description: menu.description,
    category: "menu",
    tags: ["variables"],
    width: CELL,
    height: CELL,
    filePath: filePathFor(menu.spriteId),
});

const variableItem = (field: BoundField, filePathFor: FilePathFor): PathCatalogueItem => ({
    id: field.path,
    path: field.path,
    kind: field.kind,
    label: field.path,
    description: `${field.kind} — linked to jsonBuffer path "${field.path}".`,
    category: field.path,
    tags: ["variables"],
    width: CELL,
    height: ITEM_HEIGHT,
    filePath: filePathFor(field.kind),
});

const valueItem = (field: BoundField, filePathFor: FilePathFor): PathCatalogueItem => ({
    id: `${VALUE_PREFIX}${field.path}`,
    path: field.path,
    kind: field.kind,
    label: field.path,
    description: `${field.kind} — live value for jsonBuffer path "${field.path}".`,
    category: field.path,
    tags: ["value"],
    width: CELL,
    height: ITEM_HEIGHT,
    filePath: filePathFor(field.kind),
});

const actionItem = (
    field: BoundField,
    op: ActionOp,
    filePathFor: FilePathFor,
): ActionCatalogueItem => ({
    id: `${ACTION_PREFIX}${field.path}:${op}`,
    action: op,
    path: field.path,
    kind: field.kind,
    label: `${field.path} ${ACTION_LABEL[op]}`,
    description: `${ACTION_LABEL[op]} — writes jsonBuffer path "${field.path}" then commits.`,
    category: field.path,
    tags: ["action"],
    width: CELL,
    height: CELL,
    filePath: filePathFor(op),
});

const actionItemsFor = (field: BoundField, filePathFor: FilePathFor): CatalogueItem[] => {
    if (field.kind === "number") {
        return [actionItem(field, "inc", filePathFor), actionItem(field, "dec", filePathFor)];
    }
    if (field.kind === "bool") return [actionItem(field, "toggle", filePathFor)];
    return [];
};

/** Derive bound (exposed, index-resolved) paths from the buffer's listed fields. */
export function boundFields(listed: { kind?: FieldKind; path: string }[]): BoundField[] {
    return listed
        .filter((f): f is { kind: FieldKind; path: string } =>
            f.kind !== undefined && EXPOSED_KINDS.includes(f.kind)
        )
        .map((f) => ({ kind: f.kind, path: resolveBindingPath(f.path) }));
}

/** The config fields buildBufferControlList needs (record-shape independent). */
export type CatalogueConfig = Pick<
    BufferControlsConfig,
    "menu" | "categories" | "spriteFiles" | "menuItemId"
>;

export function buildBufferControlList(
    modId: string,
    bound: BoundField[],
    config: CatalogueConfig,
): CatalogueResult {
    const filePathFor: FilePathFor = (spriteEntryId) =>
        config.spriteFiles.find((f) => f.id === spriteEntryId)?.filePath ?? "";

    const categories: CatalogueCategory[] = bound.map((field) => {
        return { id: field.path, label: field.path };
    });

    /*
    [
        { id: "variables", label: config.categories.variables },
        { id: "value", label: config.categories.value },
        { id: "action", label: config.categories.action },
    ];
    */

    const menuId = config.menuItemId ?? modId;
    const items: CatalogueItem[] = [
        menuItem(menuId, config.menu, filePathFor),
        ...bound.flatMap((field) => [
            variableItem(field, filePathFor),
            valueItem(field, filePathFor),
            ...actionItemsFor(field, filePathFor),
        ]),
    ];

    const list: BuildList = createBuildList({
        modId,
        menuId,
        menuLabel: config.menu.label,
        categories,
        catalogueItems: items,
        selectedId: bound[0]?.path,
    });

    return { list, pathCount: bound.length };
}
