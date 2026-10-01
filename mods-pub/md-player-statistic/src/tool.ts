/**
 * Register the Player Statistic tool item and the global overlay.
 * Overlay is visible only while this tool is the active hotbar item (or locked).
 *
 * ## `items.register` requires a *loaded* sprite — it is not optional
 *
 * The engine does, with no guard:
 *
 * ```js
 * const n = e.sandkit.graphics[t.sprite.id];
 * const o = n.texture;              // ← TypeError when the sprite is missing
 * ```
 *
 * so a missing/failed `loadFromMod` does not degrade gracefully: it throws,
 * the item is never registered, `inventory.addById` then throws reading
 * `.cooldown` off the missing definition, the tool never reaches the hotbar,
 * `isToolSelected()` is permanently false and the overlay can never open.
 * We check the sprite up front and report it as the hard error it is.
 */
import { api, ITEM_TYPE_TOOL, registerStatisticTool, safe } from "@sandmd/ui";
import {
    DESC_KEY,
    ITEM_ID,
    LOG,
    NAME_KEY,
    OVERLAY_ID,
    SPRITE_ID,
    SPRITE_PATH,
    TOOL_DESC,
    TOOL_NAME,
} from "./constants.ts";
import { StatisticPanel } from "./panel.ts";

let itemRegistered = false;

/** True once `items.register` actually succeeded. */
export function isToolRegistered(): boolean {
    return itemRegistered;
}

/**
 * Put the tool in the player's hotbar. Safe to call repeatedly.
 * Returns true once the tool is known to be in the inventory.
 *
 * The mod boots at the main menu, where there is no player inventory yet, so
 * the first attempt is a no-op. `game:ready` is only ever *listened to* in the
 * engine — nothing emits it on the main thread — so we cannot depend on it.
 * `main.ts` pairs this with a `game:started` listener plus a bounded retry.
 */
export function ensureToolInInventory(): boolean {
    if (!itemRegistered) return false;
    return safe(() => {
        const inv = api.player?.inventory;
        if (!inv) return false;
        if (typeof inv.hasById === "function") {
            if (inv.hasById(ITEM_ID)) return true;
            inv.addById(ITEM_ID);
            return inv.hasById(ITEM_ID);
        }
        inv.addById?.(ITEM_ID);
        return true;
    }, false) === true;
}

let watchTimer: ReturnType<typeof setInterval> | null = null;
let watchTicks = 0;
const WATCH_INTERVAL_MS = 2000;
/** ~3 minutes of retries — long enough to cover menu → world transitions. */
const WATCH_MAX_TICKS = 90;

/**
 * Keep offering the tool until it lands in the hotbar, then stop so it costs
 * nothing for the rest of the session.
 */
export function startInventoryWatch(): void {
    stopInventoryWatch();
    watchTicks = 0;
    watchTimer = setInterval(() => {
        if (ensureToolInInventory() || ++watchTicks >= WATCH_MAX_TICKS) {
            stopInventoryWatch();
        }
    }, WATCH_INTERVAL_MS);
}

export function stopInventoryWatch(): void {
    if (watchTimer != null) {
        clearInterval(watchTimer);
        watchTimer = null;
    }
}

export async function registerTool(): Promise<void> {
    const res = await registerStatisticTool({
        log: LOG,
        itemId: ITEM_ID,
        overlayId: OVERLAY_ID,
        spriteId: SPRITE_ID,
        spritePath: SPRITE_PATH,
        nameKey: NAME_KEY,
        descKey: DESC_KEY,
        toolName: TOOL_NAME,
        toolDesc: TOOL_DESC,
        render: StatisticPanel,
        itemType: ITEM_TYPE_TOOL,
        // A missing sprite is a hard error here: without it the tool silently
        // never reaches the hotbar and the overlay can never open.
        requireSprite: true,
    });
    itemRegistered = res.itemRegistered;
    if (res.ok) ensureToolInInventory();
}

export function unregisterTool(): void {
    safe(() => api.ui.overlays?.unregister?.("global", OVERLAY_ID));
    // ⚠️ The runtime `api.items` facade exposes no `unregister`, and
    // `player.inventory` exposes no `removeById` — the item definition and the
    // hotbar entry therefore survive a disable. Only the overlay is torn down.
    itemRegistered = false;
}
