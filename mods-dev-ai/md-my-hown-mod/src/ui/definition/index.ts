
import { behaviorDefinition } from "./core/behavior.ts";
import { bufferDefinition } from "./custom/buffer.ts";
import { contactDefinition } from "./core/contact.ts";
import { elementDefinition } from "./core/element.ts";
import { energyDefinition } from "./core/energy.ts";
import { excavationDefinition } from "./core/excavation.ts";
import { inputDefinition } from "./core/input.ts";
import { interactionDefinition } from "./core/interaction.ts";
import { itemDefinition } from "./core/item.ts";
import { modifierDefinition } from "./core/modifier.ts";
import { processingDefinition } from "./core/processing.ts";
import { placementConfigDefinition } from "./core/placement.ts";
import { projectileDefinition } from "./core/projectile.ts";
import { recipeDefinition } from "./core/recipe.ts";
import { signalDefinition } from "./core/signal.ts";
import { spriteDefinition } from "./core/sprite.ts";
import { structureDefinition } from "./core/structure.ts";
import { techDefinition } from "./core/tech.ts";
import { terrainDefinition } from "./core/terrain.ts";
import { triggerDefinition } from "./core/trigger.ts";
import { upgradeDefinition } from "./core/upgrade.ts";
import { upgradeCategoryDefinition } from "./core/upgrade-category.ts";
import { customProcessDefinition } from "./custom/process.ts";
import { networkDefinition } from "./custom/network.ts";
import { unlockNodeDefinition } from "./custom/unlock-node.ts";
import type { Definition, Tab } from "./types.ts";


export const DEFINITIONS: Partial<Record<Tab, Definition>> = {
    behaviors: behaviorDefinition,
    placementConfigs: placementConfigDefinition,
    buffers: bufferDefinition,
    customProcess: customProcessDefinition,
    categories: upgradeCategoryDefinition,
    contacts: contactDefinition,
    elements: elementDefinition,
    energy: energyDefinition,
    excavation: excavationDefinition,
    inputs: inputDefinition,
    interactions: interactionDefinition,
    items: itemDefinition,
    modifiers: modifierDefinition,
    networks: networkDefinition,
    processing: processingDefinition,
    projectiles: projectileDefinition,
    recipes: recipeDefinition,
    signals: signalDefinition,
    sprites: spriteDefinition,
    structures: structureDefinition,
    techs: techDefinition,
    terrains: terrainDefinition,
    triggers: triggerDefinition,
    unlockNodes: unlockNodeDefinition,
    upgrades: upgradeDefinition,
};


export function definitionFor(cat: Tab): Definition | undefined {
    return DEFINITIONS[cat];
}
