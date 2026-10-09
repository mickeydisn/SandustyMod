import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import type { ItemId, StructureId } from "../host-types/domain.d.ts";
import type { Vector2 } from "../host-types/shared.d.ts";

export const player = {
    inventory: {
        addById(
            itemId: ItemId,
            amount = 1,
        ): boolean {
            try {
                const ns = g()?.api?.player?.inventory;
                if (typeof ns?.addById !== "function") return false;
                ns.addById(itemId, amount);
                return true;
            } catch (e) {
                console.warn(`${LOG} player.inventory.addById failed`, itemId, e);
                return false;
            }
        },

        /**
         * Whether the inventory holds at least one of an item.
         *
         * Distinct from `addById`: it reads state instead of mutating it.
         */
        hasById(itemId: ItemId): boolean {
            try {
                const ns = g()?.api?.player?.inventory;
                if (typeof ns?.hasById !== "function") return false;
                return ns.hasById(itemId) === true;
            } catch (e) {
                console.warn(`${LOG} player.inventory.hasById failed`, itemId, e);
                return false;
            }
        },

        /** Alias of {@link inventory.addById}. */
        addFromId(itemId: ItemId, amount?: number): boolean {
            return player.inventory.addById(itemId, amount);
        },
    },
    buildings: {
        unlockById(structureId: string): boolean {
            try {
                const fn = g()?.api?.player?.buildings?.unlockById;
                if (typeof fn !== "function") return false;
                fn(structureId);
                return true;
            } catch (e) {
                console.error(`${LOG} player.buildings.unlockById failed`, structureId, e);
                return false;
            }
        },

        /** Host alias of {@link buildings.unlockById}. */
        unlockByType(structureId: StructureId): boolean {
            return player.buildings.unlockById(structureId);
        },

        removeById(structureId: string): boolean {
            try {
                const fn = g()?.api?.player?.buildings?.removeById;
                if (typeof fn !== "function") return false;
                fn(structureId);
                return true;
            } catch (e) {
                console.error(`${LOG} player.buildings.removeById failed`, structureId, e);
                return false;
            }
        },
    },

    /** Player position in world units. */
    getPositionAtWorld(): Vector2 {
        try {
            return (g()?.api?.player?.getPositionAtWorld?.() ??
                { x: 0, y: 0 }) as Vector2;
        } catch (e) {
            console.warn(`${LOG} player.getPositionAtWorld failed`, e);
            return { x: 0, y: 0 };
        }
    },

    /**
     * Scale movement speed.
     *
     * The engine short-circuits any value other than exactly `1`
     * (`bundel.js` 52123-52125), so pass `1` to restore default speed.
     */
    setMovementSpeedMultiplier(multiplier: number): boolean {
        try {
            const ns = g()?.api?.player;
            if (typeof ns?.setMovementSpeedMultiplier !== "function") return false;
            ns.setMovementSpeedMultiplier(multiplier);
            return true;
        } catch (e) {
            console.warn(`${LOG} player.setMovementSpeedMultiplier failed`, e);
            return false;
        }
    },

    /**
     * Switch the player movement mode.
     *
     * Documented as `"normal" | "hover"`
     * (`doc/doc-artifacts/doc.api/shared/api.player.md`). Typed as `string`
     * because the engine's own validation could not be traced in the shipped
     * bundle — an unknown value is not rejected there, so check before
     * relying on one.
     */
    setMovementMode(mode: string): boolean {
        try {
            const ns = g()?.api?.player;
            if (typeof ns?.setMovementMode !== "function") return false;
            ns.setMovementMode(mode);
            return true;
        } catch (e) {
            console.warn(`${LOG} player.setMovementMode failed`, mode, e);
            return false;
        }
    },

    /** Whether the player is standing on solid ground. */
    isOnGround(): boolean {
        try {
            return g()?.api?.player?.isOnGround?.() === true;
        } catch (e) {
            console.warn(`${LOG} player.isOnGround failed`, e);
            return false;
        }
    },

    /** Snap the player down onto the nearest ground below. */
    teleportToGround(): boolean {
        try {
            const ns = g()?.api?.player;
            if (typeof ns?.teleportToGround !== "function") return false;
            ns.teleportToGround();
            return true;
        } catch (e) {
            console.warn(`${LOG} player.teleportToGround failed`, e);
            return false;
        }
    },

    /** Whether the player currently overlaps a given cell. */
    isCollidingWithCell(cellX: number, cellY: number): boolean {
        try {
            return g()?.api?.player?.isCollidingWithCell?.(cellX, cellY) === true;
        } catch (e) {
            console.warn(`${LOG} player.isCollidingWithCell failed`, cellX, cellY, e);
            return false;
        }
    },

    /** Whether the player is within `radiusCells` of a cell's position. */
    isWithinRadiusOfCell(
        cellX: number,
        cellY: number,
        radiusCells: number,
    ): boolean {
        try {
            return g()?.api?.player?.isWithinRadiusOfCell?.(
                cellX,
                cellY,
                radiusCells,
            ) === true;
        } catch (e) {
            console.warn(
                `${LOG} player.isWithinRadiusOfCell failed`,
                cellX,
                cellY,
                e,
            );
            return false;
        }
    },

    /** Whether a world position is free of solid geometry. */
    isPositionClearAtWorld(worldX: number, worldY: number): boolean {
        try {
            const ns = g()?.api?.player;
            const fn = ns?.isPositionClearAtWorld ?? ns?.isWorldPositionClear;
            if (typeof fn !== "function") return false;
            return fn.call(ns, worldX, worldY) === true;
        } catch (e) {
            console.warn(
                `${LOG} player.isPositionClearAtWorld failed`,
                worldX,
                worldY,
                e,
            );
            return false;
        }
    },

    /** Alias of {@link isPositionClearAtWorld}. */
    isWorldPositionClear(worldX: number, worldY: number): boolean {
        return player.isPositionClearAtWorld(worldX, worldY);
    },

    /** Alias of {@link getPositionAtWorld}. */
    getWorldPosition(): Vector2 {
        return player.getPositionAtWorld();
    },

    /** Move the player to a world position. */
    setPositionAtWorld(worldX: number, worldY: number): boolean {
        try {
            const ns = g()?.api?.player;
            const fn = ns?.setPositionAtWorld ?? ns?.setWorldPosition;
            if (typeof fn !== "function") return false;
            fn.call(ns, worldX, worldY);
            return true;
        } catch (e) {
            console.warn(`${LOG} player.setPositionAtWorld failed`, worldX, worldY, e);
            return false;
        }
    },

    /** Alias of {@link setPositionAtWorld}. */
    setWorldPosition(worldX: number, worldY: number): boolean {
        return player.setPositionAtWorld(worldX, worldY);
    },

    /** Set the player's velocity in world units per second. */
    setVelocity(velocityX: number, velocityY: number): boolean {
        try {
            const ns = g()?.api?.player;
            if (typeof ns?.setVelocity !== "function") return false;
            ns.setVelocity(velocityX, velocityY);
            return true;
        } catch (e) {
            console.warn(`${LOG} player.setVelocity failed`, e);
            return false;
        }
    },
};
