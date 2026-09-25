/**
 * Build the buffer-controls BuildList from a jsonBuffer record.
 *
 * Every scalar path (bool / number / string) becomes a catalogue item, grouped
 * in the three category tabs:
 *   - variables — one item per path,
 *   - value     — one item per path (live readout),
 *   - action    — +1 / ±10 for numbers, toggle for booleans, plus the
 *     opt-in toggles a number declares through its sprite entries
 *     (`toggleNum` for `*-weigth.png`, `toggleRate` for `*-rate.png`).
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
    BufferControlsSprite,
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
): string {
    if (item.id === menuItemId) return menuSpriteId;

    const aItem = item as ActionCatalogueItem;
    const find = (
        predicate: (entry: BufferControlsSprite) => boolean,
    ): BufferControlsSprite | undefined => {
        for (const entry of sprites) {
            if (predicate(entry)) return entry;
        }
        return undefined;
    };

    let found = find((entry) => entry.itemId !== undefined && entry.itemId === item.id);
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
): PathCatalogueItem => ({
    id: menuItemId,
    label: menu.label,
    description: menu.description,
    category: "menu",
    path: "menu",
    kind: "string",
    align: "floor",
    tags: ["variables"],
    sizes: [],
    width: CELL,
    height: CELL,
    color: "#FFFFFF",
    spriteId: "",
    readoutCells: 8,
    showIcon: true,
});

const variableItem = (
    field: BoundField,
    category: string,
): PathCatalogueItem => ({
    id: field.path,
    path: field.path,
    kind: field.kind,
    align: "floor",
    label: field.path,
    description: `${field.kind} — linked to jsonBuffer path "${field.path}".`,
    category,
    tags: ["variables", ...field.path.split(".").slice(2)],
    sizes: [],
    width: CELL,
    height: ITEM_HEIGHT,
    color: "#FFFFFF",
    spriteId: "",
    readoutCells: 8,
    showIcon: true,
});

const valueItem = (
    field: BoundField,
    category: string,
): PathCatalogueItem => {
    return {
        id: `${VALUE_PREFIX}${field.path}`,
        path: field.path,
        kind: field.kind,
        align: "floor",
        label: field.path,
        description: `${field.kind} — live value for jsonBuffer path "${field.path}".`,
        category,
        tags: ["value", ...field.path.split(".").slice(2)],
        sizes: [],
        width: CELL,
        height: ITEM_HEIGHT,
        color: "#FFFFFF",
        spriteId: "",
        readoutCells: 3,
        showIcon: false,
    };
};

const actionItem = (
    field: BoundField,
    category: string,
    op: ActionOp,
    frames?: number,
): ActionCatalogueItem => {
    const base = {
        id: `${ACTION_PREFIX}${field.path}:${op}`,
        path: field.path,
        kind: field.kind,
        align: "floor" as const,
        label: `${field.path} ${ACTION_LABEL[op]}`,
        description: `${ACTION_LABEL[op]} — writes jsonBuffer path "${field.path}" then commits.`,
        category,
        tags: ["action", ...field.path.split(".").slice(2)],
        sizes: [],
        width: CELL,
        height: CELL,
        color: "#FFFFFF",
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
 * first, then `tag` scoped to the path's last segment). A bare `kind`-only
 * entry never opts a field into a toggle behaviour.
 */
const toggleEntryFor = (
    sprites: BufferControlsSprites,
    field: BoundField,
    op: "toggleNum" | "toggleRate",
): BufferControlsSprite | undefined => {
    const last = field.path.split(".").at(-1);
    const toggleId = `${ACTION_PREFIX}${field.path}:${op}`;
    for (const sprite of sprites) {
        if (sprite.action === op && sprite.itemId === toggleId) return sprite;
    }
    for (const sprite of sprites) {
        if (
            sprite.action === op &&
            sprite.tag !== undefined &&
            sprite.tag === last &&
            (sprite.kind === undefined || sprite.kind === field.kind)
        ) {
            return sprite;
        }
    }
    return undefined;
};

const actionItemsFor = (
    field: BoundField,
    category: string,
    sprites: BufferControlsSprites,
): ActionCatalogueItem[] => {
    if (field.kind === "number") {
        const items = [
            actionItem(field, category, "inc"),
            actionItem(field, category, "dec"),
            actionItem(field, category, "incX"),
            actionItem(field, category, "decX"),
        ];
        // A number has no toggle behaviour by default — each toggle exists
        // only where the sprite config declares it (e.g. `*-weigth.png`
        // entries declare `toggleNum`, `*-rate.png` entries declare
        // `toggleRate`).
        const tognum = toggleEntryFor(sprites, field, "toggleNum");
        if (tognum) items.push(actionItem(field, category, "toggleNum"));
        const rate = toggleEntryFor(sprites, field, "toggleRate");
        if (rate) items.push(actionItem(field, category, "toggleRate", rate.frames));
        return items;
    }
    if (field.kind === "bool") {
        return [
            actionItem(field, category, "toggle"),
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
    | "menu"
    | "sprites"
    | "menuItemId"
    | "initialItemId"
    | "categories"
    | "categoryForPath"
    | "unmappedCategoryColor"
>;

export function buildBufferControlList(
    modId: string,
    bound: BoundField[],
    config: CatalogueConfig,
    /** Loaded sprite ids keyed by sprite entry id (`spriteId`). */
    spriteIds: SpriteIdMap,
): CatalogueResult {
    const menuId = config.menuItemId;
    const items: PathCatalogueItem[] = [
        menuItem(menuId, config.menu),
        ...bound.flatMap((field) => {
            const category = config.categoryForPath(field.path);
            if (category.length === 0) {
                throw new Error(`categoryForPath returned an empty category for "${field.path}".`);
            }
            return [
                variableItem(field, category),
                valueItem(field, category),
                ...actionItemsFor(field, category, config.sprites),
            ];
        }),
    ];

    // One entry resolution drives both the loaded sprite id and the source
    // file. A missing match is a configuration error, not an empty sprite.
    for (const item of items) {
        const entryId = resolveSpriteEntry(config.sprites, item, menuId, config.menu.spriteId);
        const loadedSpriteId = spriteIds[entryId];
        if (typeof loadedSpriteId !== "string") {
            throw new Error(
                `Sprite "${entryId}" was not loaded for buffer-controls item "${item.id}".`,
            );
        }
        const entry = config.sprites.find((sprite) => sprite.spriteId === entryId);
        if (!entry) {
            throw new Error(
                `Sprite entry "${entryId}" is missing from the buffer-controls config.`,
            );
        }
        item.spriteId = loadedSpriteId;
        item.filePath = entry.filePath;
    }
    for (const item of items) {
        const category = config.categories.find((entry) => entry.id === item.category);
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
