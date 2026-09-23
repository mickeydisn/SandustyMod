/**
 * Build the buffer-controls BuildList from a jsonBuffer record.
 *
 * Every scalar path (bool / number / string) becomes a catalogue item, grouped
 * in the three category tabs:
 *   - variables — one item per path,
 *   - value     — one item per path (live readout),
 *   - action    — +1 / ±10 / sign-toggle for numbers, toggle for booleans.
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
    BufferControlsSprites,
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

/** Loaded sprite ids, keyed by `sprites[].spriteId` (from `loadSpriteMap`). */
export type SpriteIdMap = Record<string, string>;

/**
 * Resolve the sprite entry id (a `sprites[].spriteId`) for one catalogue item.
 * The first condition that fits wins:
 *   1. `itemId` — exact catalogue item id,
 *   2. `tag` — item tags include the entry's `tag` (a buffer key),
 *   3. `action` + `kind` — e.g. every number `inc` button,
 *   4. `kind` alone — the generic per-kind icon.
 * The menu entry always resolves through `menu.spriteId`.
 */
export function resolveSpriteEntry(
    sprites: BufferControlsSprites,
    item: CatalogueItem,
    menuItemId: string,
    menuSpriteId: string,
): string | undefined {
    if (item.id === menuItemId) return menuSpriteId;

    const aItem = item as ActionCatalogueItem;
    const found = sprites.find((c) => c.itemId != null && c.itemId === item.id) ??
        sprites.find((c) =>
            c.tag != null && item.tags?.includes(c.tag) &&
            (c.kind == null || c.kind === aItem.kind) &&
            (c.action == null || c.action === aItem.action)
        ) ??
        sprites.find((c) => aItem.action && c.action === aItem.action && c.kind === aItem.kind) ??
        sprites.find((c) => !c.action && c.kind === aItem.kind);

    return found?.spriteId;
}

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
            // Sign toggle: `0` stays `0`, every other value flips sign.
            actionItem(field, "toggleNum"),
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
    "menu" | "sprites" | "menuItemId" | "categories"
>;

export function buildBufferControlList(
    modId: string,
    bound: BoundField[],
    config: CatalogueConfig,
    /** Loaded sprite ids keyed by sprite entry id (`spriteId`). */
    spriteIds: SpriteIdMap,
): CatalogueResult {
    const menuId = config.menuItemId ?? modId;
    const items: PathCatalogueItem[] = [
        menuItem(menuId, config.menu),
        ...bound.flatMap((field) => [
            variableItem(field),
            valueItem(field),
            ...actionItemsFor(field),
        ]),
    ];

    // One entry resolution drives both the loaded sprite id and the source
    // file (the picker falls back to `filePath` when no `spriteIdFor` is given).
    items.forEach((item) => {
        const entryId = resolveSpriteEntry(config.sprites, item, menuId, config.menu.spriteId);
        item.spriteId = spriteIds[entryId ?? ""];
        item.filePath = config.sprites.find((s) => s.spriteId === entryId)?.filePath ?? "";
    });
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
