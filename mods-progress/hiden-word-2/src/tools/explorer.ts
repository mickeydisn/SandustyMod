/** Fog Explorer + Deep Fog Explorer — registration & activation. */

import {
  DEEP_EXPLORER_ENERGY,
  DEEP_EXPLORER_ICON_PATH,
  DEEP_EXPLORER_ICON_SPRITE_ID,
  DEEP_EXPLORER_ITEM_ID,
  DEEP_EXPLORER_OVERLAY_ID,
  EXPLORER_ENERGY,
  EXPLORER_ICON_PATH,
  EXPLORER_ICON_SPRITE_ID,
  EXPLORER_ITEM_ID,
  EXPLORER_OVERLAY_ID,
  EXPLORER_RADIUS_DEFAULT,
  EXPLORER_RADIUS_MAX,
  EXPLORER_RADIUS_MIN,
  KEY,
  LOG,
} from "../world/constants.ts";
import { runtime } from "../world/state.ts";
import {
  applyDeepFogExplorer,
  applyFogExplorer,
  isTagsEnabled,
  patchGhostRegion,
} from "../world/tags.ts";
import { persistExploredOnly } from "../world/persistence.ts";
import {
  bindHoldFire,
  injectToolBarStyles,
  isItemSelected,
  makeRadiusBar,
  paintBrushRing,
  readMouseCell,
  registerToolItem,
  toast,
  tryEnergy,
  type RadiusState,
  rawApi,
} from "./shared.ts";

const fogRadius: RadiusState = { value: EXPLORER_RADIUS_DEFAULT };
const deepRadius: RadiusState = { value: EXPLORER_RADIUS_DEFAULT };

export function isExplorerSelected(): boolean {
  return isItemSelected(EXPLORER_ITEM_ID) || isItemSelected(DEEP_EXPLORER_ITEM_ID);
}

function fireExplorer(deep: boolean, quiet: boolean): void {
  if (!isTagsEnabled()) {
    if (!quiet) toast("Enable Exploration mode in mod settings");
    return;
  }
  if (!runtime.data) {
    if (!quiet) toast("Generate hidden map first");
    return;
  }
  const cell = readMouseCell();
  if (!cell) {
    if (!quiet) toast("No cursor cell");
    return;
  }
  const energy = deep ? DEEP_EXPLORER_ENERGY : EXPLORER_ENERGY;
  if (!tryEnergy(energy)) {
    if (!quiet) toast("Not enough energy");
    return;
  }
  const r = deep ? deepRadius.value : fogRadius.value;
  if (deep) {
    const { explored } = applyDeepFogExplorer(cell.x, cell.y, r);
    if (explored > 0) {
      patchGhostRegion(cell.x - r - 2, cell.y - r - 2, cell.x + r + 2, cell.y + r + 2);
      schedulePersist();
    }
  } else {
    const res = applyFogExplorer(cell.x, cell.y, r);
    if (res.blocked) {
      if (!quiet) toast("Must touch a Materialised zone");
      return;
    }
    if (res.materialised + res.explored > 0) {
      patchGhostRegion(cell.x - r - 2, cell.y - r - 2, cell.x + r + 2, cell.y + r + 2);
      schedulePersist();
    }
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (persistTimer != null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try { persistExploredOnly(); } catch { /* */ }
  }, 600);
}

export function paintExplorerBrush(): void {
  if (isItemSelected(EXPLORER_ITEM_ID)) {
    paintBrushRing(fogRadius.value, "rgba(255, 200, 80, 0.9)");
  } else if (isItemSelected(DEEP_EXPLORER_ITEM_ID)) {
    paintBrushRing(deepRadius.value, "rgba(180, 100, 255, 0.9)");
  }
}

export async function registerExplorer(): Promise<void> {
  injectToolBarStyles();

  await registerToolItem({
    id: EXPLORER_ITEM_ID,
    name: "Fog Explorer",
    desc: "Tag fog as Materialised (needs Materialised contact). 2px border → Explored.",
    nameKey: KEY.explorerName,
    descKey: KEY.explorerDesc,
    spriteId: EXPLORER_ICON_SPRITE_ID,
    spritePath: EXPLORER_ICON_PATH,
    energyCost: EXPLORER_ENERGY,
  });

  await registerToolItem({
    id: DEEP_EXPLORER_ITEM_ID,
    name: "Deep Fog Explorer",
    desc: "Reveal fog as Explored only — no Materialised contact required.",
    nameKey: KEY.deepExplorerName,
    descKey: KEY.deepExplorerDesc,
    spriteId: DEEP_EXPLORER_ICON_SPRITE_ID,
    spritePath: DEEP_EXPLORER_ICON_PATH,
    energyCost: DEEP_EXPLORER_ENERGY,
  });

  const a = rawApi();
  try {
    a.ui.overlays.register(
      "hotbar",
      EXPLORER_OVERLAY_ID,
      makeRadiusBar("Explore r", fogRadius, EXPLORER_RADIUS_MIN, EXPLORER_RADIUS_MAX, EXPLORER_ITEM_ID),
    );
  } catch { /* */ }
  try {
    a.ui.overlays.register(
      "hotbar",
      DEEP_EXPLORER_OVERLAY_ID,
      makeRadiusBar("Deep r", deepRadius, EXPLORER_RADIUS_MIN, EXPLORER_RADIUS_MAX, DEEP_EXPLORER_ITEM_ID),
    );
  } catch { /* */ }

  bindHoldFire({
    itemId: EXPLORER_ITEM_ID,
    onFire: (_s, quiet) => fireExplorer(false, quiet),
  });
  bindHoldFire({
    itemId: DEEP_EXPLORER_ITEM_ID,
    onFire: (_s, quiet) => fireExplorer(true, quiet),
  });

  console.log(`${LOG} Explorer tools registered`);
}
