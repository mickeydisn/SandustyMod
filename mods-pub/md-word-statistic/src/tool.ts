/**
 * Register the World Statistic tool item and the global overlay.
 * Overlay is visible only while this tool is the active hotbar item.
 */
import { registerStatisticTool } from "@sandmd/ui";
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
    await registerStatisticTool({
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
    });
}
