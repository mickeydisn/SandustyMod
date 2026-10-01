/**
 * Is a statistic tool currently the active hotbar item?
 *
 * The overlay stays mounted the whole time and simply returns `null` from its
 * render when the tool is not held, so switching tools only needs a repaint.
 */
import { api, safe } from "./api.ts";

export function isToolSelected(itemId: string): boolean {
    const byId = safe(() => api.items?.isActiveById?.(itemId), false);
    if (byId !== null) return byId === true;
    return safe(() => api.items?.getActive?.()?.id === itemId, false) === true;
}
