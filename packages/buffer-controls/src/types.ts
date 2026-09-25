/**
 * Public types for @sandmd/buffer-controls.
 *
 * Configuration is declarative and explicit: the mod supplies its complete
 * JsonBuffer record plus storage, scan, catalogue, sprite, and picker policy.
 * All catalogue / structure / refresh wiring is owned by registerBufferControls()
 * (see ./buffer-controls.ts).
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
    /** Readout width in STRUCT_H units. */
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
/**
 * One sprite: the logical `spriteId` (the loaded asset id, also referenced by
 * `menu.spriteId`) and the `filePath` it is loaded from. There is no separate
 * file table — the package extracts the load list from this array.
 *
 * An entry is matched against a catalogue item by the first condition that
 * fits, in this order:
 *   1. `itemId` — exact catalogue item id,
 *   2. `tag` — item tags include `tag` (the buffer path's last segment),
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
    /** Applies to every item whose tags include this value (a buffer key). */
    tag?: string;
    kind?: FieldKind;
};

export type BufferControlsSprite =
    & BufferControlsSpriteBase
    & (
        | {
            action: "toggleRate";
            /** N-frame rate sheet; required for rate actions. */
            frames: number;
        }
        | {
            action?: Exclude<ActionOp, "toggleRate">;
            frames?: never;
        }
    );
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
    /** Initial record written to the buffer. */
    defaultRecord: T;
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
    /** Category labels. */
    categories: BufferControlsCategoryLabels[];
    /** Derive the picker category for a buffer path; the caller owns this mapping. */
    categoryForPath: (path: string) => string;
    /**
     * Kind icons + action buttons. Each entry carries its own `filePath`, so
     * the sprite list is the single source of truth (no separate file table).
     */
    sprites: BufferControlsSprites;
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
