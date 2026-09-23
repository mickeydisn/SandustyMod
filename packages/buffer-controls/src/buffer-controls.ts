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
import type { BufferControlsConfig, BufferControlsHandles } from "./types.ts";
import { boundFields, buildBufferControlList, resolveSpriteEntry } from "./catalogue.ts";
import { formatBufferValue } from "./structure/register/valueRegister.ts";
import { registerStructures } from "./structure/register.ts";

export async function registerBufferControls<T extends object>(
    config: BufferControlsConfig<T>,
): Promise<BufferControlsHandles<T>> {
    const { modId } = config;

    // -- 1. The jsonBuffer record we expose to the player --------------------
    // `persist` defaults to true: JsonBuffer.loadFromStorage is opt-in and must
    // be enabled here or the record is only saved, never restored on reload.
    const buffer = new JsonBuffer<T>(
        modId,
        config.bufferId,
        config.defaultRecord,
        undefined,
        config.persist ?? true,
        config.persistLoad ?? true,
    );
    // console.log("[pkg-buffControl] 0", modId, config);
    const readBuffer = (path: string): unknown => buffer.getPath(path);
    // console.log("[pkg-buffControl]1 ", modId, buffer.get(), buffer.listPaths());

    // -- 2. Sprites ----------------------------------------------------------
    // The package extracts the load list straight from `config.sprites`: each
    // entry carries its own filePath, so there is no second file table to keep
    // in sync. Entries sharing a spriteId (same art for several conditions)
    // are loaded once.
    const spriteEntries = [
        ...new Map(
            config.sprites.map((s) => [
                s.spriteId,
                { id: s.spriteId, filePath: s.filePath },
            ]),
        ).values(),
    ];
    const spriteIds = await loadSpriteMap(modId, spriteEntries);
    const menuItemId = config.menuItemId ?? modId;

    // -- 3. BuildingList: one item per scalar path in the record -------------
    // The catalogue resolves each item's sprite entry itself (itemId / tag /
    // kind+action / kind) and takes the loaded id from `spriteIds`.
    const bound = boundFields(buffer.listPaths());
    const { buildList: buildList, pathCount } = buildBufferControlList(
        modId,
        bound,
        config,
        spriteIds,
    );

    // The picker swatch resolver: entry id → loaded sprite id.
    const spriteFor = (item: CatalogueItem): string | undefined =>
        spriteIds[
            resolveSpriteEntry(config.sprites, item, menuItemId, config.menu.spriteId) ?? ""
        ];

    // console.log("[pkg-buffControl], 3 ", buildList, pathCount);

    // -- 4. Structures — one loop registers every catalogue item across all
    //        categories (menu / variable / value / action) via the register/*
    //        modules, and returns the runtime handles we need to keep synced. ---
    const { refreshSignals, valueEntries } = registerStructures(buffer, buildList);

    // console.log("[pkg-buffControl], 4 ", valueEntries);

    // -- 5. Keep every placed value structure in sync with the buffer --------
    // The value structure's draw only reads structure.data.dataValue. Whenever
    // the buffer updates, look at all placed value structures (forEachOfType
    // walks the live world) and setData the current value of their path, so the
    // draw always shows the LAST buffer value.
    const valueByType = new Map<
        string,
        { typeId: string; path: string; kind: Parameters<typeof formatBufferValue>[1] }
    >();
    for (const entry of valueEntries) valueByType.set(entry.typeId, entry);

    const refreshOne = (typeId: string): void => {
        const entry = valueByType.get(typeId);
        if (!entry) return;
        const value = readBuffer(entry.path);
        const next = formatBufferValue(value, entry.kind);
        sandkit.api.structures.forEachOfType(entry.typeId, (structure) => {
            if (String(structure.data?.dataValue) === next) return;
            sandkit.api.structures.setData(structure, { dataValue: next }, {
                propagateToWorkers: true,
            });
        });
    };

    const refresh = (onlyTypeId?: string) => {
        // Push every action structure's signal output (recompute + setAll on
        // each placed action) so connected receivers re-apply it. Event-driven:
        // runs only when the buffer actually changes, never per-frame.
        if (onlyTypeId) {
            // Targeted path (placement): only the placed type can need a
            // seeded value. Full signal refresh stays on buffer commits.
            refreshOne(onlyTypeId);
            return;
        }
        refreshSignals();
        for (const entry of valueEntries) refreshOne(entry.typeId);
    };

    // React to local commits — every buffer write in this mod happens on the
    // main thread (action structures call writeBuffer() -> commit()), so the
    // subscribe/notify path below covers all changes. No polling needed.
    // If a worker ever writes the buffer too, have it push a custom event via
    // sandkit.api.main.emitEvent("buffer:changed") (worker side) and pull() it
    // in a listener here instead of re-adding a setInterval.
    buffer.subscribe(() => refresh());
    // Refresh once so value structures placed in an earlier session pick up
    // the current buffer value immediately.
    refresh();
    // Placement path: seed ONLY the placed type. The old code called the full
    // refresh() (every value type × full world scan + every action signal) on
    // EVERY placement in the game — including vanilla walls. Guard on our own
    // mod prefix first so foreign placements cost one string check.
    sandkit.api.events?.on?.("building:placed", (payload) => {
        try {
            const p = payload as { structure?: { type?: string } };
            const type = p.structure?.type;
            if (typeof type !== "string" || !type.startsWith(`${modId}:`)) return;
            refresh(type);
        } catch {
            /* best-effort seed */
        }
    });

    // -- 6. Custom picker: icon + path rows, category tabs -------------------
    createPickerOverlay({
        list: buildList,
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
    return { buffer, list: buildList, pathCount, refresh };
}
