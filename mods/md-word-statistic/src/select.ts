import { api } from "./api.ts";
import { ITEM_ID } from "./constants.ts";

/** True when the Word Statistic tool is the active hotbar item. */
export function isToolSelected(): boolean {
    try {
        if (typeof api.items?.isActiveById === "function") {
            return api.items.isActiveById(ITEM_ID) === true;
        }
    } catch { /* */ }
    try {
        return api.items?.getActive?.()?.id === ITEM_ID;
    } catch {
        return false;
    }
    return false;
}
