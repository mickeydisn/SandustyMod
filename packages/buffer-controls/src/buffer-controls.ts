/**
 * registerBufferControls — wire a JsonBuffer record to placeable structures.
 *
 * This is the single entry point of @sandmd/buffer-controls. Given a declarative
 * config (one `field` per exposed path + the generic kind art + labels) it:
 *   1. builds the JsonBuffer seed record from the field list,
 *   2. loads each field's own art plus the generic kind art,
 *   3. re-shapes a restored record onto the field list (fills new knobs, drops
 *      removed ones) and builds the catalogue (variables / value / action),
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
    BufferControlsSprites,
} from "./types.ts";
import { boundFields, buildBufferControlList } from "./catalogue.ts";
import { buildFieldsRecord, fieldsToSprites, normalizeFieldsRecord } from "./fields.ts";
import { formatBufferValue } from "./structure/register/valueRegister.ts";
import { registerStructures } from "./structure/register.ts";

export async function registerBufferControls<T extends object>(
    config: BufferControlsConfig<T>,
): Promise<BufferControlsHandles<T>> {
    const { modId } = config;

    const buffer = new JsonBuffer<T>({
        key: config.bufferId,
        // Derived from the field list — the caller never hand-writes a seed
        // record that could drift from the declared paths/defaults.
        defaultRecord: buildFieldsRecord<T>(config.fields),
        assertShape: config.assertShape,
        maxBytes: config.maxBytes,
        persist: config.storage.persist,
        loadFromStorage: config.storage.load,
        observe: false,
    });
    // -- 2. Sprites ----------------------------------------------------------
    // Each field's own art, followed by the generic kind/action art it falls
    // back to. Every entry carries its own filePath, so there is no second file
    // table; entries sharing a spriteId (same art for several fields) load once.
    const sprites: BufferControlsSprites = [
        ...config.kindSprites,
        ...fieldsToSprites(config.fields),
    ];
    const spriteEntries = [
        ...new Map(
            sprites.map((s) => [
                s.spriteId,
                { id: s.spriteId, filePath: s.filePath },
            ]),
        ).values(),
    ];
    const spriteIds = await loadSpriteMap(modId, spriteEntries);

    // -- 3. BuildingList: one item per declared field ------------------------
    // The field list owns the record shape: a restored record is re-shaped onto
    // it first (declared values kept, missing defaults filled, removed knobs
    // dropped), so an older save can never break the strict path ↔ field match.
    const normalized = normalizeFieldsRecord<T>(
        buffer.listPaths(config.pathScan),
        config.fields,
        (path) => buffer.getPath(path),
    );
    if (normalized.changed) {
        buffer.replace(normalized.record);
        buffer.commit();
    }

    // Each listed path is matched to its declared field, so the item's tag and
    // category come from the config — never from a path segment's position.
    const bound = boundFields(buffer.listPaths(config.pathScan), config.fields);
    const { buildList: buildList, pathCount } = buildBufferControlList(
        modId,
        bound,
        config,
        sprites,
        spriteIds,
    );

    // The picker swatch resolver: entry id → loaded sprite id.
    const spriteFor = (item: CatalogueItem): string => {
        const spriteId = item.spriteId;
        if (typeof spriteId !== "string") {
            throw new Error(`Buffer-controls item "${item.id}" has no resolved sprite.`);
        }
        return spriteId;
    };

    // -- 4. Structures — one loop registers every catalogue item across all
    //        categories (menu / variable / value / action) via the register/*
    //        modules, and returns the runtime handles we need to keep synced. ---
    const { refreshSignals, valueEntries } = registerStructures(buffer, buildList);

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
        const value = buffer.getPath(entry.path);
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
        pickerId: config.picker.id,
        slot: config.picker.slot,
        title: config.picker.title,
        persistSelection: config.picker.persistSelection,
        unlockTypes: (types) => {
            for (const type of types) sandkit.api.player.buildings.unlockByType(type);
        },
        spriteIdFor: spriteFor,
    });
    console.log(`[${modId}] loaded ${pathCount} jsonBuffer paths`);
    return { buffer, list: buildList, pathCount, refresh };
}
