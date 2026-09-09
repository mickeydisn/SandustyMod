/**
 * registerBufferControls — wire a JsonBuffer record to placeable structures.
 *
 * This is the single entry point of @sandmd/buffer-controls. Given a declarative
 * config (record, sprite ids, labels) it:
 *   1. builds the JsonBuffer,
 *   2. loads the sprites,
 *   3. builds the catalogue (variables / value / action categories),
 *   4. registers the path, value and action structures,
 *   5. subscribes to the buffer so every placed value structure shows the last
 *      value (setData on each placed structure via api.structures.forEachOfType),
 *   6. creates the picker overlay.
 *
 * The mod keeps only boot/dev concerns + the config object; all generic wiring
 * lives here so it can be reused by any mod exposing a jsonBuffer record.
 */
import "@sandmd/sandkit";
import { loadSpriteMap } from "@sandmd/assets";
import { JsonBuffer } from "@sandmd/buffer";
import { type CatalogueItem, createPickerOverlay } from "@sandmd/catalogue";
import type {
    BufferControlsConfig,
    BufferControlsHandles,
    BufferControlsKindSprites,
} from "./types.ts";
import { boundFields, buildBufferControlList } from "./catalogue.ts";
import type { ActionCatalogueItem } from "./structure/actionRegister.ts";
import { registerActionStructures } from "./structure/actionRegister.ts";
import { type PathCatalogueItem, registerPathStructures } from "./structure/varRegister.ts";
import { formatBufferValue, registerValueStructures } from "./structure/valueRegister.ts";

export async function registerBufferControls<T extends object>(
    config: BufferControlsConfig<T>,
): Promise<BufferControlsHandles<T>> {
    const { modId } = config;

    // -- 1. The jsonBuffer record we expose to the player --------------------
    const buffer = new JsonBuffer<T>(modId, config.bufferId, config.defaultRecord);
    const readBuffer = (path: string): unknown => buffer.getPath(path);
    const writeBuffer = (path: string, value: unknown): void => {
        buffer.setPath(path, value);
        buffer.commit(); // encode + bump version + notify subscribers
    };
    console.log("[pkg-buffControl], 1 ", buffer.get(), buffer.listPaths());

    // -- 2. Sprites ----------------------------------------------------------
    // loadSpriteMap resolves each entry id ("number", "menu", "actionPlus", …)
    // to the full in-game sprite id; config.sprites/menu reference entry ids.
    const spriteIds = await loadSpriteMap(modId, config.spriteFiles);
    const menuItemId = config.menuItemId ?? modId;
    const spriteFor = (item: CatalogueItem): string | undefined => {
        if (item.id === menuItemId) return spriteIds[config.menu.spriteId];
        const action = (item as ActionCatalogueItem).action;
        if (action) return spriteIds[config.sprites.action[action]];
        const kind = ((item as PathCatalogueItem).kind ?? "string") as
            | keyof BufferControlsKindSprites
            | string;
        return spriteIds[config.sprites.kind[kind as keyof BufferControlsKindSprites] ?? "string"];
    };

    // -- 3. BuildingList: one item per scalar path in the record -------------
    const bound = boundFields(buffer.listPaths());
    const { list, pathCount } = buildBufferControlList(modId, bound, config);

    console.log("[pkg-buffControl], 3 ", list, pathCount);

    // -- 4. Structures (menu entry unlocked + one per path, per category) ----
    registerPathStructures(list, spriteFor);
    const valueEntries = registerValueStructures(list, spriteFor, readBuffer);
    registerActionStructures(list, spriteFor, readBuffer, writeBuffer);
    console.log("[pkg-buffControl], 4 ", valueEntries);

    // -- 5. Keep every placed value structure in sync with the buffer --------
    // The value structure's draw only reads structure.data.dataValue. Whenever
    // the buffer updates, look at all placed value structures (forEachOfType
    // walks the live world) and setData the current value of their path, so the
    // draw always shows the LAST buffer value.
    const refresh = () => {
        for (const entry of valueEntries) {
            const value = readBuffer(entry.path);
            const next = formatBufferValue(value, entry.kind);
            sandkit.api.structures.forEachOfType(entry.typeId, (structure) => {
                if (String(structure.data?.dataValue) === next) return;
                sandkit.api.structures.setData(structure, { dataValue: next }, {
                    propagateToWorkers: true,
                });
            });
        }
    };

    // React to local commits (including action clicks) AND to changes another
    // side wrote: pull() is a cheap version-compare and fires the subscription
    // only on a real change. The 500 ms poll mirrors the pattern the game uses.
    buffer.subscribe(() => refresh());
    setInterval(() => {
        buffer.pull();
    }, 500);
    // Refresh once so value structures placed in an earlier session pick up
    // the current buffer value immediately, then on new placements too.
    refresh();
    sandkit.api.events?.on?.("building:placed", () => refresh());

    // -- 6. Custom picker: icon + path rows, category tabs, no sizes ---------
    // createVariablePicker({ list, title: config.pickerTitle, spriteFor });
    createPickerOverlay({
        list,
        /** Overlay id. Default `${modId}/picker`. */
        pickerId: "buffControl:",
        /** Overlay slot. Default "hotbar". */
        title: config.pickerTitle,
        /**
         * Resolves the sprite id actually loaded for an item. Defaults to
         * `item.spriteId ?? mod structure-type`, but mods that load sprites under
         * their own id scheme (e.g. `modId:<id>`) must supply this so the swatches
         * show the correct art.
         */

        spriteIdFor: spriteFor,
    });
    console.log(`[${modId}] loaded ${pathCount} jsonBuffer paths`);
    return { buffer, list, pathCount, refresh };
}
