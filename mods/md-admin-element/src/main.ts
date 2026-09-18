/**
 * mdadmin — dev helper entry point.
 *
 * On load it opens the DevTools console and injects a panel (toggle: Alt+L) that
 * lists every registered element. Elements added by mods carry a "Remove" button
 * that deletes them from the live element registry.
 *
 * Removal is PERSISTENT: the element ids are remembered in mod storage and the
 * scrub is re-applied on every load (init + game:ready + a short interval), so a
 * remembered id is deleted again even if it re-registers — elements do not come
 * back on reload.
 *
 * This file only wires the modules together; see `registry.ts` for the element
 * registry and `panel.ts` for the HUD component.
 */
import { api, h, React, safe } from "./api.ts";
import { LOG, PANEL_ID, TOGGLE_KEY, VERSION } from "./constants.ts";
import { MdAdminPanel } from "./panel.ts";
import { reapplyRemovals } from "./registry.ts";
import { repaintPanel, state } from "./state.ts";

/** Open the Electron DevTools console (non-fatal when unavailable). */
function openDevTools(): void {
    try {
        const electron = (globalThis as { electron?: { openDevTools?: () => void } }).electron;
        electron?.openDevTools?.();
    } catch {
        /* devtools bridge unavailable */
    }
}

/** Alt+L toggles the panel. Capture phase so the game never sees the key. */
function registerToggle(): void {
    globalThis.addEventListener?.(
        "keydown",
        (event: Event) => {
            const e = event as KeyboardEvent;
            if (!e.altKey || e.code !== TOGGLE_KEY) return;
            state.open = !state.open;
            repaintPanel();
            e.preventDefault();
            e.stopPropagation();
        },
        true,
    );
}

/** Keep the blacklist applied as mods (and save-ghosted elements) re-register. */
function persistRemovals(): void {
    reapplyRemovals();
    safe(() => api.events.on("game:ready", reapplyRemovals));
    setTimeout(reapplyRemovals, 1000);
    setInterval(reapplyRemovals, 2000);
}

function init(): void {
    openDevTools();
    registerToggle();
    persistRemovals();

    if (!h || !React) {
        console.warn(`${LOG} sandkit.react missing — panel unavailable`);
        return;
    }
    const dispose = safe(() => api.ui.inject?.(PANEL_ID, MdAdminPanel));
    if (!dispose) console.warn(`${LOG} api.ui.inject failed — panel unavailable`);
}

try {
    init();
    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
}
