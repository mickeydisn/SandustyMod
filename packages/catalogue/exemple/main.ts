/**
 * @sandmd/catalogue — build catalogue, picker UI, placement helpers, shapes.
 *
 * This example walks the main surface: defining a build list, mapping between
 * logical ids and world structure types, opening the picker overlay, and using
 * the alignment / cell helpers when rendering decorative structures.
 *
 *   deno check packages/catalogue/exemple/main.ts
 *
 * Note: functions that touch the live game (getGridMetrics, createPickerOverlay,
 * registerCatalogueStructures) need the in-game `sandkit`; they are documented
 * as code, not executed here.
 */

import {
    applyCellsOption,
    computeAlignedRect,
    createBuildList,
    createPickerOverlay,
    isMirroredType,
    itemIdFromType,
    resolveAlign,
    structureTypeFor,
} from "../index.ts"; // "@sandmd/catalogue";
import type { BuildList, CatalogueCategory, CatalogueItem } from "../index.ts"; // "@sandmd/catalogue";

const MOD_ID = "catalogue-example";

/** Fake sprite ids we pretend were loaded with @sandmd/assets. */
function spriteFor(itemId: string): string {
    return `${MOD_ID}:${itemId}`;
}

/** 1. Define categories + items and create the build list controller. */
function exempleBuildList(): BuildList {
    const categories: CatalogueCategory[] = [
        { id: "deco", label: "Decoration" },
        { id: "machines", label: "Machines" },
    ];

    const items: CatalogueItem[] = [
        {
            id: "vase",
            label: "Vase",
            category: "deco",
            width: 16,
            height: 24,
            align: "floor",
        },
        {
            id: "lamp",
            label: "Lamp",
            category: "deco",
            width: 16,
            height: 32,
            align: "wall",
        },
        {
            id: "conveyor",
            label: "Conveyor",
            category: "machines",
            width: 16,
            height: 16,
            data: { speed: 2 },
        },
    ];
    for (const item of items) item.spriteId = spriteFor(item.id);

    const list: BuildList = createBuildList({
        modId: MOD_ID,
        menuId: `catalogue-example:catalogue/opener`, // single entry that opens the picker
        menuLabel: "Catalogue",
        categories,
        catalogueItems: items,
        selectedId: "vase",
    });

    list.on("select", (event) => console.log("selected", event.item.id));
    list.on("mirror", (event) => console.log("mirror", event.mirrored));

    list.setSelected("lamp");
    console.log("selected type", list.getSelectedType()); // catalogue-example:item/lamp

    list.setMirrored(true);
    console.log("mirrored type", list.getSelectedType()); // ...:item/lamp~mirrored
    return list;
}

/** 2. Translate between logical ids and world structure types. */
function exempleTypeHelpers(): void {
    // item id -> unique structure type (with a mirror suffix variant)
    console.log(structureTypeFor(MOD_ID, "vase", false)); // ...:item/vase
    console.log(structureTypeFor(MOD_ID, "vase", true)); // ...:item/vase~mirrored

    // and back again: type -> item id, plus a mirror check
    const type = structureTypeFor(MOD_ID, "conveyor", true);
    console.log("mirrored?", isMirroredType(type)); // true
    console.log("item id", itemIdFromType(MOD_ID, type)); // conveyor
}

/** 3. Open (and later dispose) the picker overlay bound to a build list. */
function exemplePickerOverlay(): void {
    const list = exempleBuildList();
    const overlay = createPickerOverlay({
        list,
        title: "My catalogue",
        search: true,
        persistSelection: true,
        onSelect: (item, mirrored) => console.log("picked", item.id, mirrored),
    });

    overlay.expand();
    overlay.sync();
    overlay.minimize();
    overlay.dispose();
}

/** 4. Alignment helpers: compute where a sprite lands inside a grid cell. */
function exempleAlignment(): void {
    const rect = computeAlignedRect(
        { x: 16, y: 32 }, // top-left of the placement cell in pixels
        {
            spritePixels: { width: 16, height: 24 },
            align: resolveAlign({ align: "floor" }, "floor"),
            mirrored: false,
        },
    );
    console.log("draw rect", rect);

    // resolveAlign reads an optional "align" field (floor|wall|center)
    console.log(resolveAlign(undefined, "floor")); // floor
}

/** 5. Cell-footprint helpers used when registering multi-cell structures. */
function exempleCellsOption(): void {
    interface CellOpts {
        id: string;
        name: string;
        spriteId: string;
        cells: { w: number; h: number };
        shape?: number[][];
        renderSize?: { width: number; height: number };
    }

    const def = applyCellsOption<CellOpts>({
        id: "big-lamp",
        name: "Big Lamp",
        spriteId: spriteFor("big-lamp"),
        cells: { w: 2, h: 2 }, // auto-fills shape + renderSize
    });
    console.log("shape", def.shape);
    console.log("renderSize", def.renderSize);
}

function main() {
    exempleBuildList();
    exempleTypeHelpers();
    exempleAlignment();
    exempleCellsOption();
    // exemplePickerOverlay(); // uncomment to open the picker (game UI)
}

try {
    main();
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    console.error(e);
}
