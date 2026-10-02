import { LOG, type ModConfig } from "../constants.ts";
import { configStore } from "../config/store.ts";
import { ProcessRegistry, setProcessRegistry } from "../handler/processing/custom-process/index.ts";
import { closeBootWindow, type RegisterContext } from "./registry.ts";

import { registerElements } from "./core/elements.ts";
import { installElementPickerVisibility } from "./core/element-picker.ts";
import { registerStructures } from "./core/structures.ts";
import { registerTerrains } from "./core/terrains.ts";
import { registerSprites } from "./core/sprites.ts";
import { registerItems } from "./core/items.ts";
import { registerRecipes } from "./core/recipes.ts";
import { registerProcessing } from "./core/processing.ts";
import { registerContacts } from "./core/contacts.ts";
import { registerInteractions } from "./core/interactions.ts";
import { registerTechs } from "./core/techs.ts";
import { registerUpgradeCategories, registerUpgrades } from "./core/upgrades.ts";
import { registerProjectiles } from "./core/projectiles.ts";
import { registerEnergyTypes, registerExcavationProfiles } from "./core/energy.ts";
import { registerStructureBehaviors } from "./core/structure-behaviors.ts";
import { registerPlacementConfigs } from "./core/placement-configs.ts";
import { registerSignals, registerTriggers } from "./core/schedules.ts";
import { registerInputBindings } from "./core/input-bindings.ts";

import { registerModifiers } from "./custom/modifiers.ts";
import { reportEnergyNetworks } from "./custom/energy-networks.ts";
import { installPlacementLimits } from "./core/placement-limits.ts";


type Step = (ctx: RegisterContext) => number;


const STEPS: readonly [name: string, step: Step][] = [
    ["elements", registerElements],
    ["structures", registerStructures],
    ["terrains", registerTerrains],
    ["sprites", registerSprites],
    ["items", registerItems],
    ["recipes", registerRecipes],
    ["processing", registerProcessing],
    ["contacts", registerContacts],
    ["interactions", registerInteractions],
    ["modifiers", registerModifiers],
    ["techs", registerTechs],
    ["upgradeCategories", registerUpgradeCategories],
    ["upgrades", registerUpgrades],
    ["projectiles", registerProjectiles],
    ["energyTypes", registerEnergyTypes],
    ["energyNetworks", reportEnergyNetworks],
    ["placementLimits", installPlacementLimits],
    ["excavationProfiles", registerExcavationProfiles],
    ["structureBehaviors", registerStructureBehaviors],
    ["placementConfigs", registerPlacementConfigs],
    ["signals", registerSignals],
    ["triggers", registerTriggers],
    ["inputBindings", registerInputBindings],
];

export interface RegisterCounts {
    
    steps: Record<string, number>;
    
    hiddenElements: number;
}

export function registerAll(cfg?: ModConfig): RegisterCounts {
    const config = cfg ?? configStore.load();

    const processes = new ProcessRegistry(config.processes ?? []);
    setProcessRegistry(processes);
    const ctx: RegisterContext = { config, processes };

    const steps: Record<string, number> = {};
    let total = 0;
    for (const [name, step] of STEPS) {
        const n = step(ctx);
        steps[name] = n;
        total += n;
    }

    const hiddenElements = installElementPickerVisibility();
    closeBootWindow();

    console.log(
        `${LOG} registered ${total} entries across ${STEPS.length} steps ` +
            `(hidden ${hiddenElements} element(s)): ` +
            Object.entries(steps).map(([k, v]) => `${k}=${v}`).join(" "),
    );

    return { steps, hiddenElements };
}
