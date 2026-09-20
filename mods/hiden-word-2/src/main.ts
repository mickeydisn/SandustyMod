/**
 * Hiden Word 2 — cleaned Hidden World + full generator stages from sandgenerator-web.
 *
 * Tools:
 *   Ghost Lens  — translucent overlay on the live map
 *   Map Viewer  — 80% panel: left config + low-res full map preview
 */

import {
  DEFAULT_GHOST_ALPHA_PERCENT,
  GHOST_ALPHA_PERCENT_MAX,
  GHOST_ALPHA_PERCENT_MIN,
  LOG,
} from "./constants.ts";
import { api } from "./api.ts";
import { VERSION } from "./ids.ts";
import { registerLens } from "./lens.ts";
import { registerMapViewer } from "./mapViewer.ts";
import { registerParamsOverlay } from "./overlay.ts";
import { ensureSeedRecord } from "./persistence.ts";
import { paintGhostView } from "./render.ts";
import { runtime } from "./state.ts";

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
      `(seed ${runtime.seed}, ${runtime.width}×${runtime.height})`,
  );

  await registerLens();
  await registerMapViewer();
  registerParamsOverlay();

  try {
    applyAlphaPercent(api.settings.get("ghostAlphaPercent"));
    api.settings.onChange((values) => applyAlphaPercent(values?.ghostAlphaPercent));
  } catch (err) {
    console.warn(`${LOG} settings unavailable, default alpha`, err);
  }

  api.events.on("frame:render", () => paintGhostView());
  api.events.on("game:ready", () => {
    try {
      api.ui.toast(
        `HIDEN WORLD 2 v${VERSION} — Ghost Lens + Map Viewer`,
        {},
      );
    } catch { /* */ }
  });
} catch (err) {
  console.error(`${LOG} boot failed:`, err);
}
