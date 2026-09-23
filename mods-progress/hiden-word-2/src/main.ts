import {
  DEFAULT_GHOST_ALPHA_PERCENT,
  GHOST_ALPHA_PERCENT_MAX,
  GHOST_ALPHA_PERCENT_MIN,
  LOG,
} from "./world/constants.ts";
import { api } from "./api/api.ts";
import { VERSION } from "./api/ids.ts";
import { registerLens } from "./tools/lens.ts";
import { registerMapTools } from "./viewer/register.ts";
import { registerMaterializer } from "./tools/materializer.ts";
import { registerExplorer } from "./tools/explorer.ts";
import { bindPersistHooks, ensureSeedRecord, persistRecord, reloadPersistedTags } from "./world/persistence.ts";
import { resetTagsFromMap } from "./world/tags.ts";
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
  if (enabled && !prev) resetTagsFromMap();
  else if (!enabled) { runtime.explored = null; runtime.tags = null; }
  runtime.tags = null;
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
  await registerMapTools();
  await registerMaterializer();
  await registerExplorer();
  bindPersistHooks();

  // Exploration tags always on
  runtime.params.explorationEnabled = true;
  try { resetTagsFromMap(); } catch { /* */ }

  try {
    applyAlphaPercent(api.settings.get("ghostAlphaPercent"));
    api.settings.onChange((values) => {
      if (values && "ghostAlphaPercent" in values) {
        applyAlphaPercent(values.ghostAlphaPercent);
      }
    });
  } catch (err) {
    console.warn(`${LOG} settings unavailable`, err);
  }

  api.events.on("frame:render", () => paintGhostView());
  api.events.on("game:ready", () => {
    try {
      const live = (api as any).grid?.getDimensions?.();
      if (live) {
        const w = live.widthCells ?? live.width ?? 0;
        const h = live.heightCells ?? live.height ?? 0;
        if (w > 0 && h > 0) {
          runtime.width = w;
          runtime.height = h;
        }
      }
    } catch { /* */ }
    reloadPersistedTags();
    try {
      api.ui.toast(`HIDEN WORLD 2 v${VERSION}`, {});
    } catch { /* */ }
  });
} catch (err) {
  console.error(`${LOG} boot failed:`, err);
}
