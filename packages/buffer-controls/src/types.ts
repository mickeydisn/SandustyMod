/**
 * Public types for @sandmd/buffer-controls.
 *
 * Configuration is declarative: the mod only supplies its JsonBuffer record,
 * its sprite ids, and labels. All catalogue / structure / refresh wiring is
 * owned by registerBufferControls() (see ./buffer-controls.ts).
 */
import type { JsonBuffer } from "@sandmd/buffer";
import type { BuildList } from "@sandmd/catalogue";

/** Sprite entry id per buffer field kind. */
export interface BufferControlsKindSprites {
    bool: string;
    number: string;
    string: string;
}

/** Sprite entry ids for the clickable action buttons. */
export interface BufferControlsActionSprites {
    inc: string;
    dec: string;
    toggle: string;
}

export interface BufferControlsSprites {
    kind: BufferControlsKindSprites;
    action: BufferControlsActionSprites;
}

/** Build-menu entry that opens the picker. */
export interface BufferControlsMenu {
    label: string;
    /** Build-menu tooltip. */
    description: string;
    /** Sprite entry id (from `spriteFiles`). */
    spriteId: string;
}

/** Category id → human label (shown as the picker tab). */
export interface BufferControlsCategoryLabels {
    variables: string;
    value: string;
    action: string;
}

export interface BufferControlsSpriteFile {
    /** Logical id referenced by `menu.spriteId` / `sprites`. */
    id: string;
    /** Relative file under the mod. */
    filePath: string;
}

export interface BufferControlsConfig<T extends object = Record<string, unknown>> {
    modId: string;
    /** jsonBuffer storage id (e.g. `<modId>:gameConfig`). */
    bufferId: string;
    /** Initial record written to the buffer. */
    defaultRecord: T;
    /** Menu-entry settings. */
    menu: BufferControlsMenu;
    /** Id of the menu entry structure. Defaults to `modId`. */
    menuItemId?: string;
    /** Category labels. */
    categories: BufferControlsCategoryLabels;
    /** Sprite entry ids for kind icons and action buttons. */
    sprites: BufferControlsSprites;
    /** Asset files to load; ids referenced by `menu.spriteId` and `sprites`. */
    spriteFiles: BufferControlsSpriteFile[];
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
