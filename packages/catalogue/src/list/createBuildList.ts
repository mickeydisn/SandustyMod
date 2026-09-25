/**
 * BuildList — selection + catalogue, no cost logic.
 *
 * Events: select, place, remove, category, path, mirror, and tag.
 * Call notifyPlace / notifyRemove manually when a structure is actually
 * built or demolished (e.g. from the playground grid). The game
 * `building:placed` / `building:removed` auto-wiring was removed: nobody
 * subscribes to `place` / `remove`, and each list was paying a global
 * event + linear catalogue scan on every vanilla placement.
 */
import "@sandmd/sandkit";
import type { ResolvedCatalogueItem } from "../structure/types.ts";
import type {
    BuildEventMap,
    BuildEventName,
    BuildListener,
    BuildListOptions,
    PlacedPayload,
} from "./types.ts";

const MIRROR_SUFFIX = "~mirrored";

/** Natural sort for size tags: "2x10" after "2x2" (W then H, numerically). */
export function compareSizes(a: string, b: string): number {
    const [aw, ah] = a.split("x").map(Number);
    const [bw, bh] = b.split("x").map(Number);
    return (aw || 0) - (bw || 0) || (ah || 0) - (bh || 0);
}

const itemTypePrefix = (modId: string): string => `${modId}:item/`;

export function typeOfCatalogueItem(modId: string, itemId: string, mirrored: boolean): string {
    return `${itemTypePrefix(modId)}${itemId}${mirrored ? MIRROR_SUFFIX : ""}`;
}

function itemIdFromType(modId: string, type: string): string | null {
    const prefix = itemTypePrefix(modId);
    if (!type.startsWith(prefix)) return null;
    let id = type.slice(prefix.length);
    if (id.endsWith(MIRROR_SUFFIX)) id = id.slice(0, -MIRROR_SUFFIX.length);
    return id;
}

export interface BuildList {
    readonly modId: string;
    readonly menuId: string;
    readonly menuLabel: string;
    readonly catalogueItems: ResolvedCatalogueItem[];
    getSelected(): ResolvedCatalogueItem | undefined;
    getSelectedType(): string;
    setSelected(id: string): void;
    isMirrored(): boolean;
    setMirrored(next: boolean): void;
    getCategory(): string;
    setCategory(id: string): void;
    getPath(): string;
    setPath(id: string): void;
    /** All distinct directory tags across the catalogue. */
    allTags(): string[];
    allCategories(): string[];
    allPaths(): string[];
    /** All distinct size tags across the catalogue (e.g. "1x1", "3x2"). */
    allSizes(): string[];
    /** Currently selected directory-tag filters (multi-select, OR within group). */
    getSelectedTags(): string[];
    setSelectedTags(tags: string[]): void;
    toggleTag(tag: string): void;
    /** Currently selected size filters (multi-select, OR within group). */
    getSelectedSizes(): string[];
    setSelectedSizes(sizes: string[]): void;
    toggleSize(size: string): void;
    itemsInCategory(id?: string): ResolvedCatalogueItem[];
    itemsInPath(path: string): ResolvedCatalogueItem[];

    countIn(categoryId: string): number;
    structureType(itemId: string, mirrored?: boolean): string;
    itemFromType(type: string): ResolvedCatalogueItem | undefined;
    on<K extends BuildEventName>(name: K, handler: BuildListener<K>): () => void;
    /** Fire after a successful world placement. */
    notifyPlace(x: number, y: number, type?: string): PlacedPayload | null;
    notifyRemove(x: number, y: number, type: string): PlacedPayload | null;
    /** Select this list's current item in the game build tool. */
    applyToBuildTool(): void;
}

export const createBuildList = (options: BuildListOptions): BuildList => {
    const catalogueItems: ResolvedCatalogueItem[] = options.catalogueItems.map((item) => ({
        ...item,
        tags: item.tags.slice(),
        sizes: item.sizes.slice(),
    }));
    if (catalogueItems.length === 0) {
        throw new Error("createBuildList: catalogueItems must contain at least one item.");
    }
    // O(1) id → item lookup for selection and placement events.
    const byId = new Map<string, ResolvedCatalogueItem>();
    for (const entry of catalogueItems) byId.set(entry.id, entry);
    const initial = byId.get(options.selectedId);
    if (!initial) {
        throw new Error(
            `createBuildList: selectedId "${options.selectedId}" is not in catalogueItems.`,
        );
    }
    let selectedId = initial.id;
    let category = initial.category;
    let path = initial.path;
    let mirrored = false;
    let selectedTags: string[] = [];
    let selectedSizes: string[] = [];

    const listeners: { [K in BuildEventName]: Set<BuildListener<K>> } = {
        select: new Set(),
        place: new Set(),
        remove: new Set(),
        category: new Set(),
        path: new Set(),
        mirror: new Set(),
        tag: new Set(),
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
        // categories: categories,

        getSelected() {
            return byId.get(selectedId);
        },

        getSelectedType() {
            return typeOfCatalogueItem(options.modId, selectedId, mirrored);
        },

        setSelected(id) {
            const item = byId.get(id);
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
        getPath: () => path,

        setPath(id) {
            path = id;
            emit("path", { path: id });
        },

        allTags() {
            const set = new Set<string>();
            for (const it of catalogueItems) {
                for (const t of it.tags) set.add(t);
            }
            return [...set].sort();
        },
        allCategories() {
            const set = new Set<string>();
            for (const it of catalogueItems) {
                set.add(it.category);
            }
            return [...set].sort();
        },
        allPaths() {
            const set = new Set<string>();
            for (const it of catalogueItems) {
                set.add(it.path);
            }
            return [...set].sort();
        },

        allSizes() {
            const set = new Set<string>();
            for (const it of catalogueItems) {
                for (const s of it.sizes) set.add(s);
            }
            return [...set].sort(compareSizes);
        },

        getSelectedTags: () => selectedTags.slice(),

        setSelectedTags(tags) {
            selectedTags = tags.filter(
                (t, i) =>
                    tags.indexOf(t) === i &&
                    catalogueItems.some((it) => it.tags.includes(t)),
            );
            emit("tag", { tags: selectedTags, sizes: selectedSizes });
        },

        toggleTag(tag) {
            const next = selectedTags.includes(tag)
                ? selectedTags.filter((t) => t !== tag)
                : [...selectedTags, tag];
            list.setSelectedTags(next);
        },

        getSelectedSizes: () => selectedSizes.slice(),

        setSelectedSizes(sizes) {
            selectedSizes = sizes.filter(
                (s, i) =>
                    sizes.indexOf(s) === i &&
                    catalogueItems.some((it) => it.sizes.includes(s)),
            );
            emit("tag", { tags: selectedTags, sizes: selectedSizes });
        },

        toggleSize(size) {
            const next = selectedSizes.includes(size)
                ? selectedSizes.filter((s) => s !== size)
                : [...selectedSizes, size];
            list.setSelectedSizes(next);
        },

        itemsInCategory(id) {
            const cat = id === undefined ? category : id;
            return catalogueItems.filter((it) => it.category === cat);
        },
        itemsInPath(path) {
            return catalogueItems.filter((it) => it.path === path);
        },

        countIn(categoryId) {
            return catalogueItems.reduce((n, it) => n + (it.category === categoryId ? 1 : 0), 0);
        },

        structureType: (itemId, mir) =>
            typeOfCatalogueItem(options.modId, itemId, mir === undefined ? mirrored : mir),

        itemFromType(type) {
            const id = itemIdFromType(options.modId, type);
            return id ? byId.get(id) : undefined;
        },

        on(name, handler) {
            const set = listeners[name] as Set<BuildListener<typeof name>>;
            set.add(handler);
            return () => set.delete(handler);
        },

        notifyPlace(x, y, type) {
            const used = type === undefined ? list.getSelectedType() : type;
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
        // Lazy wiring: only subscribe to the global building events when
        // somebody actually listens for place/remove. Every list used to pay
        // a global callback + catalogue scan on EVERY placement in the game
        // (including vanilla walls), while having zero subscribers.
        let wired = false;
        const ensureWired = () => {
            if (wired) return;
            wired = true;
            const prefix = `${options.modId}:`;
            sandkit.api.events.on("building:placed", (payload) => {
                if (listeners.place.size === 0) return;
                const p = payload as { structure?: { x: number; y: number; type?: string } };
                const structure = p.structure;
                if (!structure?.type) return;
                if (!structure.type.startsWith(prefix)) return;
                list.notifyPlace(structure.x, structure.y, structure.type);
            });
            sandkit.api.events.on("building:removed", (payload) => {
                if (listeners.remove.size === 0) return;
                const p = payload as {
                    structureId?: string;
                    type?: string;
                    x?: number;
                    y?: number;
                };
                const rawType = p.structureId !== undefined ? p.structureId : p.type;
                if (rawType === undefined || typeof p.x !== "number" || typeof p.y !== "number") {
                    return;
                }
                const type = String(rawType);
                if (!type.startsWith(prefix)) return;
                list.notifyRemove(p.x, p.y, type);
            });
        };

        const origOn = list.on.bind(list);
        list.on = ((name: BuildEventName, handler: BuildListener<BuildEventName>) => {
            if (name === "place" || name === "remove") ensureWired();
            return (origOn as (n: BuildEventName, h: never) => () => void)(name, handler as never);
        }) as BuildList["on"];
    }

    return list;
};
