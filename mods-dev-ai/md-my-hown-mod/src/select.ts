import { api, getSandkit } from "./api.ts";
import { ITEM_ID } from "./constants.ts";

/** True when the configurator tool is the active hotbar item. */
export function isToolSelected(): boolean {
    const a = getSandkit()?.api ?? api;
    try {
        if (typeof a?.items?.isActiveById === "function") {
            return a.items.isActiveById(ITEM_ID) === true;
        }
    } catch { /* */ }
    try {
        const active = a?.items?.getActive?.();
        if (active?.id === ITEM_ID) return true;
    } catch { /* */ }
    try {
        const sel = a?.action?.getSelected?.();
        const id = sel?.id ?? sel;
        if (id === ITEM_ID) return true;
    } catch { /* */ }
    return false;
}
