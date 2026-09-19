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
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import { createBuildList } from "@sandmd/catalogue";
import type {
    ActionCatalogueItem,
    ActionOp,
    BufferControlsConfig,
    FieldKind,
    PathCatalogueItem,
} from "./types.ts";
import { EXPOSED_KINDS } from "./const.ts";
import { resolveBindingPath } from "./structure/defBuilders.ts";
import { ACTION_LABEL } from "./structure/register/actionRegister.ts";

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
    buildList: BuildList;
    /** Number of scalar paths exposed. */
    pathCount: number;
}

const menuItem = (
    menuItemId: string,
    menu: BufferControlsConfig["menu"],
): PathCatalogueItem => ({
    id: menuItemId,
    label: menu.label,
    description: menu.description,
    category: "menu",
    path: "menu",
    tags: ["variables"],
    width: CELL,
    height: CELL,
    color: "#FFFFFF",
});

const variableItem = (
    field: BoundField,
): PathCatalogueItem => ({
    id: field.path,
    path: field.path,
    kind: field.kind,
    label: field.path,
    description: `${field.kind} — linked to jsonBuffer path "${field.path}".`,
    category: field.path.split(".")[1],
    tags: ["variables", ...field.path.split(".").slice(2)],
    width: CELL,
    height: ITEM_HEIGHT,
    color: "#FFFFFF",
    readoutCells: 8,
    showIcon: true,
});

const valueItem = (
    field: BoundField,
): PathCatalogueItem => {
    return {
        id: `${VALUE_PREFIX}${field.path}`,
        path: field.path,
        kind: field.kind,
        label: field.path,
        description: `${field.kind} — live value for jsonBuffer path "${field.path}".`,
        category: field.path.split(".")[1],
        tags: ["value", ...field.path.split(".").slice(2)],
        width: CELL,
        height: ITEM_HEIGHT,
        color: "#FFFFFF",
        readoutCells: 4,
        showIcon: false,
    };
};

const actionItem = (
    field: BoundField,
    op: ActionOp,
): ActionCatalogueItem => ({
    id: `${ACTION_PREFIX}${field.path}:${op}`,
    action: op,
    path: field.path,
    kind: field.kind,
    label: `${field.path} ${ACTION_LABEL[op]}`,
    description: `${ACTION_LABEL[op]} — writes jsonBuffer path "${field.path}" then commits.`,
    category: field.path.split(".")[1],
    tags: ["action", ...field.path.split(".").slice(2)],
    width: CELL,
    height: CELL,
    color: "#FFFFFF",
});

const actionItemsFor = (field: BoundField): ActionCatalogueItem[] => {
    if (field.kind === "number") {
        return [
            actionItem(field, "inc"),
            actionItem(field, "dec"),
            actionItem(field, "incX"),
            actionItem(field, "decX"),
        ];
    }
    if (field.kind === "bool") {
        return [
            actionItem(field, "toggle"),
        ];
    }
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
    "menu" | "spriteFiles" | "menuItemId" | "categories"
>;

export function buildBufferControlList(
    modId: string,
    bound: BoundField[],
    config: CatalogueConfig,
    spriteFor: (item: CatalogueItem) => string | undefined,
): CatalogueResult {
    const filePathFor: FilePathFor = (spriteEntryId) =>
        config.spriteFiles.find((f) => f.id === spriteEntryId)?.filePath ?? "";

    const menuId = config.menuItemId ?? modId;
    const items: PathCatalogueItem[] = [
        menuItem(menuId, config.menu),
        ...bound.flatMap((field) => [
            variableItem(field),
            valueItem(field),
            ...actionItemsFor(field),
        ]),
    ];

    items.forEach((item) => item.spriteId = spriteFor(item));
    items.forEach((item) => item.filePath = filePathFor(item.spriteId ?? ""));
    items.forEach((item) =>
        item.color = config.categories.find((c) => c.id == item.category)?.color ?? "#FFFFFF"
    );

    const list: BuildList = createBuildList({
        modId,
        menuId,
        menuLabel: config.menu.label,
        // categories,
        catalogueItems: items,
        selectedId: bound[0]?.path,
    });

    return { buildList: list, pathCount: bound.length };
}
