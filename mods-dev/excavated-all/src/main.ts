/**
 * excavated-all — main-thread entry point.
 *
 * Wires the pieces together: load persisted radius/filters, register the
 * Total Excavator tool + its hotbar panel, and paint the brush-radius
 * indicator every frame while the tool is selected.
 *
 * See `engine.ts` for the actual terrain/element/structure removal logic,
 * `tool.ts` for the item + input plumbing, and `panel.ts` for the hotbar UI.
 */
import "@sandmd/sandkit";
import { api, safe } from "./api.ts";
import { LOG, VERSION } from "./ids.ts";
import { loadPersisted } from "./state.ts";
import { registerTool, paintBrushOverlay } from "./tool.ts";
import { registerPanel } from "./panel.ts";

async function init(): Promise<void> {
    loadPersisted();
    await registerTool();
    registerPanel();

    // The overlay canvas is cleared/composited by the engine every render
    // frame, so the brush circle has to be (re)drawn from *inside* that same
    // frame — drawing it from a plain setInterval races the engine's own
    // clear and never shows up. `hiden-word-2`'s reference tool paints its
    // brush from exactly this event (see world/render.ts → frame:render).
    let sawFrameEvent = false;
    safe(() => api.events.on("frame:render", () => {
        sawFrameEvent = true;
        paintBrushOverlay();
    }));

    // Defensive fallback only: if this build never fires `frame:render`,
    // keep the circle visible via a short poll instead of losing it silently.
    setInterval(() => {
        if (!sawFrameEvent) paintBrushOverlay();
    }, 33);

    safe(() => api.events.on("game:ready", () => {
        safe(() => api.ui.toast(`Excavated All v${VERSION} ready`, {}));
    }));
}

try {
    init();
    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
}
