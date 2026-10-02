import { LOG, type ModConfig } from "../constants.ts";
import { configStore } from "../config/store.ts";
import { registerElements } from "./core/elements.ts";
import { registerStructures } from "./core/structures.ts";
import { registerTerrains } from "./core/terrains.ts";
import { registerTheRest } from "./the-rest.ts";
import { installElementPickerVisibility } from "./core/element-picker.ts";
import { closeBootWindow } from "./registry.ts";

export interface RegisterCounts {
    elements: number;
    structures: number;
    terrains: number;
    rest: Record<string, number>;
    hiddenElements: number;
}

export function registerAll(cfg?: ModConfig): RegisterCounts {
    const config = cfg ?? configStore.load();
    const counts: RegisterCounts = {
        elements: registerElements(config),
        structures: registerStructures(config),
        terrains: registerTerrains(config),
        rest: registerTheRest(config),
        hiddenElements: installElementPickerVisibility(),
    };
    closeBootWindow();
    console.log(
        `${LOG} registered: el${counts.elements} st${counts.structures} ` +
            `te${counts.terrains} hidden${counts.hiddenElements} ` +
            Object.entries(counts.rest).map(([k, v]) => `${k}${v}`).join(" "),
    );
    return counts;
}
