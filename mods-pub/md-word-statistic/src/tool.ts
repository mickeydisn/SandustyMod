/**
 * Register the World Statistic tool item and the global overlay.
 * Overlay is visible only while this tool is the active hotbar item.
 */
import { api, h, React, safe, toast } from "./api.ts";
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

export async function registerTool(): Promise<void> {
    safe(() =>
        api.i18n?.register?.("en", {
            [NAME_KEY]: TOOL_NAME,
            [DESC_KEY]: TOOL_DESC,
        })
    );

    try {
        await api.sprites?.loadFromMod?.(SPRITE_ID, SPRITE_PATH);
    } catch (err) {
        console.warn(`${LOG} sprite load failed`, err);
    }

    try {
        api.items.register({
            id: ITEM_ID,
            nameKey: NAME_KEY,
            descriptionKey: DESC_KEY,
            name: TOOL_NAME,
            description: TOOL_DESC,
            sprite: { id: SPRITE_ID },
            itemType: "tool",
            energyCost: 0,
            cooldown: { durationMs: 120 },
        });
    } catch (err) {
        console.warn(`${LOG} items.register failed`, err);
    }

    try {
        if (typeof api.player?.inventory?.hasById === "function") {
            if (!api.player.inventory.hasById(ITEM_ID)) {
                api.player.inventory.addById(ITEM_ID);
            }
        } else {
            api.player?.inventory?.addById?.(ITEM_ID);
        }
    } catch (err) {
        console.warn(`${LOG} inventory add failed`, err);
    }

    // Global overlay — panel returns null when the tool is not selected.
    if (!h || !React) {
        console.warn(`${LOG} sandkit.react missing — overlay unavailable`);
        return;
    }

    try {
        api.ui.overlays.register("global", OVERLAY_ID, () => StatisticPanel());
    } catch (err) {
        console.warn(`${LOG} overlays.register failed, trying ui.inject`, err);
        safe(() => api.ui.inject?.(OVERLAY_ID, StatisticPanel));
    }

    try {
        api.events.on("action:changed", () => {
            // Force overlay re-eval when the player switches tools.
            safe(() => api.ui.overlays.update?.("global"));
        });
    } catch { /* */ }

    toast(`${TOOL_NAME} ready`);
    console.log(`${LOG} tool + overlay registered (${ITEM_ID})`);
}
