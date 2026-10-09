import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type ItemConfig } from "../types.ts";
import { normalizeItem } from "../internal/normalize.ts";
import type { ItemId, ItemType } from "../host-types/domain.d.ts";

/**
 * A live item instance created by the host.
 *
 * `cooldown` is only present when the registered definition declares one
 * (`bundel.js` 50626-50633).
 */
export type ItemInstance = {
    /** Item id of the definition this instance came from. */
    id: ItemId;
    /** Category handle for the instance. */
    itemType: ItemType;
    /** Present only when the definition declares a cooldown. */
    cooldown?: { last: number };
};

/**
 * One sprite mount transform: offsets and pivot within the mounted sprite.
 *
 * The three built-in mounts are `onehand`, `backhand` and `cryoblaster`
 * (`bundel.js` 18912-18922).
 */
export type ItemSpriteMount = {
    x: number;
    y: number;
    pivotX: number;
    pivotY: number;
};

/** Map of mount name to its transform. */
export type ItemSpriteMounts = {
    onehand?: ItemSpriteMount;
    backhand?: ItemSpriteMount;
    cryoblaster?: ItemSpriteMount;
    [mount: string]: ItemSpriteMount | undefined;
};

export const items = {
    /**
     * Built-in sprite mount transforms, keyed by mount name.
     *
     * Read from the host at call time rather than captured once, so it stays
     * correct if the host swaps its asset table.
     */
    get spriteMounts(): ItemSpriteMounts {
        try {
            return (g()?.api?.items?.spriteMounts ?? {}) as ItemSpriteMounts;
        } catch (e) {
            console.warn(`${LOG} items.spriteMounts failed`, e);
            return {};
        }
    },

    register(def: ItemConfig): void {
        try {
            g()?.api?.items?.register?.(normalizeItem(def));
        } catch (e) {
            console.error(`${LOG} items.register failed`, def.id, e);
        }
    },

    /**
     * Build a fresh instance of a registered item.
     *
     * Returns `{ id, itemType }`, plus `cooldown: { last: 0 }` only when the
     * registered definition declares a cooldown (`bundel.js` 50626-50633).
     * Returns `null` when the id is unknown.
     */
    createById(itemId: ItemId): ItemInstance | null {
        try {
            const ns = g()?.api?.items;
            const fn = ns?.createById ?? ns?.createFromId;
            if (typeof fn !== "function") return null;
            return (fn.call(ns, itemId) as ItemInstance | undefined) ?? null;
        } catch (e) {
            console.warn(`${LOG} items.createById failed`, itemId, e);
            return null;
        }
    },

    /** Alias of {@link createById}. */
    createFromId(itemId: ItemId): ItemInstance | null {
        return items.createById(itemId);
    },

    /** The item the player is currently holding, or null. */
    getActive(): ItemInstance | null {
        try {
            return (g()?.api?.items?.getActive?.() ?? null) as ItemInstance | null;
        } catch (e) {
            console.warn(`${LOG} items.getActive failed`, e);
            return null;
        }
    },

    /**
     * Whether the given item is the active one.
     *
     * Omit `itemType` to match on id alone; pass one to also require the
     * category to match (`bundel.js` 50636-50640).
     */
    isActiveById(itemId: ItemId, itemType?: ItemType): boolean {
        try {
            return g()?.api?.items?.isActiveById?.(itemId, itemType) === true;
        } catch (e) {
            console.warn(`${LOG} items.isActiveById failed`, itemId, e);
            return false;
        }
    },

    updateDefinition(itemId: ItemId, partial: Partial<ItemConfig>): void {
        try {
            g()?.api?.items?.updateDefinition?.(itemId, partial);
        } catch (e) {
            console.error(`${LOG} items.updateDefinition failed`, itemId, e);
        }
    },

    getRegisteredIds(): ItemId[] {
        try {
            return (g()?.api?.items?.getRegisteredIds?.() ?? []) as ItemId[];
        } catch (e) {
            console.warn(`${LOG} items.getRegisteredIds failed`, e);
            return [];
        }
    },

    getDefinitionById(id: ItemId): ItemConfig | undefined {
        try {
            return (g()?.api?.items?.getDefinitionById?.(id) ?? undefined) as
                | ItemConfig
                | undefined;
        } catch (e) {
            console.warn(`${LOG} items.getDefinitionById failed`, id, e);
            return undefined;
        }
    },

    getRegistered(): ItemConfig[] {
        try {
            return (g()?.api?.items?.getRegistered?.() ?? []) as ItemConfig[];
        } catch (e) {
            console.warn(`${LOG} items.getRegistered failed`, e);
            return [];
        }
    },
    getAll(): ItemConfig[] {
        try {
            return (g()?.api?.items?.getAll?.() ?? []) as ItemConfig[];
        } catch (e) {
            console.warn(`${LOG} items.getAll failed`, e);
            return [];
        }
    },
    list(): ItemConfig[] {
        try {
            return (g()?.api?.items?.list?.() ?? []) as ItemConfig[];
        } catch (e) {
            console.warn(`${LOG} items.list failed`, e);
            return [];
        }
    },
};
