import type { BuildList } from "./index.ts";

const KEY_SELECTED = "picker.selected";
const KEY_MIRROR = "picker.mirror";
const KEY_CATEGORY = "picker.category";

export function restorePickerState(list: BuildList) {
    if (!sandkit.api.storage) return;
    try {
        const selected = sandkit.api.storage.get(list.modId, KEY_SELECTED);
        if (
            typeof selected === "string" &&
            list.catalogueItems.some((i: { id: string }) => i.id === selected)
        ) {
            list.setSelected(selected);
        }
        const mirrored = sandkit.api.storage.get(list.modId, KEY_MIRROR);
        if (typeof mirrored === "boolean") list.setMirrored(mirrored);
        const category = sandkit.api.storage.get(list.modId, KEY_CATEGORY);
        if (typeof category === "string") list.setCategory(category);
    } catch (err) {
        console.warn("[picker-overlay] could not restore selection", err);
    }
}

export function persistSelection(list: BuildList) {
    if (!sandkit.api.storage) return;
    try {
        sandkit.api.storage.set(list.modId, KEY_SELECTED, list.getSelected()?.id ?? "");
        sandkit.api.storage.set(list.modId, KEY_MIRROR, list.isMirrored());
        sandkit.api.storage.set(list.modId, KEY_CATEGORY, list.getCategory());
    } catch (err) {
        console.warn("[picker-overlay] could not persist selection", err);
    }
}
