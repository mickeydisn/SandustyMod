/**
 * Picker — overlay controller (state + game side-effects).
 *
 * This file owns the picker's *behaviour*: the open / minimized / closed state
 * machine, registration with the overlay system, and driving it from the
 * engine's `action:changed` event (which build item is currently selected).
 * The actual UI (swatches, category grid, buttons, tooltip) lives in
 * content.ts, which is a presentational view fed through {@link PickerContentApi}.
 *
 * The controller has no knowledge of DOM/React; it just reacts to state changes
 * and user intent reported by the view.
 */
import type { ResolvedCatalogueItem } from "../structure/types.ts";
import { persistSelection, restorePickerState } from "../list/persistence.ts";
import { createPickerView } from "./content.ts";
import type { PickerContentApi, PickerOverlay, PickerOverlayOptions } from "./types.ts";

type PickerState = { minimized: boolean } | null;

export function createPickerOverlay(
    options: PickerOverlayOptions,
): PickerOverlay {
    const list = options.list;
    const { pickerId, slot, title, unlockTypes } = options;

    let pickerState: PickerState = null;
    let repaint: (() => void) | null = null;
    let clearTooltip: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;

    if (options.persistSelection) restorePickerState(list);

    const persistIfEnabled = () => {
        if (options.persistSelection) persistSelection(list);
    };

    const selectStructure = (type: string) => {
        unlockTypes([type]);
        sandkit.api.building?.selectStructure?.(type);
    };
    const expand = () => {
        if (!pickerState?.minimized) return;
        pickerState = { minimized: false };
        repaint?.();
    };

    const minimize = () => {
        if (!pickerState || pickerState.minimized) return;
        clearTooltip?.();
        pickerState = { minimized: true };
        repaint?.();
    };

    const close = () => {
        clearTooltip?.();
        pickerState = null;
        repaint?.();
    };

    const selectItem = (item: ResolvedCatalogueItem) => {
        const mirrored = list.isMirrored();
        list.setSelected(item.id);
        list.setCategory(item.category);
        selectStructure(list.structureType(item.id, mirrored));
        unlockTypes([list.structureType(item.id, !mirrored)]);
        options.onSelect?.(item, mirrored);
        list.applyToBuildTool();
        persistIfEnabled();
        repaint?.();
    };

    const toggleMirror = () => {
        const next = !list.isMirrored();
        list.setMirrored(next);
        const item = list.getSelected();
        if (item) selectStructure(list.structureType(item.id, next));
        persistIfEnabled();
        repaint?.();
    };

    const chooseCategory = (categoryId: string) => {
        if (list.getCategory() == categoryId) {
            list.setCategory("");
        } else {
            list.setCategory(categoryId);
        }
        persistIfEnabled();
        repaint?.();
    };

    const choosePath = (path: string) => {
        if (list.getPath() == path) {
            list.setPath("");
        } else {
            list.setPath(path);
        }
        const tags = list.getSelectedTags();
        const sizes = list.getSelectedSizes();
        // AND across groups, OR within each group (same as the picker filter).
        const matches = (it: ResolvedCatalogueItem): boolean => {
            const itemTags = it.tags;
            const itemSizes = it.sizes;
            if (tags.length > 0 && !tags.some((t) => itemTags.includes(t))) return false;
            if (sizes.length > 0 && !sizes.some((s) => itemSizes.includes(s))) return false;
            return true;
        };
        const item = list.itemsInPath(path).find(matches);
        if (item) selectStructure(list.structureType(item.id, !list.isMirrored()));
        persistIfEnabled();
        repaint?.();
    };

    const toggleTag = (tag: string) => {
        list.toggleTag(tag);
        persistIfEnabled();
        repaint?.();
    };

    const toggleSize = (size: string) => {
        list.toggleSize(size);
        persistIfEnabled();
        repaint?.();
    };

    const clearFilters = () => {
        list.setSelectedTags([]);
        list.setSelectedSizes([]);
        persistIfEnabled();
        repaint?.();
    };
    const contentApi: PickerContentApi = {
        pickerId,
        title,
        list,
        getState: () => pickerState,
        expand,
        minimize,
        selectItem,
        toggleMirror,
        chooseCategory,
        choosePath,
        toggleTag,
        toggleSize,
        clearFilters,
        setRepaint(fn) {
            repaint = fn;
        },
        setClearTooltip(fn) {
            clearTooltip = fn;
        },
        repaint: () => repaint?.(),
    };

    const render = createPickerView({
        api: contentApi,
        spriteIdFor: options.spriteIdFor,
        itemFilter: options.itemFilter,
    });

    /**
     * Read the currently selected game build action and return the matching
     * catalogue item — or `undefined` when nothing this catalogue owns is
     * selected. The engine's `action:changed` gives no payload, so we read the
     * current selection here (the same data the old poll loop read).
     *
     * The selected action id is a structure *type* like
     * `<modId>:item/<itemId>[~mirrored]`; `list.itemFromType` maps it back to
     * the matching {@link CatalogueItem} (stripping the mirror suffix).
     *
     * NOTE: `action.getSelected()` is typed as `AssetRef` (`{ id: number,
     * type: number }`) — vanilla tools/buildings report a NUMERIC id. A bare
     * `selected.id.startsWith(...)` throws TypeError on those, which aborted
     * `sync()` before `close()` and left the overlay stuck open. Always
     * narrow to string first.
     */
    const currentSelectedItem = (): ResolvedCatalogueItem | undefined => {
        try {
            const selected = sandkit.api.action.getSelected?.() as
                | { id?: unknown; type?: unknown }
                | null
                | undefined;
            if (!selected) return undefined;
            const building = sandkit.enums?.ActionType?.Building;
            // Enum not ready yet: can't classify — treat as "not ours" so the
            // overlay closes rather than sticking.
            if (building == null) return undefined;
            if (selected.type !== building) return undefined;
            const id = selected.id;
            if (typeof id !== "string") return undefined;
            if (!id.startsWith(`${list.modId}:`)) return undefined;
            return list.itemFromType(id);
        } catch {
            // Never let a selection read abort sync — a throw here used to
            // skip close() and wedge the overlay open.
            return undefined;
        }
    };

    const sync = () => {
        try {
            const item = currentSelectedItem();
            if (!item) {
                if (pickerState) close();
                return;
            }
            if (item.id !== list.getSelected()?.id) {
                list.setSelected(item.id);
                if (pickerState) repaint?.();
            }
            if (!pickerState) {
                // Showing this catalogue's item: open the (minimized) picker.
                pickerState = { minimized: true };
                repaint?.();
            }
        } catch {
            // Sync must never throw: worst case, close a possibly-stale
            // overlay rather than leaving it wedged open.
            try {
                if (pickerState) close();
            } catch {
                /* ignore */
            }
        }
    };
    const install = () => {
        sandkit.api.ui.overlays.register(slot, pickerId, render);
        // Event-driven: the engine emits `action:changed` every time the selected
        // action changes (select, build-menu pick, deselect). `events.on` returns
        // an unsubscribe; we run `sync()` once after registration to catch the
        // current state (e.g. picking a structure from the build menu).
        // Defer via nextTick so the engine has settled `player.action` first;
        // fall back to a direct call when the scheduler is unavailable.
        const scheduleSync = () => {
            try {
                const nextTick = sandkit.api.schedule?.nextTick;
                if (typeof nextTick === "function") {
                    nextTick(sync);
                    return;
                }
            } catch {
                /* fall through to direct sync */
            }
            sync();
        };
        unsubscribe = sandkit.api.events.on("action:changed", scheduleSync);
        scheduleSync();
    };

    install();

    return {
        pickerId,
        expand,
        minimize,
        close,
        sync,
        dispose() {
            unsubscribe?.();
            unsubscribe = null;
            close();
        },
    };
}
