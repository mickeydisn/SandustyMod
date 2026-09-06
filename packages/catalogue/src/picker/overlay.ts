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
import { CatalogueItem } from "../strucutre/types.ts";
import { persistSelection, restorePickerState } from "../list/persistence.ts";
import { createPickerView } from "./content.ts";
import type { PickerContentApi, PickerOverlay, PickerOverlayOptions } from "./types.ts";

type PickerState = { minimized: boolean } | null;

export function createPickerOverlay(
    options: PickerOverlayOptions,
): PickerOverlay {
    const list = options.list;
    const pickerId = options.pickerId ?? `${list.modId}/picker`;
    const slot = options.slot ?? "hotbar";
    const title = options.title ?? "Pick item";
    const maxHeight = options.maxHeight ?? 400;

    let pickerState: PickerState = null;
    let repaint: (() => void) | null = null;
    let clearTooltip: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;
    let registered = false;

    if (options.persistSelection !== false) restorePickerState(list);

    const unlockTypes = options.unlockTypes ??
        ((types: string[]) => {
            for (const type of types) sandkit.api.player.buildings.unlockByType(type);
        });

    const persistIfEnabled = () => {
        if (options.persistSelection !== false) persistSelection(list);
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

    const selectItem = (item: CatalogueItem) => {
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
        list.setCategory(categoryId);
        const item = list.itemsInCategory(categoryId)[0];
        if (item) selectStructure(list.structureType(item.id, !list.isMirrored()));
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
        maxHeight,
        spriteIdFor: options.spriteIdFor,
        itemFilter: options.itemFilter,
        renderItemBadge: options.renderItemBadge,
        renderHeaderExtra: options.renderHeaderExtra,
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
     */
    const currentSelectedItem = (): CatalogueItem | undefined => {
        const selected = sandkit.api.action.getSelected?.();
        const building = sandkit.enums.ActionType.Building;
        if (!selected || !building || selected.type !== building) {
            return undefined;
        }
        const id = selected.id;
        if (!id || !id.startsWith(`${list.modId}:`)) return undefined;
        return list.itemFromType(id);
    };

    const sync = () => {
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
    };
    const install = () => {
        if (registered) return;
        sandkit.api.ui.overlays.register(slot, pickerId, render);
        registered = true;
        // Event-driven: the engine emits `action:changed` every time the selected
        // action changes (select, build-menu pick, deselect). `events.on` returns
        // an unsubscribe; we run `sync()` once after registration to catch the
        // current state (e.g. picking a structure from the build menu).
        unsubscribe = sandkit.api.events.on("action:changed", sync);
        sync();
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
