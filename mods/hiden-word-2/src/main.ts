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
import { registerMaterializer } from "./materializer.ts";
import { registerExplorer } from "./explorer.ts";
import { registerParamsOverlay } from "./overlay.ts";
import { ensureSeedRecord, persistRecord } from "./persistence.ts";
import { resetExplorationFromMap } from "./exploration.ts";
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

function applyExplorationSetting(value: unknown): void {
  const enabled = value === true || value === "true" || value === 1;
  const prev = !!runtime.params.explorationEnabled;
  runtime.params.explorationEnabled = enabled;
  if (enabled && !prev) {
    resetExplorationFromMap();
  } else if (!enabled) {
    runtime.explored = null;
  }
  runtime.cache = null; // rebuild ghost with/without mask
  try { persistRecord(); } catch { /* */ }
}

try {
  const { created } = ensureSeedRecord();
  console.log(
    `${LOG} v${VERSION} — hidden world ${created ? "created" : "loaded"} ` +
      `(seed ${runtime.seed}, ${runtime.width}×${runtime.height})`,
  );

  await registerLens();
  await registerMapViewer();
  await registerMaterializer();
  await registerExplorer();
  registerParamsOverlay();

  try {
    applyAlphaPercent(api.settings.get("ghostAlphaPercent"));
    applyExplorationSetting(api.settings.get("explorationEnabled"));
    api.settings.onChange((values) => {
      if (values && "ghostAlphaPercent" in values) {
        applyAlphaPercent(values.ghostAlphaPercent);
      }
      if (values && "explorationEnabled" in values) {
        applyExplorationSetting(values.explorationEnabled);
      }
    });
  } catch (err) {
    console.warn(`${LOG} settings unavailable, defaults`, err);
  }

  api.events.on("frame:render", () => paintGhostView());
  api.events.on("game:ready", () => {
    try {
      api.ui.toast(
        `HIDEN WORLD 2 v${VERSION} — Lens · Viewer · Manifest · Explorer`,
        {},
      );
    } catch { /* */ }
  });
} catch (err) {
  console.error(`${LOG} boot failed:`, err);
}
