/**
 * Build the buffer-controls BuildList from a jsonBuffer record.
 *
 * Every declared field (one per scalar path: bool / number / string) becomes a
 * catalogue item, grouped in the three category tabs:
 *   - variables — one item per field,
 *   - value     — one item per field (live readout),
 *   - action    — +1 / ±10 for numbers, toggle for booleans, plus the
 *     opt-in toggles a number declares through its field `sprite`
 *     (`toggleNum` for `*-weigth.png`, `toggleRate` for `*-rate.png`).
 * Plus a single unlocked menu entry that opens the picker.
 *
 * An item's `category`, sprite `tag` and filter tags come straight from its
 * `BufferControlsField` — never from a path segment's position, so moving a
 * field in the record cannot silently re-tag or re-group it.
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
    BufferControlsField,
    BufferControlsSprite,
    BufferControlsSprites,
    FieldKind,
    PathCatalogueItem,
} from "./types.ts";
import { CELL, EXPOSED_KINDS } from "./const.ts";
import { fieldCategory, fieldTag } from "./fields.ts";
import { resolveBindingPath } from "./structure/defBuilders.ts";
import { ACTION_LABEL } from "./structure/register/actionRegister.ts";

/** Variable/value structures are 1 cell wide × 6 cells tall. */
const ITEM_HEIGHT = 6 * 15;
const VALUE_PREFIX = "value:";
const ACTION_PREFIX = "action:";

/**
 * One bound field: a declared field resolved to a real, readable/writable
 * jsonBuffer path (array templates become index 0).
 */
export interface BoundField {
    path: string;
    kind: FieldKind;
    /** Sprite-matching tag (declared on the field, else its last path segment). */
    tag: string;
    /** Picker category id (declared on the field, else its parent container). */
    category: string;
    /** Extra picker filter tags declared on the field. */
    tags: string[];
}

/**
 * Filter tags shared by one field's items: the bucket (`variables` / `value` /
 * `action`), the field's sprite tag, then any extra tags the field declares.
 */
const itemTags = (bucket: string, field: BoundField): string[] => [
    bucket,
    field.tag,
    ...field.tags,
];

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
): string {
    if (item.id === menuItemId) return menuSpriteId;

    const aItem = item as ActionCatalogueItem;
    const find = (
        predicate: (entry: BufferControlsSprite) => boolean,
    ): BufferControlsSprite | undefined => sprites.find(predicate);

    let found = find((entry) => entry.itemId === item.id);
    if (!found) {
        found = find((entry) =>
            entry.tag !== undefined && item.tags.includes(entry.tag) &&
            (entry.kind === undefined || entry.kind === aItem.kind) &&
            (entry.action === undefined || entry.action === aItem.action)
        );
    }
    if (!found) {
        found = find((entry) =>
            aItem.action !== undefined && entry.action === aItem.action && entry.kind === aItem.kind
        );
    }
    if (!found) {
        found = find((entry) => entry.action === undefined && entry.kind === aItem.kind);
    }

    if (!found) {
        throw new Error(`No buffer-controls sprite matches catalogue item "${item.id}".`);
    }
    return found.spriteId;
}

export interface CatalogueResult {
    buildList: BuildList;
    /** Number of scalar paths exposed. */
    pathCount: number;
}

const menuItem = (
    menuItemId: string,
    menu: BufferControlsConfig["menu"],
    color: string,
): PathCatalogueItem => ({
    id: menuItemId,
    label: menu.label,
    description: menu.description,
    category: "menu",
    path: "menu",
    kind: "string",
    align: "floor",
    tags: [],
    sizes: [],
    width: CELL,
    height: CELL,
    color,
    spriteId: "",
    readoutCells: 8,
    showIcon: true,
});

const variableItem = (
    field: BoundField,
    color: string,
): PathCatalogueItem => ({
    id: field.path,
    path: field.path,
    kind: field.kind,
    align: "floor",
    label: field.path,
    description: `${field.kind} — linked to jsonBuffer path "${field.path}".`,
    category: field.category,
    tags: itemTags("variables", field),
    sizes: [],
    width: CELL,
    height: ITEM_HEIGHT,
    color,
    spriteId: "",
    readoutCells: 8,
    showIcon: true,
});

const valueItem = (
    field: BoundField,
    color: string,
): PathCatalogueItem => {
    return {
        id: `${VALUE_PREFIX}${field.path}`,
        path: field.path,
        kind: field.kind,
        align: "floor",
        label: field.path,
        description: `${field.kind} — live value for jsonBuffer path "${field.path}".`,
        category: field.category,
        tags: itemTags("value", field),
        sizes: [],
        width: CELL,
        height: ITEM_HEIGHT,
        color,
        spriteId: "",
        readoutCells: 3,
        showIcon: false,
    };
};

const actionItem = (
    field: BoundField,
    op: ActionOp,
    color: string,
    frames?: number,
): ActionCatalogueItem => {
    const base = {
        id: `${ACTION_PREFIX}${field.path}:${op}`,
        path: field.path,
        kind: field.kind,
        align: "floor" as const,
        label: `${field.path} ${ACTION_LABEL[op]}`,
        description: `${ACTION_LABEL[op]} — writes jsonBuffer path "${field.path}" then commits.`,
        category: field.category,
        tags: itemTags("action", field),
        sizes: [],
        width: CELL,
        height: CELL,
        color,
        spriteId: "",
        readoutCells: 1,
        showIcon: true,
    };
    if (op === "toggleRate") {
        if (frames === undefined) {
            throw new Error(`Rate action for "${field.path}" must declare a frame count.`);
        }
        return { ...base, action: op, frames };
    }
    return { ...base, action: op };
};

/**
 * Does a sprite entry declare a toggle behaviour for this field?
 * Matching reuses the same priority as `resolveSpriteEntry` (exact `itemId`
 * first, then the field's declared `tag`). A bare `kind`-only entry never opts
 * a field into a toggle behaviour.
 */
const toggleEntryFor = (
    sprites: BufferControlsSprites,
    field: BoundField,
    op: "toggleNum" | "toggleRate",
): BufferControlsSprite | undefined => {
    const toggleId = `${ACTION_PREFIX}${field.path}:${op}`;
    const exact = sprites.find((sprite) => sprite.action === op && sprite.itemId === toggleId);
    if (exact) return exact;
    return sprites.find((sprite) =>
        sprite.action === op &&
        sprite.tag === field.tag &&
        (sprite.kind === undefined || sprite.kind === field.kind)
    );
};

const actionItemsFor = (
    field: BoundField,
    sprites: BufferControlsSprites,
    color: string,
): ActionCatalogueItem[] => {
    if (field.kind === "number") {
        const items = [
            actionItem(field, "inc", color),
            actionItem(field, "dec", color),
            actionItem(field, "incX", color),
            actionItem(field, "decX", color),
        ];
        // A number has no toggle behaviour by default — each toggle exists
        // only where the field's art declares it (e.g. `*-weigth.png`
        // fields declare `toggleNum`, `*-rate.png` fields declare
        // `toggleRate`).
        const tognum = toggleEntryFor(sprites, field, "toggleNum");
        if (tognum) items.push(actionItem(field, "toggleNum", color));
        const rate = toggleEntryFor(sprites, field, "toggleRate");
        if (rate) items.push(actionItem(field, "toggleRate", color, rate.frames));
        return items;
    }
    if (field.kind === "bool") {
        return [
            actionItem(field, "toggle", color),
        ];
    }
    return [];
};

/**
 * Resolve the buffer's listed scalar paths against the declared field list.
 * Every exposed path must be declared — an undeclared path is a config bug and
 * throws, rather than silently getting a guessed tag or category.
 */
export function boundFields(
    listed: readonly { kind?: FieldKind; path: string }[],
    fields: readonly BufferControlsField[],
): BoundField[] {
    const byPath = new Map(fields.map((field) => [field.path, field]));
    const out: BoundField[] = [];
    for (const entry of listed) {
        if (entry.kind === undefined || !EXPOSED_KINDS.includes(entry.kind)) continue;
        const def = byPath.get(entry.path);
        if (!def) {
            throw new Error(`No buffer-controls field declares buffer path "${entry.path}".`);
        }
        if (def.kind !== entry.kind) {
            throw new Error(
                `Buffer-controls field "${def.path}" declares kind "${def.kind}" but the record holds "${entry.kind}".`,
            );
        }
        out.push({
            path: resolveBindingPath(entry.path),
            kind: def.kind,
            tag: fieldTag(def),
            category: fieldCategory(def),
            tags: def.tags ?? [],
        });
    }
    return out;
}

/** The config fields buildBufferControlList needs (record-shape independent). */
export type CatalogueConfig = Pick<
    BufferControlsConfig,
    | "menu"
    | "menuItemId"
    | "initialItemId"
    | "categories"
    | "unmappedCategoryColor"
>;

export function buildBufferControlList(
    modId: string,
    bound: BoundField[],
    config: CatalogueConfig,
    /** Kind art + every declared field art, already merged by the caller. */
    sprites: BufferControlsSprites,
    /** Loaded sprite ids keyed by sprite entry id (`spriteId`). */
    spriteIds: SpriteIdMap,
): CatalogueResult {
    const menuId = config.menuItemId;
    const items: PathCatalogueItem[] = [
        menuItem(menuId, config.menu, config.unmappedCategoryColor),
        ...bound.flatMap((field) => {
            if (field.category.length === 0) {
                throw new Error(
                    `Field "${field.path}" has no category (declare one or nest the path under a container).`,
                );
            }
            const color = config.unmappedCategoryColor;
            return [
                variableItem(field, color),
                valueItem(field, color),
                ...actionItemsFor(field, sprites, color),
            ];
        }),
    ];

    // Resolve every generated item's sprite and category colour in one pass.
    for (const item of items) {
        const entryId = resolveSpriteEntry(sprites, item, menuId, config.menu.spriteId);
        const loadedSpriteId = spriteIds[entryId];
        if (typeof loadedSpriteId !== "string") {
            throw new Error(
                `Sprite "${entryId}" was not loaded for buffer-controls item "${item.id}".`,
            );
        }
        const entry = sprites.find((sprite) => sprite.spriteId === entryId);
        if (!entry) {
            throw new Error(
                `Sprite entry "${entryId}" is missing from the buffer-controls config.`,
            );
        }
        item.spriteId = loadedSpriteId;
        item.filePath = entry.filePath;
        const category = config.categories.find((candidate) => candidate.id === item.category);
        item.color = category === undefined ? config.unmappedCategoryColor : category.color;
    }

    const list: BuildList = createBuildList({
        modId,
        menuId,
        menuLabel: config.menu.label,
        catalogueItems: items,
        selectedId: config.initialItemId,
    });

    return { buildList: list, pathCount: bound.length };
}
