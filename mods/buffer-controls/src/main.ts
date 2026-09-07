/**
 * Buffer Controls — connects a JsonBuffer record to placeable structures.
 *
 * Every path in the jsonBuffer record becomes a catalogue item (a
 * "BuildingList" like the sandustry-icons mod):
 *   - one single unlocked menu entry (assets/other/display.png) opens the picker,
 *   - one structure per path, drawn with its kind icon (assets/types/*.png)
 *     plus the record path as text,
 *   - a custom picker overlay lists all paths (icon + text) in a single
 *     "Variables" category, with no size selector.
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/dev";
import { loadSpriteMap } from "@sandmd/assets";
import { createBuildList } from "@sandmd/catalogue";
import type { BuildList, CatalogueCategory, CatalogueItem } from "@sandmd/catalogue";
import { JsonBuffer } from "@sandmd/buffer";

import {
    EXPOSED_KINDS,
    KIND_SPRITE_KEY,
    type PathCatalogueItem,
    registerPathStructures,
} from "./structure/register.ts";
import { createVariablePicker } from "./picker.ts";

const MOD_ID = "buffer-controls";
const MENU_ID = "buffer-controls";
const VARIABLE_CATEGORY = "variables";
const BUFFER_ID = `${MOD_ID}:gameConfig`;

interface GameConfig {
    volume: number;
    muted: boolean;
    label: string;
    players: { name: string; score: number }[];
}

/** Sprites: one per FieldKind under assets/types/ + the menu entry icon. */
const SPRITE_FILES = [
    { id: "number", filePath: "assets/types/number.png" },
    { id: "bolean", filePath: "assets/types/bolean.png" },
    { id: "string", filePath: "assets/types/string.png" },
    { id: "menu", filePath: "assets/other/display.png" },
];

const CELL = 16;
/** Variable structures are 1 cell wide × 6 cells tall (6 × 15px). */
const STRUCT_H = 6 * 15;

async function main() {
    const api = sandkit.api;

    // -- 1. The jsonBuffer record we expose to the player --------------------
    const buffer = new JsonBuffer<GameConfig>(MOD_ID, BUFFER_ID, {
        volume: 1,
        muted: false,
        label: "hello",
        players: [{ name: "Bob", score: 0 }],
    });

    // -- 2. Sprites ----------------------------------------------------------
    const spriteIds = await loadSpriteMap(MOD_ID, SPRITE_FILES);
    const kindSpriteId = (kind: string): string | undefined =>
        spriteIds[KIND_SPRITE_KEY[kind as keyof typeof KIND_SPRITE_KEY] ?? "string"];
    const spriteFor = (item: CatalogueItem): string | undefined =>
        item.id === MENU_ID
            ? spriteIds["menu"]
            : kindSpriteId((item as PathCatalogueItem).kind ?? "string");

    // -- 3. BuildingList: one item per scalar path in the record -------------
    // Only bool / number / string paths are exposed for now.
    const paths = buffer.listPaths().filter((field) => EXPOSED_KINDS.includes(field.kind));
    const items: PathCatalogueItem[] = [
        {
            id: MENU_ID,
            label: "Buffer Controls",
            description: "Buffer Controls — opens the variable picker.",
            category: VARIABLE_CATEGORY,
            width: CELL,
            height: CELL,
            filePath: "assets/other/display.png",
        },
        ...paths.map((field) => ({
            id: field.path,
            label: field.path,
            description: `${field.kind} — linked to jsonBuffer path "${field.path}".`,
            category: VARIABLE_CATEGORY,
            width: CELL,
            height: STRUCT_H,
            filePath: "assets/types/string.png",
            kind: field.kind,
        })),
    ];

    const categories: CatalogueCategory[] = [
        { id: VARIABLE_CATEGORY, label: "Variables" },
    ];

    const list: BuildList = createBuildList({
        modId: MOD_ID,
        menuId: MENU_ID,
        menuLabel: "Buffer Controls",
        categories,
        catalogueItems: items as CatalogueItem[],
        selectedId: paths[0]?.path,
    });

    // -- 4. Structures (menu entry unlocked + one per path) ------------------
    registerPathStructures(list, spriteFor);

    // -- 5. Custom picker: icon + path rows, single category, no sizes -------
    createVariablePicker({
        list,
        title: "Buffer variables",
        spriteFor,
    });

    api.ui?.toast?.(`Buffer Controls — ${paths.length} variables loaded`, {});
    console.log(`[${MOD_ID}] loaded ${paths.length} jsonBuffer paths`);
}

try {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);
    console.log("==== STATE STORE === ", sandkit.state?.store);
    void main();
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    console.error(e);
}
