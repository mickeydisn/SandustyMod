/**
 * Persist panel position / zoom / opacity / lock / mini state.
 */
import { api, safe } from "./api.ts";
import { MOD_ID } from "./constants.ts";
import type { PanelPos } from "./types.ts";

const POS_KEY = "ui_pos";
const ZOOM_KEY = "ui_zoom";
const ALPHA_KEY = "ui_alpha";
const LOCK_KEY = "ui_lock";
const MINI_KEY = "ui_mini";

export function loadPos(): PanelPos {
    const raw = safe(() => api.storage.get(MOD_ID, POS_KEY), null) as PanelPos | null;
    if (raw && typeof raw.right === "number" && typeof raw.top === "number") return raw;
    return { right: 16, top: 80 };
}

export function savePanelPos(pos: PanelPos): void {
    safe(() => api.storage.set(MOD_ID, POS_KEY, pos));
}

export function loadZoom(): number {
    const v = safe(() => api.storage.get(MOD_ID, ZOOM_KEY), 1);
    return typeof v === "number" && v > 0.4 && v < 2.5 ? v : 1;
}

export function saveZoom(z: number): void {
    safe(() => api.storage.set(MOD_ID, ZOOM_KEY, z));
}

export function loadAlpha(): number {
    const v = safe(() => api.storage.get(MOD_ID, ALPHA_KEY), 1);
    return typeof v === "number" && v >= 0.3 && v <= 1 ? v : 1;
}

export function saveAlpha(a: number): void {
    safe(() => api.storage.set(MOD_ID, ALPHA_KEY, a));
}

export function loadLocked(): boolean {
    return !!safe(() => api.storage.get(MOD_ID, LOCK_KEY), false);
}

export function saveLocked(v: boolean): void {
    safe(() => api.storage.set(MOD_ID, LOCK_KEY, v));
}

export function loadMinimized(): boolean {
    return !!safe(() => api.storage.get(MOD_ID, MINI_KEY), false);
}

export function saveMinimized(v: boolean): void {
    safe(() => api.storage.set(MOD_ID, MINI_KEY, v));
}
