/**
 * Public types for @sandmd/buffer-controls.
 *
 * Configuration is declarative and explicit: the mod supplies one
 * `BufferControlsField` per exposed path, plus the generic kind art and the
 * storage / scan / picker policy. registerBufferControls() derives the JsonBuffer
 * record, the sprite list and every catalogue item's tag / category / filter
 * tags from that field list (see ./fields.ts).
 */
import type { JsonBuffer, ListPathsOptions } from "@sandmd/buffer";
import type { BuildList } from "@sandmd/catalogue";

///-----------------

import type { CatalogueItem } from "@sandmd/catalogue";
import type { FieldKind } from "@sandmd/buffer";

///-----------------

export type { FieldKind };
export type ActionOp = "inc" | "dec" | "incX" | "decX" | "toggle" | "toggleNum" | "toggleRate";

///-----------------

/** Extra fields attached to catalogue items generated from the JsonBuffer. */
export interface PathCatalogueItem extends CatalogueItem {
    /** Real jsonBuffer path this item represents. */
    path: string;
    kind: FieldKind;
    color: string;
    spriteId: string;
    /** Readout width in cells. */
    readoutCells: number;
    /** Draw the kind icon left of the readout. */
    showIcon: boolean;
}

export type ActionCatalogueItem =
    & PathCatalogueItem
    & (
        | { action: "toggleRate"; frames: number }
        | { action: Exclude<ActionOp, "toggleRate">; frames?: never }
    );

///-----------------

/** A sprite's toggle behaviour — `toggleRate` carries its sheet frame count. */
export type SpriteAction =
    | { action: "toggleRate"; frames: number }
    | { action?: Exclude<ActionOp, "toggleRate">; frames?: never };

///-----------------

/**
 * Art for one declared field: the logical `spriteId` (unique across the mod)
 * plus the toggle behaviour the field exposes. A bare entry adds no button — it
 * only draws the field, so `*-rate.png` fields get `toggleRate` and
 * `*-weigth.png` fields get `toggleNum`.
 */
export type BufferControlsFieldSprite = {
    /** Logical sprite id — loaded from `filePath`. */
    spriteId: string;
    /** Asset file, relative to the mod (e.g. `assets/types/number.png`). */
    filePath: string;
} & SpriteAction;

/**
 * One exposed buffer path — the single source of truth for that path:
 *   - `default` seeds the JsonBuffer record (and repairs an older saved record),
 *   - `kind` drives value validation and the generic-art fallback,
 *   - `sprite` is this path's own art (falls back to `kindSprites`),
 *   - `tag` / `category` / `tags` place the generated catalogue items
 *     (defaults: the path's last segment / the path's parent container / none).
 *
 * Every scalar path the record exposes must be declared; the package throws on
 * an undeclared path instead of guessing its tag or category.
 */
export interface BufferControlsField {
    /** Full jsonBuffer path, e.g. `P.InWater-ASeed.tickSpeed`. */
    path: string;
    kind: FieldKind;
    /** Value written at `path` when the record is created or repaired. */
    default: boolean | number | string;
    /** Per-path art; omit to use the generic kind / action art. */
    sprite?: BufferControlsFieldSprite;
    /** Sprite-matching tag; defaults to the path's last segment. */
    tag?: string;
    /** Picker category id; defaults to the path's parent container. */
    category?: string;
    /** Extra picker filter tags (the bucket + tag are added automatically). */
    tags?: string[];
}

///-----------------

/**
 * One generic sprite: the logical `spriteId` (the loaded asset id, also
 * referenced by `menu.spriteId`) and the `filePath` it is loaded from. There is
 * no separate file table — the package extracts the load list from this array.
 *
 * An entry is matched against a catalogue item by the first condition that
 * fits, in this order:
 *   1. `itemId` — exact catalogue item id,
 *   2. `tag` — item tags include `tag` (a field tag, not a path position),
 *   3. `action` (+ `kind`) — e.g. every number `inc` button,
 *   4. `kind` alone — the generic per-kind icon.
 */
type BufferControlsSpriteBase = {
    /** Logical sprite id — loaded from `filePath`, referenced by `menu.spriteId`. */
    spriteId: string;
    /** Asset file, relative to the mod (e.g. `assets/types/number.png`). */
    filePath: string;
    /** Exact catalogue item id this sprite applies to. */
    itemId?: string;
    /** Applies to every item whose tags include this value (a field tag). */
    tag?: string;
    kind?: FieldKind;
};

export type BufferControlsSprite = BufferControlsSpriteBase & SpriteAction;
export type BufferControlsSprites = BufferControlsSprite[];

/** Build-menu entry that opens the picker. */
export interface BufferControlsMenu {
    label: string;
    /** Build-menu tooltip. */
    description: string;
    /** Sprite entry id (from `sprites`). */
    spriteId: string;
}

///-----------------
/** Category id → human label (shown as the picker tab). */
export type BufferControlsCategoryLabels = {
    id: string;
    color: string;
};

export interface BufferControlsStorageConfig {
    /** Save the record to local storage on `store:save`. */
    persist: boolean;
    /** Restore the saved record during construction. */
    load: boolean;
}

export interface BufferControlsPickerConfig {
    /** Overlay registration id. */
    id: string;
    /** Overlay slot supplied by the host. */
    slot: string;
    /** Picker header title. */
    title: string;
    /** Persist selection/filter state in host storage. */
    persistSelection: boolean;
}

export interface BufferControlsConfig<T extends object = Record<string, unknown>> {
    modId: string;
    /** jsonBuffer storage id (e.g. `<modId>:gameConfig`). */
    bufferId: string;
    /**
     * One entry per exposed path — the single source of truth for that path.
     * The record seed, the sprite list and every item's tag / category come
     * from here, so there is no separate `defaultRecord` or `sprites` list to
     * keep in sync.
     */
    fields: BufferControlsField[];
    /** Optional validation guard passed to the underlying JsonBuffer. */
    assertShape?: (value: T) => void;
    /** Maximum JSON payload size in bytes. */
    maxBytes: number;
    /** Explicit storage policy. */
    storage: BufferControlsStorageConfig;
    /** Explicit field-discovery policy. */
    pathScan: ListPathsOptions;
    /** Menu-entry settings. */
    menu: BufferControlsMenu;
    /** Id of the menu entry structure. */
    menuItemId: string;
    /** Catalogue item selected when the picker opens; must exist in the generated list. */
    initialItemId: string;
    /** Category id → colour (one entry per distinct `field.category`). */
    categories: BufferControlsCategoryLabels[];
    /**
     * Generic art by kind / action: the per-kind icons, the inc/dec buttons,
     * the boolean toggle and the menu icon. A field overrides it per path with
     * its own `sprite`.
     */
    kindSprites: BufferControlsSprites;
    /** Colour used when a generated item has no category entry. */
    unmappedCategoryColor: string;
    /** Picker layout and persistence policy. */
    picker: BufferControlsPickerConfig;
}

export interface BufferControlsHandles<T extends object = Record<string, unknown>> {
    buffer: JsonBuffer<T>;
    list: BuildList;
    /** Number of scalar paths exposed as structures. */
    pathCount: number;
    /** Push the current buffer values to every placed value structure. */
    refresh(): void;
}
