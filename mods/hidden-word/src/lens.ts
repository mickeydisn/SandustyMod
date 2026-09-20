/**
 * Hidden World — the Ghost Lens item.
 *
 * Registers the custom hotbar item (sprite → item → inventory). The ghost
 * view of the hidden terrain is shown while the lens is the player's selected
 * item — `render.ts` checks the active item each frame, so no use/toggle
 * wiring is needed here.
 */

import { ICON_PATH, ICON_SPRITE_ID, ITEM_ID, KEY, LOG } from "./constants.ts";
import { api } from "./api.ts";

/**
 * Whether the Ghost Lens is the item the player currently holds. Shared by
 * the ghost painter (visibility) and the params overlay (open/close).
 */
export function isLensSelected(): boolean {
    try {
        if (typeof api.items.isActiveById === "function") {
            return api.items.isActiveById(ITEM_ID) === true;
        }
    } catch {
        /* fall through */
    }
    try {
        return api.items.getActive?.()?.id === ITEM_ID;
    } catch {
        return false;
    }
}

/** Add the lens to the inventory only once (prevents menu duplicates). */
function addLensOnce(): void {
    try {
        if (typeof api.player.inventory.hasById === "function") {
            if (api.player.inventory.hasById(ITEM_ID)) return;
        }
    } catch {
        /* hasById unavailable — fall through and add */
    }
    try {
        api.player.inventory.addById(ITEM_ID);
    } catch (err) {
        console.warn(`${LOG} inventory add failed`, err);
    }
}

/**
 * Collapse duplicate Ghost Lens entries in the player inventory — every mod
 * reload used to push another copy (the inventory is the store's plain
 * `player.inventory` array). Keeps the first copy; returns the removed count.
 */
function dedupeLensCopies(): number {
    try {
        const inventory = sandkit.state?.store?.player?.inventory as
            | Array<{ id?: unknown }>
            | undefined;
        if (!Array.isArray(inventory)) return 0;
        let seen = false;
        let removed = 0;
        for (let i = inventory.length - 1; i >= 0; i--) {
            if (inventory[i]?.id !== ITEM_ID) continue;
            if (seen) {
                inventory.splice(i, 1);
                removed++;
            } else {
                seen = true;
            }
        }
        return removed;
    } catch {
        return 0;
    }
}

/** Register i18n strings, the item sprite and the item itself. */
export async function registerLens(): Promise<void> {
    try {
        api.i18n?.register("en", {
            [KEY.itemName]: "Ghost Lens",
            [KEY.itemDesc]:
                "Peer into the hidden world. The ghost view shows while the lens is selected.",
        });
    } catch (err) {
        console.warn(`${LOG} i18n failed`, err);
    }

    // Sprites must load before items.register — the UI resolves sprite ids then.
    try {
        await api.sprites.loadFromMod(ICON_SPRITE_ID, ICON_PATH);
    } catch (err) {
        console.warn(`${LOG} icon load failed`, err);
    }

    try {
        api.items.register({
            id: ITEM_ID,
            nameKey: KEY.itemName,
            descriptionKey: KEY.itemDesc,
            name: "Ghost Lens",
            sprite: { id: ICON_SPRITE_ID },
        });
        addLensOnce();
    } catch (err) {
        console.warn(`${LOG} item registration failed`, err);
    }

    const removed = dedupeLensCopies();
    if (removed > 0) console.log(`${LOG} removed ${removed} duplicate Ghost Lens entries`);
}
