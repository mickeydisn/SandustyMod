import type { BuildList } from "../list/index.ts";
import { CatalogueItem } from "../strucutre/types.ts";

/** Optional price shown on a picker swatch. */
export interface PriceTag {
    amount: number;
    currency?: string;
    icon?: string;
}

export interface PickerContext {
    list: BuildList;
    selected: CatalogueItem | undefined;
    mirrored: boolean;
    categoryId: string;
    search: string;
    repaint: () => void;
}

export interface PickerOverlayOptions {
    list: BuildList;
    /** Overlay id. Default `${modId}/picker`. */
    pickerId?: string;
    /** Overlay slot. Default "hotbar". */
    slot?: string;
    title?: string;
    width?: number;
    maxHeight?: number;
    search?: boolean;
    persistSelection?: boolean;
    itemFilter?: (item: CatalogueItem) => boolean;
    priceFor?: (item: CatalogueItem) => PriceTag | null;
    onSelect?: (item: CatalogueItem, mirrored: boolean) => void;
    unlockTypes?: (types: string[]) => void;
    /**
     * Resolves the sprite id actually loaded for an item. Defaults to
     * `item.spriteId ?? mod structure-type`, but mods that load sprites under
     * their own id scheme (e.g. `modId:<id>`) must supply this so the swatches
     * show the correct art.
     */
    spriteIdFor?: (item: CatalogueItem) => string | undefined;
    renderHeaderExtra?: (ctx: PickerContext) => unknown;
    renderItemBadge?: (item: CatalogueItem) => unknown;
}

export interface PickerOverlay {
    readonly pickerId: string;
    expand(): void;
    minimize(): void;
    close(): void;
    sync(): void;
    dispose(): void;
}

/**
 * The contract the overlay controller (overlay.ts) exposes to the picker's
 * presentational view (content.ts). The view renders the catalogue UI and
 * reports user intent (select / mirror / category); the controller owns the
 * overlay state machine, sync with the selected build action, and the game
 * side-effects (unlock, select build tool, persist).
 */
export interface PickerContentApi {
    readonly pickerId: string;
    readonly title: string;
    readonly list: BuildList;
    /** Overlay visibility/minimized state, read by the view to pick a layout. */
    getState(): { minimized: boolean } | null;
    expand(): void;
    minimize(): void;
    /** User picked a swatch — select it, unlock, hand it to the build tool. */
    selectItem(item: CatalogueItem): void;
    /** Toggle the mirror flag and refresh the build-tool structure. */
    toggleMirror(): void;
    /** Switch the active category and select its first item. */
    chooseCategory(categoryId: string): void;
    /** Toggle a directory-tag filter (multi-select, OR within tags group). */
    toggleTag(tag: string): void;
    /** Toggle a size filter (multi-select, OR within sizes group). */
    toggleSize(size: string): void;
    /** Clear both tag and size filters. */
    clearFilters(): void;
    /** Register the view's re-render trigger; pass null to clear. */
    setRepaint(fn: (() => void) | null): void;
    /** Register a callback to clear transient UI state (e.g. tooltip); pass null to clear. */
    setClearTooltip(fn: (() => void) | null): void;
    /** Request a re-render of the view (used for header extras). */
    repaint(): void;
}
