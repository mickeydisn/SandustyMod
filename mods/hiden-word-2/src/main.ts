import {
  DEFAULT_GHOST_ALPHA_PERCENT,
  GHOST_ALPHA_PERCENT_MAX,
  GHOST_ALPHA_PERCENT_MIN,
  LOG,
} from "./world/constants.ts";
import { api } from "./api/api.ts";
import { VERSION } from "./api/ids.ts";
import { registerLens } from "./tools/lens.ts";
import { registerMapViewer } from "./viewer/register.ts";
import { registerMaterializer } from "./tools/materializer.ts";
import { registerExplorer } from "./tools/explorer.ts";
import { registerParamsOverlay } from "./tools/overlay.ts";
import { ensureSeedRecord, persistRecord } from "./world/persistence.ts";
import { resetExplorationFromMap } from "./world/exploration.ts";
import { paintGhostView } from "./world/render.ts";
import { runtime } from "./world/state.ts";

function applyAlphaPercent(value: unknown): void {
  const percent = typeof value === "number" && isFinite(value)
    ? value
    : DEFAULT_GHOST_ALPHA_PERCENT;
  runtime.alpha = Math.min(
    GHOST_ALPHA_PERCENT_MAX,
    Math.max(GHOST_ALPHA_PERCENT_MIN, Math.round(percent)),
  ) / 100;
}

function applyExplorationSetting(value: unknown): void {
  const enabled = value === true || value === "true" || value === 1;
  const prev = !!runtime.params.explorationEnabled;
  runtime.params.explorationEnabled = enabled;
  if (enabled && !prev) resetExplorationFromMap();
  else if (!enabled) runtime.explored = null;
  runtime.cache = null;
  try { persistRecord(); } catch { /* */ }
}

try {
  const { created } = ensureSeedRecord();
  console.log(
    `${LOG} v${VERSION} — ${created ? "created" : "loaded"} ` +
      `(${runtime.seed}, ${runtime.width}×${runtime.height})`,
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
    console.warn(`${LOG} settings unavailable`, err);
  }

  api.events.on("frame:render", () => paintGhostView());
  api.events.on("game:ready", () => {
    try {
      api.ui.toast(`HIDEN WORLD 2 v${VERSION}`, {});
    } catch { /* */ }
  });
} catch (err) {
  console.error(`${LOG} boot failed:`, err);
}
