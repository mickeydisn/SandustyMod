/**
 * Is the Player Statistic tool currently the active hotbar item?
 */
import { api, safe } from "./api.ts";
import { ITEM_ID } from "./constants.ts";

export function isToolSelected(): boolean {
    return !!safe(() => api.items?.isActiveById?.(ITEM_ID), false);
}
