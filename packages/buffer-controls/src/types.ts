/**
 * Public types for @sandmd/buffer-controls.
 *
 * Configuration is declarative: the mod only supplies its JsonBuffer record,
 * its sprites (`{ spriteId, filePath, … }`) and labels. All catalogue /
 * structure / refresh wiring is owned by registerBufferControls()
 * (see ./buffer-controls.ts).
 */
import type { JsonBuffer } from "@sandmd/buffer";
import type { BuildList } from "@sandmd/catalogue";

///-----------------

import type { CatalogueItem } from "@sandmd/catalogue";
import type { FieldKind } from "@sandmd/buffer";

///-----------------

export type { FieldKind };
export type ActionOp = "inc" | "dec" | "incX" | "decX" | "toggle" | "toggleNum" | "toggleRate";

///-----------------

/** Extra fields we attach to catalogue items generated from the JsonBuffer. */
export interface PathCatalogueItem extends CatalogueItem {
    /** Real jsonBuffer path this action writes to (already index-resolved). */
    path: string;
    kind?: FieldKind;
    color: string;
    /**
     * Readout width in STRUCT_H units for `drawIconAndReadout`
     * (final pixels = readoutCells * 16). When omitted, the register falls
     * back to its per-kind default (var: 8, value string: 8 / number: 4 /
     * bool: 2).
     */
    readoutCells?: number;
    /** Draw the 16x16 kind icon left of the readout. Defaults to true. */
    showIcon?: boolean;
}

export interface ActionCatalogueItem extends CatalogueItem {
    /** Real jsonBuffer path this action writes to (already index-resolved). */
    path: string;
    kind?: FieldKind;
    action?: ActionOp;
    color: string;
    /**
     * Spritesheet frame count for value-mapped toggle art (`toggleRate`).
     * Copied from the matched `BufferControlsSprite.frames` entry; defaults
     * to 6 when the entry omits it.
     */
    frames?: number;
}

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
export interface BufferControlsSprite {
    /** Logical sprite id — loaded from `filePath`, referenced by `menu.spriteId`. */
    spriteId: string;
    /** Asset file, relative to the mod (e.g. `assets/types/number.png`). */
    filePath: string;
    /** Exact catalogue item id this sprite applies to. */
    itemId?: string;
    /** Applies to every item whose tags include this value (a buffer key). */
    tag?: string;
    kind?: FieldKind;
    action?: ActionOp;
    /**
     * Spritesheet frame count for value-mapped toggle art.
     * `toggleNum` is always 3 frames (0 / `>0` / `<0`) and ignores this.
     * `toggleRate` follows the N-frame rule — frame 0 is `<= 0`, the last
     * frame is `>= 100`, and the `N - 2` middle frames split `(0, 100)`
     * evenly (6 frames → steps of 25, 7 frames → steps of 20, …).
     * Defaults to 6 when omitted.
     */
    frames?: number;
}
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

export interface BufferControlsConfig<T extends object = Record<string, unknown>> {
    modId: string;
    /** jsonBuffer storage id (e.g. `<modId>:gameConfig`). */
    bufferId: string;
    /** Initial record written to the buffer. */
    defaultRecord: T;
    /**
     * Persist the record to `sandkit.api.storage.local` on `store:save` and
     * restore it when the game reloads. Default `true`.
     */
    persist?: boolean;
    persistLoad?: boolean;
    /** Menu-entry settings. */
    menu: BufferControlsMenu;
    /** Id of the menu entry structure. Defaults to `modId`. */
    menuItemId?: string;
    /** Category labels. */
    categories: BufferControlsCategoryLabels[];
    /**
     * Kind icons + action buttons. Each entry carries its own `filePath`, so
     * the sprite list is the single source of truth (no separate file table).
     */
    sprites: BufferControlsSprites;
    /** Picker header title. */
    pickerTitle?: string;
}

export interface BufferControlsHandles<T extends object = Record<string, unknown>> {
    buffer: JsonBuffer<T>;
    list: BuildList;
    /** Number of scalar paths exposed as structures. */
    pathCount: number;
    /** Push the current buffer values to every placed value structure. */
    refresh(): void;
}
