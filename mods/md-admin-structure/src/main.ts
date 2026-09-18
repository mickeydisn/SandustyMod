/**
 * md-admin-structure — dev panel entry point (toggle: Alt+O).
 *
 * Lists structures: every mod-registered structure plus the player's unlocked
 * structures (built-ins). Filter by owning mod and by hideFromBuildMenu.
 * Unlock any structure via api.player.buildings.unlockById(id), or remove it
 * via api.player.buildings.removeById(id).
 *
 * This file only wires the modules together; see `data.ts` for the structure
 * sources and `panel.ts` for the HUD component.
 */
import { api, h, React, safe } from "./api.ts";
import { LOG, PANEL_ID, TOGGLE_KEY, VERSION } from "./constants.ts";
import { StructurePanel } from "./panel.ts";
import { repaintPanel, state } from "./state.ts";

/** Alt+O toggles the panel. Capture phase so the game never sees the key. */
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

function init(): void {
    registerToggle();

    if (!h || !React) {
        console.warn(`${LOG} sandkit.react missing — panel unavailable`);
        return;
    }
    const dispose = safe(() => api.ui.inject?.(PANEL_ID, StructurePanel));
    if (!dispose) console.warn(`${LOG} api.ui.inject failed — panel unavailable`);
}

try {
    init();
    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
}
