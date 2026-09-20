import { ICON_PATH, ICON_SPRITE_ID, ITEM_ID, KEY, LOG } from "./constants.ts";
import { api } from "./api.ts";

export function isLensSelected(): boolean {
  try {
    if (typeof api.items.isActiveById === "function") {
      return api.items.isActiveById(ITEM_ID) === true;
    }
  } catch { /* fall through */ }
  try {
    return api.items.getActive?.()?.id === ITEM_ID;
  } catch {
    return false;
  }
}

function addLensOnce(): void {
  try {
    if (typeof api.player.inventory.hasById === "function") {
      if (api.player.inventory.hasById(ITEM_ID)) return;
    }
  } catch { /* add */ }
  try {
    api.player.inventory.addById(ITEM_ID);
  } catch (err) {
    console.warn(`${LOG} inventory add failed`, err);
  }
}

function dedupeLensCopies(): number {
  try {
    const inventory = (globalThis as any).sandkit?.state?.store?.player?.inventory as
      | Array<{ id?: unknown }>
      | undefined;
    if (!Array.isArray(inventory)) return 0;
    let seen = false;
    let removed = 0;
    for (let i = inventory.length - 1; i >= 0; i--) {
      if (inventory[i]?.id !== ITEM_ID) continue;
      if (seen) {
        inventory.splice(i, 1);
        removed++;
      } else seen = true;
    }
    return removed;
  } catch {
    return 0;
  }
}

export async function registerLens(): Promise<void> {
  try {
    api.i18n?.register("en", {
      [KEY.itemName]: "Ghost Lens 2",
      [KEY.itemDesc]:
        "Ghost view of the hidden world over the live map. Use Map Viewer for config.",
    });
  } catch (err) {
    console.warn(`${LOG} i18n failed`, err);
  }
  try {
    await api.sprites.loadFromMod(ICON_SPRITE_ID, ICON_PATH);
  } catch (err) {
    console.warn(`${LOG} icon load failed`, err);
  }
  try {
    api.items.register({
      id: ITEM_ID,
      nameKey: KEY.itemName,
      descriptionKey: KEY.itemDesc,
      name: "Ghost Lens 2",
      sprite: { id: ICON_SPRITE_ID },
    });
    addLensOnce();
  } catch (err) {
    console.warn(`${LOG} item registration failed`, err);
  }
  const removed = dedupeLensCopies();
  if (removed > 0) console.log(`${LOG} removed ${removed} duplicate lens entries`);
}
