/**
 * Hidden World — mod entry point.
 *
 * A generated terrain the exact size of the real map exists only as data (a
 * "shadow world"): no elements, no structures, no interaction. While the
 * Ghost Lens item is selected, a translucent view of it is drawn over the
 * normal map display.
 *
 * Boot order: seed persistence → item registration → config (ghost alpha) →
 * frame painter.
 */

import "@sandmd/sandkit";
import { api } from "./api.ts";
import {
    DEFAULT_GHOST_ALPHA_PERCENT,
    GHOST_ALPHA_PERCENT_MAX,
    GHOST_ALPHA_PERCENT_MIN,
    LOG,
} from "./constants.ts";
import { VERSION } from "./ids.ts";
import { registerLens } from "./lens.ts";
import { registerParamsOverlay } from "./overlay.ts";
import { ensureSeedRecord } from "./persistence.ts";
import { paintGhostView } from "./render.ts";
import { runtime } from "./state.ts";

/**
 * Clamp a percent config value (the config UI only takes integers) and store
 * it as a 0–1 alpha in the runtime.
 */
function applyAlphaPercent(value: unknown): void {
    const percent = typeof value === "number" && isFinite(value)
        ? value
        : DEFAULT_GHOST_ALPHA_PERCENT;
    const clamped = Math.min(
        GHOST_ALPHA_PERCENT_MAX,
        Math.max(GHOST_ALPHA_PERCENT_MIN, Math.round(percent)),
    );
    runtime.alpha = clamped / 100;
}

try {
    const { created } = ensureSeedRecord();
    console.log(
        `${LOG} v${VERSION} — hidden world ${created ? "created" : "loaded"} ` +
            `(seed ${runtime.seed}, ${runtime.width}×${runtime.height} cells)`,
    );

    await registerLens();
    registerParamsOverlay();

    try {
        applyAlphaPercent(api.settings.get("ghostAlphaPercent"));
        api.settings.onChange((values) => applyAlphaPercent(values?.ghostAlphaPercent));
    } catch (err) {
        console.warn(`${LOG} settings unavailable, using default alpha`, err);
    }

    api.events.on("frame:render", () => paintGhostView());
    api.events.on("game:ready", () => {
        try {
            api.ui.toast(`HIDDEN WORLD v${VERSION} — select the Ghost Lens`, {});
        } catch {
            /* optional */
        }
    });
} catch (err) {
    console.error(`${LOG} boot failed:`, err);
}
