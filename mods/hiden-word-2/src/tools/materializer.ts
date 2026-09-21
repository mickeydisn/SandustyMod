/** World Manifest + Infinite Manifest — registration & activation. */

import {
  INFINITE_MATERIALIZER_ENERGY,
  INFINITE_MATERIALIZER_ICON_PATH,
  INFINITE_MATERIALIZER_ICON_SPRITE_ID,
  INFINITE_MATERIALIZER_ITEM_ID,
  INFINITE_MATERIALIZER_OVERLAY_ID,
  KEY,
  LOG,
  MATERIALIZER_ENERGY,
  MATERIALIZER_ICON_PATH,
  MATERIALIZER_ICON_SPRITE_ID,
  MATERIALIZER_ITEM_ID,
  MATERIALIZER_OVERLAY_ID,
  MATERIALIZER_RADIUS_DEFAULT,
  MATERIALIZER_RADIUS_MAX,
  MATERIALIZER_RADIUS_MIN,
} from "../world/constants.ts";
import { materializeBrush } from "../world/materialize.ts";
import { isTagsEnabled, patchGhostRegion } from "../world/tags.ts";
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

const radiusState: RadiusState = { value: MATERIALIZER_RADIUS_DEFAULT };
const infiniteRadius: RadiusState = { value: MATERIALIZER_RADIUS_DEFAULT };

export function isMaterializerSelected(): boolean {
  return isItemSelected(MATERIALIZER_ITEM_ID) || isItemSelected(INFINITE_MATERIALIZER_ITEM_ID);
}

function fireManifest(infinite: boolean, quiet: boolean): void {
  const cell = readMouseCell();
  if (!cell) return;

  const energy = infinite ? INFINITE_MATERIALIZER_ENERGY : MATERIALIZER_ENERGY;
  if (!tryEnergy(energy)) {
    if (!quiet) toast("Not enough energy");
    return;
  }

  const r = infinite ? infiniteRadius.value : radiusState.value;
  const result = materializeBrush(cell.x, cell.y, r, {
    skipMaterialised: !infinite,
    requireMaterialisedContact: !infinite && isTagsEnabled(),
  });

  if (result.blocked) {
    if (!quiet) toast("Must touch a Materialised zone");
    return;
  }

  const changed = result.painted + result.taggedMat + result.taggedExp;
  if (changed > 0) {
    patchGhostRegion(cell.x - r - 4, cell.y - r - 4, cell.x + r + 4, cell.y + r + 4);
    schedulePersist();
  }
  // no spam toasts on success — only rare blocks above
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (persistTimer != null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try { persistExploredOnly(); } catch { /* */ }
  }, 600);
}

export function paintManifestBrush(): void {
  if (isItemSelected(MATERIALIZER_ITEM_ID)) {
    paintBrushRing(radiusState.value, "rgba(120, 200, 255, 0.9)");
  } else if (isItemSelected(INFINITE_MATERIALIZER_ITEM_ID)) {
    paintBrushRing(infiniteRadius.value, "rgba(255, 180, 80, 0.9)");
  }
}

export async function registerMaterializer(): Promise<void> {
  injectToolBarStyles();

  await registerToolItem({
    id: MATERIALIZER_ITEM_ID,
    name: "World Manifest",
    desc: "Materialise hidden terrain. Needs Materialised contact; skips already materialised cells.",
    nameKey: KEY.materializerName,
    descKey: KEY.materializerDesc,
    spriteId: MATERIALIZER_ICON_SPRITE_ID,
    spritePath: MATERIALIZER_ICON_PATH,
    energyCost: MATERIALIZER_ENERGY,
  });

  await registerToolItem({
    id: INFINITE_MATERIALIZER_ITEM_ID,
    name: "Infinite World Manifest",
    desc: "Repaint freely — no Materialised contact, can overwrite materialised cells.",
    nameKey: KEY.infiniteMaterializerName,
    descKey: KEY.infiniteMaterializerDesc,
    spriteId: INFINITE_MATERIALIZER_ICON_SPRITE_ID,
    spritePath: INFINITE_MATERIALIZER_ICON_PATH,
    energyCost: INFINITE_MATERIALIZER_ENERGY,
  });

  const a = rawApi();
  try {
    a.ui.overlays.register(
      "hotbar",
      MATERIALIZER_OVERLAY_ID,
      makeRadiusBar("Manifest r", radiusState, MATERIALIZER_RADIUS_MIN, MATERIALIZER_RADIUS_MAX, MATERIALIZER_ITEM_ID),
    );
  } catch { /* */ }
  try {
    a.ui.overlays.register(
      "hotbar",
      INFINITE_MATERIALIZER_OVERLAY_ID,
      makeRadiusBar("Infinite r", infiniteRadius, MATERIALIZER_RADIUS_MIN, MATERIALIZER_RADIUS_MAX, INFINITE_MATERIALIZER_ITEM_ID),
    );
  } catch { /* */ }

  bindHoldFire({
    itemId: MATERIALIZER_ITEM_ID,
    onFire: (_s, quiet) => fireManifest(false, quiet),
  });
  bindHoldFire({
    itemId: INFINITE_MATERIALIZER_ITEM_ID,
    onFire: (_s, quiet) => fireManifest(true, quiet),
  });

  console.log(`${LOG} Manifest tools registered`);
}
