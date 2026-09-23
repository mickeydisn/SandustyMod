import {
  ICON_PATH,
  ICON_SPRITE_ID,
  INFINITE_LENS_ICON_PATH,
  INFINITE_LENS_ICON_SPRITE_ID,
  INFINITE_LENS_ITEM_ID,
  ITEM_ID,
  KEY,
  LOG,
} from "../world/constants.ts";
import { isItemSelected, registerToolItem } from "./shared.ts";

export function isLensSelected(): boolean {
  return isItemSelected(ITEM_ID) || isItemSelected(INFINITE_LENS_ITEM_ID);
}

/** True when Infinite Ghost Lens is active (no exploration overlay). */
export function isInfiniteLensSelected(): boolean {
  return isItemSelected(INFINITE_LENS_ITEM_ID);
}

export async function registerLens(): Promise<void> {
  await registerToolItem({
    id: ITEM_ID,
    name: "Ghost Lens",
    desc: "Ghost view of the hidden world with exploration overlay.",
    nameKey: KEY.itemName,
    descKey: KEY.itemDesc,
    spriteId: ICON_SPRITE_ID,
    spritePath: ICON_PATH,
  });

  await registerToolItem({
    id: INFINITE_LENS_ITEM_ID,
    name: "Infinite Ghost Lens",
    desc: "Ghost view of the full hidden map — no exploration fog overlay.",
    nameKey: KEY.infiniteLensName,
    descKey: KEY.infiniteLensDesc,
    spriteId: INFINITE_LENS_ICON_SPRITE_ID,
    spritePath: INFINITE_LENS_ICON_PATH,
  });

  console.log(`${LOG} Ghost lenses registered`);
}
