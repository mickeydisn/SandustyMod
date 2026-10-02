import { LOG, type ModConfig } from "../constants.ts";
import { configStore } from "../config/store.ts";
import { registerTerrain } from "../packages/registrations.ts";
import { ProcessRegistry, setProcessRegistry } from "../handler/custom-process/index.ts";
import { registerTheRest } from "./categories.ts";
import { installElementPickerVisibility } from "./core/element-picker.ts";
import { registerElements } from "./core/elements.ts";
import { registerStructures } from "./core/structures.ts";
import { closeBootWindow, registerEach } from "./registry.ts";

export interface RegisterCounts {
    elements: number;
    structures: number;
    terrains: number;
    rest: Record<string, number>;
    hiddenElements: number;
}

export function registerAll(cfg?: ModConfig): RegisterCounts {
    const config = cfg ?? configStore.load();

    
    
    const processes = new ProcessRegistry(config.processes ?? []);
    setProcessRegistry(processes);

    const counts: RegisterCounts = {
        elements: registerElements(config),
        structures: registerStructures(config),
        terrains: registerEach(config.terrains, "terrains", (t) => registerTerrain(t))[1],
        rest: registerTheRest(config, processes),
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
