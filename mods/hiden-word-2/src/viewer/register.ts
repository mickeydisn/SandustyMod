import {
  EDITOR_ICON_PATH,
  EDITOR_ICON_SPRITE_ID,
  EDITOR_ITEM_ID,
  EDITOR_OVERLAY_ID,
  KEY,
  LOG,
  VIEWER_ICON_PATH,
  VIEWER_ICON_SPRITE_ID,
  VIEWER_ITEM_ID,
  VIEWER_OVERLAY_ID,
} from "../world/constants.ts";
import { api } from "../api/api.ts";
import { MapViewerPanel, isEditorSelected, isViewerSelected } from "./panel.ts";
import { paintIfVisible } from "./preview.ts";
import { injectViewerStyles } from "./styles.ts";
import { registerToolItem } from "../tools/shared.ts";

export { isEditorSelected, isViewerSelected, paintIfVisible };

export async function registerMapTools(): Promise<void> {
  injectViewerStyles();

  await registerToolItem({
    id: EDITOR_ITEM_ID,
    name: "Map Editor",
    desc: "Edit generation params and preview the hidden world.",
    nameKey: KEY.editorName,
    descKey: KEY.editorDesc,
    spriteId: EDITOR_ICON_SPRITE_ID,
    spritePath: EDITOR_ICON_PATH,
  });

  await registerToolItem({
    id: VIEWER_ITEM_ID,
    name: "Map Viewer",
    desc: "Preview-only view of the hidden world map.",
    nameKey: KEY.viewerName,
    descKey: KEY.viewerDesc,
    spriteId: VIEWER_ICON_SPRITE_ID,
    spritePath: VIEWER_ICON_PATH,
  });

  // One global overlay — panel decides editor vs viewer mode from active item
  try {
    api.ui.overlays.register("global", EDITOR_OVERLAY_ID, () => MapViewerPanel());
  } catch (err) {
    console.warn(`${LOG} editor overlay failed`, err);
  }
  try {
    // alias id for safety if something still references viewer overlay
    api.ui.overlays.register("global", VIEWER_OVERLAY_ID, () => MapViewerPanel());
  } catch { /* */ }

  try {
    api.events.on("action:changed", () => {
      requestAnimationFrame(() => paintIfVisible());
    });
  } catch { /* */ }

  console.log(`${LOG} Map Editor + Map Viewer registered`);
}

/** @deprecated use registerMapTools */
export const registerMapViewer = registerMapTools;
