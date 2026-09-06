/**
 * Sandustry Icons — decorative catalogue (deco-style picker, no cost).
 */

import { loadSpriteMap } from "../../../packages/assets/index.ts";

import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/dev";
import { CatalogueItem, createBuildList } from "@sandmd/catalogue";
import { createPickerOverlay } from "@sandmd/catalogue";
import { ICON_CATEGORIES, ICON_FILES, ICON_ITEMS } from "./catalogue.generated.ts";
import { registerIconStructures } from "./structure/register.ts";
import { JsonBuffer } from "@sandmd/buffer";

const MOD_ID = "buffer-controls";
const MENU_ID = "icons";
const BUFFER_ID = `${MOD_ID}:gameConfig`;

async function mainOlder() {
    const api = sandkit.api;

    const spriteIds = await loadSpriteMap(MOD_ID, ICON_FILES, {
        assetDir: "",
        concurrency: 16,
    });

    const list = createBuildList({
        modId: MOD_ID,
        menuId: MENU_ID,
        menuLabel: "Icons",
        categories: ICON_CATEGORIES,
        catalogueItems: ICON_ITEMS,
        selectedId: ICON_ITEMS.find((i) => i.id !== MENU_ID)?.id,
    });

    registerIconStructures(list, spriteIds);

    // The picker renders with React and reads enums, both of which the game
    // exposes on `sandkit.*` (the root), not on `sandkit.api`. Feed them into the
    // host so createElement/useState/useEffect and ActionType.Building resolve.

    createPickerOverlay({
        list,
        title: "Pick icon",
        pickerId: `${MOD_ID}/picker`,
        // Sprites are loaded under `sandustry.icons:<id>` (see loadSpriteMap), not
        // the structure-type id `sandustry.icons:item/<id>`. Resolve them here so
        // the picker swatches show the correct art.
        spriteIdFor: (item: CatalogueItem) => spriteIds[item.id],
    });
    api.ui?.toast?.(`Sandustry Icons — ${ICON_ITEMS.length} objects loaded`, {});
    console.log(`[${MOD_ID}] loaded ${ICON_ITEMS.length} catalogue entries`);
}
// -----------

interface GameConfig {
    volume: number;
    muted: boolean;
    players: { name: string; score: number }[];
}

async function main() {
    const spriteIds = await loadSpriteMap(MOD_ID, ICON_FILES, {
        assetDir: "",
        concurrency: 16,
    });

    console.log("=== SPRITE ", spriteIds);

    const buffer = new JsonBuffer<GameConfig>(
        MOD_ID,
        BUFFER_ID,
        { volume: 1, muted: false, players: [{ name: "Bob", score: 0 }] } as GameConfig,
    );
    const buffer2 = new JsonBuffer<GameConfig>(
        MOD_ID,
        BUFFER_ID,
        { volume: 1, muted: false, players: [{ name: "Bob", score: 0 }] } as GameConfig,
    );

    // buffer.setPath("volume", 2);
    const path = buffer.listPaths();

    console.log("LIST _PATH");
}

try {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);
    const storage = sandkit.api.storage.ensure(MOD_ID) as Record<string, any> | null;
    console.log("STORE", storage);

    console.log("getGridMetrics:", sandkit.api.rendering.getGridMetrics());
    /*
  if (storage) {
    for (const key in Object.keys(storage)) {
      sandkit.api.storage.local.remove(key);
    }
  }
  */
    void main();
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    console.error(e);
}
