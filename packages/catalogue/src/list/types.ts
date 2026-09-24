/**
 * Catalogue + picker types. UI-agnostic: the controller owns selection
 * state; a React overlay or sandkit overlay just renders it.
 */

import type { CatalogueItem } from "../strucutre/types.ts";

export type BuildEventName = "select" | "place" | "remove" | "category" | "path" | "mirror" | "tag";

export interface CatalogueCategory {
    id: string;
    label: string;
}

export interface BuildListOptions {
    modId: string;
    /** Structure id of the single build-menu entry that opens the picker. */
    menuId: string;
    menuLabel: string;
    // categories: CatalogueCategory[];
    catalogueItems: CatalogueItem[];
    /** Default selected item id. */
    selectedId?: string;
    alwaysUnlocked?: boolean;
}

export interface PlacedPayload {
    item: CatalogueItem;
    type: string;
    x: number;
    y: number;
    mirrored: boolean;
}

export interface BuildEventMap {
    select: { item: CatalogueItem; mirrored: boolean };
    place: PlacedPayload;
    remove: PlacedPayload;
    category: { categoryId: string };
    path: { path: string };
    mirror: { mirrored: boolean };
    tag: { tags: string[]; sizes: string[] };
}

export type BuildListener<K extends BuildEventName = BuildEventName> = (
    event: BuildEventMap[K],
) => void;
