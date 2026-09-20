import {
  KEY,
  LOG,
  VIEWER_ICON_PATH,
  VIEWER_ICON_SPRITE_ID,
  VIEWER_ITEM_ID,
  VIEWER_OVERLAY_ID,
} from "../constants.ts";
import { api } from "../api.ts";
import { MapViewerPanel, isViewerSelected } from "./panel.ts";
import { paintIfVisible } from "./preview.ts";
import { injectViewerStyles } from "./styles.ts";

export { isViewerSelected, paintIfVisible };

export async function registerMapViewer(): Promise<void> {
  injectViewerStyles();

  try {
    api.i18n?.register("en", {
      [KEY.viewerName]: "Map Viewer",
      [KEY.viewerDesc]:
        "Full hidden-world map preview with Map stages + Modifiers pipeline.",
    });
  } catch (err) {
    console.warn(`${LOG} viewer i18n failed`, err);
  }

  try {
    await api.sprites.loadFromMod(VIEWER_ICON_SPRITE_ID, VIEWER_ICON_PATH);
  } catch (err) {
    console.warn(`${LOG} viewer icon load failed`, err);
  }

  try {
    api.items.register({
      id: VIEWER_ITEM_ID,
      nameKey: KEY.viewerName,
      descriptionKey: KEY.viewerDesc,
      name: "Map Viewer",
      sprite: { id: VIEWER_ICON_SPRITE_ID },
    });
  } catch (err) {
    console.warn(`${LOG} viewer item register failed`, err);
  }

  try {
    if (typeof api.player.inventory.hasById === "function") {
      if (!api.player.inventory.hasById(VIEWER_ITEM_ID)) {
        api.player.inventory.addById(VIEWER_ITEM_ID);
      }
    } else {
      api.player.inventory.addById(VIEWER_ITEM_ID);
    }
  } catch (err) {
    console.warn(`${LOG} viewer inventory add failed`, err);
  }

  try {
    api.ui.overlays.register("global", VIEWER_OVERLAY_ID, () => MapViewerPanel());
  } catch (err) {
    console.warn(`${LOG} viewer overlay register failed`, err);
  }

  try {
    api.events.on("action:changed", () => {
      requestAnimationFrame(() => paintIfVisible());
    });
  } catch { /* */ }

  console.log(`${LOG} Map Viewer tool registered`);
}
