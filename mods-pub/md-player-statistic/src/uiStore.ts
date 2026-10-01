/**
 * Panel preferences in mod storage (not configSchema).
 *
 * Delegates to the shared `@sandmd/ui` store. The key prefix is `ui` (not
 * `panel`) so existing installs keep their persisted position and zoom.
 */
import { createUiStore } from "@sandmd/ui";
import { MOD_ID } from "./constants.ts";
import type { PanelPos } from "@sandmd/ui";

export const store = createUiStore({
    modId: MOD_ID,
    keyPrefix: "ui",
    // This mod historically allowed a wider range than the shared default.
    zoomRange: [0.4, 2.5],
    alphaRange: [0.3, 1],
    // Legacy saves used underscore-suffixed keys; keep reading those so an
    // upgrade does not silently reset a player's panel position and zoom.
    keys: {
        pos: "ui_pos",
        zoom: "ui_zoom",
        alpha: "ui_alpha",
        lock: "ui_lock",
        mini: "ui_mini",
    },
});

export const loadPos = store.loadPanelPos;
export const savePanelPos = store.savePanelPos;
export const loadZoom = store.loadZoom;
export const saveZoom = store.saveZoom;
export const loadAlpha = store.loadAlpha;
export const saveAlpha = store.saveAlpha;
export const loadLocked = store.loadLocked;
export const saveLocked = store.saveLocked;
export const loadMinimized = store.loadMinimized;
export const saveMinimized = store.saveMinimized;

export type { PanelPos };
