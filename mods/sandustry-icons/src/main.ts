/**
 * Sandustry Icons — decorative catalogue (deco-style picker, no cost).
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/dev";
import { loadSpriteMap } from "@sandmd/assets";

import { CatalogueItem, createBuildList } from "@sandmd/catalogue";
import { createPickerOverlay } from "@sandmd/catalogue";

import { ICON_CATEGORIES, ICON_FILES, ICON_ITEMS } from "./catalogue.generated.ts";
import { registerIconStructures } from "./register.ts";

const MOD_ID = "sandustry.icons";
const MENU_ID = "icons";

async function main() {
    const api = sandkit.api;

    const spriteIds = await loadSpriteMap(
        MOD_ID,
        ICON_FILES,
    );
    const buildList = createBuildList({
        modId: MOD_ID,
        menuId: MENU_ID,
        menuLabel: "Icons",
        categories: ICON_CATEGORIES,
        catalogueItems: ICON_ITEMS,
        selectedId: ICON_ITEMS.find((i) => i.id !== MENU_ID)?.id,
    });

    registerIconStructures(buildList, spriteIds);

    // The picker renders with React and reads enums, both of which the game
    // exposes on `sandkit.*` (the root), not on `sandkit.api`. Feed them into the
    // host so createElement/useState/useEffect and ActionType.Building resolve.

    createPickerOverlay({
        list: buildList,
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

try {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);

    void main();
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    console.error(e);
}
