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
    /**
     * Slow fallback poll interval in ms (default 1000). The picker is primarily
     * driven by the engine's push `action:changed` event; this timer only guards
     * against edge cases where the action changes without that event being emitted.
     */
    syncIntervalMs?: number;
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
