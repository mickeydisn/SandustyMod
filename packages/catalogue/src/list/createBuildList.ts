/**
 * BuildList — selection + catalogue, no cost logic.
 *
 * Events: select, place, remove, category, mirror.
 * Call notifyPlace / notifyRemove from the game when a structure is
 * actually built or demolished (sandkit events, or the playground grid).
 */
import "@sandmd/sandkit";
import { CatalogueItem } from "@sandmd/catalogue";
import type {
    BuildEventMap,
    BuildEventName,
    BuildListener,
    BuildListOptions,
    CatalogueCategory,
    PlacedPayload,
} from "./types.ts";

export const MIRROR_SUFFIX = "~mirrored";

const itemTypePrefix = (modId: string): string => `${modId}:cItem:`;

export function typeOfCatalogueItem(modId: string, itemId: string, mirrored = false): string {
    return `${itemTypePrefix(modId)}${itemId}${mirrored ? MIRROR_SUFFIX : ""}`;
}

export function itemIdFromType(modId: string, type: string): string | null {
    const prefix = itemTypePrefix(modId);
    if (!type.startsWith(prefix)) return null;
    let id = type.slice(prefix.length);
    if (id.endsWith(MIRROR_SUFFIX)) id = id.slice(0, -MIRROR_SUFFIX.length);
    return id;
}

export function findItem(items: CatalogueItem[], id: string): CatalogueItem | undefined {
    return items.find((entry) => entry.id === id);
}

export interface BuildList {
    readonly modId: string;
    readonly menuId: string;
    readonly menuLabel: string;
    readonly catalogueItems: CatalogueItem[];
    readonly categories: CatalogueCategory[];
    getSelected(): CatalogueItem | undefined;
    getSelectedType(): string;
    setSelected(id: string): void;
    isMirrored(): boolean;
    setMirrored(next: boolean): void;
    getCategory(): string;
    setCategory(id: string): void;
    itemsInCategory(id?: string): CatalogueItem[];
    countIn(categoryId: string): number;
    structureType(itemId: string, mirrored?: boolean): string;
    itemFromType(type: string): CatalogueItem | undefined;
    on<K extends BuildEventName>(name: K, handler: BuildListener<K>): () => void;
    /** Fire after a successful world placement. */
    notifyPlace(x: number, y: number, type?: string): PlacedPayload | null;
    notifyRemove(x: number, y: number, type: string): PlacedPayload | null;
    /** Select this list's current item in the game build tool. */
    applyToBuildTool(): void;
}

export const createBuildList = (options: BuildListOptions): BuildList => {
    const catalogueItems = options.catalogueItems.slice();
    const categories = options.categories.filter((c) =>
        catalogueItems.some((it) => it.category === c.id)
    );

    let selectedId = options.selectedId ?? catalogueItems[0]?.id ?? "";
    let category = findItem(catalogueItems, selectedId)?.category ?? categories[0]?.id ?? "";
    let mirrored = false;

    const listeners: { [K in BuildEventName]: Set<BuildListener<K>> } = {
        select: new Set(),
        place: new Set(),
        remove: new Set(),
        category: new Set(),
        mirror: new Set(),
    };

    const emit = <K extends BuildEventName>(name: K, event: BuildEventMap[K]) => {
        for (const h of listeners[name]) {
            try {
                (h as BuildListener<K>)(event);
            } catch (err) {
                console.error("[panel-build-list]", name, err);
            }
        }
    };

    const list: BuildList = {
        modId: options.modId,
        menuId: options.menuId,
        menuLabel: options.menuLabel,
        catalogueItems: catalogueItems,
        categories: categories,

        getSelected() {
            return findItem(catalogueItems, selectedId);
        },

        getSelectedType() {
            return typeOfCatalogueItem(options.modId, selectedId, mirrored);
        },

        setSelected(id) {
            const item = findItem(catalogueItems, id);
            if (!item) return;
            selectedId = id;
            category = item.category;
            emit("select", { item, mirrored });
        },

        isMirrored: () => mirrored,

        setMirrored(next) {
            mirrored = next;
            emit("mirror", { mirrored });
        },

        getCategory: () => category,

        setCategory(id) {
            category = id;
            emit("category", { categoryId: id });
        },

        itemsInCategory(id) {
            const cat = id ?? category;
            return catalogueItems.filter((it) => it.category === cat);
        },

        countIn(categoryId) {
            return catalogueItems.reduce((n, it) => n + (it.category === categoryId ? 1 : 0), 0);
        },

        structureType: (itemId, mir) => typeOfCatalogueItem(options.modId, itemId, mir ?? mirrored),

        itemFromType(type) {
            const id = itemIdFromType(options.modId, type);
            return id ? findItem(catalogueItems, id) : undefined;
        },

        on(name, handler) {
            const set = listeners[name] as Set<BuildListener<typeof name>>;
            set.add(handler);
            return () => set.delete(handler);
        },

        notifyPlace(x, y, type) {
            const used = type ?? list.getSelectedType();
            const item = list.itemFromType(used);
            if (!item) return null;
            const payload: PlacedPayload = {
                item,
                type: used,
                x,
                y,
                mirrored: type ? type.endsWith(MIRROR_SUFFIX) : mirrored,
            };
            emit("place", payload);
            return payload;
        },

        notifyRemove(x, y, type) {
            const item = list.itemFromType(type);
            if (!item) return null;
            const payload: PlacedPayload = {
                item,
                type,
                x,
                y,
                mirrored: type.endsWith(MIRROR_SUFFIX),
            };
            emit("remove", payload);
            return payload;
        },

        applyToBuildTool() {
            sandkit.api.building?.selectStructure?.(list.getSelectedType());
        },
    };

    if (sandkit.api.events?.on) {
        sandkit.api.events.on("building:placed", (payload) => {
            const p = payload as { structure?: { x: number; y: number; type?: string } };
            const structure = p.structure;
            if (!structure?.type) return;
            if (!structure.type.startsWith(`${options.modId}:`)) return;
            list.notifyPlace(structure.x, structure.y, structure.type);
        });
        sandkit.api.events.on("building:removed", (payload) => {
            const p = payload as { structureId?: string; type?: string; x?: number; y?: number };
            const type = String(p.structureId ?? p.type ?? "");
            const x = Number(p.x);
            const y = Number(p.y);
            if (!type.startsWith(`${options.modId}:`)) return;
            list.notifyRemove(x, y, type);
        });
    }

    return list;
};
